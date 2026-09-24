// Missile Command — the Raider rains meteors on six frontier towns; the Defender bursts
// cannon shells in their path. Blasts catch meteors, and caught meteors blow up too.
import { clamp, lerp, rand, chance, Clock } from "../util.js";

const W = 640;
const H = 480;
const GROUND = 440;
const CANNON = { x: W / 2, y: GROUND - 14 };
const TOWN_XS = [70, 150, 230, 410, 490, 570];
const TOWN_HALF = 24;
const SHELL_SPEED = 480;
const BLAST_R = 32;
const BLAST_TIME = 1.1;
const SPLIT_COST = 2;
const TOWNS_TO_WIN = 4; // the raider needs to flatten this many

function createRound({ level, inputs }) {
  // Per-level numbers tuned with tests/fairness.js
  const supply = [12, 14, 16, 18, 20][level - 1];
  const r = {
    level,
    towns: TOWN_XS.map((x) => ({ x, alive: true })),
    meteors: [],
    shells: [],
    blasts: [],
    supply, // meteors the raider has left to drop
    ammo: supply - [0, 1, 2, 3, 4][level - 1],
    cooldown: 0.8,
    launchEvery: [0.6, 0.55, 0.5, 0.45, 0.4][level - 1],
    meteorSpeed: [110, 118, 126, 138, 150][level - 1],
    time: 0,
    winner: null,
    endReason: "",
  };
  r.cursors = [
    { x: W / 2, y: H / 2, speed: 550, x0: 0, x1: W, y0: 20, y1: GROUND - 30 },
    { x: W / 2, y: GROUND - 6, speed: 320 + 20 * (level - 1), x0: 20, x1: W - 20, y0: GROUND - 6, y1: GROUND - 6, lockY: true },
  ];

  const end = (winner, reason) => {
    r.winner = winner;
    r.endReason = reason;
  };

  function launch(tx, sx = clamp(tx + rand(-220, 220), 20, W - 20), sy = 0) {
    const len = Math.hypot(tx - sx, GROUND - sy);
    r.meteors.push({ sx, sy, x: sx, y: sy, tx, vx: ((tx - sx) / len) * r.meteorSpeed, vy: ((GROUND - sy) / len) * r.meteorSpeed, split: false });
  }

  function split() {
    // Splits the lowest meteor still high enough in the sky into three
    const c = r.cursors[1];
    const m = r.meteors.filter((x) => !x.split && x.y < GROUND * 0.7).sort((a, b) => b.y - a.y)[0];
    if (!m || r.supply < SPLIT_COST) return;
    r.supply -= SPLIT_COST;
    m.done = true;
    for (const dx of [-80, 0, 80]) {
      launch(clamp(c.x + dx, 20, W - 20), m.x, m.y);
      r.meteors[r.meteors.length - 1].split = true;
    }
  }

  function fire(c) {
    if (r.ammo <= 0) return;
    r.ammo--;
    const len = Math.hypot(c.x - CANNON.x, c.y - CANNON.y) || 1;
    r.shells.push({
      x: CANNON.x, y: CANNON.y, tx: c.x, ty: c.y,
      vx: ((c.x - CANNON.x) / len) * SHELL_SPEED,
      vy: ((c.y - CANNON.y) / len) * SHELL_SPEED,
      remaining: len,
    });
  }

  const explode = (x, y, max) => r.blasts.push({ x, y, t: 0, max, r: 0 });

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    r.time += dt;
    const din = inputs[0];
    const rin = inputs[1];

    r.cooldown -= dt;
    if (rin.pressed.action && r.supply > 0 && r.cooldown <= 0) {
      launch(r.cursors[1].x);
      r.supply--;
      r.cooldown = r.launchEvery;
    }
    if (rin.pressed.action2) split();
    if (din.pressed.action) fire(r.cursors[0]);

    for (const b of r.blasts) {
      b.t += dt;
      b.r = b.max * Math.sin(Math.PI * Math.min(b.t / BLAST_TIME, 1));
    }
    r.blasts = r.blasts.filter((b) => b.t < BLAST_TIME);

    for (const s of r.shells) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.remaining -= SHELL_SPEED * dt;
      if (s.remaining <= 0) {
        s.done = true;
        explode(s.tx, s.ty, BLAST_R);
      }
    }
    r.shells = r.shells.filter((s) => !s.done);

    for (const m of r.meteors) {
      if (m.done) continue;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (r.blasts.some((b) => Math.hypot(m.x - b.x, m.y - b.y) < b.r)) {
        m.done = true;
        explode(m.x, m.y, 26);
        continue;
      }
      if (m.y >= GROUND) {
        m.done = true;
        explode(m.x, GROUND, 30);
        for (const t of r.towns) if (t.alive && Math.abs(t.x - m.x) < TOWN_HALF + 4) t.alive = false;
      }
    }
    r.meteors = r.meteors.filter((m) => !m.done);

    const standing = r.towns.filter((t) => t.alive).length;
    if (6 - standing >= TOWNS_TO_WIN) end(1, `The raider flattened ${6 - standing} towns!`);
    else if (r.supply < 1 && !r.meteors.length) end(0, `${standing} town${standing === 1 ? "" : "s"} still standing — the frontier holds!`);
    return r.winner;
  };

  r.status = () => `Towns flattened ${r.towns.filter((t) => !t.alive).length}/${TOWNS_TO_WIN} · Meteors left ${r.supply} · Shells ${r.ammo}`;
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

