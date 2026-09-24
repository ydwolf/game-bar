// Splat — the Bird flies through one saguaro at a time; the Planter slides the gap up and
// down to make it miss. The gap locks shortly before the bird arrives, so the Planter has to
// commit — no dodging at the last instant.
import { clamp, lerp, rand, chance } from "../util.js";

const W = 420;
const H = 560;
const GROUND = H - 64;
const GAP = 130;
const CACTUS_W = 64;
const BIRD_X = 110;
const BIRD_R = 14;
const GRAVITY = 1500;
const FLAP_V = -440;
const TO_CLEAR = 10;
const GAP_MIN = GAP / 2 + 40;
const GAP_MAX = GROUND - GAP / 2 - 40;

function createRound({ level, inputs }) {
  const r = {
    level,
    bird: { y: H / 2 - 40, vy: 0 },
    gy: (GAP_MIN + GAP_MAX) / 2,
    speed: 150 + 12 * (level - 1),
    planterSpeed: 300,
    // Seconds between the gap locking and the bird reaching it (tuned with tests/fairness.js)
    lockTime: [0.52, 0.44, 0.36, 0.31, 0.3][level - 1],
    cactus: null,
    cleared: 0,
    distance: 0,
    time: 0,
    winner: null,
    endReason: "",
  };
  const newCactus = () => ({ x: W + 10, locked: false, passed: false });
  r.cactus = newCactus();
  r.lockX = () => BIRD_X + BIRD_R + r.speed * r.lockTime;

  const end = (winner, reason) => {
    r.winner = winner;
    r.endReason = reason;
  };

  function hitsRect(x, y, w, h) {
    const nx = clamp(BIRD_X, x, x + w);
    const ny = clamp(r.bird.y, y, y + h);
    const rad = BIRD_R - 2; // a little forgiveness
    return (BIRD_X - nx) ** 2 + (r.bird.y - ny) ** 2 < rad * rad;
  }

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    r.time += dt;
    r.distance += r.speed * dt;
    const bird = r.bird;
    const c = r.cactus;

    if (inputs[0].pressed.action) bird.vy = FLAP_V;
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;
    if (bird.y < BIRD_R) {
      bird.y = BIRD_R;
      bird.vy = 0;
    }

    c.x -= r.speed * dt;
    if (!c.locked && c.x <= r.lockX()) c.locked = true;

    if (!c.locked) {
      const pin = inputs[1];
      const mv = (pin.held.down ? 1 : 0) - (pin.held.up ? 1 : 0);
      if (mv) {
        r.gy += mv * r.planterSpeed * dt;
        pin.target = null;
      } else if (pin.target) {
        r.gy += clamp(pin.target.y - r.gy, -r.planterSpeed * dt, r.planterSpeed * dt);
      }
      r.gy = clamp(r.gy, GAP_MIN, GAP_MAX);
    }

    const topH = r.gy - GAP / 2;
    const bottomY = r.gy + GAP / 2;
    if (hitsRect(c.x, 0, CACTUS_W, topH) || hitsRect(c.x, bottomY, CACTUS_W, GROUND - bottomY)) {
      end(1, "Splat! Right into the saguaro.");
      return r.winner;
    }
    if (bird.y + BIRD_R >= GROUND) {
      bird.y = GROUND - BIRD_R;
      end(1, "Splat! The bird hit the dirt.");
      return r.winner;
    }

    if (!c.passed && c.x + CACTUS_W < BIRD_X - BIRD_R) {
      c.passed = true;
      r.cleared++;
      if (r.cleared >= TO_CLEAR) end(0, `The bird cleared all ${TO_CLEAR} cacti!`);
      else r.cactus = newCactus();
    }
    return r.winner;
  };

  r.status = () => `Cleared ${r.cleared}/${TO_CLEAR}${r.cactus.locked ? " · Gap locked" : ""}`;
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

// ---------- Bots ----------

