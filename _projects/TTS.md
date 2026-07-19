---
layout: page
title: TTS
description: local voice-cloning & automated lecture-video pipeline
img: assets/img/TTS_image.jpg
importance: 1
category: completed
tags: [Python, TTS, ML, voice cloning]
---

> "Speak the speech, I pray you, [...] trippingly on the tongue; [...] nor do not saw the air too much with your hand, thus, but use all gently."
>
> — *Hamlet*, III.ii

## TL;DR

I built a fully local pipeline that takes Jupyter notebooks and produces synchronized lecture videos: TTS audio narrated by a fine-tuned clone of my own voice, recorded against an automated JupyterLab session driven by Playwright and the Jupyter kernel WebSocket protocol. Ten numbered scripts, no external API calls at run time. The only externally-hosted piece is the LLM I use offline to draft the lecture scripts, which sits upstream of the pipeline rather than inside it.

This post is about the architecture and the decisions behind it, including the ones I got wrong the first time.

One thing I owe you up front: there are no audio samples here. A post about voice cloning without a clip of the cloned voice is an obvious gap, and I know it. But publishing thirty seconds of my voice next to a description of how to clone it seemed like a bad trade, so section 4 carries the evidence in numbers instead. Judge the work on those.

---

## 1. Constraints First

Four constraints drove every architectural decision here. I list them first because otherwise some of the choices below look arbitrary, or worse, look like overengineering.

**Privacy.** Voice cloning means uploading a substantial amount of your own audio to someone else's servers. ElevenLabs, Azure Custom Neural Voice and the rest process that audio on infrastructure I do not control, under terms of service that do not clearly commit to deleting it. In my case the voice samples *are* the lecture content, so the same channel would carry both. I was not comfortable with that. Everything runs locally.

**Cost at scale.** Sixty-seven classes at roughly 30 minutes each is about 33 hours of synthesized speech. And re-synthesizing a class after editing its script is not an edge case, it is a weekly operation. Per-character cloud pricing turns that into a bill that grows every time I fix a typo. Locally, the marginal cost of re-synthesis is electricity.

**Hardware.** I train and infer on an NVIDIA RTX 4060 with 8 GB of VRAM. XTTS v2 has around 500 million parameters, and a naive fine-tuning setup does not come close to fitting. This constraint shaped every training decision in section 4, and not always in ways I liked.

**Reproducibility.** Same script, same checkpoint, same audio and same timestamps. This rules out any unseeded stochastic post-processing, and it drove how timestamps get generated (section 7).

---

## 2. Pipeline Overview and details

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/TTS/final_diagram.png" class="img-fluid rounded z-depth-1" %}
    </div>
</div>

*End-to-end pipeline. Voice-model training (blue), script generation & TTS (green) and notebook recording (orange) run in parallel and converge at the merge step (`10`) that produces each lecture video.*

Ten numbered scripts, each with one input and one output. I built it this way deliberately, and it paid off exactly once, but that once was worth it: when script `09` turned out to be built on a broken assumption, I rewrote it without touching the model, the scripts, or the synthesis.

| Script | Input | Output |
|---|---|---|
| `01_segment_audio.py` | raw recordings | 3–10s clips (WAV) |
| `02_transcribe.py` | clips | (audio, transcript) pairs |
| `03_build_dataset.py` | pairs | XTTS-compatible dataset |
| `04_train.py` | dataset + base checkpoint | fine-tuned model |
| `05_synthesize.py` | text | WAV (generic synthesis) |
| `06_synthesize_lecture.py` | script + model | lecture.wav + clase_XX_sync.json |
| `07_measure_cell_times.py` | notebook | cell_timings/clase_XX_timings.json |
| `08_build_timing_manifest.py` | sync.json + cell_timings | timing_manifest.json |
| `09b_record_notebook.py` | manifest + notebook | screen recording (MP4) |
| `10_merge_video.py` | recording + lecture.wav | final video (MP4) |

The numbering hides one thing worth spelling out: `07` has to run before `06`, and nothing in the table tells you why.

`07` is the script that executes the notebook, which makes it the script that knows each cell's *type* — code or markdown. `06` needs that map, because its event stream scrolls to every cell but only executes the code ones. Without the map it cannot label the events, so it gives up on sync generation entirely and writes a plain WAV with no `clase_XX_sync.json`. `08` then finds no sync file and falls back to character-count estimates, which are worse. So `07 → 06 → 08` is a hard dependency, and the coupling runs through cell-type metadata rather than through timestamps, which is the opposite of what the script names suggest.

