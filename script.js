// Page behaviour: the leave planner, scroll entrances and the drawn illustrations.
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // ---------- Dates ----------
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function sameDay(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
  function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }
  function dayMonth(d) { return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); }
  function withWeekday(d) { return DAYS[d.getDay()].slice(0, 3) + " " + dayMonth(d); }
  function longLabel(d) { return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }
  function workingDays(a, b) {
    var n = 0;
    for (var d = a; d.getTime() <= b.getTime(); d = addDays(d, 1)) if (!isWeekend(d)) n++;
    return n;
  }

  // ---------- Leave planner ----------
  var grid = document.getElementById("cal-days");
  var monthEl = document.getElementById("cal-month");
  var resultEl = document.getElementById("cal-result");
  var clearBtn = document.getElementById("cal-clear");
  var prevBtn = document.getElementById("cal-prev");
  var nextBtn = document.getElementById("cal-next");

  if (grid && monthEl && resultEl && clearBtn && prevBtn && nextBtn) {
    var today = startOfDay(new Date());
    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    var focusDate = today;
    var start = null, end = null, hover = null;
    var cells = [];

    var build = function (moveFocus) {
      grid.textContent = "";
      cells = [];
      monthEl.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();

      var offset = (view.getDay() + 6) % 7; // weeks start on Monday
      var count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var total = Math.ceil((offset + count) / 7) * 7;

      // Keep the roving tab stop on a day that exists in this month.
      if (focusDate.getMonth() !== view.getMonth() || focusDate.getFullYear() !== view.getFullYear()) {
        if (start && start.getMonth() === view.getMonth() && start.getFullYear() === view.getFullYear()) focusDate = start;
        else if (today.getMonth() === view.getMonth() && today.getFullYear() === view.getFullYear()) focusDate = today;
        else focusDate = view;
      }

      for (var i = 0; i < total; i++) {
        var n = i - offset + 1;
        if (n < 1 || n > count) {
          var blank = document.createElement("span");
          blank.className = "blank";
          blank.setAttribute("aria-hidden", "true");
          blank.style.setProperty("--n", i);
          grid.appendChild(blank);
          continue;
        }
        var date = new Date(view.getFullYear(), view.getMonth(), n);
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "day";
        btn.setAttribute("aria-label", longLabel(date));
        btn.style.setProperty("--n", i);
        var num = document.createElement("span");
        num.className = "num";
        num.textContent = String(n);
        var tag = document.createElement("span");
        tag.className = "tag";
        tag.setAttribute("aria-hidden", "true");
        btn.appendChild(num);
        btn.appendChild(tag);
        grid.appendChild(btn);
        cells.push({ date: date, el: btn, tag: tag });
      }

      paint();
      if (moveFocus) focusCell();
    };

    var focusCell = function () {
      for (var i = 0; i < cells.length; i++) {
        if (sameDay(cells[i].date, focusDate)) { cells[i].el.focus(); return; }
      }
    };

    var inPreview = function (d) {
      if (!start || end || !hover) return false;
      var lo = hover.getTime() < start.getTime() ? hover : start;
      var hi = hover.getTime() < start.getTime() ? start : hover;
      return d.getTime() >= lo.getTime() && d.getTime() <= hi.getTime();
    };

    var paint = function () {
      cells.forEach(function (c) {
        var d = c.date;
        var isStart = sameDay(d, start), isEnd = sameDay(d, end);
        var inRange = !!(start && end) && d.getTime() > start.getTime() && d.getTime() < end.getTime();
        c.el.classList.toggle("is-start", isStart);
        c.el.classList.toggle("is-end", isEnd);
        c.el.classList.toggle("is-range", inRange);
        c.el.classList.toggle("is-preview", !isStart && !isEnd && inPreview(d));
        c.el.classList.toggle("is-today", sameDay(d, today));
        c.el.classList.toggle("is-weekend", isWeekend(d));
        c.el.setAttribute("aria-pressed", isStart || isEnd ? "true" : "false");
        c.el.tabIndex = sameDay(d, focusDate) ? 0 : -1;
        c.tag.textContent = isStart && isEnd ? "Day off" : isStart ? "First day" : isEnd ? "Last day" : sameDay(d, today) ? "Today" : "";
      });

      clearBtn.hidden = !start;
      if (!start) {
        resultEl.textContent = "No dates chosen yet.";
      } else if (!end) {
        resultEl.textContent = withWeekday(start) + " chosen. Now pick the last day.";
      } else {
        var n = workingDays(start, end);
        var sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
        var span = sameDay(start, end) ? withWeekday(start)
          : sameMonth ? start.getDate() + " to " + dayMonth(end)
          : dayMonth(start) + " to " + dayMonth(end);
        resultEl.textContent = span + ", " + n + " working " + (n === 1 ? "day" : "days") + ".";
      }
    };

    var pick = function (d) {
      if (!start || end) { start = d; end = null; }
      else if (d.getTime() < start.getTime()) { start = d; }
      else { end = d; }
      focusDate = d;
      hover = null;
      paint();
    };

    var go = function (monthDelta, moveFocus) {
      view = new Date(view.getFullYear(), view.getMonth() + monthDelta, 1);
      build(moveFocus);
    };

    // Move the focused day; the month turns over when the day leaves it.
    var moveTo = function (d) {
      focusDate = d;
      if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) {
        view = new Date(d.getFullYear(), d.getMonth(), 1);
        build(true);
      } else {
        paint();
        focusCell();
      }
    };

    grid.addEventListener("click", function (e) {
      var btn = e.target.closest ? e.target.closest(".day") : null;
      if (!btn) return;
      for (var i = 0; i < cells.length; i++) if (cells[i].el === btn) { pick(cells[i].date); return; }
    });

    grid.addEventListener("mouseover", function (e) {
      var btn = e.target.closest ? e.target.closest(".day") : null;
      if (!btn || !start || end) return;
      for (var i = 0; i < cells.length; i++) {
        if (cells[i].el === btn) { hover = cells[i].date; paint(); return; }
      }
    });
    grid.addEventListener("mouseleave", function () {
      if (hover) { hover = null; paint(); }
    });

    grid.addEventListener("keydown", function (e) {
      var d = focusDate, next = null;
      switch (e.key) {
        case "ArrowLeft": next = addDays(d, -1); break;
        case "ArrowRight": next = addDays(d, 1); break;
        case "ArrowUp": next = addDays(d, -7); break;
        case "ArrowDown": next = addDays(d, 7); break;
        case "Home": next = addDays(d, -((d.getDay() + 6) % 7)); break;
        case "End": next = addDays(d, 6 - ((d.getDay() + 6) % 7)); break;
        case "PageUp":
        case "PageDown": {
          var step = e.key === "PageUp" ? -1 : 1;
          var last = new Date(d.getFullYear(), d.getMonth() + step + 1, 0).getDate();
          next = new Date(d.getFullYear(), d.getMonth() + step, Math.min(d.getDate(), last));
          break;
        }
        default: return;
      }
      e.preventDefault();
      moveTo(next);
    });

    prevBtn.addEventListener("click", function () { go(-1, false); });
    nextBtn.addEventListener("click", function () { go(1, false); });
    clearBtn.addEventListener("click", function () {
      start = null; end = null; hover = null;
      paint();
    });

    build(false);
  }

  // ---------- Entrances ----------
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

  // ---------- Drawn illustrations ----------
  // A small month starting on a Sunday (Nov 2026), Monday-first, with a three-day leave range.
  var cal = document.querySelector("[data-cal]");
  if (cal) {
    for (var i = 0; i < 42; i++) {
      var cell = document.createElement("span");
      var day = i - 5;
      if (day >= 1 && day <= 30) {
        cell.textContent = String(day);
        if (day === 25 || day === 27) cell.className = "edge";
        else if (day === 26) cell.className = "range";
        else if (i % 7 > 4) cell.className = "off";
      }
      cal.appendChild(cell);
    }
  }

  // Towers with lit and dark windows.
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
})();
