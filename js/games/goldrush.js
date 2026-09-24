// Gold Rush — a western Pac-Man. The Prospector collects every gold nugget in the mine; the
// Bandit tries to catch them three times. Dynamite scares the Bandit for a few seconds, and
// a scared Bandit caught by the Prospector gets thrown in the jailhouse. The Bandit can dig in
// its spurs for a short sprint.
import { DIRS, DIR_NAMES, OPPOSITE, bfs, Clock, chance, pick, lerp, rand } from "../util.js";

// # wall   . gold   o dynamite   _ jailhouse door (bandit only)   space: jailhouse
const MAZE = [
  "###################",
  "#o.......#.......o#",
  "#.##.###.#.###.##.#",
  "#.##..##...##..##.#",
  "#.###.##.#.##.###.#",
  "#.................#",
  "#.##.#.##_##.#.##.#",
  "#....#.#   #.#....#",
  "#.##.#.#####.#.##.#",
  "#.................#",
  "#.###.##.#.##.###.#",
  "#.##..##...##..##.#",
  "#.##.###.#.###.##.#",
  "#o.......#.......o#",
  "###################",
];
const COLS = MAZE[0].length;
const ROWS = MAZE.length;
const T = 30; // tile size in px
const W = COLS * T;
const H = ROWS * T;
const PRO_START = { x: 9, y: 9 };
const JAIL = { x: 9, y: 7 };
const LIVES = 3;
const SPUR_TIME = 1.5;
const SPUR_COOLDOWN = 6;
const SPUR_BOOST = 1.45;

const cell = (x, y) => (x < 0 || y < 0 || x >= COLS || y >= ROWS ? "#" : MAZE[y][x]);
const idx = (x, y) => y * COLS + x;
const proOpen = (x, y) => ".o".includes(cell(x, y));
const banditOpen = (x, y) => cell(x, y) !== "#" && cell(x, y) !== " " && cell(x, y) !== "_";
const inJail = (m) => Math.round(m.y) >= 6 && Math.round(m.y) <= 7 && Math.round(m.x) >= 8 && Math.round(m.x) <= 10;

// Moves along the grid: turns happen at tile centers, reversing works any time.
function move(m, speed, dt, canEnter) {
  let dist = speed * dt;
  let guard = 0;
  while (dist > 1e-6 && guard++ < 8) {
    if (m.want && m.dir && m.want === OPPOSITE[m.dir]) m.dir = m.want;
    const cx = Math.round(m.x);
    const cy = Math.round(m.y);
    if (Math.abs(m.x - cx) < 1e-6 && Math.abs(m.y - cy) < 1e-6) {
      m.x = cx;
      m.y = cy;
      if (m.want && canEnter(cx + DIRS[m.want][0], cy + DIRS[m.want][1])) m.dir = m.want;
      if (!m.dir || !canEnter(cx + DIRS[m.dir][0], cy + DIRS[m.dir][1])) {
        m.dir = null;
        return;
      }
    }
    const [dx, dy] = DIRS[m.dir];
    const pos = dx ? m.x : m.y;
    const d = dx || dy;
    const next = d > 0 ? Math.floor(pos + 1e-9) + 1 : Math.ceil(pos - 1e-9) - 1;
    const step = Math.min(dist, Math.abs(next - pos));
    if (dx) m.x += dx * step;
    else m.y += dy * step;
    dist -= step;
    if (Math.abs(m.x - Math.round(m.x)) < 1e-6) m.x = Math.round(m.x);
    if (Math.abs(m.y - Math.round(m.y)) < 1e-6) m.y = Math.round(m.y);
  }
}