```
07_cell_times → 06_synthesize → clase_XX_sync.json → 08_build_manifest → 09b_record → 10_merge
```

---

## 3. Dataset Construction (Scripts 01–03)

The source audio is about 22 hours: mostly lecture recordings from an earlier iteration of the course, plus readings of assorted text and some informal recordings. I added the second category on purpose. Training exclusively on academic lecture audio produces a model that only knows how to lecture, and I wanted it to handle register variation without falling apart.

**Segmentation.** Script `01_segment_audio.py` runs a VAD model to find speech-active segments and cuts them into 3–10 second clips. Anything under 3 seconds gets discarded, since it carries too little phonetic context for XTTS to learn from. Anything over 10 gets re-split at sentence boundaries, using the VAD's own confidence scores to find them.

**Transcription.** Script `02_transcribe.py` runs Whisper over each clip and writes a metadata JSON with the file path and the transcript. These (audio, text) pairs are the raw material for training.

**Dataset construction.** Script `03_build_dataset.py` validates and filters the pairs, splits train/eval, and writes the metadata CSVs the XTTS trainer expects.

What comes out is roughly 8,000 pairs. By pretraining standards that is small, and the rest of section 4 is largely about working around how small it is.

---

## 4. Fine-Tuning XTTS v2 Under Memory Constraints (Script 04)

### The memory budget

XTTS v2 in FP32 needs about 2 GB just to hold its parameters. The backward pass then has to store intermediate activations for gradient computation, and activation memory scales with sequence length and batch size — for 3–10 second clips at 22kHz, that easily triples the footprint. 8 GB does not accommodate it.

Four techniques got it to fit, each attacking a different part of the problem:

```python
trainer = XttsTrainer(
    model=model,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
    output_path=output_dir,
    epochs=20,
    batch_size=1,
    grad_accum_steps=16,
    lr=3e-6,
    fp16=True,
    gradient_checkpointing=True,
)
```

**`fp16=True`** halves activation memory by storing activations as 16-bit floats. Master weights stay in FP32 for numerical stability during the update; only forward and backward activations drop to FP16. In practice this bought me about 1.5 GB.

**`batch_size=1`** was forced on me. A batch of 2 with 3–10s sequences blows the budget. Single-sample gradient estimates are noisy, which is what the next setting is for.

**`grad_accum_steps=16`** simulates an effective batch of 16 without ever materializing 16 samples. Gradients accumulate over 16 forward passes before one weight update, so the update sees a mean gradient with much lower variance than a single sample would give. Memory cost stays at one sample; the optimization dynamics approximate a batch of 16.

**`gradient_checkpointing=True`** trades compute for memory. Instead of storing every intermediate activation for the backward pass, it discards most of them and recomputes them on demand, dropping activation memory from `O(n)` to `O(√n)` in the number of layers. The price is 30–40% longer epochs. Since inference is fast and I retrain rarely, I took that trade without much hesitation.

All four together: peak VRAM around 5.9 GB, average around 4–4.5 GB. It fits, with a margin thin enough that I stopped opening other applications while training.

### Learning rate and catastrophic forgetting

My first run used `lr=1e-5`. The result was worse than the base checkpoint I started from — more robotic, and noticeably degraded on sentences outside the training distribution. That was a discouraging way to spend six hours.

The failure mode is well documented: on a small dataset, too high a learning rate lets the model overwrite the well-calibrated weight distributions it acquired during pretraining in order to fit the idiosyncrasies of my 8,000 clips. It does not memorize my examples so much as it corrodes its own general phonetic representations.

The second run used `lr=3e-6`:

```yaml
training:
  base_checkpoint: "models/checkpoints/best_model_mar07.pth"
  epochs: 20
  lr: 3.0e-6
  batch_size: 1
  grad_accum_steps: 16
  fp16: true
  gradient_checkpointing: true
  save_n_checkpoints: 3
  eval_every_n_steps: 500
```

This one worked. The model picked up the timbre and the cadence without losing its handling of phonetic patterns it had never seen from me.

One operational note on `save_n_checkpoints: 3`. XTTS checkpoints run about 1.8 GB each, so keeping all of them across 20 epochs is not realistic. The trainer always saves `best_model` (lowest eval loss) separately from the rolling window, which matters if you ever resume: start from `best_model`, not from the most recent checkpoint, because the most recent one may sit at a worse point on the loss curve.

### Gibberish artifact and top_p

