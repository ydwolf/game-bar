// Snake — the Snake hunts the Pear; the Pear has to survive until the clock runs out.
import { DIRS, DIR_NAMES, OPPOSITE, bfs, floodCount, chance, pick, lerp, rand, formatTime } from "../util.js";

const N = 20;
const S = 24;
const W = N * S;
const ROUND_TIME = 30;
const DASH_COOLDOWN = 4;
const GROW_EVERY = 3;

const key = (x, y) => y * N + x;
const inBounds = (x, y) => x >= 0 && y >= 0 && x < N && y < N;

function placeCacti(count, avoid) {
  const cacti = new Set();
  let tries = 0;
  while (cacti.size < count && tries++ < 2000) {
    const x = 1 + Math.floor(Math.random() * (N - 2));
    const y = 1 + Math.floor(Math.random() * (N - 2));
    // Keep cacti apart (no sealed-off pockets) and away from the starting spots
    let ok = !avoid.some((p) => Math.abs(p.x - x) + Math.abs(p.y - y) < 4);
    for (const c of cacti) {
      const cx = c % N;
      const cy = (c / N) | 0;
      if (Math.abs(cx - x) <= 1 && Math.abs(cy - y) <= 1) ok = false;
    }
    if (y === 10 && x <= 9) ok = false; // the snake's opening lane
    if (ok) cacti.add(key(x, y));
  }
  return cacti;
}

function createRound({ level, inputs }) {
  // The pear starts a little quicker than the snake (the snake has to corner it with its
  // body); by level 5 the snake is the faster one.
  const snakeStep = Math.max(0.085, 0.13 - 0.011 * (level - 1));
  const pearStep = snakeStep * lerp(0.9, 1.04, (level - 1) / 4);

  const r = {
    level,
    time: ROUND_TIME,
    snake: [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }, { x: 2, y: 10 }],
    dir: "right",
    queue: [],
    pear: { x: 15, y: 10 },
    pdir: null,
    dashCd: 0,
    grow: 0,
    growTimer: GROW_EVERY,
    snakeT: 0,
    pearT: 0,
    winner: null,
    endReason: "",
  };
  r.cacti = placeCacti(2 + 2 * level, [r.snake[0], r.snake[3], r.pear]);

  const end = (winner, reason) => {
    r.winner = winner;
    r.endReason = reason;
  };

  const snakeAt = (x, y, from = 0) => r.snake.some((s, i) => i >= from && s.x === x && s.y === y);

  function turnSnake(d) {
    const last = r.queue.length ? r.queue[r.queue.length - 1] : r.dir;
    if (d === last || d === OPPOSITE[last]) return;
    if (r.queue.length < 3) r.queue.push(d);
  }

  function stepSnake() {
    if (r.queue.length) r.dir = r.queue.shift();
    const head = r.snake[0];
    const nx = head.x + DIRS[r.dir][0];
    const ny = head.y + DIRS[r.dir][1];
    if (!inBounds(nx, ny)) return end(1, "The snake slammed into the fence!");
    if (r.cacti.has(key(nx, ny))) return end(1, "The snake ran into a cactus!");
    const body = r.grow > 0 ? r.snake : r.snake.slice(0, -1);
    if (body.some((s) => s.x === nx && s.y === ny)) return end(1, "The snake bit its own tail!");
    r.snake.unshift({ x: nx, y: ny });
    if (r.grow > 0) r.grow--;
    else r.snake.pop();
    if (nx === r.pear.x && ny === r.pear.y) end(0, "The snake caught the pear!");
  }

  // Returns true if the pear moved
  function movePear(d) {
    const nx = r.pear.x + DIRS[d][0];
    const ny = r.pear.y + DIRS[d][1];
    if (!inBounds(nx, ny) || r.cacti.has(key(nx, ny)) || snakeAt(nx, ny, 1)) return false;
    r.pear = { x: nx, y: ny };
    if (nx === r.snake[0].x && ny === r.snake[0].y) {
      end(0, "The pear rolled right into the snake's mouth!");
      return false;
    }
    return true;
  }

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;

    for (const d of inputs[0].dirs) turnSnake(d);
    for (const d of inputs[1].dirs) r.pdir = d;

    r.dashCd = Math.max(0, r.dashCd - dt);
    if (inputs[1].pressed.action && r.dashCd === 0 && r.pdir) {
      r.dashCd = DASH_COOLDOWN;
      for (let i = 0; i < 2 && r.winner === null; i++) if (!movePear(r.pdir)) break;
    }

    r.growTimer -= dt;
    if (r.growTimer <= 0) {
      r.grow++;
      r.growTimer += GROW_EVERY;
    }

    r.snakeT += dt;
    while (r.snakeT >= snakeStep && r.winner === null) {
      r.snakeT -= snakeStep;
      stepSnake();
    }
    r.pearT += dt;
    while (r.pearT >= pearStep && r.winner === null) {
      r.pearT -= pearStep;
      if (r.pdir) movePear(r.pdir);
    }

    r.time -= dt;
    if (r.winner === null && r.time <= 0) end(1, "The pear outlasted the snake!");
    return r.winner;
  };

  r.status = () => `${formatTime(r.time)} left · Snake length ${r.snake.length}`;
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