// ---------- Bots ----------

function defenderBot(r, input, skill) {
  // Even a sharp defender needs a moment to react and doesn't click pixel-perfect
  const clock = new Clock(lerp(0.55, 0.22, skill));
  const claimed = new Map(); // meteor -> time we stop counting on our shot to get it

  return {
    update(dt) {
      if (r.winner !== null || !clock.tick(dt) || input.pendingFire || r.ammo <= 0) return;
      const c = r.cursors[0];
      for (const [m, until] of claimed) if (until < r.time || !r.meteors.includes(m)) claimed.delete(m);

      const aliveXs = r.towns.filter((t) => t.alive).map((t) => t.x);
      const threats = r.meteors
        .filter((m) => !claimed.has(m))
        .filter((m) => !chance(skill) || aliveXs.some((x) => Math.abs(x - m.tx) < TOWN_HALF + 4))
        .sort((a, b) => (GROUND - a.y) / a.vy - (GROUND - b.y) / b.vy);
      const m = threats[0];
      if (!m) return;

      // Lead the target: where will it be when the crosshair and shell get there?
      let t = 0.5;
      let px = m.x;
      let py = m.y;
      for (let i = 0; i < 5; i++) {
        px = m.x + m.vx * t;
        py = m.y + m.vy * t;
        t = Math.hypot(px - c.x, py - c.y) / c.speed + Math.hypot(px - CANNON.x, py - CANNON.y) / SHELL_SPEED + 0.25;
      }
      if (py > GROUND - 35) return;
      const noise = lerp(60, 24, skill);
      input.target = { x: px + rand(-noise, noise), y: py + rand(-noise, noise) };
      input.pendingFire = true;
      claimed.set(m, r.time + t + 1);
    },
  };
}

function raiderBot(r, input, skill) {
  const clock = new Clock(lerp(1.4, 0.6, skill));
  const plan = []; // towns queued for the next salvo

  return {
    update(dt) {
      if (r.winner !== null) return;

      // Split a meteor that's about to fly into a shell's blast
      if (r.supply >= SPLIT_COST && chance(skill * dt * 6)) {
        const doomed = r.meteors.some(
          (m) => !m.split && m.y < GROUND * 0.7 && r.shells.some((s) => Math.hypot(s.tx - m.x, s.ty - m.y) < 70)
        );
        if (doomed) input.press("action2");
      }

      if (!plan.length && clock.tick(dt) && r.supply > 0) {
        const alive = r.towns.filter((t) => t.alive);
        const incoming = (x) => r.meteors.filter((m) => Math.abs(m.tx - x) < TOWN_HALF).length;
        const ranked = alive
          .map((t) => ({ x: t.x, score: -incoming(t.x) * skill + (Math.abs(t.x - CANNON.x) / W) * skill + rand(0, 1.2 - skill) }))
          .sort((a, b) => b.score - a.score);
        const salvo = 1 + Math.round(rand(0, 2.5 * skill));
        for (let i = 0; i < salvo && i < ranked.length; i++) plan.push(ranked[i].x);
      }

      if (plan.length && !input.pendingFire && r.cooldown <= 0.15) {
        const x = plan.shift();
        input.target = { x: x + rand(-1, 1) * (1 - skill) * 25, y: GROUND - 6 };
        input.pendingFire = true;
      }
    },
  };
}

// ---------- Drawing ----------

const STARS = Array.from({ length: 60 }, () => ({ x: rand(0, W), y: rand(0, GROUND * 0.7), s: rand(0.3, 1.5) }));