The fine-tuned model puts noise at the end of some sentences — a 0.3–0.5 second burst of tokens that sound like nothing. My best explanation is XTTS's default `top_p=0.95`, which permits sampling from the tail of the token distribution. In a model pretrained on large diverse data that tail is well-calibrated. In a fine-tune on 8,000 clips, parts of it probably are not.

Dropping to `top_p=0.85` across all synthesis presets makes the artifact rarer without any quality cost I can hear. It mitigates the problem; it does not solve it. The artifact still shows up. A real fix would need more training data, or checkpoint selection driven by a perceptual quality metric like UTMOS instead of eval loss.

### How the model was actually evaluated

Every quality claim above (that the second run was better, that the artifact became rarer, that the voice carries the right cadence) rests on listening, so what about real metrics?

The numbers that do exist make the point better than the adjectives do. The two runs' best eval losses were **4.347** (run 1, `lr=1e-5`, at step 1665) and **4.328** (run 2, `lr=3e-6`, at step 3330) — a gap of about 0.02 on a quantity that is almost entirely mel cross-entropy, since the text cross-entropy term had already collapsed below 0.001 in both runs. By the only number the trainer produced, the two models are nearly indistinguishable. By ear they were not: run 2 was clearly the one worth keeping. A 0.02 difference in eval loss carrying an audible difference in quality is precisely why the rest of this section is written in adjectives rather than metrics.

The checkpoint that shipped is `best_model` at step 3330, which is **epoch 10 of the 20-epoch run** (the dataset yields 333 optimizer steps per epoch). Eval loss never improved on that value across the remaining ten epochs — it oscillated between 4.329 and 4.333 — so the second half of the run bought nothing the metric could see. There is also a structural reason the metric was blind: the eval split is drawn from the same recordings as the training split, so it only measures in-distribution reconstruction. The failure mode that motivated lowering the learning rate — degraded prosody on sentences *outside* the training distribution — is exactly what an in-distribution eval set cannot detect. The metric went down while, on out-of-distribution text, the earlier run had gotten worse.

The one number I do not have is the artifact rate. The claim that `top_p=0.85` makes the end-of-utterance noise rarer than `top_p=0.95` was never turned into a count over a fixed sentence set; it rests on repeated listening during synthesis, not on a measurement. I report it as a qualitative observation because that is all it is.

So eval loss was the only automatic signal I had, and it is a bad proxy for perceived quality — I found checkpoints with marginally worse loss that sounded better. Selection came down to sitting and listening, which does not scale and is not reproducible from one session to the next. Replacing that with an objective perceptual metric is the second item in section 12.

---

## 5. The Script Format as a System Interface (Scripts 05 and 06)

Two scripts consume the text format described here:

- `05_synthesize.py` is the generic tool: give it a text file and a checkpoint, get a WAV. No awareness of section types. I use it for quick tests and development.
- `06_synthesize_lecture.py` is the production tool: section-based prosody control, batch processing across all 67 classes, YAML-driven reference audio, and inline timestamp generation.

Everything that ships goes through `06`.

The format is the contract between the LLM that drafts the content and the synthesizer that speaks it. Specify that contract badly and the errors surface during playback, which is the most expensive possible place to find them — you have already spent the GPU time.

### Format selection

JSON was my first candidate:

```json
{
  "cells": [
    {
      "cell_id": 1,
      "sections": [
        {"type": "explanation", "text": "En esta celda...", "pause_after": 0.5}
      ]
    }
  ]
}
```

I rejected it. Writing the parser would have been trivial; the bottleneck was never parsing, it was editing. A script for a 30-minute class runs 1,500–4,000 words, and reviewing that much prose through a fog of brackets, quotes and commas is slower and more error-prone than reading plain text. Scripts also get edited repeatedly: after generation, after QA, and again after listening to the audio. Any friction there gets multiplied by three.

What I use instead is plain text with bracket markers:

```
[introduction]
Bienvenidos a la clase 8. Hoy vamos a trabajar con arrays de NumPy.

[cell:0]
[explanation]
Esta primera celda importa NumPy con el alias np. Es una convención
universalmente adoptada en el ecosistema científico de Python.
[pause 0.5s]

[cell:1]
[key_point]
La función np.array convierte una lista de Python en un array de NumPy.
La diferencia no es solo de nombre: un array soporta operaciones
vectorizadas que una lista no puede hacer.
[pause 1.0s]
```

The bracket markers borrow from stage directions. A direction like `[aside]` or `[enter stage left]` annotates a script without being part of the dialogue: the actor reads it, interprets it, and then speaks without it. The synthesizer does the same thing — it reads `[key_point]`, picks the matching reference clip and synthesis parameters, and speaks the text that follows. When Hamlet tells the players to speak the speech trippingly on the tongue, he is giving them what these markers give the synthesizer: instructions for how to read the words, not words to read.