// ---------- Bots ----------

function snakeBot(r, input, skill) {
  // Decides once per step. Lapses in attention make it chase badly, but like a person it
  // almost always notices a wall right in front of it.
  const attention = lerp(0.5, 0.95, skill);
  let lastHead = null;

  function isDeadly(d) {
    const head = r.snake[0];
    const x = head.x + DIRS[d][0];
    const y = head.y + DIRS[d][1];
    return !inBounds(x, y) || r.cacti.has(key(x, y)) || r.snake.slice(0, -1).some((s) => s.x === x && s.y === y);
  }

  function choose() {
    const head = r.snake[0];
    const body = new Set(r.snake.slice(0, -1).map((s) => key(s.x, s.y)));
    const passable = (x, y) => !r.cacti.has(key(x, y)) && !body.has(key(x, y));

    // Skilled snakes cut the pear off instead of chasing its tail
    let tx = r.pear.x;
    let ty = r.pear.y;
    if (r.pdir && chance(skill)) {
      for (let i = 0; i < 2; i++) {
        const nx = tx + DIRS[r.pdir][0];
        const ny = ty + DIRS[r.pdir][1];
        if (!inBounds(nx, ny) || !passable(nx, ny)) break;
        tx = nx;
        ty = ny;
      }
    }
    const dist = bfs(N, N, tx, ty, passable);

    const options = DIR_NAMES.filter((d) => d !== OPPOSITE[r.dir]).map((d) => {
      const x = head.x + DIRS[d][0];
      const y = head.y + DIRS[d][1];
      if (!inBounds(x, y) || !passable(x, y)) return { d, score: -1e9 };
      const dd = dist[key(x, y)];
      let score = dd < 0 ? -200 : -dd;
      if (chance(0.3 + 0.7 * skill) && floodCount(N, N, x, y, passable, 80) < r.snake.length + 3) score -= 500;
      return { d, score };
    });
    options.sort((a, b) => b.score - a.score);
    let best = options[0];
    if (chance(lerp(0.18, 0.02, skill))) {
      const safe = options.filter((o) => o.score > -1e8);
      if (safe.length) best = pick(safe);
    }
    return best.d;
  }

  return {
    update() {
      if (r.winner !== null || r.snake[0] === lastHead) return;
      lastHead = r.snake[0];
      if (!chance(attention) && !(isDeadly(r.dir) && chance(lerp(0.85, 0.99, skill)))) return;
      const d = choose();
      if (d !== r.dir) input.press(d);
    },
  };
}

function pearBot(r, input, skill) {
  // Decides once per step, like the snake bot. Looks for room to run, not just distance,
  // and steers clear of where the snake's head is about to be.
  const attention = lerp(0.55, 0.95, skill);
  let lastPos = null;
  let lastHead = null;

  return {
    update() {
      if (r.winner !== null) return;
      if (r.pear === lastPos && r.snake[0] === lastHead) return;
      lastPos = r.pear;
      lastHead = r.snake[0];
      if (r.pdir && !chance(attention)) return;

      const head = r.snake[0];
      const next = { x: head.x + DIRS[r.dir][0], y: head.y + DIRS[r.dir][1] };
      const body = new Set(r.snake.slice(1).map((s) => key(s.x, s.y)));
      const open = (x, y) => !r.cacti.has(key(x, y)) && !body.has(key(x, y));
      const snakeDist = bfs(N, N, head.x, head.y, open);
      const pearPassable = (x, y) => open(x, y) && !(x === head.x && y === head.y);

      let best = null;
      for (const d of DIR_NAMES) {
        const x = r.pear.x + DIRS[d][0];
        const y = r.pear.y + DIRS[d][1];
        if (!inBounds(x, y) || !pearPassable(x, y)) continue;
        const sd = snakeDist[key(x, y)];
        let score = Math.min(sd < 0 ? 20 : sd, 20);
        if (Math.abs(x - next.x) + Math.abs(y - next.y) <= 1) score -= 30;
        score += Math.min(floodCount(N, N, x, y, pearPassable, 60), 60) * lerp(0.05, 0.25, skill);
        if (x === 0 || y === 0 || x === N - 1 || y === N - 1) score -= 2 * skill;
        score += rand(0, (1 - skill) * 6);
        if (!best || score > best.score) best = { d, score };
      }
      if (best && best.d !== r.pdir) input.press(best.d);

      const here = snakeDist[key(r.pear.x, r.pear.y)];
      if (r.dashCd === 0 && here >= 0 && here <= 3 && chance(0.3 + 0.6 * skill)) input.press("action");
    },
  };
}

