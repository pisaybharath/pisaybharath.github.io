// Leave-date picker for the hero. No external requests, no innerHTML.
(function () {
  "use strict";

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  var grid = document.getElementById("cal-grid");
  var monthLabel = document.getElementById("cal-month");
  var result = document.getElementById("cal-result");
  var clearBtn = document.getElementById("cal-clear");
  var prevBtn = document.getElementById("cal-prev");
  var nextBtn = document.getElementById("cal-next");
  if (!grid || !monthLabel || !result || !clearBtn || !prevBtn || !nextBtn) return;

  var today = startOfDay(new Date());
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var focusDate = today;
  var start = null;
  var end = null;

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function sameDay(a, b) {
    return !!a && !!b && a.getTime() === b.getTime();
  }
  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }
  function isWeekend(d) {
    return d.getDay() === 0 || d.getDay() === 6;
  }
  function short(d) {
    return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3);
  }
  function longLabel(d) {
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function workingDays(a, b) {
    var count = 0;
    for (var d = a; d <= b; d = addDays(d, 1)) {
      if (!isWeekend(d)) count++;
    }
    return count;
  }

  function summary() {
    if (!start) {
      result.textContent = "No dates chosen yet.";
      clearBtn.hidden = true;
      return;
    }
    clearBtn.hidden = false;
    if (!end) {
      result.textContent = short(start) + " chosen. Now pick the last day.";
      return;
    }
    var n = workingDays(start, end);
    var range = sameDay(start, end) ? short(start) : short(start) + " to " + short(end);
    if (n === 0) {
      result.textContent = range + ": no working days.";
    } else {
      result.textContent = range + ": " + n + (n === 1 ? " working day." : " working days.");
    }
  }

  function render(shouldFocus) {
    var monthText = MONTHS[view.getMonth()] + " " + view.getFullYear();
    // Only change the live region when the month changes, so screen readers
    // don't re-announce it on every date click.
    if (monthLabel.textContent !== monthText) monthLabel.textContent = monthText;
    while (grid.firstChild) grid.removeChild(grid.firstChild);

    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    var lead = (first.getDay() + 6) % 7; // Monday-first grid
    var total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();

    for (var i = 0; i < lead; i++) {
      var blank = document.createElement("span");
      blank.className = "day is-blank";
      blank.setAttribute("aria-hidden", "true");
      grid.appendChild(blank);
    }

    var focusInView = focusDate.getMonth() === view.getMonth() &&
      focusDate.getFullYear() === view.getFullYear();

    for (var n = 1; n <= total; n++) {
      var date = new Date(view.getFullYear(), view.getMonth(), n);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "day";
      btn.textContent = String(n);
      btn.dataset.time = String(date.getTime());

      var label = longLabel(date);
      if (isWeekend(date)) { btn.classList.add("is-weekend"); label += ", weekend"; }
      if (sameDay(date, today)) { btn.classList.add("is-today"); label += ", today"; }

      var isEdge = sameDay(date, start) || sameDay(date, end);
      var inRange = start && end && date > start && date < end;
      if (isEdge) btn.classList.add("is-edge");
      else if (inRange) btn.classList.add("in-range");
      btn.setAttribute("aria-pressed", isEdge || inRange ? "true" : "false");
      btn.setAttribute("aria-label", label);

      var isFocusTarget = focusInView ? sameDay(date, focusDate) : n === 1;
      btn.tabIndex = isFocusTarget ? 0 : -1;
      if (isFocusTarget && shouldFocus) {
        // focus after insertion below
        btn.dataset.focus = "1";
      }
      grid.appendChild(btn);
    }

    var toFocus = grid.querySelector("[data-focus]");
    if (toFocus) { toFocus.focus(); delete toFocus.dataset.focus; }
    summary();
  }

  function choose(date) {
    focusDate = date;
    if (!start || (start && end)) {
      start = date;
      end = null;
    } else if (date < start) {
      end = start;
      start = date;
    } else {
      end = date;
    }
    render(true);
  }

  function moveView(delta) {
    view = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    focusDate = new Date(view.getFullYear(), view.getMonth(), 1);
    render(false);
  }

  grid.addEventListener("click", function (e) {
    var btn = e.target.closest("button.day");
    if (!btn || !grid.contains(btn)) return;
    var time = Number(btn.dataset.time);
    if (!isFinite(time)) return;
    choose(startOfDay(new Date(time)));
  });

  grid.addEventListener("keydown", function (e) {
    var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    focusDate = addDays(focusDate, step);
    view = new Date(focusDate.getFullYear(), focusDate.getMonth(), 1);
    render(true);
  });

  prevBtn.addEventListener("click", function () { moveView(-1); });
  nextBtn.addEventListener("click", function () { moveView(1); });
  clearBtn.addEventListener("click", function () {
    start = null;
    end = null;
    render(false);
  });

  render(false);
})();
