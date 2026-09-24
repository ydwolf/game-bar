// Breakout — the Paddle tries to drill a hole through the adobe wall and get the ball out to
// the sky behind it; the Mason patches holes with mortar and rolls tumbleweeds at the ball.
import { clamp, lerp, rand, chance, Clock, formatTime } from "../util.js";

const W = 480;
const H = 560;
const COLS = 8;
const ROWS = 4;
const BW = 56;
const BH = 18;
const GAP = 4;
const TOP = 90;
const LEFT = (W - (COLS * BW + (COLS - 1) * GAP)) / 2;
const ROW_COLORS = ["#b8442e", "#d0692f", "#d9a23a", "#7a9a55", "#3a8f89"];
const ROUND_TIME = 60;
const WEED_COST = 3;
const WEED_Y = H * 0.6;
const SAFE_GAP = 26; // the mason can't brick up a spot right next to the ball

function createRound({ level, inputs }) {
  const r = {
    level,
    time: ROUND_TIME,
    bricks: [],
    paddle: { x: W / 2, y: H - 40, w: 94 - 4 * (level - 1), h: 14, speed: 620 },
    ball: { x: W / 2, y: 0, vx: 0, vy: 0, r: 7, stuck: true },
    speed: 320 + 12 * (level - 1),
    lives: 3,
    mortar: 1,
    mortarMax: 5,
    regen: [0.065, 0.085, 0.115, 0.16, 0.22][level - 1], // tuned with tests/fairness.js
    weed: null,
    flash: 0, // brief red flash on a refused rebuild
    smashed: 0,
    winner: null,
    endReason: "",
  };
  r.cursors = [
    null,
    { x: W / 2, y: TOP + 40, speed: 420, x0: LEFT, x1: W - LEFT - 1, y0: TOP, y1: TOP + ROWS * (BH + GAP) - GAP - 1 },
  ];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      r.bricks.push({ x: LEFT + col * (BW + GAP), y: TOP + row * (BH + GAP), row, col, alive: true });
    }
  }

  const end = (winner, reason) => {
    r.winner = winner;
    r.endReason = reason;
  };

  function launch() {
    const a = rand(-0.4, 0.4);
    r.ball.vx = r.speed * Math.sin(a);
    r.ball.vy = -r.speed * Math.cos(a);
    r.ball.stuck = false;
  }

  function brickAt(x, y) {
    const col = Math.floor((x - LEFT) / (BW + GAP));
    const row = Math.floor((y - TOP) / (BH + GAP));
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
    return r.bricks[row * COLS + col];
  }

  function nearBall(b) {
    const nx = clamp(r.ball.x, b.x, b.x + BW);
    const ny = clamp(r.ball.y, b.y, b.y + BH);
    return Math.hypot(r.ball.x - nx, r.ball.y - ny) < r.ball.r + SAFE_GAP;
  }

  function rebuild(c) {
    const b = brickAt(c.x, c.y);
    if (!b || b.alive || r.mortar < 1) return;
    if (nearBall(b)) {
      r.flash = 0.25;
      return;
    }
    b.alive = true;
    r.mortar -= 1;
  }

  function throwWeed(c) {
    if (r.weed || r.mortar < WEED_COST) return;
    r.mortar -= WEED_COST;
    const fromLeft = c.x < W / 2;
    r.weed = { x: fromLeft ? -16 : W + 16, y: WEED_Y, vx: (fromLeft ? 1 : -1) * (110 + 10 * level), r: 15, rot: 0 };
  }

  // Moves the ball a small slice of time. Returns false if its turn is over.
  function moveBall(t) {
    const b = r.ball;
    b.x += b.vx * t;
    b.y += b.vy * t;

    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < TOP - 4) {
      end(0, "The paddle broke through the wall!");
      return false;
    }
    if (b.y - b.r > H) {
      r.lives--;
      if (r.lives <= 0) end(1, "The mason wore the paddle down!");
      else b.stuck = true;
      return false;
    }

    const p = r.paddle;
    if (b.vy > 0 && b.y + b.r >= p.y && b.y - b.r <= p.y + p.h && Math.abs(b.x - p.x) <= p.w / 2 + b.r) {
      const a = clamp((b.x - p.x) / (p.w / 2), -1, 1) * 1.05;
      b.vx = r.speed * Math.sin(a);
      b.vy = -r.speed * Math.cos(a);
      b.y = p.y - b.r;
    }

    const w = r.weed;
    if (w) {
      const dx = b.x - w.x;
      const dy = b.y - w.y;
      const d = Math.hypot(dx, dy);
      if (d < b.r + w.r && d > 0) {
        const nx = dx / d;
        const ny = dy / d;
        const dot = b.vx * nx + b.vy * ny;
        if (dot < 0) {
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
        }
        b.x = w.x + nx * (b.r + w.r);
        b.y = w.y + ny * (b.r + w.r);
      }
    }

    for (const br of r.bricks) {
      if (!br.alive) continue;
      const nx = clamp(b.x, br.x, br.x + BW);
      const ny = clamp(b.y, br.y, br.y + BH);
      if ((b.x - nx) ** 2 + (b.y - ny) ** 2 > b.r * b.r) continue;
      br.alive = false;
      r.smashed++;
      const ox = Math.min(b.x + b.r - br.x, br.x + BW - (b.x - b.r));
      const oy = Math.min(b.y + b.r - br.y, br.y + BH - (b.y - b.r));
      if (ox < oy) b.vx = b.x < br.x + BW / 2 ? -Math.abs(b.vx) : Math.abs(b.vx);
      else b.vy = b.y < br.y + BH / 2 ? -Math.abs(b.vy) : Math.abs(b.vy);
      break;
    }
    return true;
  }

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    const pin = inputs[0];
    const min = inputs[1];
    const p = r.paddle;

    const mv = (pin.held.right ? 1 : 0) - (pin.held.left ? 1 : 0);
    if (mv) {
      p.x += mv * p.speed * dt;
      pin.target = null;
    } else if (pin.target) {
      p.x += clamp(pin.target.x - p.x, -p.speed * dt, p.speed * dt);
    }
    p.x = clamp(p.x, p.w / 2, W - p.w / 2);

    r.mortar = Math.min(r.mortarMax, r.mortar + r.regen * dt);
    r.flash = Math.max(0, r.flash - dt);
    if (min.pressed.action) rebuild(r.cursors[1]);
    if (min.pressed.action2) throwWeed(r.cursors[1]);

    if (r.weed) {
      r.weed.x += r.weed.vx * dt;
      r.weed.rot += r.weed.vx * dt * 0.05;
      if (r.weed.x < -40 || r.weed.x > W + 40) r.weed = null;
    }

    if (r.ball.stuck) {
      r.ball.x = p.x;
      r.ball.y = p.y - r.ball.r - 1;
      if (pin.pressed.action) launch();
    } else {
      const steps = Math.ceil((r.speed * dt) / (r.ball.r * 0.5));
      for (let i = 0; i < steps; i++) if (!moveBall(dt / steps)) break;
    }

    r.time -= dt;
    if (r.winner === null && r.time <= 0) end(1, "Time's up — the wall still stands!");
    return r.winner;
  };

  r.status = () => {
    const thinnest = Math.min(...columnCounts(r));
    return `${formatTime(r.time)} · Balls ${"●".repeat(r.lives)} · Thinnest column ${thinnest}/${ROWS} · Mortar ${Math.floor(r.mortar)}`;
  };
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

