---
layout: page
title: BCRA_bot
description: a Twitter bot for economists
img: assets/img/BCRA_image.jpg
importance: 1
category: econ
related_publications: true
---

<a href='https://x.com/BCRA_bot'>@BCRA_bot</a> is a Twitter bot that tweets daily updates of Argentina's monetary statistics, with data of the Central Bank of Argentina (BCRA).

This project started with a simple `import requests` way back in november 2021, while testing a third-party API called <a href='https://estadisticasbcra.com/'>Estadísticas BCRA</a> to gather key monetary metrics. The very first goal was only to create a heatmap of daily changes of Foreign exchange reserves (which I did, and can be accessed here).

A few months later, the idea of making a bot came to my mind and I was immediately hands-on this project. I wanted a simple, automated way to publish monetary statistics—which are a fairly common topic of discussion in Argentina—on a daily basis, to make this information more accessible and engaging. That is how <a href='https://x.com/BCRA_bot'>@BCRA_bot</a> was concieved.

After a few attempts, the first version of the bot was launched in July 2022. It consisted in two separated ways of extracting data: given that the third-party API was updated a few hours after BCRA's official website, it used web scraping to get the latest data and requested historical data through the API.

The code suffered minor changes and kept adding features (such as weekly and monthly analyses and graphs) until 2024, when the BCRA launched its own <a href='https://www.bcra.gob.ar/Catalogo/apis.asp?fileName=principales-variables-v3&sectionName=Estad%EDsticas'>official API</a>, allowing the bot to be 100% reliant on it.

<u>Note:</u> given Twitter's policy changes regarding bots, <a href='https://x.com/BCRA_bot'>@BCRA_bot</a> may sporadically go offline. If the bot is not working as you are reading this, feel free to contact me through any of the usual channels.