---
layout: page
title: Ma-py-tas
description: geospatial data visualizations across Argentina
img: assets/img/mapytas_image.jpg
importance: 3
category: completed
tags: [Python, R, Leaflet, GeoJSON, geospatial]
---

This project is more like a <i>Matryoshka doll</i> of projects I worked on, creating (perhaps a few too many) maps along the way. The topics I’ve explored are diverse, ranging from the locations of barbecues and blooming jacarandás in Buenos Aires to Argentina’s vast hydrocarbon reservoirs.
This is a a non-exhaustive (and continously growing) collection of these maps, each one a snapshot of data-driven storytelling through geography.

The Github repo for this project can be found at <a href='https://github.com/manzisebastian/Ma-py-tas'>manzisebastian/Ma-py-tas</a>.

<h2>Mapping Buenos Aires</h2>

My love for Buenos Aires may well be quantified in the number of maps I made of this city. And one of the things I love the most is that it is full of <a href='https://en.wikipedia.org/wiki/Jacaranda'><i>jacarandás</i></a>, which bloom during November and fill the city with their purple-blue petals. The following map shows the exact location of each <i>jacarandá</i>.

<div align="center"><iframe src="/assets/html/projects/Mapytas/mapa_jac.html" width="900" height="900" frameborder="0" scrolling="no" style="overflow: hidden;"></iframe></div>

In Buenos Aires, we see public buses (<i>colectivos</i>, or -rather informally- <i>bondis</i>) everywhere. History says that the first taxi-bus ran through Buenos Aires on 24 September 1928, so it is a long-standing tradition. We, Argentinians, take pride in saying we invented the <i>colectivo</i>; whether that is or not true is not relevant. <i>Bondis</i> are grouped by numbers and colours, and each of them has a different route. The following map showcases each <i>bondi</i> stop and route in Buenos Aires.

<div align="center"><iframe src="/assets/html/projects/Mapytas/mapa_colectivos.html" width="900" height="900" frameborder="0" scrolling="no" style="overflow: hidden;"></iframe></div>

Apart from jacarandás and <i>colectivos</i>, Buenos Aires is also known for its barbecues: they are all over the city. Back in 2017, the Government of the City of Buenos Aires carried out a study to gather information about each of the +500.000 buldings that shape Buenos Aires. I believe a noble way to use that dataset is to look for the location of all barbecues in the city. Make sure to hover the cursor over the map below to get the address of each of them.

<div align="center"><iframe src="/assets/html/projects/Mapytas/mapa_parrillas.html" width="900" height="900" frameborder="0" scrolling="no" style="overflow: hidden;"></iframe></div>

<h2>Other maps of interest</h2>

This section include some projects I completed a long ago, and for which code is either broken or that I found out more efficient ways to plot them.

For instance, I once mapped the rivers that shape the Paraná Delta in Buenos Aires with its hundreds of tiny islands. These rivers create beautiful patterns.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/mapytas/delta.jpg" class="img-fluid" %}
    </div>
</div>
<div class="caption">
    The rivers of the Paraná Delta, in Buenos Aires.
</div>

In another opportunity, I plotted Argentina's hydrocarbons resevoirs, dividing into those that are currently being exploited and those that are not.
<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/mapytas/cuencas.jpg" class="img-fluid" %}
    </div>
</div>
<div class="caption">
    Argentina’s vast hydrocarbon reservoirs
</div>