function createRound({ level, inputs }) {
  const r = {
    level,
    gold: new Set(),
    dynamite: new Set(),
    pro: { ...PRO_START, dir: null, want: null },
    bandit: { ...JAIL, dir: null, want: "up" },
    proSpeed: 6.2,
    banditSpeed: [6.0, 6.5, 7.1, 7.2, 7.2][level - 1], // tuned with tests/fairness.js
    scareTime: [6, 5.5, 5, 4.5, 4][level - 1],
    scared: 0,
    spur: 0,
    spurCd: 0,
    jailed: 1.5, // the bandit waits in the jailhouse at the start
    lives: LIVES,
    total: 0,
    time: 0,
    winner: null,
    endReason: "",
  };
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (cell(x, y) === ".") r.gold.add(idx(x, y));
      if (cell(x, y) === "o") r.dynamite.add(idx(x, y));
    }
  }
  r.gold.delete(idx(PRO_START.x, PRO_START.y));
  r.total = r.gold.size;

  const end = (winner, reason) => {
    r.winner = winner;
    r.endReason = reason;
  };

  // Once out of the jailhouse, the bandit can't walk back in
  r.banditCanEnter = (x, y) => (inJail(r.bandit) ? cell(x, y) !== "#" : banditOpen(x, y));

  function sendToJail(delay) {
    r.bandit = { ...JAIL, dir: null, want: "up" };
    r.jailed = delay;
  }

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    r.time += dt;
    for (const d of inputs[0].dirs) r.pro.want = d;
    for (const d of inputs[1].dirs) r.bandit.want = d;

    r.scared = Math.max(0, r.scared - dt);
    r.spur = Math.max(0, r.spur - dt);
    r.spurCd = Math.max(0, r.spurCd - dt);
    if (inputs[1].pressed.action && r.spurCd === 0 && r.scared === 0 && r.jailed <= 0) {
      r.spur = SPUR_TIME;
      r.spurCd = SPUR_COOLDOWN;
    }

    move(r.pro, r.proSpeed, dt, proOpen);
    const banditSpeed = r.banditSpeed * (r.scared > 0 ? 0.55 : r.spur > 0 ? SPUR_BOOST : 1);
    if (r.jailed > 0) r.jailed -= dt;
    else move(r.bandit, banditSpeed, dt, r.banditCanEnter);

    const px = Math.round(r.pro.x);
    const py = Math.round(r.pro.y);
    if (r.gold.delete(idx(px, py)) && r.gold.size === 0) {
      end(0, "The prospector struck it rich!");
      return r.winner;
    }
    if (r.dynamite.delete(idx(px, py))) r.scared = r.scareTime;

    if (r.jailed <= 0 && Math.hypot(r.pro.x - r.bandit.x, r.pro.y - r.bandit.y) < 0.7) {
      if (r.scared > 0) {
        sendToJail(3);
        r.scared = 0;
      } else {
        r.lives--;
        if (r.lives <= 0) {
          end(1, "The bandit caught the prospector!");
          return r.winner;
        }
        r.pro = { ...PRO_START, dir: null, want: null };
        sendToJail(1.5);
      }
    }
    return r.winner;
  };

  r.status = () =>
    `Gold ${r.total - r.gold.size}/${r.total} · Prospector ${"●".repeat(r.lives)}${r.spurCd === 0 ? " · Spurs ready" : ""}${r.scared > 0 ? ` · Bandit scared ${Math.ceil(r.scared)}s` : ""}`;
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

// ---------- Bots ----------

function neighbors(x, y, open) {
  return DIR_NAMES.map((d) => ({ d, x: x + DIRS[d][0], y: y + DIRS[d][1] })).filter((n) => open(n.x, n.y));
}

