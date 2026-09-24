// The game table: runs a first-to-3 match between two seats, each played by a human or the
// computer. Handles keyboard (split in two when both seats are human), mouse/touch, on-screen
// pads, the round countdown, pausing, and the scoreboard.

import { createRoundSet, tick } from "./engine.js";
import { KEY_SCHEMES, SCHEME_LABELS } from "./input.js";
import { skillAt, ROUNDS_TO_WIN } from "./util.js";

const $ = (id) => document.getElementById(id);
const SEAT_COLORS = ["#f3e6c9", "#f08a6e"];

export const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// The mouse/touchscreen goes to the first human seat whose role can use it
export function pointerSeat(game, humans) {
  return humans.findIndex((h, i) => h && game.sides[i].pointer);
}

function schemeFor(humans, side) {
  return humans[0] && humans[1] ? (side === 0 ? "a" : "b") : "solo";
}

// Plain-language controls for one seat, for the setup screen and under the table
export function describeControls(game, humans, side) {
  const role = game.sides[side];
  if (!humans[side]) return "Played by the computer";
  const parts = [];
  if (isTouch) {
    const touchBoard = pointerSeat(game, humans) === side && role.pointerHint;
    return touchBoard ? `${role.pointerHint}, or use your pad` : "Use your pad";
  }
  const keys = SCHEME_LABELS[schemeFor(humans, side)];
  const c = role.controls;
  if (c.dirs) parts.push(`${keys.dirs}: ${c.dirs}`);
  if (c.action) parts.push(`${keys.action}: ${c.action}`);
  if (c.action2) parts.push(`${keys.action2}: ${c.action2}`);
  if (pointerSeat(game, humans) === side && role.pointerHint) parts.push(role.pointerHint);
  return parts.join(" · ");
}

export function whoLabel(humans, side) {
  if (!humans[side]) return "Computer";
  if (humans[0] && humans[1]) return side === 0 ? "Player 1" : "Player 2";
  return "You";
}

