/**
 * Piktura Global JS
 * IntersectionObserver reveal + common UI interactions.
 */
(function() {
  'use strict';

  /** IntersectionObserver: reveal elements on scroll */
  function initRevealObserver() {
    var reveals = document.querySelectorAll('.pk-reveal');
    if (!reveals.length || !('IntersectionObserver' in window)) {
      reveals.forEach(function(el) { el.classList.add('is-visible'); });
      return;
    }

    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          var delay = entry.target.dataset.revealDelay || 0;
          setTimeout(function() {
            entry.target.classList.add('is-visible');
          }, Number(delay));
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.18, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(function(el) { observer.observe(el); });
  }

  /** Accordion toggle */
  function initAccordions() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-accordion-toggle]');
      if (!btn) return;
      var targetId = btn.getAttribute('aria-controls');
      var panel = document.getElementById(targetId);
      if (!panel) return;
      var isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
      if (!isOpen) {
        panel.style.maxHeight = panel.scrollHeight + 'px';
        panel.style.opacity = '1';
      } else {
        panel.style.maxHeight = '0';
        panel.style.opacity = '0';
      }
    });
  }

  /** Mobile menu toggle */
  function initMobileMenu() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-mobile-menu-toggle]');
      if (!btn) return;
      var menu = document.querySelector('[data-mobile-menu]');
      if (!menu) return;
      var isOpen = menu.classList.contains('is-open');
      menu.classList.toggle('is-open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  }

  /** Init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initRevealObserver();
      initAccordions();
      initMobileMenu();
    });
  } else {
    initRevealObserver();
    initAccordions();
    initMobileMenu();
  }
})();