function prospectorBot(r, input, skill) {
  const clock = new Clock(lerp(0.28, 0.08, skill));
  const caution = Math.round(lerp(1, 3, skill)); // how many tiles of room it keeps from the bandit

  return {
    update(dt) {
      if (r.winner !== null || !clock.tick(dt)) return;
      const px = Math.round(r.pro.x);
      const py = Math.round(r.pro.y);
      const bx = Math.round(r.bandit.x);
      const by = Math.round(r.bandit.y);
      const free = r.jailed > 0 || r.scared > 1;
      const bd = free ? null : bfs(COLS, ROWS, bx, by, banditOpen);
      const danger = (x, y) => bd && bd[idx(x, y)] >= 0 && bd[idx(x, y)] <= caution;

      let dir = null;
      const here = bd ? bd[idx(px, py)] : 99;
      if (r.scared > 1.5 && r.jailed <= 0 && chance(skill) && Math.hypot(px - bx, py - by) < 6) {
        // Turn the tables on a scared bandit
        const toBandit = bfs(COLS, ROWS, bx, by, proOpen);
        dir = pickStep(px, py, toBandit, proOpen);
      } else {
        const wantDynamite = !free && here >= 0 && here < 6 && r.dynamite.size;
        const targets = wantDynamite ? r.dynamite : r.gold;
        const dist = bfs(COLS, ROWS, px, py, (x, y) => proOpen(x, y) && !danger(x, y));
        let best = -1;
        let bestD = Infinity;
        for (const t of targets) {
          const d = dist[t];
          if (d > 0 && d < bestD) {
            bestD = d;
            best = t;
          }
        }
        if (best >= 0) {
          const back = bfs(COLS, ROWS, best % COLS, (best / COLS) | 0, (x, y) => proOpen(x, y) && !danger(x, y));
          dir = pickStep(px, py, back, (x, y) => proOpen(x, y) && !danger(x, y));
        }
        if (!dir && bd) {
          // Cornered: run to whichever neighbor is farthest from the bandit
          let far = -1;
          for (const n of neighbors(px, py, proOpen)) {
            if (bd[idx(n.x, n.y)] > far) {
              far = bd[idx(n.x, n.y)];
              dir = n.d;
            }
          }
        }
      }
      if (chance(lerp(0.12, 0.02, skill))) dir = pick(neighbors(px, py, proOpen))?.d ?? dir;
      if (dir && dir !== r.pro.want) input.press(dir);
    },
  };
}

// First step from (x, y) downhill along a distance field
function pickStep(x, y, dist, open) {
  let best = null;
  let bestD = Infinity;
  for (const n of neighbors(x, y, open)) {
    const d = dist[idx(n.x, n.y)];
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = n.d;
    }
  }
  return best;
}

function banditBot(r, input, skill) {
  const clock = new Clock(lerp(0.32, 0.08, skill));
  return {
    update(dt) {
      if (r.winner !== null || !clock.tick(dt)) return;
      if (r.jailed > 0 || inJail(r.bandit)) {
        if (r.bandit.want !== "up") input.press("up");
        return;
      }
      const bx = Math.round(r.bandit.x);
      const by = Math.round(r.bandit.y);
      let tx = Math.round(r.pro.x);
      let ty = Math.round(r.pro.y);
      let dir;
      if (r.scared > 0) {
        const pd = bfs(COLS, ROWS, tx, ty, banditOpen);
        let far = -1;
        for (const n of neighbors(bx, by, banditOpen)) {
          const d = pd[idx(n.x, n.y)] + rand(0, 2 * (1 - skill));
          if (d > far) {
            far = d;
            dir = n.d;
          }
        }
      } else {
        // Skilled bandits head the prospector off instead of trailing behind
        if (r.pro.dir && chance(skill)) {
          for (let i = 0; i < 3; i++) {
            const nx = tx + DIRS[r.pro.dir][0];
            const ny = ty + DIRS[r.pro.dir][1];
            if (!proOpen(nx, ny)) break;
            tx = nx;
            ty = ny;
          }
        }
        dir = pickStep(bx, by, bfs(COLS, ROWS, tx, ty, banditOpen), banditOpen);
      }
      if (chance(lerp(0.2, 0.03, skill))) dir = pick(neighbors(bx, by, banditOpen))?.d ?? dir;
      if (dir && dir !== r.bandit.want) input.press(dir);

      // Spur when the prospector is close enough to run down
      if (r.spurCd === 0 && r.scared === 0 && chance(0.3 + 0.6 * skill)) {
        const d = bfs(COLS, ROWS, bx, by, banditOpen)[idx(Math.round(r.pro.x), Math.round(r.pro.y))];
        if (d >= 0 && d <= lerp(9, 5, skill)) input.press("action");
      }
    },
  };
}

// ---------- Drawing ----------