// ---------- Drawing ----------

function drawCactus(ctx, x, y) {
  const cx = x * S + S / 2;
  ctx.fillStyle = "#5c8a3a";
  ctx.beginPath();
  ctx.roundRect(cx - 4, y * S + 3, 8, S - 5, 4);
  ctx.roundRect(cx - 10, y * S + 8, 5, 8, 2.5);
  ctx.roundRect(cx + 5, y * S + 5, 5, 8, 2.5);
  ctx.fill();
  ctx.fillStyle = "#3f6a28";
  ctx.fillRect(cx - 1, y * S + 5, 2, S - 9);
}

function drawPear(ctx, r) {
  const cx = r.pear.x * S + S / 2;
  const cy = r.pear.y * S + S / 2;
  if (r.dashCd === 0) {
    ctx.strokeStyle = "rgba(184, 58, 82, 0.35)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy + 1, 13, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "#5f8a3c";
  ctx.beginPath();
  ctx.ellipse(cx, cy - 8, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#b83a52";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 1, 8.5, 9.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6dfa0";
  for (const [dx, dy] of [[-3, -2], [3, 0], [-1, 4], [4, 5], [-4, 3]]) ctx.fillRect(cx + dx, cy + dy, 1.5, 1.5);
}

function draw(ctx, r) {
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      ctx.fillStyle = (x + y) % 2 ? "#e6cd98" : "#ead4a3";
      ctx.fillRect(x * S, y * S, S, S);
    }
  }
  for (const c of r.cacti) drawCactus(ctx, c % N, (c / N) | 0);
  drawPear(ctx, r);

  for (let i = r.snake.length - 1; i >= 0; i--) {
    const s = r.snake[i];
    const isHead = i === 0;
    const isTail = i === r.snake.length - 1;
    ctx.fillStyle = isHead ? "#6b7a34" : isTail ? "#d9c795" : i % 3 === 0 ? "#4a311c" : "#9a8a4a";
    ctx.beginPath();
    ctx.roundRect(s.x * S + 1.5, s.y * S + 1.5, S - 3, S - 3, isHead ? 8 : 5);
    ctx.fill();
  }

  const head = r.snake[0];
  const [dx, dy] = DIRS[r.dir];
  const cx = head.x * S + S / 2;
  const cy = head.y * S + S / 2;
  for (const side of [-1, 1]) {
    const ex = cx + dx * 4 - dy * 5 * side;
    const ey = cy + dy * 4 + dx * 5 * side;
    ctx.fillStyle = "#f2d04a";
    ctx.beginPath();
    ctx.arc(ex, ey, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.fillRect(ex - 0.75, ey - 2, 1.5, 4);
  }
}

export default {
  id: "snake",
  title: "Snake",
  kicker: "Arrow keys",
  accent: "var(--sage)",
  blurb: "A rattler hunts a runaway prickly pear.",
  width: W,
  height: W,
  sides: [
    {
      name: "Snake",
      emoji: "🐍",
      goal: "Catch the pear before time runs out. You grow as you go — don't crash.",
      controls: { dirs: "steer" },
      pointer: "swipe",
      pointerHint: "Swipe the board to steer",
      pad: { dirs: "four" },
      bot: snakeBot,
    },
    {
      name: "Pear",
      emoji: "🍐",
      goal: `Stay away from the snake for ${ROUND_TIME} seconds. Dash to escape tight spots.`,
      controls: { dirs: "roll (keeps rolling)", action: "dash" },
      pointer: "swipe",
      pointerHint: "Swipe to roll · tap to dash",
      pad: { dirs: "four", action: "Dash" },
      bot: pearBot,
    },
  ],
  createRound,
};
