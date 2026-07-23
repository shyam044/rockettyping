/* ============================================================
   ads.js — Shared, device-friendly ad loader for Rocket Typing
   ------------------------------------------------------------
   - Each ad unit renders inside its own iframe, so multiple
     different atOptions configs on one page never overwrite
     each other (a common bug when placing several of these
     network tags directly on the same page).
   - Below-the-fold units (in-content rectangle, footer banner,
     native banner) are lazy-loaded with IntersectionObserver:
     they only fire a request once a visitor actually scrolls
     near them. This avoids wasted/unseen impressions and raises
     the site's overall viewable-impression rate, which is what
     most ad networks reward with a higher effective CPM.
   - The top slot swaps to a small mobile banner under 768px so
     nothing overflows or pushes content around on phones, and
     the skyscraper sidebars only mount on screens wide enough
     to fit them beside the article without overlapping it.
   ============================================================ */
(function () {
  "use strict";

  var AD_UNITS = {
    topDesktop:   { key: "ec2cd2e3ac271efe174e656e9ef09deb", width: 728, height: 90  },
    topMobile:    { key: "e8642ebc1588f7663a0e84f1c8058052", width: 320, height: 50  },
    sidebarLeft:  { key: "f9fd656d91c4953d559c8174661c6df8", width: 160, height: 600 },
    sidebarRight: { key: "e3a304a061bb8b53fdbf045abe87c573", width: 160, height: 300 },
    rectangle:    { key: "c0570a980250971b0f952672ff8a136a", width: 300, height: 250 },
    footerBanner: { key: "95b624fbbcc4571e53cd5d3a062f9758", width: 468, height: 60  }
  };

  var NATIVE_SRC = "https://pl30277778.effectivecpmnetwork.com/42f27a48e35d8fefd79d32771cdb9094/invoke.js";
  var NATIVE_CONTAINER_ID = "container-42f27a48e35d8fefd79d32771cdb9094";

  function renderAd(container, unit) {
    if (!container || container.getAttribute("data-ad-loaded")) return;
    container.setAttribute("data-ad-loaded", "1");

    var iframe = document.createElement("iframe");
    iframe.title = "Advertisement";
    iframe.scrolling = "no";
    iframe.style.border = "0";
    iframe.style.overflow = "hidden";
    iframe.style.width = unit.width + "px";
    iframe.style.height = unit.height + "px";
    iframe.style.maxWidth = "100%";
    container.appendChild(iframe);

    var doc = iframe.contentWindow.document;
    doc.open();
    doc.write(
      "<!DOCTYPE html><html><head><style>" +
      "html,body{margin:0;padding:0;overflow:hidden;background:transparent;}" +
      "</style></head><body>" +
      "<script>atOptions=" +
      JSON.stringify({ key: unit.key, format: "iframe", height: unit.height, width: unit.width, params: {} }) +
      ";<\/script>" +
      '<script src="https://www.highperformanceformat.com/' + unit.key + '/invoke.js"><\/script>' +
      "</body></html>"
    );
    doc.close();
  }

  function renderNative(container) {
    if (!container || container.getAttribute("data-ad-loaded")) return;
    container.setAttribute("data-ad-loaded", "1");

    var target = document.createElement("div");
    target.id = NATIVE_CONTAINER_ID;
    container.appendChild(target);

    var script = document.createElement("script");
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src = NATIVE_SRC;
    container.appendChild(script);
  }

  function lazyMount(container, mountFn) {
    if (!container) return;
    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            mountFn(container);
            observer.unobserve(container);
          }
        });
      }, { rootMargin: "300px 0px" });
      observer.observe(container);
    } else {
      mountFn(container);
    }
  }

  function initTopSlot() {
    var slot = document.getElementById("ad-top");
    if (!slot) return;
    var isMobile = window.matchMedia("(max-width: 767px)").matches;
    renderAd(slot, isMobile ? AD_UNITS.topMobile : AD_UNITS.topDesktop);
  }

  function initSidebars() {
    if (!window.matchMedia("(min-width: 1360px)").matches) return;
    var left = document.getElementById("ad-sidebar-left");
    var right = document.getElementById("ad-sidebar-right");
    if (left) renderAd(left, AD_UNITS.sidebarLeft);
    if (right) renderAd(right, AD_UNITS.sidebarRight);
  }

  function initLazySlots() {
    document.querySelectorAll('[data-ad="rectangle"]').forEach(function (el) {
      lazyMount(el, function (c) { renderAd(c, AD_UNITS.rectangle); });
    });
    document.querySelectorAll('[data-ad="footer-banner"]').forEach(function (el) {
      lazyMount(el, function (c) { renderAd(c, AD_UNITS.footerBanner); });
    });
    document.querySelectorAll('[data-ad="native"]').forEach(function (el) {
      lazyMount(el, renderNative);
    });
  }

  function init() {
    initTopSlot();
    initSidebars();
    initLazySlots();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Handles rotation/resize (e.g. tablet turned landscape) so the
  // sidebar or the correct top-slot size can still mount if it
  // didn't fit at initial load. Already-loaded slots are skipped.
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      initTopSlot();
      initSidebars();
    }, 350);
  });
})();