### Section types and synthesis presets

Twelve section types: `introduction`, `key_point`, `explanation`, `example`, `question`, `transition`, `conclusion`, `definition`, `warning`, `summary`, `aside`, `quote`. Each maps to a `StylePreset` in `lecture_synthesizer.py` specifying temperature and speed:

| Section type | Temperature | Speed | Character |
|---|---|---|---|
| `introduction` | 0.69 | 1.00 | Warm, welcoming opening |
| `key_point` | 0.73 | 1.05 | Animated, emphatic |
| `explanation` | 0.66 | 1.05 | Calm, measured (default) |
| `example` | 0.68 | 1.05 | Illustrative, engaging |
| `question` | 0.71 | 1.00 | Questioning, interactive |
| `transition` | 0.62 | 1.05 | Brief transitions |
| `conclusion` | 0.65 | 0.98 | Slower, summarizing |
| `definition` | 0.62 | 0.98 | Formal, precise |
| `warning` | 0.70 | 1.00 | Important caveats, emphatic |
| `summary` | 0.65 | 1.00 | Mid-lecture recaps |
| `aside` | 0.67 | 1.05 | Tangential, conversational |
| `quote` | 0.62 | 0.98 | Citations, precise delivery |

These live in code and are not exposed in the config. What the config does control is the reference audio — each section type can point at a different short clip from the training set:

```yaml
# lecture_synthesis_config.yaml
default_reference: "data/segments_new/new_2_seg0013.wav"

style_references:
  introduction: "data/segments_new/new_2_seg0000.wav"
  key_point:    "data/segments_new/new_3_seg0088.wav"
  explanation:  "data/segments_new/new_2_seg0013.wav"
  example:      "data/segments_new/new_2_seg0106.wav"
  question:     "data/segments_new/new_3_seg0006.wav"
  transition:   "data/segments_new/new_2_seg0030.wav"
  conclusion:   "data/segments_new/new_3_seg0135.wav"
  definition:   "data/segments_new/new_3_seg0014.wav"
  warning:      "data/segments_new/new_2_seg0114.wav"
  summary:      "data/segments_new/new_1_seg0066.wav"
  aside:        "data/segments_new/new_1_seg0015.wav"
  quote:        "data/segments_new/new_2_seg0013.wav"
```

This works because XTTS v2 is zero-shot: at inference it conditions on a short reference clip to fix the speaker's characteristics. Feed it different clips for different section types and the delivery changes audibly — slower and more deliberate for `key_point`, natural pace for `explanation`, a slight shift in register for `warning`. Same model underneath, modulated by the reference.

Picking those twelve clips took an afternoon of listening through the training segments looking for moments where my own delivery happened to match the character I wanted. It is the least sophisticated part of the system and one of the most effective.

### The parser

```python
def parse_script(path: str) -> list[Block]:
    blocks = []
    current_type = None
    current_lines = []

    for line in open(path, encoding='utf-8'):
        line = line.rstrip()

        if m := re.match(r'\[cell:(\d+)\]', line):
            if current_lines:
                blocks.append(SectionBlock(current_type, ' '.join(current_lines)))
                current_lines = []
            blocks.append(CellMarker(int(m.group(1))))

        elif m := re.match(r'\[pause ([\d.]+)s\]', line):
            if current_lines:
                blocks.append(SectionBlock(current_type, ' '.join(current_lines)))
                current_lines = []
            blocks.append(PauseMarker(int(float(m.group(1)) * 1000)))

        elif m := re.match(r'\[(\w+)\]', line):
            if current_lines:
                blocks.append(SectionBlock(current_type, ' '.join(current_lines)))
                current_lines = []
            current_type = m.group(1)

        elif line:
            current_lines.append(line)

    if current_lines:
        blocks.append(SectionBlock(current_type, ' '.join(current_lines)))

    return blocks
```

I kept the parser deliberately dumb. A malformed marker produces a block with an unrecognized type, which is trivial to detect and report — no silent failure, no corrupted parse state. A richer format would need a defensive parser, and that is more code to maintain and test for a benefit I could not identify.

### LLM-assisted generation

Writing 67 lecture scripts by hand was never on the table. The workflow:

1. Read the notebook: cells, markdown, code, structure.
2. Build a conceptual map — what the class teaches, in what order, which common errors to flag.
3. Review that map myself, before any script exists, to check the topics are the right ones and in the right sequence.
4. Pass the map to the LLM along with the format specification.
5. Review the output, fix errors, run QA (next section).

