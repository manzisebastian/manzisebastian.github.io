---
layout: page
title: networks
description: network theory applied to geospatial & telecom data
img: assets/img/Network_theory_image.jpg
importance: 3
category: ongoing
tags: [R, Python, network theory, geospatial, ArcGIS]
---

Over the course of a month and a half, I had the opportunity to work as a Geospatial Data Analyst (GDA) on a project that applied network theory to the field of Telecommunications. Although this domain was new to me, I quickly became fascinated by network-based approaches to understanding complex systems.

That is why I decided to start this project with a clear and simple goal: to revisit, replicate, and expand upon everything I learned and developed during my time as a GDA, but this time using publicly available or synthetic datasets.

To respect the NDA I signed, this project intentionally explores topics outside the scope of Telecommunications. Instead, I focus on areas that I feel more comfortable working in, and where network theory can offer equally interesting insights: urban mobility, pollution and global trade connectivity.

<h2>urban mobility</h2>

This first sub-project is all about modelling the public transportation network of Buenos Aires using R.

Bus, <i>subte</i> (underground metro) and trains. Stops of each mean of transport are represented as nodes, while the edges are the routes (weighted by frequency and/or travel time).

I used a Louvain community detection algorithm to identify mobility sub-clusters (this is, zones with tight internal connections but sparse external ones).
