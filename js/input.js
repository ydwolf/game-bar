// Every side of every game is driven by an Input. A human's keyboard, touch pad or mouse
// writes into it, or a bot does — the game can't tell the difference, so bots have to play
// with exactly the same controls (and limits) as a person.

import { clamp, DIR_NAMES } from "./util.js";

const ACTIONS = [...DIR_NAMES, "action", "action2"];

export class Input {
  constructor() {
    this.held = {};
    this.pressed = {};
    for (const a of ACTIONS) {
      this.held[a] = false;
      this.pressed[a] = false;
    }
    this.dirs = []; // directions pressed this frame, in order
    this.target = null; // where a pointer / bot wants the cursor (or paddle, or gap) to go
    this.pendingFire = false; // fire "action" once the cursor reaches the target
  }

  // One-shot press, for this frame only
  press(action) {
    this.pressed[action] = true;
    if (DIR_NAMES.includes(action)) this.dirs.push(action);
  }

  down(action) {
    if (!this.held[action]) this.press(action);
    this.held[action] = true;
  }

  up(action) {
    this.held[action] = false;
  }

  endFrame() {
    for (const a of ACTIONS) this.pressed[a] = false;
    this.dirs.length = 0;
  }
}

// Aiming roles (the Defender, Raider, Mason, Rock thrower) move a cursor. Keys/pad move it
// directly; a mouse click or a bot sets a target and the cursor glides there at the same
// capped speed, then fires if asked.
export function stepCursor(c, input, dt) {
  const h = input.held;
  let dx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
  let dy = (h.down ? 1 : 0) - (h.up ? 1 : 0);
  if (c.lockY) dy = 0;

  if (dx || dy) {
    input.target = null;
    input.pendingFire = false;
    const len = Math.hypot(dx, dy);
    c.x += (dx / len) * c.speed * dt;
    c.y += (dy / len) * c.speed * dt;
  } else if (input.target) {
    const tx = clamp(input.target.x, c.x0, c.x1);
    const ty = c.lockY ? c.y : clamp(input.target.y, c.y0, c.y1);
    const dist = Math.hypot(tx - c.x, ty - c.y);
    const step = c.speed * dt;
    if (dist <= step) {
      c.x = tx;
      c.y = ty;
      input.target = null;
      if (input.pendingFire) {
        input.pendingFire = false;
        input.press("action");
      }
    } else {
      c.x += ((tx - c.x) / dist) * step;
      c.y += ((ty - c.y) / dist) * step;
    }
  }
  c.x = clamp(c.x, c.x0, c.x1);
  c.y = clamp(c.y, c.y0, c.y1);
}

// Keyboard layouts. One human gets both arrow keys and WASD; two humans split the keyboard.
export const KEY_SCHEMES = {
  solo: {
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    action: ["Space", "Enter"],
    action2: ["ShiftLeft", "ShiftRight", "KeyE"],
  },
  a: {
    up: ["KeyW"],
    down: ["KeyS"],
    left: ["KeyA"],
    right: ["KeyD"],
    action: ["Space"],
    action2: ["KeyQ"],
  },
  b: {
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    action: ["Enter"],
    action2: ["Slash"],
  },
};

export const SCHEME_LABELS = {
  solo: { dirs: "Arrows / WASD", action: "Space", action2: "Shift" },
  a: { dirs: "WASD", action: "Space", action2: "Q" },
  b: { dirs: "Arrows", action: "Enter", action2: "/" },
};
