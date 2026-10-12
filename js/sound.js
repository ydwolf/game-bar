// Sound effects for every game, synthesized with the Web Audio API — no audio files.
//
//   import { sfx } from "../sound.js";
//   sfx("coin");                 // play a named sound
//   sfx("bounce", { pitch: 1.2, volume: 0.5 });   // optional pitch multiplier / volume (0..1)
//
// Exports: sfx(name, opts?), ambient(place), setMuted(bool), isMuted(), toggleMuted(), SOUND_NAMES
//
// Sounds:
//   blip     short UI / menu tick            tick     quiet clock tick
//   pickup   bright two-note grab            eat      chomp (pickup, lower)
//   coin     gold-coin "ka-ching"            score    rising three-note jingle
//   bounce   soft wooden knock               brick    crunchy brick break
//   thud     low dull impact                 hit      sharp hit / damage
//   explode  noise burst with low boom       shoot    six-shooter crack
//   laser    falling zap                     flap     airy whoosh
//   dash     quick rising swish              power    rising power-up sweep
//   place    "plop" of setting something     chop     axe chop / dig
//   throw    whoosh + low swing              lose     sad falling trombone
//   win      bugle-style fanfare             error    buzzy refusal
//
// Safe everywhere: in Node (tests/fairness.js) or a browser without Web Audio every call is
// a no-op. The AudioContext is created on the first user gesture (browsers block autoplay),
// the same sound can't repeat faster than every ~50 ms, and simultaneous voices are capped.

const HAS_WINDOW = typeof window !== "undefined";
const AC = HAS_WINDOW ? window.AudioContext || window.webkitAudioContext : null;
const MASTER = 0.25;
const MAX_VOICES = 10;
const MIN_GAP = 0.05; // seconds between repeats of the same sound
const STORE_KEY = "gamebar.muted";

let ctx = null;
let master = null;
let noiseBuf = null;
let voices = 0;
const lastPlayed = new Map();

let muted = false;
try {
  muted = HAS_WINDOW && window.localStorage.getItem(STORE_KEY) === "1";
} catch {
  muted = false;
}

