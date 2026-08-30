/* ============================================================
   TRENDING ADS — Rocket Typing
   Just one ad on this page: the right-side rail. It's only ever in
   the DOM on wide viewports where it's already visible (see
   .tr-ad-rail CSS, min-width: 1650px), so there's no benefit to
   delaying the push — it's requested as soon as the page loads.

   Safe if AdSense's script is blocked (adblock, slow network, etc.) —
   the push is wrapped so a missing `adsbygoogle` array never throws.
   ============================================================ */
(function () {
  "use strict";

  function init() {
    var ins = document.querySelector(".tr-ad-rail ins.adsbygoogle");
    if (!ins) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) { /* AdSense script not available (blocked/offline) — fail silently */ }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();