function birdBot(r, input, skill) {
  const reaction = lerp(0.3, 0.1, skill);
  const history = []; // what the bird "saw" of the gap, so it reacts late like a person
  let t = 0;
  let sinceFlap = 1;
  let cactus = null;
  let offset = 0;

  return {
    update(dt) {
      if (r.winner !== null) return;
      t += dt;
      sinceFlap += dt;
      history.push({ t, gy: r.gy });
      while (history.length > 2 && history[1].t <= t - reaction) history.shift();
      const seen = history[0].gy;

      if (r.cactus !== cactus) {
        cactus = r.cactus;
        offset = rand(-1, 1) * (1 - skill) * 30;
      }
      // A flap lifts the bird ~65px, so flapping ~30px below the gap's center keeps its
      // bobbing centered on the gap
      const target = seen + 30 + offset;
      if (r.bird.y > target && r.bird.vy > 0 && sinceFlap > 0.14) {
        input.press("action");
        sinceFlap = 0;
      }
    },
  };
}

function planterBot(r, input, skill) {
  let cactus = null;
  let switchAt = 0;
  let decoy = 0;

  return {
    update() {
      if (r.winner !== null) return;
      const c = r.cactus;
      if (c !== cactus) {
        cactus = c;
        // When to make the real move, in seconds before the lock
        switchAt = lerp(0.25, 0.55, skill) + rand(-0.15, 0.15) * (1 - skill);
        decoy = chance(skill) ? r.bird.y : rand(GAP_MIN, GAP_MAX);
      }
      if (c.locked) {
        input.held.up = input.held.down = false;
        return;
      }
      const timeToLock = (c.x - r.lockX()) / r.speed;
      let target;
      if (timeToLock > switchAt) {
        target = decoy; // bait the bird toward one spot…
      } else {
        // …then swing the gap as far from the bird as it can get before the lock
        const mid = (GAP_MIN + GAP_MAX) / 2;
        target = r.bird.y < mid ? GAP_MAX : GAP_MIN;
        if (!chance(0.6 + 0.4 * skill)) target = lerp(target, r.bird.y, 0.5);
      }
      input.held.up = target < r.gy - 4;
      input.held.down = target > r.gy + 4;
    },
  };
}

// ---------- Drawing ----------

function drawRidge(ctx, r, factor, period, color, profile) {
  const off = (r.distance * factor) % period;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-off, GROUND);
  for (let base = -off; base < W + period; base += period) {
    for (const [px, py] of profile) ctx.lineTo(base + px, GROUND - py);
  }
  ctx.lineTo(W + period, GROUND);
  ctx.closePath();
  ctx.fill();
}

function drawCactus(ctx, x, y, h, capAtBottom, locked) {
  if (h <= 0) return;
  ctx.fillStyle = locked ? "#46702b" : "#5c8a3a";
  ctx.fillRect(x + 4, y, CACTUS_W - 8, h);
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  ctx.fillRect(x + 10, y, 6, h);
  ctx.strokeStyle = "rgba(30, 60, 20, 0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const rx of [22, 34, 46]) {
    ctx.moveTo(x + rx, y);
    ctx.lineTo(x + rx, y + h);
  }
  ctx.stroke();
  ctx.fillStyle = "#efe2b0";
  for (let sy = y + 10; sy < y + h - 6; sy += 18) {
    for (const rx of [22, 34, 46]) ctx.fillRect(x + rx - 3, sy + (rx % 4), 2, 2);
  }
  ctx.fillStyle = locked ? "#c9a45c" : "#4f7a31";
  ctx.beginPath();
  ctx.roundRect(x, capAtBottom ? y + h - 18 : y, CACTUS_W, 18, 8);
  ctx.fill();
}