function draw(ctx, r) {
  ctx.fillStyle = "#1d130d";
  ctx.fillRect(0, 0, W, H);
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = cell(x, y);
      if (c === "#") {
        ctx.fillStyle = "#6e4529";
        ctx.fillRect(x * T, y * T, T, T);
        ctx.fillStyle = "#86563a";
        ctx.fillRect(x * T + 2, y * T + 2, T - 4, 5);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(x * T, y * T + T - 4, T, 4);
      } else if (c === "_") {
        ctx.fillStyle = "#c9a45c";
        for (let i = 0; i < 4; i++) ctx.fillRect(x * T + 4 + i * 7, y * T + 12, 3, 8);
      } else if (c === " ") {
        ctx.fillStyle = "#2a1c12";
        ctx.fillRect(x * T, y * T, T, T);
      }
    }
  }

  ctx.fillStyle = "#f3c35a";
  for (const g of r.gold) {
    const x = (g % COLS) * T + T / 2;
    const y = ((g / COLS) | 0) * T + T / 2;
    ctx.beginPath();
    ctx.moveTo(x - 3, y + 2);
    ctx.lineTo(x - 1, y - 3);
    ctx.lineTo(x + 3, y - 1);
    ctx.lineTo(x + 2, y + 3);
    ctx.fill();
  }
  for (const d of r.dynamite) {
    const x = (d % COLS) * T + T / 2;
    const y = ((d / COLS) | 0) * T + T / 2;
    const pulse = 1 + Math.sin(r.time * 6) * 0.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = "#c9412e";
    ctx.fillRect(-7, -5, 4, 12);
    ctx.fillRect(-2, -5, 4, 12);
    ctx.fillRect(3, -5, 4, 12);
    ctx.fillStyle = "#f3c35a";
    ctx.fillRect(-1, -10, 2, 5);
    ctx.restore();
  }

  // Prospector: round face, wide brown hat
  const px = r.pro.x * T + T / 2;
  const py = r.pro.y * T + T / 2;
  ctx.fillStyle = "#e8c28e";
  ctx.beginPath();
  ctx.arc(px, py + 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6b4220";
  ctx.beginPath();
  ctx.ellipse(px, py - 5, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(px - 7, py - 13, 14, 9, 4);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.fillRect(px - 5, py + 1, 2, 3);
  ctx.fillRect(px + 3, py + 1, 2, 3);

  // Bandit: black hat and red bandana, pale and flickering when scared
  if (r.jailed <= 0 || Math.floor(r.time * 4) % 2 === 0) {
    const bx = r.bandit.x * T + T / 2;
    const by = r.bandit.y * T + T / 2;
    const scared = r.scared > 0;
    const flicker = scared && r.scared < 1.5 && Math.floor(r.time * 8) % 2 === 0;
    ctx.fillStyle = scared ? (flicker ? "#f3e6c9" : "#8fb3c9") : "#4a3a30";
    ctx.beginPath();
    ctx.arc(bx, by + 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = scared ? "#5a7a8c" : "#b8442e";
    ctx.fillRect(bx - 10, by + 3, 20, 6);
    ctx.fillStyle = "#15100c";
    ctx.beginPath();
    ctx.ellipse(bx, by - 5, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(bx - 7, by - 14, 14, 10, 3);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(bx - 5, by - 1, 3, 3);
    ctx.fillRect(bx + 2, by - 1, 3, 3);
  }
}

export default {
  id: "goldrush",
  title: "Gold Rush",
  kicker: "Maze chase",
  accent: "var(--turquoise)",
  blurb: "Pac-Man, western style: a prospector and a bandit.",
  width: W,
  height: H,
  sides: [
    {
      name: "Prospector",
      emoji: "🤠",
      goal: `Collect every gold nugget. Grab dynamite to scare the bandit — then you can chase it into the jailhouse.`,
      controls: { dirs: "walk the mine" },
      pointer: "swipe",
      pointerHint: "Swipe the board to turn",
      pad: { dirs: "four" },
      bot: prospectorBot,
    },
    {
      name: "Bandit",
      emoji: "🦹",
      goal: `Catch the prospector ${LIVES} times before the gold runs out. Dig in your spurs to sprint; steer clear while you're scared.`,
      controls: { dirs: "chase", action: "spurs (short sprint)" },
      pointer: "swipe",
      pointerHint: "Swipe the board to turn · tap for spurs",
      pad: { dirs: "four", action: "Spurs" },
      bot: banditBot,
    },
  ],
  createRound,
};