function unlock() {
  if (!AC) return;
  try {
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

if (AC) {
  for (const ev of ["pointerdown", "keydown", "touchstart"]) {
    window.addEventListener(ev, unlock, { capture: true, passive: true });
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(m) {
  muted = !!m;
  try {
    if (HAS_WINDOW) window.localStorage.setItem(STORE_KEY, muted ? "1" : "0");
  } catch {
    /* storage blocked — keep the in-memory state */
  }
  try {
    if (master) master.gain.setTargetAtTime(muted ? 0 : MASTER, ctx.currentTime, 0.01);
  } catch {
    /* ignore */
  }
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

// ---------- Building blocks ----------

// Track a voice so we can cap how many play at once
function track(node, stopAt) {
  voices++;
  node.onended = () => {
    voices = Math.max(0, voices - 1);
  };
  node.stop(stopAt);
}

// An oscillator sweeping from f0 to f1 with a quick attack and exponential decay
function tone(o, t0, k) {
  const { type = "square", f0 = 440, f1 = f0, dur = 0.1, vol = 0.5, delay = 0, attack = 0.004 } = o;
  const t = t0 + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0 * k.pitch, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1 * k.pitch), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * k.volume), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  track(osc, t + dur + 0.02);
}

// Filtered white noise with a decay envelope (filter can sweep from q0 to q1)
function noise(o, t0, k) {
  const { dur = 0.15, vol = 0.5, delay = 0, filter = "lowpass", q0 = 2000, q1 = q0, Q = 1, attack = 0.003 } = o;
  const t = t0 + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.playbackRate.value = k.pitch;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.Q.value = Q;
  f.frequency.setValueAtTime(q0, t);
  if (q1 !== q0) f.frequency.exponentialRampToValueAtTime(Math.max(20, q1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol * k.volume), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 0.5);
  track(src, t + dur + 0.02);
}

// ---------- The library ----------

const SOUNDS = {
  blip: [["t", { type: "square", f0: 880, dur: 0.05, vol: 0.25 }]],
  tick: [["t", { type: "triangle", f0: 1500, dur: 0.03, vol: 0.2 }]],
  pickup: [
    ["t", { type: "square", f0: 988, dur: 0.06, vol: 0.25 }],
    ["t", { type: "square", f0: 1318, dur: 0.09, vol: 0.25, delay: 0.05 }],
  ],
  eat: [
    ["t", { type: "square", f0: 300, f1: 600, dur: 0.07, vol: 0.35 }],
    ["n", { dur: 0.06, vol: 0.3, filter: "bandpass", q0: 1800, Q: 2 }],
  ],
  coin: [
    ["t", { type: "square", f0: 1318, dur: 0.05, vol: 0.22 }],
    ["t", { type: "square", f0: 1976, dur: 0.14, vol: 0.22, delay: 0.045 }],
  ],
  score: [
    ["t", { type: "triangle", f0: 523, dur: 0.08, vol: 0.45 }],
    ["t", { type: "triangle", f0: 659, dur: 0.08, vol: 0.45, delay: 0.07 }],
    ["t", { type: "triangle", f0: 784, dur: 0.16, vol: 0.45, delay: 0.14 }],
  ],
  bounce: [["t", { type: "triangle", f0: 520, f1: 380, dur: 0.07, vol: 0.5 }]],
  brick: [
    ["n", { dur: 0.12, vol: 0.5, filter: "bandpass", q0: 1400, q1: 500, Q: 1.5 }],
    ["t", { type: "square", f0: 220, f1: 140, dur: 0.08, vol: 0.2 }],
  ],
  thud: [
    ["t", { type: "sine", f0: 140, f1: 55, dur: 0.18, vol: 0.8 }],
    ["n", { dur: 0.08, vol: 0.3, q0: 600 }],
  ],
  hit: [
    ["t", { type: "sawtooth", f0: 420, f1: 90, dur: 0.18, vol: 0.4 }],
    ["n", { dur: 0.12, vol: 0.4, q0: 3000, q1: 400 }],
  ],
  explode: [
    ["n", { dur: 0.5, vol: 0.8, q0: 2400, q1: 120 }],
    ["t", { type: "sine", f0: 110, f1: 35, dur: 0.4, vol: 0.6 }],
  ],
  shoot: [
    ["n", { dur: 0.09, vol: 0.55, filter: "highpass", q0: 900 }],
    ["t", { type: "square", f0: 900, f1: 200, dur: 0.06, vol: 0.18 }],
  ],
  laser: [["t", { type: "sawtooth", f0: 1600, f1: 300, dur: 0.12, vol: 0.25 }]],
  flap: [["n", { dur: 0.09, vol: 0.45, filter: "bandpass", q0: 700, q1: 1600, Q: 1.2 }]],
  dash: [
    ["n", { dur: 0.16, vol: 0.4, filter: "bandpass", q0: 500, q1: 3000, Q: 2 }],
    ["t", { type: "triangle", f0: 400, f1: 900, dur: 0.12, vol: 0.2 }],
  ],
  power: [["t", { type: "square", f0: 330, f1: 1320, dur: 0.3, vol: 0.25 }]],
  place: [["t", { type: "sine", f0: 700, f1: 260, dur: 0.08, vol: 0.55 }]],
  chop: [
    ["n", { dur: 0.06, vol: 0.55, filter: "bandpass", q0: 2200, Q: 3 }],
    ["t", { type: "triangle", f0: 240, f1: 160, dur: 0.06, vol: 0.4 }],
  ],
  throw: [
    ["n", { dur: 0.22, vol: 0.35, filter: "bandpass", q0: 400, q1: 1800, Q: 1.5 }],
    ["t", { type: "sine", f0: 160, f1: 90, dur: 0.18, vol: 0.35 }],
  ],
  lose: [
    ["t", { type: "sawtooth", f0: 392, f1: 370, dur: 0.18, vol: 0.3 }],
    ["t", { type: "sawtooth", f0: 349, f1: 330, dur: 0.18, vol: 0.3, delay: 0.18 }],
    ["t", { type: "sawtooth", f0: 311, f1: 233, dur: 0.45, vol: 0.3, delay: 0.36 }],
  ],
  win: [
    ["t", { type: "square", f0: 523, dur: 0.1, vol: 0.28 }],
    ["t", { type: "square", f0: 659, dur: 0.1, vol: 0.28, delay: 0.1 }],
    ["t", { type: "square", f0: 784, dur: 0.1, vol: 0.28, delay: 0.2 }],
    ["t", { type: "square", f0: 1047, dur: 0.35, vol: 0.28, delay: 0.3 }],
  ],
  error: [["t", { type: "sawtooth", f0: 140, dur: 0.14, vol: 0.3 }]],
  // Small sounds for living in a place (Life in the Colony)
  step: [["n", { dur: 0.05, vol: 0.35, q0: 900, q1: 300 }]],
  rustle: [["n", { dur: 0.18, vol: 0.3, filter: "bandpass", q0: 2400, q1: 1200, Q: 0.8 }]],
  clink: [
    ["t", { type: "triangle", f0: 2400, f1: 2200, dur: 0.09, vol: 0.25 }],
    ["n", { dur: 0.04, vol: 0.3, filter: "highpass", q0: 2500 }],
  ],
  anvil: [
    ["t", { type: "triangle", f0: 1760, dur: 0.35, vol: 0.22 }],
    ["t", { type: "sine", f0: 2637, dur: 0.25, vol: 0.12 }],
  ],
  sizzle: [["n", { dur: 0.35, vol: 0.18, filter: "highpass", q0: 4000, attack: 0.05 }]],
  bird: [
    ["t", { type: "sine", f0: 2600, f1: 3400, dur: 0.07, vol: 0.12 }],
    ["t", { type: "sine", f0: 2800, f1: 3800, dur: 0.06, vol: 0.1, delay: 0.1 }],
    ["t", { type: "sine", f0: 3000, f1: 2400, dur: 0.09, vol: 0.09, delay: 0.19 }],
  ],
  drip: [["t", { type: "sine", f0: 1400, f1: 700, dur: 0.12, vol: 0.18 }]],
  cricket: [
    ["t", { type: "square", f0: 4200, dur: 0.02, vol: 0.05 }],
    ["t", { type: "square", f0: 4200, dur: 0.02, vol: 0.05, delay: 0.05 }],
    ["t", { type: "square", f0: 4200, dur: 0.02, vol: 0.05, delay: 0.1 }],
  ],
  crackle: [["n", { dur: 0.05, vol: 0.2, filter: "bandpass", q0: 1500, Q: 4 }]],
};

export const SOUND_NAMES = Object.keys(SOUNDS);

export function sfx(name, opts = {}) {
  if (!AC || muted || !ctx || ctx.state !== "running") return;
  const parts = SOUNDS[name];
  if (!parts) return;
  try {
    const now = ctx.currentTime;
    const last = lastPlayed.get(name);
    if (last !== undefined && now - last < MIN_GAP) return;
    if (voices + parts.length > MAX_VOICES) return;
    lastPlayed.set(name, now);
    const k = { pitch: opts.pitch || 1, volume: opts.volume ?? 1 };
    for (const [kind, o] of parts) (kind === "t" ? tone : noise)(o, now, k);
  } catch {
    /* never let sound break a game */
  }
}

// ---------- Ambient beds ----------
// A quiet, continuous background for a place: soft filtered noise (wind, a cave's rumble,
// a stone room). A game calls ambient(name) every frame it's running; if the calls stop —
// paused, left the page, round over — the bed fades out on its own.

const BEDS = {
  village: { filter: "lowpass", freq: 700, vol: 0.05 },
  forest: { filter: "bandpass", freq: 900, vol: 0.07, Q: 0.6 },
  farm: { filter: "lowpass", freq: 900, vol: 0.05 },
  mine: { filter: "lowpass", freq: 180, vol: 0.12 },
  raid: { filter: "lowpass", freq: 260, vol: 0.1 },
};
let bed = null; // { src, filter, gain, name }
let bedSeen = 0;

export function ambient(name) {
  if (!AC || !ctx || ctx.state !== "running") return;
  try {
    bedSeen = performance.now();
    const spec = BEDS[name];
    if (!spec) return;
    if (!bed) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      src.connect(filter).connect(gain).connect(master);
      src.start();
      bed = { src, filter, gain, name: null };
    }
    if (bed.name !== name) {
      const t = ctx.currentTime;
      bed.filter.type = spec.filter;
      bed.filter.Q.value = spec.Q || 0.7;
      bed.filter.frequency.setTargetAtTime(spec.freq, t, 0.3);
      bed.gain.gain.setTargetAtTime(spec.vol, t, 0.5);
      bed.name = name;
    }
  } catch {
    /* never let sound break a game */
  }
}

if (HAS_WINDOW && AC) {
  setInterval(() => {
    if (!bed || performance.now() - bedSeen < 400) return;
    try {
      bed.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25);
      const old = bed;
      bed = null;
      setTimeout(() => {
        try {
          old.src.stop();
        } catch {
          /* already stopped */
        }
      }, 1500);
    } catch {
      bed = null;
    }
  }, 250);
}