function drawTown(ctx, t, time) {
  const x = t.x;
  if (t.alive) {
    ctx.fillStyle = "#b07d48";
    ctx.fillRect(x - 20, GROUND - 22, 40, 22);
    ctx.fillStyle = "#9c6a3a";
    ctx.fillRect(x - 14, GROUND - 34, 28, 12);
    ctx.fillStyle = "#7a4f2a";
    ctx.fillRect(x - 22, GROUND - 23, 44, 3);
    ctx.fillStyle = "#f3c35a";
    ctx.fillRect(x - 15, GROUND - 16, 6, 6);
    ctx.fillRect(x + 9, GROUND - 16, 6, 6);
    ctx.fillStyle = "#3b2414";
    ctx.fillRect(x - 4, GROUND - 14, 8, 14);
    return;
  }
  ctx.fillStyle = "#3a2418";
  ctx.beginPath();
  ctx.moveTo(x - 22, GROUND);
  ctx.lineTo(x - 14, GROUND - 8);
  ctx.lineTo(x - 4, GROUND - 5);
  ctx.lineTo(x + 6, GROUND - 11);
  ctx.lineTo(x + 18, GROUND - 4);
  ctx.lineTo(x + 22, GROUND);
  ctx.fill();
  ctx.fillStyle = "rgba(120, 110, 110, 0.25)";
  for (let i = 0; i < 3; i++) {
    const rise = (time * 14 + i * 12) % 36;
    ctx.beginPath();
    ctx.arc(x + Math.sin(time + i) * 4, GROUND - 12 - rise, 5 + rise * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw(ctx, r) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#120a18");
  sky.addColorStop(0.6, "#3a1c2c");
  sky.addColorStop(1, "#7a3426");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = "#f3e6c9";
  for (const s of STARS) ctx.fillRect(s.x, s.y, s.s, s.s);
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(90, 70, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#2a1520";
  ctx.beginPath();
  ctx.moveTo(0, GROUND);
  for (const [x, y] of [[0, 400], [60, 400], [80, 370], [170, 370], [190, 405], [440, 405], [460, 380], [560, 380], [580, 400], [640, 400]]) ctx.lineTo(x, y);
  ctx.lineTo(W, GROUND);
  ctx.fill();
  ctx.fillStyle = "#4a2e1c";
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "#6e4529";
  ctx.fillRect(0, GROUND, W, 3);

  for (const t of r.towns) drawTown(ctx, t, r.time);

  // Cannon, barrel pointing at the defender's crosshair
  const aim = r.cursors[0];
  ctx.fillStyle = "#5a3a22";
  ctx.beginPath();
  ctx.arc(CANNON.x, GROUND, 28, Math.PI, 0);
  ctx.fill();
  const a = Math.atan2(aim.y - CANNON.y, aim.x - CANNON.x);
  ctx.save();
  ctx.translate(CANNON.x, CANNON.y);
  ctx.rotate(clamp(a, -Math.PI + 0.15, -0.15));
  ctx.fillStyle = "#2b2b2b";
  ctx.fillRect(0, -4, 24, 8);
  ctx.restore();
  ctx.fillStyle = "#3b2414";
  ctx.beginPath();
  ctx.arc(CANNON.x, CANNON.y + 2, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#c9a45c";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.lineWidth = 1.5;
  for (const m of r.meteors) {
    ctx.strokeStyle = m.split ? "rgba(224, 150, 58, 0.8)" : "rgba(224, 96, 58, 0.8)";
    ctx.beginPath();
    ctx.moveTo(m.sx, m.sy);
    ctx.lineTo(m.x, m.y);
    ctx.stroke();
    ctx.fillStyle = "#ffd27a";
    ctx.beginPath();
    ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const s of r.shells) {
    ctx.strokeStyle = "rgba(243, 195, 90, 0.8)";
    ctx.beginPath();
    ctx.moveTo(CANNON.x, CANNON.y);
    ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.strokeStyle = "#f1e4c7";
    ctx.beginPath();
    ctx.moveTo(s.tx - 4, s.ty - 4);
    ctx.lineTo(s.tx + 4, s.ty + 4);
    ctx.moveTo(s.tx + 4, s.ty - 4);
    ctx.lineTo(s.tx - 4, s.ty + 4);
    ctx.stroke();
  }
  for (const b of r.blasts) {
    if (b.r <= 0) continue;
    const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
    g.addColorStop(0, "rgba(255, 245, 210, 0.95)");
    g.addColorStop(0.4, "rgba(243, 195, 90, 0.85)");
    g.addColorStop(1, "rgba(208, 105, 47, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default {
  id: "missile",
  title: "Missile Command",
  kicker: "Click to aim",
  accent: "var(--ember)",
  blurb: "The town cannon versus a raider raining fire.",
  width: W,
  height: H,
  sides: [
    {
      name: "Defender",
      emoji: "💣",
      goal: `Don't let the raider flatten ${TOWNS_TO_WIN} of your 6 towns before it runs out of meteors. Burst shells in their path.`,
      controls: { dirs: "move the crosshair", action: "fire a shell there" },
      pointer: "aim",
      pointerHint: "Click or tap where a shell should burst",
      pad: { dirs: "four", action: "Fire" },
      bot: defenderBot,
    },
    {
      name: "Raider",
      emoji: "🔥",
      goal: `Flatten ${TOWNS_TO_WIN} of the 6 towns. Pick a target on the ground and drop meteors on it; split one in mid-air to overwhelm the cannon.`,
      controls: { dirs: "pick a target (← →)", action: "drop a meteor", action2: `split a meteor (${SPLIT_COST} meteors)` },
      pointer: "aim",
      pointerHint: "Click or tap a town to drop a meteor on it · right-click to split",
      pad: { dirs: "lr", action: "Drop", action2: "Split" },
      bot: raiderBot,
    },
  ],
  createRound,
};
