/* ============================================================
   TRENDING LIGHTBOX — Rocket Typing
   Click any image with class "tr-lightbox-img" to open a full-screen,
   zoomable preview (professional-site style click-to-zoom). Uses
   event delegation on document, so it also works for images that get
   inserted later — e.g. the typing-view photo toggle.

   Controls: + / − / reset buttons, mouse wheel to zoom, drag to pan
   when zoomed in, double-click/double-tap to toggle zoom, Escape or
   backdrop click to close.
   ============================================================ */
(function () {
  "use strict";

  var MIN_SCALE = 1, MAX_SCALE = 4, STEP = 0.5;
  var scale = 1, panX = 0, panY = 0;
  var dragging = false, dragStartX = 0, dragStartY = 0, panStartX = 0, panStartY = 0;
  var lastFocusedEl = null;

  var lb, stage, img, caption, btnZoomIn, btnZoomOut, btnReset, btnClose;

  function buildLightbox() {
    lb = document.createElement("div");
    lb.id = "tr-lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Image preview");
    lb.innerHTML =
      '<button id="tr-lightbox-close" aria-label="Close image preview">\u2715</button>' +
      '<div id="tr-lightbox-controls">' +
        '<button id="tr-lightbox-zoomout" aria-label="Zoom out">\u2212</button>' +
        '<button id="tr-lightbox-reset" aria-label="Reset zoom">\u21BA</button>' +
        '<button id="tr-lightbox-zoomin" aria-label="Zoom in">+</button>' +
      '</div>' +
      '<div id="tr-lightbox-stage">' +
        '<img id="tr-lightbox-img" alt="">' +
      '</div>' +
      '<div id="tr-lightbox-caption"></div>';
    document.body.appendChild(lb);

    stage = document.getElementById("tr-lightbox-stage");
    img = document.getElementById("tr-lightbox-img");
    caption = document.getElementById("tr-lightbox-caption");
    btnZoomIn = document.getElementById("tr-lightbox-zoomin");
    btnZoomOut = document.getElementById("tr-lightbox-zoomout");
    btnReset = document.getElementById("tr-lightbox-reset");
    btnClose = document.getElementById("tr-lightbox-close");

    btnZoomIn.addEventListener("click", function () { setScale(scale + STEP, true); });
    btnZoomOut.addEventListener("click", function () { setScale(scale - STEP, true); });
    btnReset.addEventListener("click", function () { setScale(1, true); });
    btnClose.addEventListener("click", close);
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });

    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      setScale(scale + (e.deltaY < 0 ? STEP : -STEP), false, e.clientX, e.clientY);
    }, { passive: false });

    stage.addEventListener("dblclick", function (e) {
      setScale(scale > 1 ? 1 : 2, false, e.clientX, e.clientY);
    });

    stage.addEventListener("pointerdown", function (e) {
      if (scale <= 1) return;
      dragging = true;
      stage.classList.add("dragging");
      dragStartX = e.clientX; dragStartY = e.clientY;
      panStartX = panX; panStartY = panY;
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      panX = panStartX + (e.clientX - dragStartX);
      panY = panStartY + (e.clientY - dragStartY);
      applyTransform();
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) {
      stage.addEventListener(ev, function () { dragging = false; stage.classList.remove("dragging"); });
    });

    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("open")) return;
      if (e.key === "Escape") close();
      else if (e.key === "+" || e.key === "=") setScale(scale + STEP, true);
      else if (e.key === "-") setScale(scale - STEP, true);
    });
  }

  function applyTransform() {
    img.style.transform = "translate3d(" + panX + "px, " + panY + "px, 0) scale(" + scale + ")";
    stage.classList.toggle("zoomed", scale > 1);
  }

  function setScale(next, resetPan) {
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, next));
    if (resetPan || scale === 1) { panX = 0; panY = 0; }
    applyTransform();
  }

  function open(src, alt, captionText, triggerEl) {
    if (!lb) buildLightbox();
    lastFocusedEl = triggerEl || document.activeElement;
    img.src = src;
    img.alt = alt || "";
    caption.textContent = captionText || "";
    scale = 1; panX = 0; panY = 0;
    applyTransform();
    lb.classList.add("open");
    document.body.classList.add("tr-lightbox-open");
    btnClose.focus();
  }

  function close() {
    if (!lb) return;
    lb.classList.remove("open");
    document.body.classList.remove("tr-lightbox-open");
    img.src = "";
    if (lastFocusedEl && typeof lastFocusedEl.focus === "function") lastFocusedEl.focus();
  }

  // Event delegation: works for images present now AND images inserted
  // later (e.g. the typing-view photo toggle building new <img> nodes).
  document.addEventListener("click", function (e) {
    var target = e.target.closest ? e.target.closest(".tr-lightbox-img") : null;
    if (!target) return;
    var full = target.getAttribute("data-full") || target.currentSrc || target.src;
    var captionEl = target.closest("figure");
    var captionText = captionEl ? (captionEl.querySelector("figcaption") || {}).textContent : "";
    open(full, target.alt, captionText, target);
  });
})();