Step 3 is the one I would defend hardest. Reviewing a conceptual map takes minutes; reviewing a finished 3,000-word script that was built on a wrong premise takes an hour and usually ends in regeneration.

The LLM gets explicit instructions about format, section type usage, sentence length limits, and what to keep out: raw code literals, LaTeX syntax, Python variable names used as-is. That cut my post-generation editing substantially, though not to zero.

---

## 6. Pre-Synthesis QA (check_tts_problems.py)

Synthesizing a 30-minute class costs 20–45 minutes of GPU time. Finding a formatting problem afterwards means paying that twice. The QA script reads every lecture script before synthesis and reports 18 categories of problem.

### Severity model

```python
CHECKS = [
    # HIGH: block synthesis until resolved
    CheckLongSentences(max_chars=239),
    CheckKeyboardShortcuts(),
    CheckAmpersand(),
    CheckMathOperators(),

    # MEDIUM: require explicit decision before proceeding
    CheckTechAbbreviations(),
    CheckPythonLiterals(),
    CheckUrlsInText(),
    CheckUnexpandedAcronyms(),

    # LOW: logged, can proceed
    CheckDecimalPoints(),
    CheckEllipsis(),
    CheckMixedNumberFormats(),
    # ... 7 more
]
```

`HIGH` blocks synthesis. `MEDIUM` requires me to acknowledge it explicitly before proceeding. `LOW` gets logged and can wait. The split is operational: a `HIGH` problem yields broken audio — truncated sentences, artifact bursts, silence where speech should be. A `LOW` problem yields audio that is merely worse than it could be.

### Long sentence detection

XTTS v2 truncates at roughly 239 characters per input sentence in Spanish. Silently. It stops synthesizing mid-sentence and logs nothing at all.

I found this the expensive way, after synthesizing 20 classes and noticing sentences that simply stopped.

The limit is not documented anywhere, and it comes from the tokenizer: Spanish tokenizes less efficiently than English under XTTS's vocabulary, so a Spanish sentence around 239 characters is already brushing against the maximum token sequence length the encoder saw in training. The character count is a proxy for a token count, which is why the threshold is approximate.

QA flags anything over 200 characters, leaving margin. The generation instructions carry the same rule, so most of these get caught before QA ever sees them.

### Keyboard shortcut expansion

The model reads `Ctrl+C` as "control más ce". Correct Spanish, but no narrator says that. Every script uses "Control C" instead, and the check flags the pattern with a suggested expansion:

```python
def check_keyboard_shortcuts(text: str) -> list[Issue]:
    issues = []
    pattern = re.compile(r'\b(Ctrl|Alt|Shift|Win|Cmd)\+\w+')
    for m in pattern.finditer(text):
        issues.append(Issue(
            severity='HIGH',
            category='keyboard_shortcut',
            text=m.group(),
            line=text[:m.start()].count('\n') + 1,
            suggestion=m.group().replace('+', ' ')
        ))
    return issues
```

Where `+` shows up as an arithmetic operator in the same block, I review it by hand.

### Python literals in narrative text

Leave `"the list [1, 2, 3]"` in a script and the model may read the punctuation aloud: "corchete uno coma dos coma tres corchete". The rule is that code literals get verbalized before they reach narrative text — "the list with values one, two, and three". The check looks for anything resembling a Python container, function call or assignment appearing outside a `[code_walkthrough]` section.

---

## 7. Synthesis with Inline Timestamps (Script 06)

### The synchronization problem

The audio comes first. The screen recording is a separate process that runs afterwards, driven by a manifest telling it when to execute each notebook cell. So the manifest has to know, for every cell, the second in the audio where its narration starts.

There are two ways to get that.

**Option A: post-hoc forced alignment.** Generate the audio, then run WhisperX or the Montreal Forced Aligner over the WAV to find precisely when each phrase was spoken, and pull timestamps from the cell transition phrases.

**Option B: inline timestamp accumulation.** During synthesis, keep a running offset counter. Every time the synthesizer hits a `[cell:N]` marker, record `current_offset_s` as that cell's timestamp.

Option A is more accurate — WhisperX gets you to ±0.05s. Option B drifts, because small numerical errors in silence durations accumulate over a long class, and lands around ±1–2s over 30 minutes.

I went with B anyway, and the reason has nothing to do with accuracy.

