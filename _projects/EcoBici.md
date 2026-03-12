---
layout: page
title: EcoBici
description: urban mobility analysis & impact evaluation
img: assets/img/Ecobici_image.jpg
importance: 4
category: completed
tags: [Python, Plotly, Leaflet, urban economics]
---

I've always been interested in urban economics and mobility. Particularly, smarter ways of commuting are the cornerstone of public policies regarding mobility. How do cities organize themselves in a more efficient way? How can we take into account the negative externalities caused by inefficient means of transport? Is enhancing public transport enough, or do we need a <i>cultural change</i>? 

All these questions come to my mind frequently. No wonder that I am constantly consuming and sharing data about mobility (and, sometimes, analyzing it!). This project started with a clear goal: assessing how, when, and why people use Ecobici, the public bike-sharing program of Buenos Aires.

The Github repo for this project can be found at <a href='https://github.com/manzisebastian/EcoBici-CABA'>manzisebastian/EcoBici-CABA</a>.

In this project, I analyzed data over 16 million individual rides of Ecobici from 2019 to 2023 to uncover fascinating patterns around usage characteristics regarding trip duration, time of day, weekdays vs. weekends, and seasonal trends.

I also leveraged on geographic data (in particular, latitudes and longitudes for the origin and destinations of rides) to study patterns of most popular rides. Given that data for the exact route of each ride is not available, each ride is plotted as a straight line over the map. No news that mapping was the part of the project I enjoyed the most.

Below, you can see the general map for the 5000 most popular rides, with no restrictions on days and times.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/ecobici/map_1.png" class="img-fluid" %}
    </div>
</div>
<div class="caption">
    As can be seen, most of the top 5000 rides have origins and destinations within the northern part of the City of Buenos Aires.
</div>

Are there significant geographic differences between <i>modes</i> of usage? For instance, how is daily commuting usage different from spare-time recreational usage during weekends? A simple observational analysis, guided by the two maps below, show that the these differences exist. The vast majority of Ecobici rides on weekday's mornings (most common time to commute) are concentrated in Downtown Buenos Aires—<i>microcentro</i>—. On the other hand, rides during weekends (all day) are mostly on recreation-related areas, such as Palermo and San Telmo, neighbourhoods with leisure activities.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/ecobici/map_2.png" class="img-fluid" %}
    </div>
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/ecobici/map_3.png" class="img-fluid" %}
    </div>
</div>
<div class="caption">
    The difference between usage of Ecobici for commuting or for recreation.
</div>

A more thorough analysis on rides characteristics and differences, including histograms, heatmaps and origin-destination statistics, is available on request.

Later on, this project evolved to include an impact evaluation approach. The next step? Assessing how improved cycling infrastructure could boost daily EcoBici usage, paving the way for smarter urban mobility solutions.

This project is temporarily suspended due to scarce data availability on cycle lanes construction in Buenos Aires.

<u>Note:</u> Credits to Vaimoo for the image that illustrates this project's front cover.