function drawBird(ctx, r) {
  ctx.save();
  ctx.translate(BIRD_X, r.bird.y);
  ctx.rotate(clamp(r.bird.vy / 600, -0.5, 1.1));
  ctx.fillStyle = "#8b5a2b";
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e8c890";
  ctx.beginPath();
  ctx.ellipse(3, 5, 9, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b4220";
  ctx.beginPath();
  ctx.ellipse(-5, 1 + Math.sin(r.time * 22) * 3, 8, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(7, -4, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(8, -4, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#e0922f";
  ctx.beginPath();
  ctx.moveTo(13, -1);
  ctx.lineTo(22, 2);
  ctx.lineTo(13, 5);
  ctx.fill();
  ctx.fillStyle = "#3b2414";
  ctx.beginPath();
  ctx.ellipse(0, -12, 15, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#4a2d18";
  ctx.beginPath();
  ctx.roundRect(-8, -23, 16, 11, 4);
  ctx.fill();
  ctx.fillStyle = "#c9a45c";
  ctx.fillRect(-8, -15, 16, 2);
  ctx.restore();
}

function draw(ctx, r) {
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
  sky.addColorStop(0, "#2d1e3f");
  sky.addColorStop(0.45, "#9c4a3c");
  sky.addColorStop(0.8, "#e9894a");
  sky.addColorStop(1, "#f6c46e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND);
  ctx.fillStyle = "rgba(255, 214, 120, 0.9)";
  ctx.beginPath();
  ctx.arc(W * 0.7, GROUND - 90, 46, 0, Math.PI * 2);
  ctx.fill();
  drawRidge(ctx, r, 0.15, 300, "#6e3328", [[0, 40], [40, 40], [60, 110], [150, 110], [170, 55], [230, 55], [245, 80], [290, 80], [300, 40]]);
  drawRidge(ctx, r, 0.35, 260, "#4d2420", [[0, 20], [50, 20], [70, 70], [120, 70], [135, 30], [260, 30]]);

  // Lock line: once the cactus crosses it, the gap is set
  const lx = r.lockX();
  ctx.strokeStyle = "rgba(243, 230, 201, 0.25)";
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(lx, 0);
  ctx.lineTo(lx, GROUND);
  ctx.stroke();
  ctx.setLineDash([]);

  const c = r.cactus;
  drawCactus(ctx, c.x, 0, r.gy - GAP / 2, true, c.locked);
  drawCactus(ctx, c.x, r.gy + GAP / 2, GROUND - (r.gy + GAP / 2), false, c.locked);

  ctx.fillStyle = "#d2a865";
  ctx.fillRect(0, GROUND, W, H - GROUND);
  ctx.fillStyle = "#b98a4c";
  ctx.fillRect(0, GROUND, W, 6);
  ctx.fillStyle = "#a87a42";
  for (let i = 0; i < 14; i++) {
    const x = (((i * 53 - r.distance) % W) + W) % W;
    ctx.fillRect(x, GROUND + 18 + ((i * 17) % 30), 4, 3);
  }
  drawBird(ctx, r);
}

export default {
  id: "splat",
  title: "Splat",
  kicker: "One key",
  accent: "var(--gold)",
  blurb: "A bird in a big hat versus the cactus planter.",
  width: W,
  height: H,
  sides: [
    {
      name: "Bird",
      emoji: "🐦",
      goal: `Fly through ${TO_CLEAR} saguaros without going splat.`,
      controls: { action: "flap" },
      pointer: "tap",
      pointerHint: "Click or tap the board to flap",
      pad: { action: "Flap" },
      bot: birdBot,
    },
    {
      name: "Planter",
      emoji: "🌵",
      goal: "Slide each cactus's gap to make the bird crash. The gap locks when the cactus crosses the dashed line.",
      controls: { dirs: "slide the gap (↑ ↓)" },
      pointer: "y",
      pointerHint: "Mouse / drag up and down to slide the gap",
      pad: { dirs: "ud" },
      bot: planterBot,
    },
  ],
  createRound,
};
