/* Hero notebook: a Jupyter-style block whose 2nd cell plots a live Argentine
 * macro series (BCRA / ArgentinaDatos), picked at random on every visit.
 * Falls back to a bundled snapshot if the API is slow or down. No dependencies. */
(function () {
  "use strict";

  const root = document.getElementById("hero-nb");
  if (!root) return;

  const SNAPSHOT_URL = root.dataset.snapshot;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TIMEOUT_MS = 4500;

  const SERIES = [
    {
      key: "reservas",
      src: "bcra",
      id: 1,
      days: 180,
      call: 'bcra.series("reservas", last="6M")',
      title: "International reserves",
      unit: "USD M",
      dec: 0,
      caption: "Gross international reserves, USD millions. Source: BCRA API",
    },
    {
      key: "mayorista",
      src: "bcra",
      id: 5,
      days: 180,
      call: 'bcra.series("tc_mayorista", last="6M")',
      title: "Wholesale FX rate",
      unit: "ARS/USD",
      dec: 1,
      caption: "Wholesale reference exchange rate (Com. A 3500). Source: BCRA API",
    },
    {
      key: "inflacion",
      src: "bcra",
      id: 27,
      days: 1100,
      call: 'bcra.series("inflacion_mensual", last="3Y")',
      title: "Monthly inflation",
      unit: "% m/m",
      dec: 1,
      caption: "CPI, monthly change (INDEC). Source: BCRA API",
    },
    {
      key: "rem",
      src: "bcra",
      id: 29,
      days: 1100,
      call: 'bcra.series("rem_12m", last="3Y")',
      title: "Expected inflation, next 12m",
      unit: "% y/y",
      dec: 1,
      caption: "Median expected inflation, next 12 months (REM survey). Source: BCRA API",
    },
    {
      key: "badlar",
      src: "bcra",
      id: 7,
      days: 180,
      call: 'bcra.series("badlar", last="6M")',
      title: "BADLAR rate",
      unit: "% APR",
      dec: 2,
      caption: "BADLAR, private banks (30-day deposits > ARS 1M). Source: BCRA API",
    },
    {
      key: "icl",
      src: "bcra",
      id: 40,
      days: 730,
      call: 'bcra.series("icl_alquileres", last="2Y")',
      title: "Rental contracts index (ICL)",
      unit: "index",
      dec: 2,
      caption: "Índice para Contratos de Locación (base 30.6.20 = 1). Source: BCRA API",
    },
    {
      key: "riesgo",
      src: "ad",
      days: 365,
      call: 'argdata.series("riesgo_pais", last="1Y")',
      title: "Country risk",
      unit: "bps",
      dec: 0,
      caption: "Country risk spread (EMBI), basis points. Source: ArgentinaDatos API",
    },
  ];

  // ── helpers ────────────────────────────────────────────────────────────────
  const $ = (sel) => root.querySelector(sel);
  const iso = (d) => d.toISOString().slice(0, 10);
  const fmt = (v, dec) => v.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
  }

  async function fetchLive(s) {
    const today = new Date();
    const desde = iso(new Date(today.getTime() - s.days * 864e5));
    if (s.src === "bcra") {
      const url = `https://api.bcra.gob.ar/estadisticas/v4.0/monetarias/${s.id}?desde=${desde}&hasta=${iso(today)}&limit=3000`;
      const j = await (await fetch(url)).json();
      return j.results[0].detalle.map((p) => [p.fecha, +p.valor]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
    }
    const j = await (await fetch("https://api.argentinadatos.com/v1/finanzas/indices/riesgo-pais")).json();
    return j.filter((p) => p.fecha >= desde).map((p) => [p.fecha, +p.valor]);
  }

  let snapshot = null;
  async function fetchSnapshot(s) {
    if (!snapshot) snapshot = await (await fetch(SNAPSHOT_URL)).json();
    return { pts: snapshot[s.key], asOf: snapshot._generated };
  }

  async function load(s) {
    try {
      const pts = await withTimeout(fetchLive(s), TIMEOUT_MS);
      if (pts.length > 2) return { pts, live: true };
      throw new Error("empty");
    } catch (e) {
      const snap = await fetchSnapshot(s);
      return { pts: snap.pts, live: false, asOf: snap.asOf };
    }
  }

  async function type(el, text, speed) {
    el.classList.remove("is-done");
    if (REDUCED) {
      el.textContent = text;
      el.classList.add("is-done");
      return;
    }
    el.textContent = "";
    for (const ch of text) {
      el.textContent += ch;
      await sleep(speed);
    }
    el.classList.add("is-done");
  }

  // ── chart ──────────────────────────────────────────────────────────────────
  function draw(svg, pts, s) {
    const W = 600,
      H = 150,
      P = { l: 4, r: 4, t: 12, b: 18 };
    const ys = pts.map((p) => p[1]);
    let lo = Math.min(...ys),
      hi = Math.max(...ys);
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad;
    hi += pad;
    const x = (i) => P.l + (i / (pts.length - 1)) * (W - P.l - P.r);
    const y = (v) => P.t + (1 - (v - lo) / (hi - lo)) * (H - P.t - P.b);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
    const area = `${line}L${x(pts.length - 1).toFixed(1)},${H - P.b}L${x(0).toFixed(1)},${H - P.b}Z`;
    const last = pts[pts.length - 1];
    const clipId = "nb-clip-" + Math.random().toString(36).slice(2, 8);

    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.innerHTML = `
      <line class="nb-axis" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/>
      <text class="nb-tick" x="${P.l}" y="${H - 4}">${pts[0][0]}</text>
      <text class="nb-tick" x="${W - P.r}" y="${H - 4}" text-anchor="end">${last[0]}</text>
      <defs><clipPath id="${clipId}"><rect class="nb-reveal" x="0" y="0" width="${REDUCED ? W + 6 : 0}" height="${H}"/></clipPath></defs>
      <g clip-path="url(#${clipId})">
        <path class="nb-area" d="${area}"/>
        <path class="nb-line" d="${line}"/>
        <circle class="nb-dot" cx="${x(pts.length - 1)}" cy="${y(last[1])}" r="3.5"/>
      </g>
      <g class="nb-hover" visibility="hidden">
        <line class="nb-cross" y1="${P.t}" y2="${H - P.b}"/>
        <circle class="nb-hdot" r="3.5"/>
      </g>
      <rect class="nb-hit" x="0" y="0" width="${W}" height="${H}" fill="transparent"/>`;

    // Reveal left→right with a clip rect (scale-independent, unlike stroke dashes,
    // which break under vector-effect: non-scaling-stroke).
    if (!REDUCED) {
      const rect = svg.querySelector(".nb-reveal");
      const t0 = performance.now(),
        DUR = 1100;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / DUR);
        rect.setAttribute("width", (W + 6) * (1 - Math.pow(1 - k, 3))); // ease-out cubic
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }

    // hover readout
    const hover = svg.querySelector(".nb-hover"),
      cross = svg.querySelector(".nb-cross"),
      hdot = svg.querySelector(".nb-hdot");
    const readout = $(".nb-readout");
    const base = readout.innerHTML;
    svg.querySelector(".nb-hit").addEventListener("pointermove", (ev) => {
      const r = svg.getBoundingClientRect();
      const i = Math.max(
        0,
        Math.min(pts.length - 1, Math.round(((((ev.clientX - r.left) / r.width) * W - P.l) / (W - P.l - P.r)) * (pts.length - 1)))
      );
      cross.setAttribute("x1", x(i));
      cross.setAttribute("x2", x(i));
      hdot.setAttribute("cx", x(i));
      hdot.setAttribute("cy", y(pts[i][1]));
      hover.setAttribute("visibility", "visible");
      readout.innerHTML = `<span class="nb-val">${fmt(pts[i][1], s.dec)}</span> <span class="nb-unit">${s.unit}</span> <span class="nb-muted">· ${pts[i][0]}</span>`;
    });
    svg.querySelector(".nb-hit").addEventListener("pointerleave", () => {
      hover.setAttribute("visibility", "hidden");
      readout.innerHTML = base;
    });
  }

  // ── run ────────────────────────────────────────────────────────────────────
  function pick(prevKey) {
    const pool = SERIES.filter((s) => s.key !== prevKey);
    return pool[Math.floor(Math.random() * pool.length)];
  }

  let current = null,
    busy = false;

  async function runCell2(s) {
    busy = true;
    const out = $(".nb-out2");
    out.classList.remove("is-ready");
    $(".nb-status").textContent = "running…";
    const [data] = await Promise.all([load(s), type($(".nb-code2"), s.call + ".plot()", 18)]);
    const pts = data.pts,
      first = pts[0][1],
      last = pts[pts.length - 1];
    const isPct = s.unit.startsWith("%");
    const chg = isPct ? last[1] - first : ((last[1] - first) / Math.abs(first)) * 100;
    $(".nb-title").textContent = s.title;
    $(".nb-readout").innerHTML =
      `<span class="nb-val">${fmt(last[1], s.dec)}</span> <span class="nb-unit">${s.unit}</span> ` +
      `<span class="nb-muted">· ${last[0]} · ${chg >= 0 ? "▲" : "▼"} ${fmt(Math.abs(chg), 1)}${isPct ? " pp" : "%"} vs ${pts[0][0]}</span>`;
    $(".nb-caption").textContent = `Fig. 1 — ${s.caption}`;
    $(".nb-status").textContent = data.live ? "● live" : `○ snapshot ${data.asOf}`;
    $(".nb-status").classList.toggle("is-live", data.live);
    out.classList.add("is-ready");
    draw($(".nb-chart"), pts, s);
    try {
      localStorage.setItem("heroNbLast", s.key);
    } catch (e) {}
    current = s;
    busy = false;
  }

  async function start() {
    await type($(".nb-code1"), "sebastian.describe()", 32);
    $(".nb-out1").classList.add("is-ready");
    let prev = null;
    try {
      prev = localStorage.getItem("heroNbLast");
    } catch (e) {}
    await runCell2(pick(prev));
  }

  $(".nb-shuffle").addEventListener("click", () => {
    if (!busy) runCell2(pick(current && current.key));
  });
  start();
})();
