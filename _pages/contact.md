---
layout: page
title: let's talk
permalink: /contact/
description: The best ideas start with a conversation. If you have a project, a role, or something worth building, let's talk.
nav: true
nav_order: 5
---

<div class="contact-page">

  <p class="contact-intro">
    I'm always open to conversations around <strong>data science, economics, and applied research</strong> —
    collaborations, roles, or just interesting problems to think through. Pick whatever channel works best for you.
  </p>

  <a class="contact-primary" href="mailto:{{ site.email | encode_email }}">
    <i class="fa-solid fa-envelope"></i>&nbsp; {{ site.email }}
  </a>

  <div class="contact-socials">
    <p class="contact-socials-label">// elsewhere</p>
    <div class="contact-icons">{% include social.liquid %}</div>
  </div>

</div>
