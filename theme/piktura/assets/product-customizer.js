/**
 * Piktura Product Customizer — Vanilla JS
 * Handles: upload, style, size, frame, canvas/room preview, generation, checkout.
 * Works with both desktop (sidebar + canvas + summary) and mobile (sticky preview + CTA) layouts.
 */
(function () {
  'use strict';

  /* ── Config ── */
  var ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  var MAX_SIZE_MB = 10;
  var MAX_COMPRESS_BYTES = 2 * 1024 * 1024;
  var MAX_LONG_SIDE = 1200;

  /* Size options (matching Create.tsx) */
  var SIZE_OPTIONS = {
    'portrait-40x50': { metric: 'Portrait · 40 x 50 cm', orient: 'portrait', ratio: 'portrait' },
    'portrait-60x75': { metric: 'Portrait · 60 x 75 cm', orient: 'portrait', ratio: 'portrait' },
    'landscape-75x60': { metric: 'Landscape · 75 x 60 cm', orient: 'landscape', ratio: 'landscape' },
    'landscape-100x80': { metric: 'Landscape · 100 x 80 cm', orient: 'landscape', ratio: 'landscape' },
    'square-60x60': { metric: 'Square · 60 x 60 cm', orient: 'square', ratio: 'square' },
    'custom-size': { metric: 'Custom Size', orient: 'portrait', ratio: 'portrait' }
  };

  /* ── State ── */
  var state = {
    step: 'create',
    photoUrl: '',
    photoFileId: '',
    style: '',
    size: 'portrait-60x75',
    frame: 'antique-gold',
    jobId: '',
    resultUrl: '',
    status: 'idle',
    progress: 0,
    generationPhase: '',
    errorMessage: '',
    isCheckoutLoading: false,
    view: 'canvas',
    hasGeneratedPreview: false,
    sellingPlanId: ''
  };

  /* ── DOM refs ── */
  var el = {};
  var variants = [];
  var styles = [];
  var frames = [];
  var rooms = [];
  var appUrl = '';
  var useRealGeneration = false;
  var hasSizeOption = false;
  var hasFrameOption = false;
  var abortController = null;
  var pollTimeout = null;

  /* ══════════ Init ══════════ */
  function init() {
    var root = document.querySelector('[data-customizer]');
    if (!root) return;

    appUrl = root.dataset.appUrl || '';
    var urlParams = new URLSearchParams(window.location.search);
    useRealGeneration = urlParams.get('generate') === 'true';

    /* Parse JSON data */
    parseJsonData('[data-variant-data]', function (d) { variants = d; });
    parseJsonData('[data-style-data]', function (d) { styles = d; });
    parseJsonData('[data-frame-data]', function (d) { frames = d; });
    parseJsonData('[data-room-data]', function (d) { rooms = d; });

    /* Variant option detection */
    if (variants.length && variants[0].options) {
      var names = Object.keys(variants[0].options);
      hasSizeOption = names.indexOf('size') !== -1;
      hasFrameOption = names.indexOf('frame') !== -1;
    }

    /* Cache DOM refs */
    el = {
      root: root,
      customizerMain: document.querySelector('[data-customizer-main]'),
      fileInput: document.querySelector('[data-file-input]'),
      /* Desktop step indicator */
      stepIndicators: document.querySelectorAll('[data-step-indicator]'),
      /* Desktop upload */
      uploadZone: document.querySelector('[data-upload-zone]'),
      uploadEmpty: document.querySelector('[data-upload-empty]'),
      uploadPreview: document.querySelector('[data-upload-preview]'),
      uploadImage: document.querySelector('[data-upload-image]'),
      uploadError: document.querySelector('[data-upload-error]'),
      uploadStatus: document.querySelector('[data-upload-status]'),
      uploadChange: document.querySelector('[data-upload-change]'),
      uploadTriggers: document.querySelectorAll('[data-upload-trigger]'),
      /* Desktop style */
      styleGrid: document.querySelector('[data-style-grid]'),
      styleCards: document.querySelectorAll('[data-style-key]'),
      /* Desktop size */
      sizeSelect: document.querySelector('[data-size-select]'),
      /* Desktop frame */
      frameGrid: document.querySelector('[data-frame-grid]'),
      frameCards: document.querySelectorAll('[data-frame-key]'),
      /* Desktop generate */
      generateBtn: document.querySelector('[data-generate-btn]'),
      generateLabel: document.querySelector('[data-generate-label]'),
      errorMessage: document.querySelector('[data-error-message]'),
      /* Desktop preview */
      previewContainer: document.querySelector('[data-preview-container]'),
      previewEmpty: document.querySelector('[data-preview-empty]'),
      previewReference: document.querySelector('[data-preview-reference]'),
      referenceImage: document.querySelector('[data-reference-image]'),
      previewImage: document.querySelector('[data-preview-image]'),
      previewGenerating: document.querySelector('[data-preview-generating]'),
      progressFill: document.querySelector('[data-progress-fill]'),
      progressText: document.querySelector('[data-progress-text]'),
      generationPhase: document.querySelector('[data-generation-phase]'),
      previewStatus: document.querySelector('[data-preview-status]'),
      previewFrame: document.querySelector('[data-preview-frame]'),
      frameTexture: document.querySelector('[data-frame-texture]'),
      canvasView: document.querySelector('[data-canvas-view]'),
      roomView: document.querySelector('[data-room-view]'),
      roomImage: document.querySelector('[data-room-image]'),
      roomCanvasImage: document.querySelector('[data-room-canvas-image]'),
      roomFrameTexture: document.querySelector('[data-room-frame-texture]'),
      viewToggle: document.querySelector('[data-view-toggle]'),
      viewBtns: document.querySelectorAll('[data-view-btn]'),
      /* Desktop summary */
      summaryPanel: document.querySelector('[data-summary-panel]'),
      summaryStyle: document.querySelector('[data-summary-style]'),
      summarySize: document.querySelector('[data-summary-size]'),
      summaryFrame: document.querySelector('[data-summary-frame]'),
      summaryPreview: document.querySelector('[data-summary-preview]'),
      summaryPrice: document.querySelector('[data-summary-price]'),
      summaryCompare: document.querySelector('[data-summary-compare]'),
      checkoutBtn: document.querySelector('[data-checkout-btn]'),
      sellingPlanRadios: document.querySelectorAll('input[name="selling_plan"]'),
      fullPriceEl: document.querySelector('[data-full-price]'),
      depositLabels: document.querySelectorAll('[data-deposit-label]'),
      /* Details panel */
      detailsPanel: document.querySelector('[data-details-panel]'),
      detailsCheckoutBtn: document.querySelector('[data-details-checkout-btn]'),
      detailsBackBtn: document.querySelector('[data-details-back-btn]'),
      detailsArtworkImg: document.querySelector('[data-details-artwork-img]'),
      detailsSourceImg: document.querySelector('[data-details-source-img]'),
      detailsStyle: document.querySelector('[data-details-style]'),
      detailsTone: document.querySelector('[data-details-tone]'),
      detailsSize: document.querySelector('[data-details-size]'),
      detailsFrame: document.querySelector('[data-details-frame]'),
      detailsPrice: document.querySelector('[data-details-price]'),
      detailsFrameLabel: document.querySelector('[data-details-frame-label]'),
      detailsSizeLabel: document.querySelector('[data-details-size-label]'),
      /* Mobile */
      mobileUploadTriggers: document.querySelectorAll('[data-mobile-upload-trigger]'),
      mobileUploadChange: document.querySelector('[data-mobile-upload-change]'),
      mobileUploadEmpty: document.querySelector('[data-mobile-upload-empty]'),
      mobileUploadPreview: document.querySelector('[data-mobile-upload-preview]'),
      mobileUploadImage: document.querySelector('[data-mobile-upload-image]'),
      mobileUploadError: document.querySelector('[data-mobile-upload-error]'),
      mobileStyleGrid: document.querySelector('[data-mobile-style-grid]'),
      mobileStyleCards: document.querySelectorAll('[data-mobile-style-key]'),
      mobileStyleNote: document.querySelector('[data-mobile-style-note]'),
      mobileSizeGrid: document.querySelector('[data-mobile-size-grid]'),
      mobileSizeCards: document.querySelectorAll('[data-mobile-size-key]'),
      mobileFrameGrid: document.querySelector('[data-mobile-frame-grid]'),
      mobileFrameCards: document.querySelectorAll('[data-mobile-frame-key]'),
      mobileCanvasView: document.querySelector('[data-mobile-canvas-view]'),
      mobileRoomView: document.querySelector('[data-mobile-room-view]'),
      mobileViewBtns: document.querySelectorAll('[data-mobile-view-btn]'),
      mobilePreviewEmpty: document.querySelector('[data-mobile-preview-empty]'),
      mobilePreviewReference: document.querySelector('[data-mobile-preview-reference]'),
      mobileReferenceImage: document.querySelector('[data-mobile-reference-image]'),
      mobilePreviewImage: document.querySelector('[data-mobile-preview-image]'),
      mobilePreviewGenerating: document.querySelector('[data-mobile-preview-generating]'),
      mobileProgressFill: document.querySelector('[data-mobile-progress-fill]'),
      mobileProgressText: document.querySelector('[data-mobile-progress-text]'),
      mobileGenerationPhase: document.querySelector('[data-mobile-generation-phase]'),
      mobileFrameTexture: document.querySelector('[data-mobile-frame-texture]'),
      mobileSummary: document.querySelector('[data-mobile-summary]'),
      mobileSummaryStyle: document.querySelector('[data-mobile-summary-style]'),
      mobileSummarySize: document.querySelector('[data-mobile-summary-size]'),
      mobileSummaryFrame: document.querySelector('[data-mobile-summary-frame]'),
      mobileSummaryPrice: document.querySelector('[data-mobile-summary-price]'),
      mobileCtaUpload: document.querySelector('[data-mobile-cta-upload]'),
      mobileCtaGenerate: document.querySelector('[data-mobile-cta-generate]'),
      mobileCtaContinue: document.querySelector('[data-mobile-cta-continue]'),
      mobileUploadCta: document.querySelector('[data-mobile-upload-cta]'),
      mobileGenerateBtn: document.querySelector('[data-mobile-generate-btn]'),
      mobileGenerateLabel: document.querySelector('[data-mobile-generate-label]'),
      mobileCheckoutBtn: document.querySelector('[data-mobile-checkout-btn]'),
      mobileCtaPrice: document.querySelector('[data-mobile-cta-price]'),
      /* Mobile chips */
      chipStyle: document.querySelector('[data-chip-style]'),
      chipSize: document.querySelector('[data-chip-size]'),
      chipFrame: document.querySelector('[data-chip-frame]'),
      /* Mobile steps */
      mobileSteps: document.querySelectorAll('[data-mobile-step]'),
      mobileLines: document.querySelectorAll('[data-mobile-line]'),
      mobileLabels: document.querySelectorAll('[data-mobile-label]')
    };

    bindEvents();

    /* Pre-select first style if none selected */
    if (!state.style && styles.length) {
      state.style = styles[0].key;
    }

    /* Pre-select default selling plan (checked radio) */
    var checkedPlan = document.querySelector('input[name="selling_plan"]:checked');
    if (checkedPlan) {
      state.sellingPlanId = checkedPlan.value;
    }

    updateUI();
    updateFrameTexture();
  }

  function parseJsonData(selector, cb) {
    var el = document.querySelector(selector);
    if (!el) return;
    try { cb(JSON.parse(el.textContent.replace(/,\s*([\]}])/g, '$1'))); }
    catch (e) { console.warn('Failed to parse', selector, e); }
  }

  /* ══════════ Events ══════════ */
  function bindEvents() {
    /* Selling plan selection */
    el.sellingPlanRadios.forEach(function (radio) {
      radio.addEventListener('change', function () {
        state.sellingPlanId = this.value;
        document.querySelectorAll('.pk-selling-plan-option').forEach(function (label) {
          label.style.borderColor = 'var(--pk-border, #e0e0e0)';
          label.style.background = '';
        });
        var activeLabel = this.closest('.pk-selling-plan-option');
        if (activeLabel) {
          activeLabel.style.borderColor = 'var(--pk-accent, #8b6e4e)';
          activeLabel.style.background = 'rgba(139,110,78,0.06)';
        }
      });
    });

    /* Upload triggers (desktop + mobile) */
    el.uploadTriggers.forEach(function (btn) {
      btn.addEventListener('click', function () { el.fileInput && el.fileInput.click(); });
    });
    el.mobileUploadTriggers.forEach(function (btn) {
      btn.addEventListener('click', function () { el.fileInput && el.fileInput.click(); });
    });
    if (el.mobileUploadCta) {
      el.mobileUploadCta.addEventListener('click', function () { el.fileInput && el.fileInput.click(); });
    }

    /* File input */
    if (el.fileInput) {
      el.fileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (file) handleFile(file);
        e.target.value = '';
      });
    }

    /* Upload zone drag & drop (desktop) */
    if (el.uploadZone) {
      el.uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        el.uploadZone.classList.add('pk-upload-zone--dragover');
      });
      el.uploadZone.addEventListener('dragleave', function () {
        el.uploadZone.classList.remove('pk-upload-zone--dragover');
      });
      el.uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        el.uploadZone.classList.remove('pk-upload-zone--dragover');
        var file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      });
    }

    /* Change photo (desktop + mobile) */
    if (el.uploadChange) el.uploadChange.addEventListener('click', function () { el.fileInput && el.fileInput.click(); });
    if (el.mobileUploadChange) el.mobileUploadChange.addEventListener('click', function () { el.fileInput && el.fileInput.click(); });

    /* Desktop style grid */
    if (el.styleGrid) {
      el.styleGrid.addEventListener('click', function (e) {
        var card = e.target.closest('[data-style-key]');
        if (card) handleStyleSelect(card.dataset.styleKey);
      });
    }

    /* Mobile style grid */
    if (el.mobileStyleGrid) {
      el.mobileStyleGrid.addEventListener('click', function (e) {
        var card = e.target.closest('[data-mobile-style-key]');
        if (card) handleStyleSelect(card.dataset.mobileStyleKey);
      });
    }

    /* Desktop size select */
    if (el.sizeSelect) el.sizeSelect.addEventListener('change', function (e) { state.size = e.target.value; updateUI(); });

    /* Mobile size grid */
    if (el.mobileSizeGrid) {
      el.mobileSizeGrid.addEventListener('click', function (e) {
        var card = e.target.closest('[data-mobile-size-key]');
        if (card) { state.size = card.dataset.mobileSizeKey; updateUI(); }
      });
    }

    /* Desktop frame grid */
    if (el.frameGrid) {
      el.frameGrid.addEventListener('click', function (e) {
        var card = e.target.closest('[data-frame-key]');
        if (card) handleFrameSelect(card.dataset.frameKey);
      });
    }

    /* Mobile frame grid */
    if (el.mobileFrameGrid) {
      el.mobileFrameGrid.addEventListener('click', function (e) {
        var card = e.target.closest('[data-mobile-frame-key]');
        if (card) handleFrameSelect(card.dataset.mobileFrameKey);
      });
    }

    /* Generate buttons */
    if (el.generateBtn) el.generateBtn.addEventListener('click', handleGenerate);
    if (el.mobileGenerateBtn) el.mobileGenerateBtn.addEventListener('click', handleGenerate);

    /* Continue to Details (summary panel) */
    if (el.checkoutBtn) el.checkoutBtn.addEventListener('click', handleContinueToDetails);
    if (el.mobileCheckoutBtn) el.mobileCheckoutBtn.addEventListener('click', handleContinueToDetails);

    /* Checkout from Details panel */
    if (el.detailsCheckoutBtn) el.detailsCheckoutBtn.addEventListener('click', handleCheckout);
    if (el.detailsBackBtn) el.detailsBackBtn.addEventListener('click', handleBackToPreview);

    /* View toggle (desktop) */
    el.viewBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { switchView(btn.dataset.viewBtn); });
    });
    /* View toggle (mobile) */
    el.mobileViewBtns.forEach(function (btn) {
      btn.addEventListener('click', function () { switchView(btn.dataset.mobileViewBtn); });
    });
  }

  /* ══════════ Style Selection ══════════ */
  function handleStyleSelect(key) {
    state.style = key;
    updateUI();
  }

  /* ══════════ Frame Selection ══════════ */
  function handleFrameSelect(key) {
    state.frame = key;
    updateFrameTexture();
    updateUI();
  }

  function updateFrameTexture() {
    var frame = frames.find(function (f) { return f.key === state.frame; });
    var textureUrl = frame && frame.image ? frame.image : '';

    /* Desktop */
    if (el.frameTexture) {
      el.frameTexture.style.backgroundImage = textureUrl ? 'url(' + textureUrl + ')' : 'none';
    }
    if (el.previewFrame && frame) {
      el.previewFrame.style.backgroundImage = frame.gradient || '';
    }
    /* Room */
    if (el.roomFrameTexture) {
      el.roomFrameTexture.style.backgroundImage = textureUrl ? 'url(' + textureUrl + ')' : 'none';
    }
    /* Mobile */
    if (el.mobileFrameTexture) {
      el.mobileFrameTexture.style.backgroundImage = textureUrl ? 'url(' + textureUrl + ')' : 'none';
    }
  }

  /* ══════════ View Switch ══════════ */
  function switchView(view) {
    if (state.status === 'generating') return;
    state.view = view;

    /* Desktop */
    if (el.canvasView) el.canvasView.style.display = view === 'canvas' ? '' : 'none';
    if (el.roomView) el.roomView.hidden = view !== 'room';

    /* Mobile */
    if (el.mobileCanvasView) el.mobileCanvasView.style.display = view === 'canvas' ? '' : 'none';
    if (el.mobileRoomView) el.mobileRoomView.hidden = view !== 'room';

    /* Toggle buttons */
    el.viewBtns.forEach(function (btn) {
      btn.classList.toggle('pk-view-toggle__btn--active', btn.dataset.viewBtn === view);
    });
    el.mobileViewBtns.forEach(function (btn) {
      btn.classList.toggle('pk-view-toggle__btn--active', btn.dataset.mobileViewBtn === view);
    });

    /* Update room images */
    if (view === 'room') updateRoomView();
  }

  function updateRoomView() {
    var room = rooms[0];
    if (!room) return;
    if (el.roomImage) el.roomImage.src = room.image;
    if (el.mobileRoomImage) el.mobileRoomImage.src = room.image;
    if (el.roomCanvasImage) el.roomCanvasImage.src = state.resultUrl || '';
    if (el.mobileRoomCanvasImage) {
      var mobileRoomImg = document.querySelector('[data-mobile-room-canvas-image]');
      if (mobileRoomImg) mobileRoomImg.src = state.resultUrl || '';
    }
  }

  /* ══════════ Photo Upload ══════════ */
  function handleFile(file) {
    hideError(el.uploadError);
    hideError(el.mobileUploadError);

    if (ACCEPTED_TYPES.indexOf(file.type) === -1) {
      showError(el.uploadError, 'Please upload a JPG, PNG, or WebP image.');
      showError(el.mobileUploadError, 'Please upload a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      showError(el.uploadError, 'File too large. Maximum size is ' + MAX_SIZE_MB + 'MB.');
      showError(el.mobileUploadError, 'File too large. Maximum size is ' + MAX_SIZE_MB + 'MB.');
      return;
    }

    /* Local preview */
    var previewUrl = URL.createObjectURL(file);
    setUploadImages(previewUrl);
    state.status = 'uploading';
    state.hasGeneratedPreview = false;
    state.resultUrl = '';
    updateUI();

    compressImage(file).then(function (blob) {
      var compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
      return uploadPhoto(compressedFile);
    }).then(function (result) {
      state.photoUrl = result.photo_url;
      state.photoFileId = result.job_id;
      state.status = 'idle';
      updateUI();
    }).catch(function (err) {
      console.error('Upload error:', err);
      showError(el.uploadError, err && err.message ? err.message : 'Upload failed.');
      showError(el.mobileUploadError, err && err.message ? err.message : 'Upload failed.');
      state.status = 'error';
      updateUI();
    });
  }

  function setUploadImages(src) {
    if (el.uploadImage) el.uploadImage.src = src;
    if (el.mobileUploadImage) el.mobileUploadImage.src = src;
    if (el.referenceImage) el.referenceImage.src = src;
    if (el.mobileReferenceImage) el.mobileReferenceImage.src = src;
  }

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var canvas = document.createElement('canvas');
        var ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        var scale = Math.min(1, MAX_LONG_SIDE / Math.max(img.width, img.height));
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (blob && blob.size <= MAX_COMPRESS_BYTES) { resolve(blob); }
          else {
            canvas.toBlob(function (c) { c ? resolve(c) : reject(new Error('Compression failed')); }, 'image/jpeg', 0.7);
          }
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
      img.src = url;
    });
  }

  function uploadPhoto(file) {
    var formData = new FormData();
    formData.append('photo', file);
    return fetch(appUrl + '/api/upload', { method: 'POST', body: formData }).then(function (res) {
      if (!res.ok) throw new Error('Upload failed: ' + res.status);
      return res.json();
    });
  }

  /* ══════════ AI Generation ══════════ */
  function handleGenerate() {
    if (!state.photoUrl || !state.style) return;
    state.status = 'generating';
    state.progress = 5;
    state.errorMessage = '';
    state.view = 'canvas';
    hideError(el.errorMessage);
    updateUI();

    fetch(appUrl + '/api/generate-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_url: state.photoUrl, style: state.style, generate: useRealGeneration })
    }).then(function (res) {
      if (!res.ok) throw new Error('Generate failed: ' + res.status);
      return res.json();
    }).then(function (result) {
      state.jobId = result.job_id;
      if (abortController) abortController.abort();
      abortController = new AbortController();
      state.step = 'preview';
      startPolling(result.job_id, 0);
    }).catch(function (err) {
      console.error('Generate error:', err);
      showError(el.errorMessage, 'Failed to start generation.');
      state.status = 'error';
    });

    updateUI();
  }

  function startPolling(jobId, attempt) {
    var delay = Math.min(2000 * Math.pow(2, attempt), 16000);
    pollTimeout = setTimeout(function () {
      var signal = abortController ? abortController.signal : undefined;
      fetch(appUrl + '/api/job-status/' + jobId, { signal: signal }).then(function (res) {
        if (signal && signal.aborted) return;
        if (!res.ok) throw new Error('Status check failed');
        return res.json();
      }).then(function (result) {
        if (result.status === 'completed') {
          state.resultUrl = result.result_url || '';
          state.progress = 100;
          state.status = 'done';
          state.step = 'preview';
          state.hasGeneratedPreview = true;
          updateUI();
          return;
        }
        if (result.status === 'failed') {
          showError(el.errorMessage, 'Generation failed.');
          state.status = 'error';
          updateUI();
          return;
        }
        state.progress = Math.min(90, 20 + attempt * 12);
        updateUI();
        startPolling(jobId, attempt + 1);
      }).catch(function () {
        if (abortController && abortController.signal.aborted) return;
        startPolling(jobId, attempt + 1);
      });
    }, delay);
  }

  function getGenerationPhase(progress) {
    if (progress < 0.34) return 'Sketching silhouette and expression';
    if (progress < 0.68) return 'Layering painterly light and brush texture';
    return 'Finishing emotional details and varnish glow';
  }

  /* ══════════ Variant Matching ══════════ */
  function findSelectedVariant() {
    if (!variants.length) return null;
    if (!hasSizeOption && !hasFrameOption) {
      return variants.find(function (v) { return v.available; }) || variants[0];
    }
    var matched = variants.find(function (v) {
      var sizeMatch = !hasSizeOption || (v.options.size || '').toLowerCase() === (state.size || '').toLowerCase();
      var frameMatch = !hasFrameOption || (v.options.frame || '').toLowerCase() === (state.frame || '').toLowerCase();
      return sizeMatch && frameMatch;
    }) || variants.find(function (v) { return v.available; }) || variants[0];
    return matched;
  }

  function getCurrentPrice() {
    var v = findSelectedVariant();
    return v ? v.price_formatted : (variants.length ? variants[0].price_formatted : '');
  }

  function getCurrentCompareAtPrice() {
    var v = findSelectedVariant();
    return v && v.compare_at_price_formatted ? v.compare_at_price_formatted : null;
  }

  function getCurrentRawPrice() {
    var v = findSelectedVariant();
    return v ? parseFloat(v.price) : 0;
  }

  function formatMoney(amount) {
    return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function updateSellingPlanPrices() {
    var rawPrice = getCurrentRawPrice();
    if (el.fullPriceEl) {
      el.fullPriceEl.textContent = formatMoney(rawPrice);
    }
    el.depositLabels.forEach(function (label) {
      var pct = parseFloat(label.getAttribute('data-deposit-pct')) || 0;
      var depositAmount = rawPrice * pct / 100;
      var planName = label.getAttribute('data-plan-name') || 'Pay ' + pct + '% Now, ' + (100 - pct) + '% on Shipment';
      label.textContent = planName + ' \u2014 ' + formatMoney(depositAmount) + ' now, balance on shipment';
    });
  }

  /* ══════════ Continue to Details ══════════ */
  function handleContinueToDetails() {
    if (state.status !== 'done' || !state.resultUrl) return;
    state.step = 'details';
    updateUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleBackToPreview() {
    state.step = 'preview';
    updateUI();
  }

  /* ══════════ Checkout ══════════ */
  function handleCheckout() {
    if (state.status !== 'done' || !state.resultUrl) return;
    var variant = findSelectedVariant();
    if (!variant) { showError(el.errorMessage, 'No matching variant found.'); return; }

    state.isCheckoutLoading = true;
    hideError(el.errorMessage);
    updateUI();

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: variant.id,
        quantity: 1,
        selling_plan: state.sellingPlanId || undefined,
        properties: { original_photo_url: state.photoUrl, painting_url: state.resultUrl, style: state.style }
      })
    }).then(function (res) {
      if (!res.ok) throw new Error('Cart add failed');
      window.location.href = '/checkout';
    }).catch(function (err) {
      console.error('Checkout error:', err);
      showError(el.errorMessage, 'Failed to create order.');
      state.isCheckoutLoading = false;
      updateUI();
    });
  }

  /* ══════════ UI Update ══════════ */
  function updateUI() {
    updateStepIndicator();
    updateUploadArea();
    updateStyleSelection();
    updateFrameSelection();
    updateSizeSelection();
    updateGenerateButtons();
    updatePreview();
    updateSummary();
    updateDetailsPanel();
    updateMobileCta();
    updateMobileSteps();
    updateViewToggle();
    updateSelectionChips();
  }

  function updateStepIndicator() {
    el.stepIndicators.forEach(function (s) {
      var key = s.dataset.stepIndicator;
      s.classList.toggle('pk-step-bar__step--active', key === state.step);
      s.classList.toggle('pk-step-bar__step--done',
        (state.step === 'preview' && key === 'create') ||
        (state.step === 'details' && (key === 'create' || key === 'preview'))
      );
    });
  }

  function updateUploadArea() {
    var hasPhoto = !!state.photoUrl || !!(el.uploadImage && el.uploadImage.src && el.uploadImage.src.indexOf('blob:') === 0);
    var isUploading = state.status === 'uploading';

    /* Desktop */
    if (el.uploadEmpty) el.uploadEmpty.style.display = hasPhoto ? 'none' : '';
    if (el.uploadPreview) el.uploadPreview.hidden = !hasPhoto;

    /* Mobile */
    if (el.mobileUploadEmpty) el.mobileUploadEmpty.style.display = hasPhoto ? 'none' : '';
    if (el.mobileUploadPreview) el.mobileUploadPreview.hidden = !hasPhoto;
  }

  function updateStyleSelection() {
    /* Desktop cards */
    el.styleCards.forEach(function (card) {
      var isActive = card.dataset.styleKey === state.style;
      card.classList.toggle('pk-style-card--active', isActive);
      card.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
    /* Mobile cards */
    el.mobileStyleCards.forEach(function (card) {
      var isActive = card.dataset.mobileStyleKey === state.style;
      card.classList.toggle('pk-mobile-style-card--active', isActive);
    });
    /* Update note */
    if (el.mobileStyleNote && state.style) {
      var styleData = styles.find(function (s) { return s.key === state.style; });
      if (styleData && styleData.description) {
        el.mobileStyleNote.textContent = styleData.description;
      }
    }
  }

  function updateFrameSelection() {
    el.frameCards.forEach(function (card) {
      card.classList.toggle('pk-frame-card--active', card.dataset.frameKey === state.frame);
    });
    el.mobileFrameCards.forEach(function (card) {
      card.classList.toggle('pk-mobile-frame-card--active', card.dataset.mobileFrameKey === state.frame);
    });
  }

  function updateSizeSelection() {
    el.mobileSizeCards.forEach(function (card) {
      card.classList.toggle('pk-mobile-size-card--active', card.dataset.mobileSizeKey === state.size);
    });
    /* Sync desktop select */
    if (el.sizeSelect && el.sizeSelect.value !== state.size) {
      var option = el.sizeSelect.querySelector('option[value="' + state.size + '"]');
      if (option) el.sizeSelect.value = state.size;
    }
  }

  function updateGenerateButtons() {
    var canGenerate = state.photoUrl && state.status !== 'uploading' && state.status !== 'generating';
    var isGenerating = state.status === 'generating';
    var label = state.hasGeneratedPreview ? 'Regenerate Preview' : 'Generate Preview';

    /* Desktop */
    if (el.generateBtn) {
      el.generateBtn.disabled = !canGenerate;
      if (el.generateLabel) {
        el.generateLabel.textContent = isGenerating ? 'Generating portrait...' : label;
      }
      if (isGenerating) el.generateBtn.setAttribute('aria-busy', 'true');
      else el.generateBtn.removeAttribute('aria-busy');
    }

    /* Mobile */
    if (el.mobileGenerateBtn) {
      el.mobileGenerateBtn.disabled = !canGenerate;
      if (el.mobileGenerateLabel) {
        el.mobileGenerateLabel.textContent = isGenerating ? 'Generating portrait...' : label;
      }
    }
  }

  function updatePreview() {
    var isGenerating = state.status === 'generating';
    var isDone = state.status === 'done' && state.resultUrl;
    var hasPhoto = !!state.photoUrl;
    var isReferenceStage = hasPhoto && !state.hasGeneratedPreview && !isGenerating;

    /* Update generation phase */
    state.generationPhase = getGenerationPhase(state.progress / 100);

    /* Desktop preview states */
    showHide(el.previewEmpty, !hasPhoto && !isGenerating && !isDone);
    showHide(el.previewReference, isReferenceStage);
    showHide(el.previewImage, isDone);
    showHide(el.previewGenerating, isGenerating);

    /* Play/pause generation video */
    if (el.previewGenerating) {
      var video = el.previewGenerating.querySelector('video');
      if (video) {
        if (isGenerating) { try { video.play(); } catch (e) {} }
        else { video.pause(); }
      }
    }

    if (isDone && el.previewImage) el.previewImage.src = state.resultUrl;

    /* Progress */
    if (isGenerating) {
      var pct = state.progress + '%';
      if (el.progressFill) { el.progressFill.style.width = pct; el.progressFill.setAttribute('aria-valuenow', state.progress); }
      if (el.progressText) el.progressText.textContent = pct;
      if (el.generationPhase) el.generationPhase.textContent = state.generationPhase;
      /* Mobile progress */
      if (el.mobileProgressFill) el.mobileProgressFill.style.width = pct;
      if (el.mobileProgressText) el.mobileProgressText.textContent = pct;
      if (el.mobileGenerationPhase) el.mobileGenerationPhase.textContent = state.generationPhase;
    }

    /* Mobile preview states */
    showHide(el.mobilePreviewEmpty, !hasPhoto && !isGenerating && !isDone);
    showHide(el.mobilePreviewReference, isReferenceStage);
    showHide(el.mobilePreviewImage, isDone);
    showHide(el.mobilePreviewGenerating, isGenerating);

    /* Play/pause mobile generation video */
    if (el.mobilePreviewGenerating) {
      var mvideo = el.mobilePreviewGenerating.querySelector('video');
      if (mvideo) {
        if (isGenerating) { try { mvideo.play(); } catch (e) {} }
        else { mvideo.pause(); }
      }
    }

    if (isDone && el.mobilePreviewImage) el.mobilePreviewImage.src = state.resultUrl;

    /* Aria status */
    if (el.previewStatus) {
      if (isGenerating) el.previewStatus.textContent = 'Generating your painting, ' + state.progress + '% complete.';
      else if (isDone) el.previewStatus.textContent = 'Your painting preview is ready.';
      else el.previewStatus.textContent = '';
    }
  }

  function updateSummary() {
    var isDone = state.status === 'done' && state.resultUrl;
    var styleName = getStyleName(state.style);
    var sizeInfo = SIZE_OPTIONS[state.size];
    var frameData = frames.find(function (f) { return f.key === state.frame; });

    /* Desktop summary */
    showHide(el.summaryPanel, isDone);
    if (el.summaryStyle) el.summaryStyle.textContent = styleName || '—';
    if (el.summarySize) el.summarySize.textContent = sizeInfo ? sizeInfo.metric : (state.size || '—');
    if (el.summaryFrame) el.summaryFrame.textContent = frameData ? frameData.name : (state.frame || '—');
    if (el.summaryPreview) {
      if (isDone) el.summaryPreview.textContent = 'Generated';
      else if (state.status === 'generating') el.summaryPreview.textContent = 'Generating...';
      else el.summaryPreview.textContent = 'Not started';
    }
    if (el.summaryPrice) el.summaryPrice.textContent = getCurrentPrice();
    if (el.summaryCompare) {
      var cp = getCurrentCompareAtPrice();
      if (cp) { el.summaryCompare.textContent = cp; showHide(el.summaryCompare, true); }
      else { showHide(el.summaryCompare, false); }
    }
    /* Update selling plan prices */
    updateSellingPlanPrices();
    if (el.checkoutBtn) {
      el.checkoutBtn.disabled = !isDone || state.isCheckoutLoading;
      el.checkoutBtn.textContent = state.isCheckoutLoading ? 'Creating Order...' : 'Continue to Details';
    }

    /* Mobile summary */
    showHide(el.mobileSummary, isDone);
    if (el.mobileSummaryStyle) el.mobileSummaryStyle.textContent = styleName || '—';
    if (el.mobileSummarySize) el.mobileSummarySize.textContent = sizeInfo ? sizeInfo.metric : (state.size || '—');
    if (el.mobileSummaryFrame) el.mobileSummaryFrame.textContent = frameData ? frameData.name : (state.frame || '—');
    if (el.mobileSummaryPrice) el.mobileSummaryPrice.textContent = getCurrentPrice();
  }

  function updateDetailsPanel() {
    var isDetails = state.step === 'details';

    /* Hide/show main customizer (sidebar + canvas + mobile) */
    if (el.customizerMain) showHide(el.customizerMain, !isDetails);
    showHide(el.detailsPanel, isDetails);

    if (!isDetails) return;

    /* Populate details panel content */
    if (el.detailsArtworkImg && state.resultUrl) el.detailsArtworkImg.src = state.resultUrl;
    if (el.detailsSourceImg && state.photoUrl) el.detailsSourceImg.src = state.photoUrl;

    var styleName = getStyleName(state.style);
    var styleData = styles.find(function (s) { return s.key === state.style; });
    if (el.detailsStyle) el.detailsStyle.textContent = styleName || '—';
    if (el.detailsTone) el.detailsTone.textContent = (styleData && styleData.tone) ? styleData.tone : '—';

    var sizeInfo = SIZE_OPTIONS[state.size];
    if (el.detailsSize) el.detailsSize.textContent = sizeInfo ? sizeInfo.metric : (state.size || '—');
    if (el.detailsSizeLabel) el.detailsSizeLabel.textContent = sizeInfo ? sizeInfo.metric : (state.size || '—');

    var frameData = frames.find(function (f) { return f.key === state.frame; });
    if (el.detailsFrame) el.detailsFrame.textContent = frameData ? frameData.name : (state.frame || '—');
    if (el.detailsFrameLabel) el.detailsFrameLabel.textContent = frameData ? frameData.name : (state.frame || '—');

    if (el.detailsPrice) el.detailsPrice.textContent = getCurrentPrice();

    if (el.detailsCheckoutBtn) {
      el.detailsCheckoutBtn.disabled = state.isCheckoutLoading;
      el.detailsCheckoutBtn.innerHTML = state.isCheckoutLoading ? 'Creating Order...' : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Continue to Secure Payment <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
    }
  }

  function updateMobileCta() {
    var hasPhoto = !!state.photoUrl;
    var isDone = state.status === 'done' && state.resultUrl;
    var isGenerating = state.status === 'generating';

    showHide(el.mobileCtaUpload, !hasPhoto);
    showHide(el.mobileCtaGenerate, hasPhoto && !isDone);
    showHide(el.mobileCtaContinue, isDone);

    if (el.mobileCtaPrice) el.mobileCtaPrice.textContent = getCurrentPrice();
    if (el.mobileCheckoutBtn) {
      el.mobileCheckoutBtn.disabled = state.isCheckoutLoading;
    }
  }

  function updateMobileSteps() {
    var stepIndex = state.hasGeneratedPreview ? 2 : (state.photoUrl ? 1 : 0);

    el.mobileSteps.forEach(function (dot) {
      var idx = parseInt(dot.dataset.mobileStep, 10);
      dot.classList.toggle('pk-mobile-steps__dot--active', idx === stepIndex);
      dot.classList.toggle('pk-mobile-steps__dot--done', idx < stepIndex);
      if (idx < stepIndex) {
        dot.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      } else {
        dot.textContent = '0' + (idx + 1);
      }
    });

    el.mobileLines.forEach(function (line) {
      var idx = parseInt(line.dataset.mobileLine, 10);
      line.className = 'pk-mobile-steps__line-fill';
      if (idx < stepIndex) line.classList.add('pk-mobile-steps__line-fill--done');
      else if (idx === stepIndex) line.classList.add('pk-mobile-steps__line-fill--half');
    });

    el.mobileLabels.forEach(function (label) {
      var idx = parseInt(label.dataset.mobileLabel, 10);
      label.classList.toggle('pk-mobile-steps__label--active', idx === stepIndex);
    });
  }

  function updateViewToggle() {
    var hasPreview = state.hasGeneratedPreview;
    showHide(el.viewToggle, hasPreview);

    /* Enable/disable room button */
    el.viewBtns.forEach(function (btn) {
      if (btn.dataset.viewBtn === 'room') {
        btn.disabled = state.status === 'generating' || !state.hasGeneratedPreview;
      }
    });
    el.mobileViewBtns.forEach(function (btn) {
      if (btn.dataset.mobileViewBtn === 'room') {
        btn.disabled = state.status === 'generating' || !state.hasGeneratedPreview;
      }
    });
  }

  function updateSelectionChips() {
    var styleName = getStyleName(state.style);
    var sizeInfo = SIZE_OPTIONS[state.size];
    var frameData = frames.find(function (f) { return f.key === state.frame; });

    if (el.chipStyle) el.chipStyle.textContent = styleName || 'Classic Oil';
    if (el.chipSize) el.chipSize.textContent = sizeInfo ? sizeInfo.metric : state.size;
    if (el.chipFrame) el.chipFrame.textContent = frameData ? frameData.name : state.frame;
  }

  /* ══════════ Helpers ══════════ */
  function getStyleName(key) {
    var s = styles.find(function (st) { return st.key === key; });
    return s ? s.name : key;
  }

  function showHide(elem, show) {
    if (!elem) return;
    if (show) {
      elem.removeAttribute('hidden');
      elem.style.display = '';
    } else {
      elem.setAttribute('hidden', '');
      elem.style.display = 'none';
    }
  }

  function showError(elem, msg) {
    if (elem) { elem.textContent = msg; elem.hidden = false; elem.style.display = ''; }
  }

  function hideError(elem) {
    if (elem) { elem.textContent = ''; elem.hidden = true; }
  }

  /* ── Cleanup ── */
  window.addEventListener('beforeunload', function () {
    if (abortController) abortController.abort();
    if (pollTimeout) clearTimeout(pollTimeout);
  });

  /* ── Boot ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
