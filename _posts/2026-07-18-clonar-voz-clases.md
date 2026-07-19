---
layout: post
title: Clonar mi voz para automatizar mis clases
date: 2026-07-18
description: cómo entrené un modelo TTS con mi propia voz para generar videos de clases a partir de notebooks
tags: TTS ML voz Python docencia
categories: proyectos
related_posts: false
---

*Esta es una versión bajada a tierra de un post más técnico que escribí: encontralo [acá](/projects/TTS/) (en inglés).*

Desde 2025 doy un curso que mezcla matemática, economía y Python: el *Laboratorio de Métodos Cuantitativos aplicados a la Gestión*, dentro de una Tecnicatura en Análisis de Datos de la UBA.

Dar clases es una de las actividades que más me gusta. El problema es el tiempo. Un cuatrimestre son 12 o 13 clases asincrónicas, unas 22 horas netas. Parece poco, pero soy perfeccionista: terminaba grabando cada clase tres o cuatro veces por una pronunciación torcida, una frase que se perdía a mitad de la explicación, algunos "ehm". Entre grabación, edición y exportación, 20 horas de clase me costaban unas 60. Imposible escalarlo.

Así que me pregunté si era posible automatizarlo. La intención no era "grabarlo una vez y olvidarme", sino poder actualizar una clase sin volver a grabarme y mantener el material al día sin el cuello de botella del audio.

El material base ya existía: junto a un equipo de ayudantes habíamos construido una base de notebooks de Jupyter con código ejecutable, ejemplos numéricos, explicaciones y gráficos. El problema es que un notebook no es una clase. Para que sea una clase, alguien tiene que explicarlo.

Este post es sobre ese intento: lo que funcionó, lo que no, y las decisiones que tomé en el camino.

---

## Por qué un modelo propio

Lo primero que evalué fue usar un servicio de *text-to-speech* existente. Básicamente, es un servicio que permite pasar de texto a discurso narrado, con una voz que puede ser predeterminada o con personalización.

Probé Google, Azure, ElevenLabs. Todos tienen APIs razonables y algunos tienen clonación de voz. El resultado era funcional pero no me cerraba del todo.

Una clase universitaria no es *solo* una locución. Cuando un docente explica, hay un ritmo: el *tempo* se ralentiza antes de un punto importante, hay una pausa después de mostrar el código para que el estudiante lo procese, el tono cambia cuando se señala un error común. Es *como si* **actuaras**, no como si hablaras. Los TTS genéricos producen narración correcta pero llana, y en un contexto pedagógico esa diferencia afecta cómo se recibe la información.

Hubo dos factores más.

Uno, la privacidad: los servicios con clonación requieren subir muestras de audio a servidores externos, con ToS poco claros. Mi voz, en cantidad suficiente para clonarla con buena fidelidad, quedaría procesándose en infraestructura que no controlo. Un poco por objeción paranoica y otro poco por el contexto académico, decidí trabajar exclusivamente en local.

Dos, el costo: sintetizar decenas de horas y regenerar partes cada vez que el material cambia hace que el costo por carácter se acumule rápido. Con un modelo propio, el costo marginal de re-sintetizar una clase es básicamente electricidad.

Conclusión: decidí entrenar un modelo propio.

---

## El modelo de voz

Tenía las clases asincrónicas grabadas de la iteración anterior: unas 20 horas de audio neto, en el mismo contexto académico que quería clonar y sin interrupciones. Le sumé lecturas de textos variados e incluso audios de WhatsApp, que le agregan naturalidad y *prosodia* (palabra que aprendí por este proyecto).

Esas ~22 horas pasaron por un pipeline de preparación: detección de voz activa para quedarme con los segmentos de habla real, recorte en fragmentos de tres a diez segundos, y transcripción con Whisper. El resultado fue un dataset de pares audio-texto para hacer *fine-tuning* de XTTS v2, un modelo TTS *open-source*.

El entrenamiento corrió en mi GPU local, una RTX 4060 con 8 GB de VRAM. Eso es suficiente aunque no sobrado para entrenar un modelo de síntesis de voz, y requirió algunas decisiones técnicas para que fuera viable: precisión reducida, batch de una sola muestra, acumulación de gradientes para simular batches más grandes, etc.

No es el setup ideal, pero A) funciona y B) es lo que mi bolsillo permite.

En inferencia el modelo recibe además un clip de referencia de voz que condiciona el estilo. Con el mismo modelo base y distintos clips se obtienen registros perceptiblemente diferentes.

Los primeros resultados fueron decididamente malos: voz robótica, con un ruido característico al final de las frases, como si el modelo no supiera cómo terminar. Ajusté el learning rate, corrí de nuevo, y otra vez. Cada ciclo tardaba entre cuatro y ocho horas. Después de varios intentos empezó a sonar como una voz real: no idéntica a la mía, pero con el registro y la cadencia correctos. Todavía *alucina* en frases muy largas (>239 caracteres) o con puntuación inusual, algo que compenso con un *Quality Check* extenso de los scripts.

---

## Los guiones