// Bricks still standing in each column
function columnCounts(r) {
  const counts = new Array(COLS).fill(0);
  for (const b of r.bricks) if (b.alive) counts[b.col]++;
  return counts;
}

const colX = (col) => LEFT + col * (BW + GAP) + BW / 2;

// Where the ball will cross height y, bouncing off the side walls
function predictX(ball, y) {
  if ((ball.vy > 0 && y < ball.y) || (ball.vy < 0 && y > ball.y) || ball.vy === 0) return null;
  const t = (y - ball.y) / ball.vy;
  const x = ball.x + ball.vx * t;
  const span = W - 2 * ball.r;
  let u = (((x - ball.r) % (2 * span)) + 2 * span) % (2 * span);
  if (u > span) u = 2 * span - u;
  return ball.r + u;
}

// ---------- Bots ----------

function paddleBot(r, input, skill) {
  const clock = new Clock(lerp(0.22, 0.06, skill));
  let target = W / 2;
  let launchIn = rand(0.4, 1.2);

  return {
    update(dt) {
      if (r.winner !== null) return;
      const p = r.paddle;
      const b = r.ball;

      if (b.stuck) {
        launchIn -= dt;
        if (launchIn <= 0) {
          input.press("action");
          launchIn = rand(0.4, 1.2);
        }
      }

      if (clock.tick(dt)) {
        let x = b.vy > 0 ? predictX(b, p.y - b.r) : null;
        if (x === null) x = lerp(b.x, W / 2, 0.3);
        if (b.vy > 0 && chance(0.5 + 0.5 * skill)) {
          // Steer the return toward the thinnest column of the wall
          const counts = columnCounts(r);
          let col = 0;
          for (let c = 1; c < COLS; c++) {
            if (counts[c] < counts[col] || (counts[c] === counts[col] && Math.abs(colX(c) - x) < Math.abs(colX(col) - x))) col = c;
          }
          const angle = clamp(Math.atan2(colX(col) - x, p.y - (TOP + ROWS * (BH + GAP))), -0.9, 0.9);
          x -= (angle / 1.05) * (p.w / 2);
        }
        target = x + rand(-1, 1) * (1 - skill) * 90;
      }

      input.held.left = target < p.x - 4;
      input.held.right = target > p.x + 4;
    },
  };
}

