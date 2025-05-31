---
layout: page
title: Econ
description: economics is what economists do
img: assets/img/econ_image.jpg
importance: 2
category: completed
---

Just as Ma-py-tas showcases years of mapping across diverse topics, this collection represents another long-term journey. However, this time, the focus is narrower, as every project here has a common thread: Economics. From intricate graphs to insightful analyses, these works reflect my desire to explore the patterns and stories behind economic data.

The Github repo for this project can be found at <a href='https://github.com/manzisebastian/Econ'>manzisebastian/Econ</a>.

<h2>reserves</h2>

Every single day, at around 16:00 Argentina time, people (mostly economists and Economics students) crowd into the Central Bank of Argentina's (BCRA) (<a href='https://x.com/BancoCentral_AR'>official Twitter account</a>) anxious to know the daily change in the Foreign Exchange Reserve stock. Using the API of the BCRA, I gathered data for these daily changes from January 1997, and plotted them into the following interactive heatmap. One can distinguish at a glance bad days—dark red ones— from good days—dark blue ones—.

<div align="center"><iframe src="/assets/html/projects/Econ/fig_var_RRII.html" width="1000" height="1500" frameborder="0" scrolling="no" style="overflow: hidden;"></iframe></div>

<h2> fiscal </h2>

The debate about Argentina's fiscal performance is a hot topic in both academic and public discourse. The following two charts aim to provide measurable insights of some economic variables that are crucial when it comes to assessing fiscal challenges: the difference between primary and fiscal balance, and the composition of the latter.

<div align="center"><iframe src="/assets/html/projects/Econ/fiscal_1.html" width="850" height="850" frameborder="0" scrolling="no" style="overflow: hidden;"></iframe></div>

In particular, the fiscal balance can be disaggregated into the economic and capital result, as shows the following chart.

<div align="center"><iframe src="/assets/html/projects/Econ/fiscal_2.html" width="850" height="850" frameborder="0" scrolling="no" style="overflow: hidden;"></iframe></div>

As a side note, this project was originally uploaded to [Alphacast](https://www.alphacast.io/datasets/fiscal-argentina-onp-government-budget-quarterly-15391) back in 2022, although the code used in that project (much more basic and not API-integrated) was not published.

<h2>budget</h2>

The Federal Budget (<i>el Presupuesto</i>) is often considered the mother of all laws, as it is a detailed description of all government resources and expenditures. In this ongoing project, I am analyzing the key questions of the budget: who spends?, in what? & which means are being used?

My plan is to build an interactive visualization that answers those questions directly while ensuring that data is presented in an understandable and appealing way. For that purpose, I am extensively using new visualization techniques and interactive features. The following Sankey diagram is a snippet of this project: a graphic analysis of the 2024 Federal Budget.

<div align="center"><iframe src="/assets/html/projects/Econ/sankey_presup.html" width="1000" height="1500" frameborder="0" scrolling="no" style="overflow: hidden;"></iframe></div>

<h2>homeownership</h2>

Back in May 2024, two economists at the Federal Reserve, Daniel Dias and Joao Duarte, published a [note](https://www.federalreserve.gov/econres/notes/feds-notes/estimating-the-importance-of-monetary-policy-shocks-for-variation-in-the-u-s-homeownership-rate-20240503.html) in the FEDS Notes, in which they showed that monetary policy shocks had an effect over the homeownership rate in the United States.

Together with a colleague, we embarked in a project in order to get estimates for Argentina. Even though the project is still in preliminary phase, we used available data for other projects we had in mind. In particular, the following visualization made extensive use of [\{eph\}](https://cran.r-project.org/web/packages/eph/), an R package that provides Argentina's Permanent Household Survey (EPH) microdata. Using variables related to type of tenure of household, we plotted estimates for the homeownership rate in Argentina from 2003Q3 to 2022Q4.

<div class="row">
    <div class="col-sm mt-3 mt-md-0">
        {% include figure.liquid loading="eager" path="assets/img/projects/econ/homeownership.jpg" class="img-fluid" %}
    </div>
</div>
<div class="caption">
    Argentina's homeownership rate remains approximately stable in around 70%.
</div>