Un modelo que sintetiza texto natural no sirve de nada si el texto que le das es el contenido crudo del notebook. Leer en voz alta una celda de Python tal como está escrita -nombres de variables, paréntesis, comentarios con numeral- sería una vergüenza. Lo mismo con fórmulas en LaTeX.

Un guion de clase tiene que hacer cosas que el notebook no hace: introducir cada sección antes de mostrarla, explicar qué va a hacer el código antes de que se vea, señalar dónde prestar atención, advertir errores comunes, conectar lo anterior con lo que viene. Esa estructura narrativa hay que construirla a propósito.

El primer paso es un mapa conceptual de la clase, generado directamente a partir del notebook: qué conceptos introduce, en qué secuencia, cuáles merecen énfasis, qué errores vale la pena anticipar. El LLM recibe ese mapa como contexto para generar el guion, lo que reduce alucinaciones y saltos de continuidad.

Para los 67 notebooks desarrollé un formato específico, con marcadores que el sintetizador interpreta. Exactamente *como si* fuera un guion de teatro:

```
[introduction]
Hola a todos. Mi nombre es Sebastián. Bienvenidos a la clase 1 del Laboratorio de Métodos Cuantitativos aplicados a la Gestión.

[cell:0]
[transition]
Este curso pertenece a la Tecnicatura Universitaria en Gestión y Análisis de Datos en Organizaciones, de la Facultad de Ciencias Económicas de la UBA.

[pause 0.5s]

[cell:1]
[explanation]
Antes de arrancar, repasemos qué vamos a lograr en esta clase.
```

Los marcadores de sección -`introduction`, `explanation`, `key_point`, `warning`, `example`, 12 en total- le indican al sintetizador a qué velocidad hablar, con qué temperatura de muestreo y con qué clip de referencia. Sirven para que la voz cambie según el contexto: más lenta y deliberada en los puntos clave, más fluida en las explicaciones, más marcada en las advertencias. Siempre un modelo, pero con múltiples registros.

Los `[cell:N]` tienen además un rol técnico clave: registran en qué segundo del audio empieza la narración de cada celda.

Cada guion se revisa manualmente antes de sintetizar. Hay errores que no se detectan automáticamente, así que combino checks por script con revisión humana.

---

## Sincronizar audio y video

El problema técnico más interesante fue este. El audio se genera primero; la grabación de pantalla corre después. El objetivo es que cuando el narrador explica la celda 3, el video muestre *exactamente* la celda 3 (no la celda 2, ni un scroll a destiempo).

La primera intuición fue alinear fonéticamente el audio después de grabar. La descarté rápido: agrega un paso de procesamiento por clase, es frágil si el narrador no menciona explícitamente cada celda, y suma complejidad sin necesidad.

La solución que usé es más simple. Durante la síntesis, cada vez que el sintetizador procesa un `[cell:N]` registra el offset de audio acumulado. Sale un archivo de timestamps -celda 0 en el segundo 8.4, celda 1 en el 47.8, celda 2 en el 89.2- gratis, como subproducto de la síntesis.

Con esos timestamps y los tiempos de ejecución medidos de cada celda se construye un script de eventos: en el segundo 47.8 hacer scroll a la celda 1 y ejecutarla, esperar a que termine, en el 89.2 pasar a la siguiente. Playwright reproduce esos eventos sobre JupyterLab mientras graba la pantalla, y FFmpeg combina el video con el audio TTS.

Una notita: no pretendía sincronización *frame-perfect*: en secciones largas o con código lento puede haber un desfase de alrededor de un segundo. ¿Me molesta? Sí. Pero para videos educativos es más que aceptable, y sobre todo es completamente reproducible: mismo guion y mismo notebook, mismo resultado.

---

## Qué aprendí

La arquitectura por etapas independientes fue la decisión más valiosa del proyecto, y fue deliberada desde el principio justamente porque sabía que me iba a encontrar con problemas. Cuando descubrí que el script de grabación dependía de una API de JupyterLab que no funciona en modo headless, pude reescribir solo ese componente sin tocar el modelo, los guiones ni la síntesis.

Del otro lado: la parte que más tiempo consume es editorial, no técnica. Y está bien que así sea. Revisar 67 guiones, encontrar errores del LLM, llevar registro, pensar qué validaciones faltan, detectar qué clases cambiaron y hay que regenerar. Ese trabajo existe independientemente de cuán bien funcione el pipeline. El sistema elimina la grabación manual, no la supervisión humana, que en educación es fundamental.

El modelo de voz también tiene límites que no resolví del todo. Reduje los problemas en frases largas pero no los eliminé, y fuera de este entorno seguramente falle. Con más datos de entrenamiento probablemente mejore; queda para más adelante.

---

El pipeline está operativo: el 100% de las clases tiene el video terminado.

Se habla mucho -a veces demasiado- de IA en educación, y casi siempre desde el lado del alumno: mejores materiales, mejores herramientas, chatbots. Sin quitarle al alumno el protagonismo, este proyecto la usa también como asistente de docencia.

El código, los scripts y ejemplos de guiones están [en GitHub](https://github.com/manzisebastian/tts-lecture-pipeline).
