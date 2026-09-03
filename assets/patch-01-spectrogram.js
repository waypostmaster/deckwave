/* DECKWAVE PATCH 01 — spectrogram v4 · RETIRED 2026-09-01, DELIBERATELY EMPTY

   This file used to re-register the 'waterfall' panel over the one in
   deckwave-panels.js, because the device-pixel fix (getImageData works in
   device pixels and ignores the canvas transform; fillRect does not) was
   written here and never moved home. deckwave-panels.js meanwhile carried a
   comment asserting that its own copy was "already the newest version",
   which was false, and the page only ever got the fixed panel because this
   script happened to load. One failed request and the screen would silently
   have shown the ledger-17 panel with the boot gate none the wiser — a
   second implementation of a calibrated instrument, kept in step by nothing.

   The implementation IS deckwave-panels.js's now, calibration numbers
   carried over unchanged, and index.html no longer loads this file. It is
   left in the tree as an empty seam rather than deleted so that a stale
   cached copy of index.html cannot resurrect the old panel, and so the two
   references to it in docs/LEARNINGS-RECOVERED.md still land somewhere.

   Reviewed 2026-09-01 (M12). If you are here to change the spectrogram, the
   panel is in deckwave-panels.js — there is one of it. Do not register a
   second here.  */
(function () {
  /* intentionally nothing */
})();