Option A introduces a mandatory second step. After every synthesis, alignment has to run again before the manifest is current. Edit a script, re-synthesize, forget to re-align, and the manifest quietly uses stale timestamps — no error, just a video that drifts. Across 67 classes that get re-synthesized individually and often, I did not trust myself to never forget. Option B cannot desynchronize, because the timestamps and the audio come out of the same function call.

About that ±1–2s: it accumulates from the silence durations and from the fact that `current_offset_s` counts audio samples while the screen recorder runs on its own clock. For a student watching a narrator explain code that is already on screen, I have never found it noticeable. If the target were conference-quality video, or anything where the drift starts to distract, Option A would be the right call — which is why it is still on the roadmap rather than dismissed.

Here is what the synthesis loop actually does:

```python
def synthesize_lecture_with_sync(script_path, model, config, clase_id, cell_types):
    blocks = parse_script(script_path)
    audio_chunks = []
    events = []
    current_offset_s = 0.0

    # emit / emit_silence append to audio_chunks and advance current_offset_s
    # by the duration appended. Elided here; they are bookkeeping.

    for block in blocks:

        if isinstance(block, CellMarker):
            # cell_types is script 07's output: {cell_index: "code" | "markdown"}.
            # Scroll to every cell; execute only the code cells.
            events.append({"t": current_offset_s, "action": "scroll", "cell": block.cell_id})
            if cell_types.get(block.cell_id) == "code":
                events.append({"t": current_offset_s, "action": "execute", "cell": block.cell_id})
            continue

        if isinstance(block, PauseMarker):
            emit_silence(audio_chunks, block.duration_ms)
            continue

        preset = config.get_preset(block.section_type)
        chunks = split_into_chunks(block.text, max_chars=239)

        for chunk in chunks:
            audio = model.synthesize(
                text=chunk, language="es",
                temperature=preset.temperature, speed=preset.speed,
                top_p=preset.top_p, speaker_wav=preset.reference_audio,
            )
            emit(audio_chunks, audio, len(audio) / model.sample_rate)
            emit_silence(audio_chunks, preset.inter_chunk_silence_ms)

        emit_silence(audio_chunks, preset.post_section_silence_ms)

    wav = concatenate_with_crossfade(audio_chunks, crossfade_ms=20)
    sync_data = {"clase": clase_id, "duration_s": current_offset_s, "events": events}
    return wav, sync_data
```

Two details in there took me longer to get right than they should have.

The first is placement. The `scroll` event — and the `execute` event for code cells — is emitted when the iterator reaches the `CellMarker`, *before* synthesizing that cell's content. At that moment `current_offset_s` holds the exact audio duration up to where the narration of that cell begins. Record it after synthesizing the content instead and the video scrolls to the cell while the narrator is already halfway through explaining it. I know because that is what my first version did.

The second is `cell_types`, the only thing `06` takes from `07`. It is the `{cell_index: "code" | "markdown"}` map that lets the synthesizer decide which cells get an execute event. When `07` has not run, the map is empty, `06` cannot build a well-formed event stream, and it declines to write a sync file at all. That is the hard dependency from sections 2 and 8, and it lives entirely in this one argument.

### Determinism

`current_offset_s` is a deterministic function of the script and the model. Same script, same checkpoint, same sequence of audio chunks with the same durations, therefore the same timestamps. Re-synthesizing after an edit produces valid timestamps with no extra step.

The flip side: timestamps are useless as a debugging signal for "did the synthesis change", since they change if and only if the script or the model changed.

### Chunking for the 239-character limit

`split_into_chunks` uses a priority hierarchy of cut points:

```python
def split_into_chunks(text: str, max_chars: int = 239) -> list[str]:
    if len(text) <= max_chars:
        return [text]

    for separator in ['. ', '; ', ', ', ' ']:
        idx = text.rfind(separator, 0, max_chars)
        if idx != -1:
            head = text[:idx + len(separator)].strip()
            tail = text[idx + len(separator):].strip()
            return [head] + split_into_chunks(tail, max_chars)

    return [text[:max_chars]] + split_into_chunks(text[max_chars:], max_chars)
```

The order `. ` > `; ` > `, ` > ` ` is about prosody, not about tidiness. Cut at a period and XTTS receives a complete sentence, so it generates correct end-of-sentence intonation — the falling contour Spanish declaratives need. Cut at a comma and it receives an incomplete clause, so it synthesizes with continuation prosody and the audio sounds like it is waiting for the rest of the sentence to arrive. Cutting at a space is a last resort that should never fire in a well-formed script, since the generation instructions and the QA check both cap sentences at 200 characters.

`rfind` searches from the right, which maximizes chunk size, which minimizes the number of inter-chunk silences and how fragmented the prosody ends up sounding.

