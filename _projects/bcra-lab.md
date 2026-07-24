---
layout: page
title: bcra-lab
description: una plataforma de datos macro del BCRA (en desarrollo)
img: assets/img/BCRA_lab_image.jpg
importance: 1
category: ongoing
tags: [Python, API, DuckDB, Streamlit, economics]
---

Después de bajar [BCRA_bot](/projects/BCRA_bot/) me quedé con muchas ganas de seguir trabajando sobre los datos del Banco Central. **bcra-lab** (*Monitor Monetario Argentino*) es la continuación natural de esa idea: una plataforma modular en Python que integra los datos macroeconómicos y monetarios de las <a href='https://www.bcra.gob.ar/'>APIs públicas del BCRA</a> para hacer análisis económico.

La idea es construir, sobre un cliente tipado de la API, toda la cadena: una base de datos local (DuckDB), reportes automáticos y un dashboard público. El objetivo es transformar las estadísticas del BCRA en algo consultable, reproducible y accesible, sin depender de tokens ni de llamadas manuales a la API.

Algunas decisiones de diseño que ya están tomadas:
- Las variables se resuelven por descripción (por ejemplo, `"reservas internacionales"`), no por *ids* mágicos.
- Paginación automática, reintentos con *backoff* y verificación SSL siempre activa.
- El dashboard lee la base local (o el último *snapshot* en Parquet), nunca llama a la API en vivo.
- Los tests corren contra *fixtures* grabados: nunca tocan la API real.

El proyecto está en una etapa temprana de desarrollo: primero se construye el cliente tipado de la API, y sobre eso siguen el almacenamiento, el análisis, los reportes y el dashboard. Por ahora el repositorio se mantiene **privado** hasta terminar algunos testeos; lo voy a hacer público apenas esté listo.