function masonBot(r, input, skill) {
  const clock = new Clock(lerp(0.6, 0.2, skill));

  return {
    update(dt) {
      if (r.winner !== null || !clock.tick(dt)) return;
      const b = r.ball;

      if (!r.weed && r.mortar >= WEED_COST + 0.5 && !b.stuck && b.vy > 0 && b.y < WEED_Y - 60 && chance(0.1 + 0.3 * skill)) {
        input.press("action2");
        return;
      }
      if (r.mortar < 1 || input.pendingFire) return;

      // Patch the thinnest column first — that's where the ball will get through
      const counts = columnCounts(r);
      let best = null;
      for (const br of r.bricks) {
        if (br.alive) continue;
        const cx = br.x + BW / 2;
        const cy = br.y + BH / 2;
        if (Math.hypot(cx - b.x, cy - b.y) < 60) continue;
        const score = -counts[br.col] * 40 * skill - Math.abs(cx - b.x) * 0.1 + rand(0, (1 - skill) * 120);
        if (!best || score > best.score) best = { score, x: cx, y: cy };
      }
      if (best) {
        input.target = { x: best.x, y: best.y };
        input.pendingFire = true;
      }
    },
  };
}

// ---------- Drawing ----------

function draw(ctx, r) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#2a1a12");
  g.addColorStop(1, "#41291a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  for (let x = 60; x < W; x += 60) ctx.fillRect(x, 0, 2, H);

  for (const b of r.bricks) {
    if (!b.alive) {
      ctx.strokeStyle = "rgba(243, 230, 201, 0.12)";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, BW - 1, BH - 1);
      ctx.setLineDash([]);
      continue;
    }
    ctx.fillStyle = ROW_COLORS[b.row];
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, BW, BH, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
    ctx.fillRect(b.x + 2, b.y + 2, BW - 4, 3);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(b.x + 2, b.y + BH - 4, BW - 4, 2);
  }

  // Mortar bucket meter
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.fillRect(LEFT, TOP - 26, 120, 10);
  ctx.fillStyle = r.flash > 0 ? "#e0603a" : "#c9a45c";
  ctx.fillRect(LEFT, TOP - 26, (120 * r.mortar) / r.mortarMax, 10);
  ctx.fillStyle = "#f3e6c9";
  ctx.font = '12px "Special Elite", monospace';
  ctx.textAlign = "left";
  ctx.fillText("MORTAR", LEFT + 128, TOP - 17);

  if (r.weed) {
    const w = r.weed;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(w.rot);
    ctx.strokeStyle = "#b8955a";
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, w.r, w.r * 0.45, (i * Math.PI) / 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  const p = r.paddle;
  const px = p.x - p.w / 2;
  ctx.fillStyle = "#8a5a33";
  ctx.beginPath();
  ctx.roundRect(px, p.y, p.w, p.h, 4);
  ctx.fill();
  ctx.fillStyle = "#6e4526";
  ctx.fillRect(px + 10, p.y + 6, p.w - 20, 2);
  ctx.fillStyle = "#c9a45c";
  ctx.fillRect(px, p.y, 7, p.h);
  ctx.fillRect(px + p.w - 7, p.y, 7, p.h);

  const b = r.ball;
  const cg = ctx.createRadialGradient(b.x - 2, b.y - 2, 1, b.x, b.y, b.r);
  cg.addColorStop(0, "#fbe7a4");
  cg.addColorStop(1, "#c99a3a");
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#8a6420";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export default {
  id: "breakout",
  title: "Breakout",
  kicker: "Mouse",
  accent: "var(--rust)",
  blurb: "A paddle drills at the adobe while a mason patches holes.",
  width: W,
  height: H,
  sides: [
    {
      name: "Paddle",
      emoji: "🪵",
      goal: `Drill through the wall and get the ball out the top within ${formatTime(ROUND_TIME)}. Lose 3 balls and the mason wins.`,
      controls: { dirs: "slide (← →)", action: "launch" },
      pointer: "x",
      pointerHint: "Mouse / drag to slide · click or tap to launch",
      pad: { dirs: "lr", action: "Launch" },
      bot: paddleBot,
    },
    {
      name: "Mason",
      emoji: "🧱",
      goal: "Don't let the ball through the wall until time runs out. Patch holes with mortar; roll tumbleweeds at the ball.",
      controls: { dirs: "move the trowel", action: "rebuild brick", action2: "tumbleweed (3 mortar)" },
      pointer: "aim",
      pointerHint: "Click a gap to rebuild · right-click for a tumbleweed",
      pad: { dirs: "four", action: "Build", action2: "Weed" },
      bot: masonBot,
    },
  ],
  createRound,
};