---

## 8. Cell Types and the Timing Manifest (Scripts 07 + 08)

Script `07_measure_cell_times.py` executes each notebook in a clean kernel and writes one JSON per class. Per cell it records the index, the type, a source preview, an error flag, and the wall-clock execution time — for code cells, taken from the notebook's `metadata["execution"]` timestamps, as the interval between `iopub.execute_input` and `iopub.status.idle`. Plus a top-level `total_time_s`.

```json
{
  "clase": 8,
  "total_time_s": 7.17,
  "cells": [
    {"index": 0, "type": "code",     "execution_time_s": 0.12, "error": null},
    {"index": 1, "type": "markdown", "execution_time_s": null, "error": null},
    {"index": 2, "type": "code",     "execution_time_s": 2.34, "error": null},
    {"index": 3, "type": "code",     "execution_time_s": 4.71, "error": null}
  ]
}
```

Of everything in that file, exactly one field gets consumed downstream: `type`. `08`'s only read of `07`'s output is a single dictionary comprehension, `{c["index"]: c["type"] for c in data["cells"]}`, and `06` uses the same map to decide which cells get an execute event (section 7). `execution_time_s` and `total_time_s` are never read by anything.

I want to be explicit about that, because the script is called `measure_cell_times` and the natural assumption — mine included, for a while — is that the measured durations drive how long the recording waits on each cell. They do not. They survive as diagnostics, and they are genuinely useful ones: noticing that a cell in class 12 takes forty seconds is a pedagogical problem worth knowing about. But nothing in the pipeline reads them.

Script `08_build_timing_manifest.py` has two paths. When `clase_XX_sync.json` exists, it copies `06`'s event stream into the manifest essentially verbatim, timestamps and all. When it does not, `08` reconstructs an estimated timeline from the script itself: `pause_s` comes from the `[pause Xs]` markers in the guion, and the gap between a cell's scroll and its execute is a hard-coded `EXECUTE_OFFSET_S = 0.5`. No measured duration enters either path.

```json
{
  "clase": 8,
  "events": [
    {"t": 8.4,  "action": "scroll",  "cell": 0},
    {"t": 8.4,  "action": "execute", "cell": 0},
    {"t": 47.8, "action": "scroll",  "cell": 1},
    {"t": 47.8, "action": "execute", "cell": 1},
    ...
  ]
}
```

Notice there is no `wait_for_output` event. Waiting for a cell to finish is not scheduled in advance at all — `09b` handles it at record time by blocking on the kernel's `execute_reply` message over the WebSocket (section 9). A real signal from the kernel beats a precomputed guess, especially when the machine is under load, and that is ultimately why measuring execution times up front turned out to be unnecessary.

So the `t` values come from `clase_XX_sync.json` whenever it exists, and they are exact. It is missing only when `06` ran without `07`'s cell-type map, in which case `06` silently declines to emit a sync file (section 7) and `08` falls back to character-count estimation. The `07 → 06 → 08` ordering exists to keep that fallback from ever firing in normal operation.

---

## 9. Screen Recording: When the Browser API Lies (Script 09b)

### The failed approach

My original recording script (`09_record_notebook.py`) drove JupyterLab from inside the browser, through the `window.jupyterapp` JavaScript API:

```javascript
// Original approach - does NOT work in headless JupyterLab 4.5.4
await window.jupyterapp.commands.execute('notebook:run-cell');
```

In JupyterLab 4.5.4 running headless under Playwright, `window.jupyterapp` exists as an object, but its command handlers were never initialized. The call returns a resolved promise immediately and the cell does not execute. Nothing appears in the log. What you get is a perfectly recorded video of a notebook sitting there doing nothing.

This cost me most of a day, largely because the absence of any error made me look everywhere except at the API itself.

The cause is that JupyterLab's application lifecycle — the part that registers command handlers for kernel interaction — does not complete in headless mode. The frontend object is present and functionally hollow.

### The replacement approach (09b)

The replacement skips the frontend and talks to the Jupyter kernel directly over the WebSocket messaging protocol:

```python
async def execute_cell(session_id: str, kernel_id: str, cell_source: str) -> str:
    ws_url = f"ws://localhost:8888/api/kernels/{kernel_id}/channels"
    async with websockets.connect(ws_url) as ws:

        msg_id = str(uuid.uuid4())
        await ws.send(json.dumps({
            "header": {
                "msg_id": msg_id,
                "msg_type": "execute_request",
                "username": "", "session": session_id,
                "date": datetime.now().isoformat(), "version": "5.3"
            },
            "parent_header": {},
            "metadata": {},
            "content": {
                "code": cell_source,
                "silent": False,
                "store_history": True,
                "user_expressions": {},
                "allow_stdin": False
            },
            "buffers": [], "channel": "shell"
        }))

        while True:
            msg = json.loads(await ws.recv())
            if (msg.get("parent_header", {}).get("msg_id") == msg_id
                    and msg.get("msg_type") == "execute_reply"):
                return msg["content"]["status"]
```

The script opens a session through the REST API (`POST /api/sessions`), takes the kernel ID, connects a WebSocket to the kernel's channel endpoint, and sends `execute_request` messages straight to it. This is the same protocol VS Code's Jupyter extension uses, that the Jupyter client library uses, that every external kernel consumer uses. It does not care what state the frontend is in.

Playwright still does the recording: it opens Chromium pointed at the JupyterLab URL, records throughout the session, and scrolls to each cell at the right timestamp. Execution just moved server-side, out of the browser's JavaScript runtime.

The lesson I took from this is narrower than "avoid browser APIs". It is that browser-native APIs for large applications depend on the full application lifecycle completing, and headless mode makes no promise about that. Server-side interfaces are safer to automate against because they live outside that lifecycle entirely.

---

## 10. Video Assembly (Script 10)

Script `10_merge_video.py` reads the class metadata — specifically the browser startup duration that `09b` recorded — trims that pre-content initialization off the front of the screen recording, and merges what is left with the TTS audio:

```bash
ffmpeg \
  -ss {offset_s} -i screen_recording.mp4 \
  -i lecture.wav \
  -map 0:v -map 1:a \
  -c:v libx264 -crf 23 -preset medium \
  -c:a aac -b:a 128k \
  -shortest \
  video_final/clase_{XX}.mp4
```

Putting `-ss {offset_s}` before `-i` performs input seeking: FFmpeg positions the decoder at `offset_s` before it starts reading frames, rather than decoding from the beginning and throwing the result away. `-shortest` ends the output when the shorter stream does, which in practice is always the audio, since `09b` leaves a small buffer at the end of the recording.

H.264 and AAC for output, chosen entirely for compatibility. They play without setup on every platform and LMS my students might use, and after everything else in this pipeline I had no appetite for a codec problem.

---

## 11. What Did Not Work

Five things, each of which cost me time. Mechanics are in the sections noted.

**`window.jupyterapp` in headless mode** (section 9). Browser-native APIs for complex applications depend on the full application lifecycle completing, and headless mode does not guarantee it. Server-side APIs are safer to automate against.

**`lr=1e-5` for fine-tuning** (section 4). On a small dataset, an aggressive learning rate degrades a pretrained model's general capabilities in order to fit dataset idiosyncrasies. Conservative rates move the model toward the target voice without corroding its phonetic representations.

**JSON as the script format** (section 5). Rejected before implementation rather than failed in production. The primary consumer of the format is a human editor, and editing ergonomics beat parsing elegance when human editing is the bottleneck.

**Synthesizing before QA** (section 6). The 239-character truncation turned up in finished audio and cost me a re-synthesis of 20 classes. The QA pipeline exists because of that afternoon.

**Measuring cell execution times** (section 8). `07` computes a per-cell duration nothing reads. The design that needed it — precomputing how long the recording should wait on each cell — got replaced by blocking on `execute_reply`, which is simpler and correct under load. The measurement outlived its purpose, and the script name still advertises the original one.

---

## 12. Current State and Remaining Work

The pipeline is in production. Every class has been through it end to end.

The bottleneck now is editorial, and I do not want to automate it away. Reviewing 67 lecture scripts for pedagogical correctness, catching the places where the LLM stated something subtly wrong, checking that each script matches what the notebook actually does — that work exists whether or not the technical pipeline is good, and in a course it is the part that matters most.

Two technical improvements are worth the effort, in order of expected impact:

1. **WhisperX forced alignment** for sub-second timestamps (the trade-off is in section 7). It can go inside `06` as a post-synthesis step, which means the downstream pipeline is untouched and the coupling problem that ruled it out no longer applies.

2. **Perceptual checkpoint selection** with UTMOS or something similar, replacing the manual listening sessions from section 4. Automatic scoring would let me evaluate every checkpoint instead of the three or four I have patience for.

Both fit the current architecture without disturbing anything else, which is the one thing about the original design I would repeat without changes.

---

The code, inference modules, and sample scripts are available [on GitHub](https://github.com/manzisebastian/tts-lecture-pipeline).
