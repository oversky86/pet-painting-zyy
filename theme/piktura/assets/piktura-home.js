/**
 * Piktura Homepage JS
 * Hero autoplay + style gallery + materials interactions.
 */
(function() {
  'use strict';

  var AUTOPLAY_MS = 4000;
  var MORPH_MS = 2500;
  var autoplayTimer = null;
  var activeIndex = 0;

  function initHero() {
    var heroSection = document.querySelector('[data-hero]');
    if (!heroSection) return;

    var stylesData = null;
    var dataEl = document.querySelector('[data-hero-styles]');
    if (dataEl) {
      try { stylesData = JSON.parse(dataEl.textContent.replace(/,\s*([\]}])/g, '$1')); } catch(e) { /* ignore */ }
    }

    var tagBtns = heroSection.querySelectorAll('[data-hero-tag]');
    var tagBtnsMobile = heroSection.querySelectorAll('[data-hero-tag-mobile]');
    var badge = heroSection.querySelector('[data-hero-badge]');
    var paintedEl = heroSection.querySelector('[data-hero-painted]');
    var originalEl = heroSection.querySelector('[data-hero-original]');

    /* Mobile hero elements */
    var badgeMobile = heroSection.querySelector('[data-hero-badge-mobile]');
    var paintedElMobile = heroSection.querySelector('[data-hero-painted-mobile]');
    var originalElMobile = heroSection.querySelector('[data-hero-original-mobile]');
    var sourceCardMobile = heroSection.querySelector('[data-hero-source-card-mobile]');
    var sourceTitleMobile = heroSection.querySelector('[data-hero-source-title-mobile]');
    var sourceNoteMobile = heroSection.querySelector('[data-hero-source-note-mobile]');
    var isPaused = false;

    function setActive(index) {
      activeIndex = index;
      tagBtns.forEach(function(btn, i) {
        btn.classList.toggle('pk-hero__tag--active', i === index);
      });
      tagBtnsMobile.forEach(function(btn, i) {
        btn.classList.toggle('pk-hero__tag--active', i === index);
      });
      if (stylesData && stylesData[index]) {
        var d = stylesData[index];
        /* Desktop updates */
        if (badge) badge.textContent = d.label;
        if (paintedEl) {
          var img = paintedEl.querySelector('img');
          if (img && d.painted) {
            img.src = d.painted;
            img.alt = d.label;
          }
          /* Reset morph: clip from 0 to full reveal */
          paintedEl.style.clipPath = 'inset(0 100% 0 0)';
          paintedEl.style.transition = 'none';
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              var dir = index % 2 === 1 ? 'ltr' : 'rtl';
              paintedEl.style.transition = 'clip-path ' + MORPH_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
              paintedEl.style.clipPath = dir === 'rtl'
                ? 'inset(0 0 0 0%)'
                : 'inset(0 0% 0 0)';
            });
          });
        }
        if (originalEl && d.original) {
          originalEl.src = d.original;
        }

        /* Mobile updates: badge, morph, source card */
        if (badgeMobile) badgeMobile.textContent = d.label;
        if (paintedElMobile) {
          var mImg = paintedElMobile.querySelector('img');
          if (mImg && d.painted) {
            mImg.src = d.painted;
            mImg.alt = d.label;
          }
          paintedElMobile.style.clipPath = 'inset(0 100% 0 0)';
          paintedElMobile.style.transition = 'none';
          requestAnimationFrame(function() {
            requestAnimationFrame(function() {
              var dir = index % 2 === 1 ? 'ltr' : 'rtl';
              paintedElMobile.style.transition = 'clip-path ' + MORPH_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
              paintedElMobile.style.clipPath = dir === 'rtl'
                ? 'inset(0 0 0 0%)'
                : 'inset(0 0% 0 0)';
            });
          });
        }
        if (originalElMobile && d.original) {
          originalElMobile.src = d.original;
        }
        if (sourceCardMobile) {
          var sImg = sourceCardMobile.querySelector('img');
          if (sImg && d.original) sImg.src = d.original;
        }
        if (sourceTitleMobile) sourceTitleMobile.textContent = d.label;
        if (sourceNoteMobile) sourceNoteMobile.textContent = d.note || '';
      }
    }

    function startAutoplay() {
      if (autoplayTimer) clearTimeout(autoplayTimer);
      autoplayTimer = setTimeout(function() {
        if (!isPaused && stylesData && stylesData.length > 0) {
          setActive((activeIndex + 1) % stylesData.length);
          startAutoplay();
        }
      }, AUTOPLAY_MS);
    }

    /* Desktop: hover on tags pauses autoplay */
    var tagsContainer = heroSection.querySelector('[data-hero-tags]');
    if (tagsContainer) {
      tagsContainer.addEventListener('mouseenter', function() { isPaused = true; });
      tagsContainer.addEventListener('mouseleave', function() {
        isPaused = false;
        startAutoplay();
      });
    }

    /* Click handlers via event delegation */
    heroSection.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-hero-tag], [data-hero-tag-mobile]');
      if (!btn) return;
      var idx = parseInt(btn.dataset.styleIndex, 10);
      if (!isNaN(idx)) {
        setActive(idx);
        startAutoplay();
      }
    });

    /* Hover on desktop tags */
    heroSection.addEventListener('mouseenter', function(e) {
      var btn = e.target.closest('[data-hero-tag]');
      if (btn) {
        var idx = parseInt(btn.dataset.styleIndex, 10);
        if (!isNaN(idx)) setActive(idx);
      }
    }, true);

    /* Init: trigger first morph – desktop */
    if (paintedEl) {
      paintedEl.style.clipPath = 'inset(0 100% 0 0)';
      setTimeout(function() {
        paintedEl.style.transition = 'clip-path ' + MORPH_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
        paintedEl.style.clipPath = 'inset(0 0% 0 0)';
      }, 100);
    }
    /* Init: trigger first morph – mobile */
    if (paintedElMobile) {
      paintedElMobile.style.clipPath = 'inset(0 100% 0 0)';
      setTimeout(function() {
        paintedElMobile.style.transition = 'clip-path ' + MORPH_MS + 'ms cubic-bezier(0.22, 1, 0.36, 1)';
        paintedElMobile.style.clipPath = 'inset(0 0% 0 0)';
      }, 100);
    }
    startAutoplay();
  }

  function initStyleGallery() {
    var section = document.querySelector('[data-styles]');
    if (!section) return;

    var btns = section.querySelectorAll('[data-style-btn]');
    var previewImg = section.querySelector('[data-styles-preview-img]');
    var previewOrig = section.querySelector('.pk-styles__preview-original img');

    /* Read style data from hero-styles JSON (shared with hero) */
    var stylesData = null;
    var dataEl = document.querySelector('[data-hero-styles]');
    if (dataEl) {
      try { stylesData = JSON.parse(dataEl.textContent.replace(/,\s*([\]}])/g, '$1')); } catch(e) { /* ignore */ }
    }

    section.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-style-btn]');
      if (!btn) return;
      var idx = parseInt(btn.dataset.styleIndex, 10);
      btns.forEach(function(b) { b.classList.remove('pk-styles__item--active'); });
      btn.classList.add('pk-styles__item--active');
      /* Update preview images */
      if (stylesData && stylesData[idx]) {
        if (previewImg && stylesData[idx].painted) previewImg.src = stylesData[idx].painted;
        if (previewOrig && stylesData[idx].original) previewOrig.src = stylesData[idx].original;
      }
    });
  }

  function initMaterials() {
    var section = document.querySelector('[data-materials]');
    if (!section) return;

    var btns = section.querySelectorAll('[data-material-btn]');
    var titleEl = section.querySelector('[data-materials-title]');
    var bodyEl = section.querySelector('[data-materials-body]');
    var imageContainer = section.querySelector('[data-materials-image]');

    /* Read materials data from JSON */
    var materialsData = null;
    var dataEl = document.querySelector('[data-materials-data]');
    if (dataEl) {
      try { materialsData = JSON.parse(dataEl.textContent); } catch(e) { /* ignore */ }
    }

    section.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-material-btn]');
      if (!btn) return;
      var idx = parseInt(btn.dataset.materialIndex, 10);

      btns.forEach(function(b) {
        b.classList.remove('pk-materials__item--active');
        var icon = b.querySelector('.pk-materials__item-icon');
        if (icon) icon.classList.remove('pk-materials__item-icon--active');
      });
      btn.classList.add('pk-materials__item--active');
      var icon = btn.querySelector('.pk-materials__item-icon');
      if (icon) icon.classList.add('pk-materials__item-icon--active');

      /* Update image, title, body */
      if (materialsData && materialsData[idx]) {
        var d = materialsData[idx];
        if (imageContainer) {
          var img = imageContainer.querySelector('img');
          if (img && d.image) img.src = d.image;
        }
        if (titleEl && d.title) titleEl.textContent = d.title;
        if (bodyEl && d.body) bodyEl.textContent = d.body;
      }
    });
  }

  /* Scroll-to utility */
  function initScrollTo() {
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-scroll-to]');
      if (!btn) return;
      var target = document.querySelector(btn.dataset.scrollTo);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* Init all */
  function init() {
    initHero();
    initStyleGallery();
    initMaterials();
    initScrollTo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
