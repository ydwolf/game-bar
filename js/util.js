// Small helpers shared by the cabinet, the games and their bots.

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const randInt = (n) => Math.floor(Math.random() * n);
export const pick = (arr) => arr[randInt(arr.length)];
export const chance = (p) => Math.random() < p;

export const DIR_NAMES = ["up", "down", "left", "right"];
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
export const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

// Shortest wrap-around angle difference, in (-PI, PI]
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Breadth-first search over a grid. Returns distances from (sx, sy); -1 = unreachable.
export function bfs(w, h, sx, sy, passable) {
  const dist = new Int16Array(w * h).fill(-1);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  dist[sy * w + sx] = 0;
  queue[tail++] = sy * w + sx;
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    for (const name of DIR_NAMES) {
      const nx = x + DIRS[name][0];
      const ny = y + DIRS[name][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (dist[j] !== -1 || !passable(nx, ny)) continue;
      dist[j] = dist[i] + 1;
      queue[tail++] = j;
    }
  }
  return dist;
}

// How many cells can be reached from (sx, sy), stopping early at `limit`.
export function floodCount(w, h, sx, sy, passable, limit) {
  const seen = new Uint8Array(w * h);
  const stack = [sy * w + sx];
  seen[sy * w + sx] = 1;
  let count = 0;
  while (stack.length && count < limit) {
    const i = stack.pop();
    count++;
    const x = i % w;
    const y = (i / w) | 0;
    for (const name of DIR_NAMES) {
      const nx = x + DIRS[name][0];
      const ny = y + DIRS[name][1];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (seen[j] || !passable(nx, ny)) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return count;
}

// A bot's "reaction time": tick() returns true when the bot may make its next decision.
// The period jitters so bots don't feel robotic.
export class Clock {
  constructor(period) {
    this.period = period;
    this.t = Math.random() * period;
  }
  tick(dt) {
    this.t -= dt;
    if (this.t > 0) return false;
    this.t += this.period * rand(0.7, 1.3);
    return true;
  }
}

export const ROUNDS_TO_WIN = 3;

// Computer skill (0..1) by round, so the computer opponent sharpens as the match goes on.
export function skillAt(round) {
  return [0.3, 0.45, 0.6, 0.72, 0.85][clamp(round, 1, 5) - 1];
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
