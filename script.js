// Page behaviour outside the 3D hero: header, entrances, tilt, drawn illustrations.
(function () {
  "use strict";

  var root = document.documentElement;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // Header: gains a ground once the page has scrolled, so links stay readable on any section.
  var header = document.querySelector(".site-header");
  if (header) {
    var syncHeader = function () { header.classList.toggle("is-scrolled", window.scrollY > 24); };
    window.addEventListener("scroll", syncHeader, { passive: true });
    syncHeader();
  }

  // Entrances: each block settles into place, once, as it comes into view.
  var reveals = [].slice.call(document.querySelectorAll(".reveal"));
  reveals.forEach(function (el) {
    if (el.getAttribute("data-i")) el.style.setProperty("--i", el.getAttribute("data-i"));
  });
  if ("IntersectionObserver" in window && !reduced) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -4% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  // Drawn illustration: a small calendar with a highlighted range.
  var cal = document.querySelector("[data-cal]");
  if (cal) {
    for (var i = 0; i < 35; i++) {
      var cell = document.createElement("span");
      var day = i - 2; // month starts on a Wednesday
      if (day >= 1 && day <= 30) {
        cell.textContent = String(day);
        if (day === 25 || day === 27) cell.className = "edge";
        else if (day === 26) cell.className = "range";
        if (i % 7 > 4) cell.classList.add("off");
      }
      cal.appendChild(cell);
    }
  }

  // Drawn illustration: towers with lit and dark windows.
  [].slice.call(document.querySelectorAll("[data-windows]")).forEach(function (tower, t) {
    var parts = tower.getAttribute("data-windows").split("x");
    var cols = parseInt(parts[0], 10), rows = parseInt(parts[1], 10);
    tower.style.setProperty("--cols", cols);
    for (var n = 0; n < cols * rows; n++) {
      var w = document.createElement("span");
      if ((n * 7 + t * 5) % 4 === 0) w.className = "lit";
      tower.appendChild(w);
    }
  });

  // Tilt: panels lean toward the pointer, with smoothing.
  if (finePointer && !reduced) {
    [].slice.call(document.querySelectorAll("[data-tilt]")).forEach(function (el) {
      var inner = el.querySelector(".stack3d");
      if (!inner) return;
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      function tick() {
        cx += (tx - cx) * 0.12;
        cy += (ty - cy) * 0.12;
        inner.style.setProperty("--rx", cx.toFixed(2) + "deg");
        inner.style.setProperty("--ry", cy.toFixed(2) + "deg");
        if (Math.abs(tx - cx) > 0.02 || Math.abs(ty - cy) > 0.02) raf = requestAnimationFrame(tick);
        else raf = 0;
      }
      function go() { if (!raf) raf = requestAnimationFrame(tick); }
      el.addEventListener("pointermove", function (e) {
        var r = el.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        tx = -ny * 8;
        ty = nx * 10;
        go();
      });
      el.addEventListener("pointerleave", function () { tx = 0; ty = 0; go(); });
    });
  }

  // Fallback hero when WebGL is unavailable: a tilted grid of day tiles in CSS 3D.
  if (root.classList.contains("no-webgl")) {
    var fb = document.querySelector(".hero-fallback");
    if (fb) {
      for (var k = 0; k < 35; k++) {
        var tile = document.createElement("span");
        if (k % 7 > 4) tile.className = "off";
        tile.style.setProperty("--k", k);
        fb.appendChild(tile);
      }
    }
  }
})();