export function createCabinet({ onSwap }) {
  const canvas = $("game");
  const ctx = canvas.getContext("2d");
  const screen = $("screen");
  const overlay = $("overlay");
  const table = $("table");

  let game = null;
  let humans = [true, false];
  let set = null;
  let wins = [0, 0];
  let round = 1;
  let phase = "idle"; // countdown | play | roundEnd | over
  let phaseTime = 0;
  let paused = false;
  let raf = null;
  let last = 0;
  let pointerSide = -1;
  let statusText = "";
  const keyMap = new Map();

  // ---------- Match flow ----------

  function start(g, h) {
    stop();
    game = g;
    humans = h.slice();
    canvas.width = game.width;
    canvas.height = game.height;
    screen.style.setProperty("--w", `${game.width}px`);
    screen.style.setProperty("--aspect", String(game.width / game.height));
    table.style.setProperty("--accent", game.accent);
    $("play-title").textContent = game.title;
    $("play-kicker").textContent = game.kicker;
    setupSeats();
    newMatch();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibility);
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("visibilitychange", onVisibility);
    game = null;
    set = null;
    phase = "idle";
  }

  // Keys, pointer and pads depend on who sits where
  function setupSeats() {
    keyMap.clear();
    humans.forEach((h, side) => {
      if (!h) return;
      for (const [action, codes] of Object.entries(KEY_SCHEMES[schemeFor(humans, side)])) {
        for (const code of codes) {
          if (!keyMap.has(code)) keyMap.set(code, []);
          keyMap.get(code).push({ side, action });
        }
      }
    });
    pointerSide = pointerSeat(game, humans);
    screen.classList.toggle("aims", pointerSide >= 0 && game.sides[pointerSide].pointer === "aim");
    buildPads();
    renderSeats();
    renderControls();
  }

  function newMatch() {
    wins = [0, 0];
    round = 1;
    paused = false;
    newRound();
  }

  function newRound() {
    const skills = humans.map((h) => (h ? null : skillAt(round)));
    set = createRoundSet(game, round, skills);
    phase = "countdown";
    phaseTime = 2.5;
    hideOverlay();
    renderSeats();
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused) step(dt);
    render();
    raf = requestAnimationFrame(frame);
  }

  function step(dt) {
    if (phase === "countdown") {
      phaseTime -= dt;
      if (phaseTime <= 0) phase = "play";
    } else if (phase === "play") {
      const w = tick(set, dt);
      if (w === 0 || w === 1) endRound(w);
    } else if (phase === "roundEnd") {
      phaseTime -= dt;
      if (phaseTime <= 0) {
        round++;
        newRound();
      }
    }
  }

  function endRound(w) {
    wins[w]++;
    renderSeats();
    const role = game.sides[w];
    const score = `${game.sides[0].emoji} ${wins[0]} – ${wins[1]} ${game.sides[1].emoji}`;
    if (wins[w] >= ROUNDS_TO_WIN) {
      phase = "over";
      const humanCount = humans.filter(Boolean).length;
      let verdict = "";
      if (humanCount === 1) verdict = humans[w] ? "You win the match!" : "The computer takes this one.";
      else if (humanCount === 2) verdict = `${whoLabel(humans, w)} wins the match!`;
      showOverlay(`${role.emoji} ${role.name} wins!`, `${set.round.endReason}\n${score}\n${verdict}`, [
        { label: "Rematch", primary: true, onClick: newMatch },
        { label: "Swap seats", onClick: swapSeats },
        { label: "Back to the bar", onClick: () => (location.hash = "#/") },
      ]);
    } else {
      phase = "roundEnd";
      phaseTime = 2.8;
      showOverlay(`${role.emoji} ${role.name} takes round ${round}`, `${set.round.endReason}\n${score}`);
    }
  }

  function swapSeats() {
    humans = [humans[1], humans[0]];
    onSwap(game.id, humans.slice());
    setupSeats();
    newMatch();
  }

  function togglePause() {
    if (phase === "over" || phase === "idle") return;
    paused = !paused;
    if (paused) {
      showOverlay("Paused", "Take a breather, partner.", [
        { label: "Resume", primary: true, onClick: togglePause },
        { label: "Leave the table", onClick: () => (location.hash = "#/") },
      ]);
    } else {
      hideOverlay();
    }
  }

  function onVisibility() {
    if (document.hidden && !paused && (phase === "play" || phase === "countdown")) togglePause();
  }

  // ---------- Input ----------

  function onKeyDown(e) {
    if (!game) return;
    if (e.code === "Escape" || e.code === "KeyP") {
      if (!e.repeat) togglePause();
      e.preventDefault();
      return;
    }
    const binds = keyMap.get(e.code);
    if (!binds || paused || phase === "over" || !set) return; // let overlay buttons get Enter/Space
    e.preventDefault();
    if (e.repeat) return;
    for (const { side, action } of binds) set.inputs[side].down(action);
  }

  function onKeyUp(e) {
    const binds = keyMap.get(e.code);
    if (!binds || !set) return;
    for (const { side, action } of binds) set.inputs[side].up(action);
  }

  function canvasPoint(e) {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * canvas.width) / r.width, y: ((e.clientY - r.top) * canvas.height) / r.height };
  }

  let swipe = null;
  screen.addEventListener("pointerdown", (e) => {
    if (!game || !set || pointerSide < 0 || paused || phase === "over" || e.target.closest("button")) return;
    e.preventDefault();
    const input = set.inputs[pointerSide];
    const pt = canvasPoint(e);
    swipe = { x: e.clientX, y: e.clientY };
    const mode = game.sides[pointerSide].pointer;
    if (mode === "aim") {
      input.target = pt;
      input.pendingFire = true;
    } else if (mode === "x" || mode === "y") {
      input.target = pt;
      input.press("action");
    } else if (mode === "tap") {
      input.press("action");
    }
    if (screen.setPointerCapture) screen.setPointerCapture(e.pointerId);
  });

  screen.addEventListener("pointermove", (e) => {
    if (!game || !set || pointerSide < 0) return;
    const mode = game.sides[pointerSide].pointer;
    if (!["aim", "x", "y"].includes(mode)) return;
    if (e.pointerType !== "mouse" && !e.buttons) return;
    set.inputs[pointerSide].target = canvasPoint(e);
  });

  screen.addEventListener("pointerup", (e) => {
    if (!game || !set || !swipe || pointerSide < 0) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    swipe = null;
    if (game.sides[pointerSide].pointer !== "swipe") return;
    const input = set.inputs[pointerSide];
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) input.press("action");
    else if (Math.abs(dx) > Math.abs(dy)) input.press(dx > 0 ? "right" : "left");
    else input.press(dy > 0 ? "down" : "up");
  });

  screen.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (set && pointerSide >= 0 && !paused) set.inputs[pointerSide].press("action2");
  });

  $("pause-btn").addEventListener("click", togglePause);

  // ---------- Touch pads ----------

  const ARROWS = { up: "▲", down: "▼", left: "◀", right: "▶" };
  const PAD_DIRS = { four: ["up", "left", "right", "down"], lr: ["left", "right"], ud: ["up", "down"], ship: ["left", "right", "up"] };

  function buildPads() {
    const pads = [$("pad-a"), $("pad-b")];
    for (const p of pads) {
      p.innerHTML = "";
      p.hidden = true;
    }
    const seated = [0, 1].filter((i) => humans[i]);
    seated.forEach((side) => {
      const el = seated.length === 2 && side === 1 ? pads[1] : pads[0];
      el.hidden = false;
      fillPad(el, side);
    });
    table.classList.toggle("has-pad", seated.length > 0);
    table.classList.toggle("two-pads", seated.length === 2);
  }

  function padButton(side, action, label, extra = "") {
    const b = document.createElement("button");
    b.className = `pad-btn ${extra}`.trim();
    b.textContent = label;
    b.setAttribute("aria-label", action);
    let held = false;
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (!set || paused) return;
      held = true;
      b.classList.add("pressed");
      set.inputs[side].down(action);
    });
    const release = () => {
      if (!held) return;
      held = false;
      b.classList.remove("pressed");
      if (set) set.inputs[side].up(action);
    };
    for (const t of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(t, release);
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    return b;
  }

  function fillPad(el, side) {
    const role = game.sides[side];
    const cfg = role.pad;
    const label = document.createElement("div");
    label.className = "pad-label";
    label.textContent = `${role.emoji} ${role.name}`;
    el.appendChild(label);
    const row = document.createElement("div");
    row.className = "pad-row";
    if (cfg.dirs) {
      const dirs = document.createElement("div");
      dirs.className = cfg.dirs === "four" ? "dpad" : "pad-group";
      for (const d of PAD_DIRS[cfg.dirs]) {
        const b = padButton(side, d, ARROWS[d]);
        b.dataset.dir = d;
        dirs.appendChild(b);
      }
      row.appendChild(dirs);
    }
    const acts = document.createElement("div");
    acts.className = "pad-group";
    if (cfg.action2) acts.appendChild(padButton(side, "action2", cfg.action2, "wide alt"));
    if (cfg.action) acts.appendChild(padButton(side, "action", cfg.action, "wide"));
    row.appendChild(acts);
    el.appendChild(row);
  }

  // ---------- HUD ----------

  function renderSeats() {
    [0, 1].forEach((side) => {
      const role = game.sides[side];
      const el = $(side === 0 ? "seat-a" : "seat-b");
      const pips = "●".repeat(wins[side]) + "○".repeat(ROUNDS_TO_WIN - wins[side]);
      el.innerHTML = "";
      const parts = [
        ["seat-emoji", role.emoji],
        ["seat-name", role.name],
        ["seat-who", whoLabel(humans, side)],
        ["seat-pips", pips],
      ];
      for (const [cls, text] of parts) {
        const span = document.createElement("span");
        span.className = cls;
        span.textContent = text;
        el.appendChild(span);
      }
      el.style.setProperty("--seat", SEAT_COLORS[side]);
      el.classList.toggle("is-human", humans[side]);
    });
  }

  function renderControls() {
    const el = $("controls");
    el.innerHTML = "";
    if (!humans[0] && !humans[1]) {
      el.textContent = "Computer vs computer — sit back and watch. Esc to pause.";
      return;
    }
    [0, 1].forEach((side) => {
      if (!humans[side]) return;
      const line = document.createElement("span");
      line.className = "controls-line";
      line.textContent = `${game.sides[side].emoji} ${game.sides[side].name}: ${describeControls(game, humans, side)}`;
      el.appendChild(line);
    });
    const hint = document.createElement("span");
    hint.className = "controls-line";
    hint.textContent = isTouch ? "" : "Esc or P to pause";
    el.appendChild(hint);
  }

  // ---------- Drawing ----------

  function drawCursor(c, side) {
    ctx.save();
    ctx.strokeStyle = SEAT_COLORS[side];
    ctx.fillStyle = SEAT_COLORS[side];
    ctx.lineWidth = 2;
    if (c.lockY) {
      // Ground target marker
      ctx.beginPath();
      ctx.moveTo(c.x, c.y - 4);
      ctx.lineTo(c.x - 8, c.y - 18);
      ctx.lineTo(c.x + 8, c.y - 18);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(c.x + dx * 5, c.y + dy * 5);
        ctx.lineTo(c.x + dx * 14, c.y + dy * 14);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    if (!set) return;
    const r = set.round;
    r.draw(ctx);
    if (r.cursors) r.cursors.forEach((c, i) => c && drawCursor(c, i));

    if (phase === "countdown") {
      ctx.fillStyle = "rgba(28, 17, 10, 0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f3e6c9";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const size = Math.round(canvas.width / 16);
      ctx.font = `${size}px "Rye", Georgia, serif`;
      ctx.fillText(`Round ${round}`, canvas.width / 2, canvas.height / 2 - size);
      ctx.font = `${size * 2}px "Rye", Georgia, serif`;
      ctx.fillText(String(Math.ceil(phaseTime)), canvas.width / 2, canvas.height / 2 + size * 0.6);
      ctx.textBaseline = "alphabetic";
    }

    const text = `Round ${round} · ${r.status()}`;
    if (text !== statusText) {
      statusText = text;
      $("status").textContent = text;
    }
  }

  // ---------- Overlay ----------

  function showOverlay(title, text, buttons = []) {
    overlay.querySelector("h2").textContent = title;
    overlay.querySelector("p").textContent = text;
    const box = overlay.querySelector(".overlay-buttons");
    box.innerHTML = "";
    for (const b of buttons) {
      const el = document.createElement("button");
      el.className = b.primary ? "btn primary" : "btn";
      el.textContent = b.label;
      el.addEventListener("click", b.onClick);
      box.appendChild(el);
    }
    overlay.classList.remove("hidden");
    const first = box.querySelector("button");
    if (first) first.focus({ preventScroll: true });
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  return { start, stop };
}

