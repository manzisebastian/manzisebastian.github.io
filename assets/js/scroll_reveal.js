/**
 * Subtle scroll-reveal animation using Intersection Observer.
 * Reveals elements with class .reveal as they enter the viewport.
 */
(function () {
  "use strict";

  function initScrollReveal() {
    const revealElements = document.querySelectorAll(
      ".post article p, .post article h2, .skill-tags, .hero-stats, .projects .col, .cv .card"
    );

    revealElements.forEach(function (el) {
      el.classList.add("reveal");
    });

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    revealElements.forEach(function (el) {
      observer.observe(el);
    });
  }

  // Stagger project card animations
  function staggerCards() {
    const cards = document.querySelectorAll(".projects .col");
    cards.forEach(function (card, index) {
      card.style.transitionDelay = index * 60 + "ms";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      initScrollReveal();
      staggerCards();
    });
  } else {
    initScrollReveal();
    staggerCards();
  }
})();
