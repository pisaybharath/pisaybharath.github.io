// 3D leave calendar for the hero. Bundled with esbuild into assets/hero3d.js.
// Each day of the month is a lit block. Weekdays stand taller than weekends,
// the pointer lifts a block, two clicks pick a leave range, and the camera
// follows the page scroll from an angled view down to a flat top view.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, HemisphereLight,
  DirectionalLight, Mesh, BoxGeometry, PlaneGeometry, MeshStandardMaterial,
  MeshBasicMaterial, ShadowMaterial, CanvasTexture, Raycaster, Vector2, Vector3, Group,
  SRGBColorSpace, PCFShadowMap, MathUtils
} from "three";

(function () {
  "use strict";

  var root = document.documentElement;
  var canvas = document.getElementById("scene");
  var track = document.querySelector(".hero-track");
  var stage = document.querySelector(".hero-stage");
  var monthEl = document.getElementById("cal-month");
  var resultEl = document.getElementById("cal-result");
  var liveEl = document.getElementById("scene-live");
  var clearBtn = document.getElementById("cal-clear");
  var prevBtn = document.getElementById("cal-prev");
  var nextBtn = document.getElementById("cal-next");
  if (!canvas || !track || !stage || !monthEl || !resultEl || !liveEl || !clearBtn || !prevBtn || !nextBtn) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var renderer;
  try {
    renderer = new WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
    if (!renderer.getContext()) throw new Error("no context");
  } catch (err) {
    root.classList.add("no-webgl");
    return;
  }
  root.classList.add("webgl-ready");

  var MONTHS = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var COLS = 7, ROWS = 6, PITCH = 1.2, SIZE = 1.04;

  var PALETTE = {
    bg: 0x071c21, ground: 0x061519, plate: 0x0a4a53,
    weekday: 0x14808b, weekend: 0x0d4b54, today: 0xe9f0f2,
    inRange: 0xf6d58a, edge: 0xf3b53f
  };
  var INK = "#16222c", CHALK = "#f2f5f7", DIM = "#9fc1c6";

  // ---------- Scene ----------
  var scene = new Scene();
  scene.background = new Color(PALETTE.bg);
  scene.fog = new Fog(PALETTE.bg, 16, 38);

  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  var camera = new PerspectiveCamera(30, 1, 0.1, 80);

  scene.add(new HemisphereLight(0xcfeff2, 0x06181c, 0.75));

  var key = new DirectionalLight(0xfff0d2, 3.1);
  key.position.set(-5.5, 10, 6.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7; key.shadow.camera.right = 7;
  key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 1; key.shadow.camera.far = 32;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  var rim = new DirectionalLight(0x6fd2dc, 0.9);
  rim.position.set(6, 4, -6);
  scene.add(rim);

  var ground = new Mesh(
    new PlaneGeometry(80, 80),
    new ShadowMaterial({ color: 0x000000, opacity: 0.55 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.14; // sits under the base slab so the two never share a surface
  ground.receiveShadow = true;
  scene.add(ground);

  var plate = new Mesh(
    new BoxGeometry(COLS * PITCH + 0.5, 0.14, ROWS * PITCH + 0.5),
    new MeshStandardMaterial({ color: PALETTE.plate, roughness: 0.7 })
  );
  plate.position.y = -0.07;
  plate.castShadow = true;
  plate.receiveShadow = true;
  scene.add(plate);

  var blockGeo = new BoxGeometry(SIZE, 1, SIZE);
  blockGeo.translate(0, 0.5, 0);
  var labelGeo = new PlaneGeometry(SIZE * 0.86, SIZE * 0.86);
  labelGeo.rotateX(-Math.PI / 2);

  // ---------- Calendar state ----------
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function sameDay(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function isWeekend(d) { return d.getDay() === 0 || d.getDay() === 6; }
  function short(d) { return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); }
  function longLabel(d) { return DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }

  var today = startOfDay(new Date());
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var focusDate = today;
  var start = null, end = null;
  var hoverIdx = -1;
  var keyboardMode = false;
  var canvasFocused = false;

  var cells = [];
  var blocks = [];
  var texReady = false;

  function makeCell(i) {
    var group = new Group();
    var col = i % COLS, row = Math.floor(i / COLS);
    group.position.set((col - (COLS - 1) / 2) * PITCH, 0, (row - (ROWS - 1) / 2) * PITCH);

    var mat = new MeshStandardMaterial({ color: PALETTE.weekday, roughness: 0.5, metalness: 0.06 });
    var block = new Mesh(blockGeo, mat);
    block.castShadow = true;
    block.receiveShadow = true;
    block.userData.index = i;
    group.add(block);

    var cv = document.createElement("canvas");
    cv.width = 192; cv.height = 192;
    var tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    var labelMat = new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false });
    var label = new Mesh(labelGeo, labelMat);
    group.add(label);

    scene.add(group);
    blocks.push(block);
    return {
      group: group, block: block, mat: mat, label: label, tex: tex, cv: cv, ctx: cv.getContext("2d"),
      date: null, h: 0, v: 0, introAt: 0, color: new Color(PALETTE.weekday),
      glow: 0, warm: 0, drawKey: "", col: col, row: row
    };
  }
  for (var i = 0; i < COLS * ROWS; i++) cells.push(makeCell(i));

  function baseHeight(d) {
    var n = d.getDate();
    if (isWeekend(d)) return 0.3 + ((n * 3) % 3) * 0.06;
    return 0.8 + (((n * 7) + d.getMonth() * 3) % 5) * 0.14;
  }

  function layoutMonth(now, animate) {
    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    var lead = (first.getDay() + 6) % 7;
    var total = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      var n = i - lead + 1;
      if (n >= 1 && n <= total) {
        c.date = new Date(view.getFullYear(), view.getMonth(), n);
        c.group.visible = true;
      } else {
        c.date = null;
        c.group.visible = false;
      }
      c.drawKey = "";
      if (animate && !reduced) {
        c.h = 0; c.v = 0;
        c.introAt = now + 250 + (c.col + c.row) * 70;
      } else {
        c.introAt = 0;
      }
    }
    monthEl.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
  }

  function cellIndexFor(date) {
    if (!date) return -1;
    if (date.getMonth() !== view.getMonth() || date.getFullYear() !== view.getFullYear()) return -1;
    var first = new Date(view.getFullYear(), view.getMonth(), 1);
    return ((first.getDay() + 6) % 7) + date.getDate() - 1;
  }

  function workingDays(a, b) {
    var n = 0;
    for (var d = a; d <= b; d = addDays(d, 1)) if (!isWeekend(d)) n++;
    return n;
  }

  function summary() {
    if (!start) {
      resultEl.textContent = "No dates chosen yet.";
      clearBtn.hidden = true;
      return;
    }
    clearBtn.hidden = false;
    if (!end) { resultEl.textContent = short(start) + " chosen. Now pick the last day."; return; }
    var n = workingDays(start, end);
    var range = sameDay(start, end) ? short(start) : short(start) + " to " + short(end);
    resultEl.textContent = n === 0
      ? range + ": no working days."
      : range + ": " + n + (n === 1 ? " working day." : " working days.");
  }

  function choose(date) {
    focusDate = date;
    if (!start || (start && end)) { start = date; end = null; }
    else if (date < start) { end = start; start = date; }
    else { end = date; }
    summary();
    liveEl.textContent = longLabel(date) + (end ? ", last day" : ", first day");
    requestFrame();
  }

  function changeMonth(delta) {
    view = new Date(view.getFullYear(), view.getMonth() + delta, 1);
    if (focusDate.getMonth() !== view.getMonth() || focusDate.getFullYear() !== view.getFullYear()) {
      focusDate = new Date(view.getFullYear(), view.getMonth(), 1);
    }
    hoverIdx = -1;
    layoutMonth(performance.now(), true);
    requestFrame();
  }

  // ---------- Labels ----------
  function drawLabel(c, color) {
    var ctx = c.ctx;
    ctx.clearRect(0, 0, 192, 192);
    ctx.fillStyle = color;
    ctx.font = '700 84px "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(c.date.getDate()), 96, 100);
    c.tex.needsUpdate = true;
  }

  // ---------- Sizing ----------
  var vw = 1, vh = 1;
  function resize() {
    var r = stage.getBoundingClientRect();
    vw = Math.max(1, Math.round(r.width));
    vh = Math.max(1, Math.round(r.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(vw, vh, false);
    camera.aspect = vw / vh;
    if (vw >= 900) camera.setViewOffset(vw, vh, -vw * 0.22, 0, vw, vh);
    else camera.setViewOffset(vw, vh, 0, -vh * 0.08, vw, vh);
    camera.updateProjectionMatrix();
    requestFrame();
  }

  // ---------- Camera ----------
  var ISO = new Vector3(6.4, 7.2, 9.0);
  var TOP = new Vector3(0, 14, 3.4);
  var camPos = new Vector3();
  var camLook = new Vector3();
  var px = 0, py = 0, tpx = 0, tpy = 0;
  var progress = 0, targetProgress = 0;

  function scrollTarget() {
    var total = Math.max(1, track.offsetHeight - window.innerHeight);
    var top = track.getBoundingClientRect().top;
    return MathUtils.clamp(-top / total, 0, 1);
  }
  function ease(t) { return t * t * (3 - 2 * t); }

  function updateCamera() {
    var e = ease(progress);
    var aspect = camera.aspect;
    var fit = vw >= 900 ? Math.max(1.55, 2.2 / aspect) : MathUtils.clamp(1.5 / aspect, 1, 3.4);
    camPos.copy(ISO).lerp(TOP, e);
    camPos.x += px * 1.1 * (1 - e * 0.6);
    camPos.z += py * 0.7 * (1 - e * 0.6);
    camPos.multiplyScalar(fit);
    camLook.set(0, 0.4 * (1 - e), 0);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    // Keep the fog behind the scene however far the camera sits.
    var dist = camPos.length();
    scene.fog.near = dist + 5;
    scene.fog.far = dist + 30;
  }

  // ---------- Per-frame update ----------
  var tmpColor = new Color();
  var raycaster = new Raycaster();
  var ndc = new Vector2();

  function update(dt, now) {
    var s = 1 - 0.7 * ease(progress);
    var t = now / 1000;
    var settled = true;

    for (var i = 0; i < cells.length; i++) {
      var c = cells[i];
      if (!c.date) continue;
      var d = c.date;
      var isEdge = sameDay(d, start) || sameDay(d, end);
      var inRange = !!(start && end && d > start && d < end);
      var isToday = sameDay(d, today);
      var weekend = isWeekend(d);
      var focused = keyboardMode && canvasFocused && i === cellIndexFor(focusDate);
      var hot = i === hoverIdx || focused;

      var base = baseHeight(d);
      var lift = (hot ? 0.42 : 0) + (isEdge ? 0.5 : 0) + (inRange ? 0.22 : 0) + (isToday ? 0.18 : 0);
      var bob = reduced ? 0 : Math.sin(t * 0.9 + i * 0.7) * 0.025 * (weekend ? 0.4 : 1);
      var target = now < c.introAt ? 0 : base * s + lift + bob;

      if (reduced) { c.h = target; c.v = 0; }
      else {
        // damped spring with a little overshoot
        c.v += (target - c.h) * 70 * dt;
        c.v *= Math.exp(-9 * dt);
        c.h += c.v * dt;
        if (Math.abs(target - c.h) > 0.002 || Math.abs(c.v) > 0.01) settled = false;
      }
      if (c.h < 0.001) c.h = 0.001;

      c.block.scale.y = c.h;
      c.label.position.y = c.h + 0.012;

      var goal = isEdge ? PALETTE.edge : inRange ? PALETTE.inRange : isToday ? PALETTE.today : weekend ? PALETTE.weekend : PALETTE.weekday;
      tmpColor.setHex(goal);
      if (reduced) c.color.copy(tmpColor);
      else {
        var before = c.color.getHex();
        c.color.lerp(tmpColor, 1 - Math.exp(-12 * dt));
        if (c.color.getHex() !== before || c.color.getHex() !== tmpColor.getHex()) settled = false;
      }
      c.mat.color.copy(c.color);

      var glowGoal = hot ? 0.1 : 0;
      var warmGoal = isEdge || inRange ? 0.34 : 0;
      var k = reduced ? 1 : 1 - Math.exp(-14 * dt);
      c.glow += (glowGoal - c.glow) * k;
      c.warm += (warmGoal - c.warm) * k;
      // Selected blocks glow in their own colour so their shaded sides stay golden, not olive.
      c.mat.emissive.copy(c.color).multiplyScalar(c.warm);
      c.mat.emissive.r += c.glow; c.mat.emissive.g += c.glow * 0.9; c.mat.emissive.b += c.glow * 0.6;

      var drawKey = (isEdge || inRange || isToday) ? "ink" : weekend ? "dim" : "chalk";
      if (texReady && c.drawKey !== drawKey + d.getTime()) {
        c.drawKey = drawKey + d.getTime();
        drawLabel(c, drawKey === "ink" ? INK : drawKey === "dim" ? DIM : CHALK);
      }
    }
    return settled;
  }

  // ---------- Loop ----------
  var raf = 0, last = performance.now(), inView = true;
  var lastP = -1;

  function frame(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    targetProgress = scrollTarget();
    progress += (targetProgress - progress) * (reduced ? 1 : 1 - Math.exp(-dt * 9));
    if (Math.abs(progress - targetProgress) < 0.0005) progress = targetProgress;
    px += (tpx - px) * (1 - Math.exp(-dt * 4));
    py += (tpy - py) * (1 - Math.exp(-dt * 4));

    if (Math.abs(progress - lastP) > 0.001) {
      stage.style.setProperty("--p", progress.toFixed(4));
      lastP = progress;
    }

    var settled = update(dt, now);
    updateCamera();
    renderer.render(scene, camera);

    var moving = Math.abs(progress - targetProgress) > 0.0005 || Math.abs(px - tpx) > 0.001 || Math.abs(py - tpy) > 0.001;
    // Keep animating while visible. With reduced motion, only draw while something changes.
    if (inView && !document.hidden && (!reduced || moving || !settled)) {
      raf = requestAnimationFrame(frame);
    }
  }
  function requestFrame() {
    if (!raf && inView && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function checkVisible() {
    var r = track.getBoundingClientRect();
    inView = r.bottom > 0 && r.top < window.innerHeight;
    if (inView) requestFrame();
  }

  // ---------- Pointer + keyboard ----------
  function pick(ev) {
    var r = canvas.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -(((ev.clientY - r.top) / r.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    var hits = raycaster.intersectObjects(blocks, false);
    for (var i = 0; i < hits.length; i++) {
      var idx = hits[i].object.userData.index;
      if (cells[idx].date) return idx;
    }
    return -1;
  }

  canvas.addEventListener("pointermove", function (ev) {
    keyboardMode = false;
    var r = canvas.getBoundingClientRect();
    tpx = ((ev.clientX - r.left) / r.width - 0.5) * 2;
    tpy = ((ev.clientY - r.top) / r.height - 0.5) * 2;
    var idx = pick(ev);
    if (idx !== hoverIdx) { hoverIdx = idx; canvas.style.cursor = idx >= 0 ? "pointer" : "default"; }
    requestFrame();
  });
  canvas.addEventListener("pointerleave", function () {
    hoverIdx = -1; tpx = 0; tpy = 0; canvas.style.cursor = "default"; requestFrame();
  });
  canvas.addEventListener("click", function (ev) {
    keyboardMode = false;
    var idx = pick(ev);
    if (idx >= 0) { hoverIdx = idx; choose(cells[idx].date); }
  });
  canvas.addEventListener("focus", function () { canvasFocused = true; requestFrame(); });
  canvas.addEventListener("blur", function () { canvasFocused = false; requestFrame(); });
  canvas.addEventListener("keydown", function (ev) {
    var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
    if (step !== undefined) {
      ev.preventDefault();
      keyboardMode = true;
      var next = addDays(focusDate, step);
      if (next.getMonth() !== view.getMonth() || next.getFullYear() !== view.getFullYear()) {
        view = new Date(next.getFullYear(), next.getMonth(), 1);
        layoutMonth(performance.now(), true);
      }
      focusDate = next;
      liveEl.textContent = longLabel(focusDate) + (isWeekend(focusDate) ? ", weekend" : "");
      requestFrame();
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      keyboardMode = true;
      choose(focusDate);
    }
  });

  prevBtn.addEventListener("click", function () { changeMonth(-1); });
  nextBtn.addEventListener("click", function () { changeMonth(1); });
  clearBtn.addEventListener("click", function () { start = null; end = null; summary(); requestFrame(); });

  window.addEventListener("scroll", function () { checkVisible(); requestFrame(); }, { passive: true });
  window.addEventListener("resize", function () { resize(); checkVisible(); });
  document.addEventListener("visibilitychange", function () { if (!document.hidden) requestFrame(); });
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);

  // ---------- Start ----------
  layoutMonth(performance.now(), true);
  summary();
  resize();
  progress = targetProgress = scrollTarget();
  requestFrame();

  var fontReady = document.fonts && document.fonts.load
    ? document.fonts.load('700 84px "Bricolage Grotesque"')
    : Promise.resolve();
  fontReady.catch(function () {}).then(function () {
    texReady = true;
    for (var i = 0; i < cells.length; i++) cells[i].drawKey = "";
    requestFrame();
  });

  // Hook for the build check: report that the scene is live.
  canvas.setAttribute("data-ready", "true");
})();
