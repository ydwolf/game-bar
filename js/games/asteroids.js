// Asteroids — the Ship has to survive the storm; the Rock thrower picks where each rock is
// headed and hurls it in from the edge of the sky.
import { clamp, lerp, rand, chance, angleDiff, Clock, formatTime } from "../util.js";

const W = 640;
const H = 480;
const ROUND_TIME = 45;
const ROCK_R = { 3: 38, 2: 22, 1: 12 };
const BULLET_SPEED = 500;
const SHIP_R = 12;

function createRound({ level, inputs }) {
  const r = {
    level,
    time: ROUND_TIME,
    ship: null,
    lives: 3,
    bullets: [],
    rocks: [],
    particles: [],
    supply: 1,
    supplyMax: 3,
    // Tuned with tests/fairness.js so each level is even between equally skilled players
    regen: 1 / [1.5, 1.6, 1.7, 1.75, 1.8][level - 1],
    rockSpeed: [160, 150, 142, 135, 128][level - 1],
    maxRocks: 5 + level,
    fireCd: 0,
    respawn: 0,
    clock: 0,
    winner: null,
    endReason: "",
  };
  r.cursors = [null, { x: W / 2, y: H / 3, speed: 420 + 30 * (level - 1), x0: 0, x1: W, y0: 0, y1: H }];

  const newShip = () => ({ x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, invuln: 2 });
  r.ship = newShip();

  const end = (winner, reason) => {
    r.winner = winner;
    r.endReason = reason;
  };

  function makeRock(x, y, size, vx, vy) {
    return {
      x, y, vx, vy, size,
      r: ROCK_R[size],
      rot: rand(0, Math.PI * 2),
      spin: rand(-0.6, 0.6),
      shape: Array.from({ length: 10 }, () => rand(0.75, 1.15)),
    };
  }

  // A thrown rock comes in from a random edge point well away from its target, so the ship
  // always gets to see it coming.
  function throwRock(target) {
    let sx = 0;
    let sy = 0;
    for (let i = 0; i < 30; i++) {
      const edge = Math.floor(Math.random() * 4);
      sx = edge === 0 ? 0 : edge === 1 ? W : rand(0, W);
      sy = edge === 2 ? 0 : edge === 3 ? H : rand(0, H);
      if (edge < 2) sy = rand(0, H);
      if (Math.hypot(sx - target.x, sy - target.y) > 260) break;
    }
    const d = Math.hypot(target.x - sx, target.y - sy) || 1;
    r.rocks.push(makeRock(sx, sy, 3, ((target.x - sx) / d) * r.rockSpeed, ((target.y - sy) / d) * r.rockSpeed));
    r.supply -= 1;
  }

  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(40, 180);
      const life = rand(0.4, 1);
      r.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, color });
    }
  }

  function wrap(o, m) {
    if (o.x < -m) o.x = W + m;
    else if (o.x > W + m) o.x = -m;
    if (o.y < -m) o.y = H + m;
    else if (o.y > H + m) o.y = -m;
  }

  function breakRock(rock, spawned) {
    rock.dead = true;
    burst(rock.x, rock.y, 6 + rock.size * 4, "#d9b98a");
    if (rock.size === 1) return;
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = Math.hypot(rock.vx, rock.vy) * rand(1.1, 1.4);
      spawned.push(makeRock(rock.x, rock.y, rock.size - 1, Math.cos(a) * sp, Math.sin(a) * sp));
    }
  }

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    r.clock += dt;
    const sin = inputs[0];
    const tin = inputs[1];

    r.supply = Math.min(r.supplyMax, r.supply + r.regen * dt);
    if (tin.pressed.action && r.supply >= 1 && r.rocks.length < r.maxRocks) throwRock(r.cursors[1]);

    for (const p of r.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    r.particles = r.particles.filter((p) => p.life > 0);

    for (const rock of r.rocks) {
      rock.x += rock.vx * dt;
      rock.y += rock.vy * dt;
      rock.rot += rock.spin * dt;
      wrap(rock, rock.r);
    }

    const ship = r.ship;
    if (ship) {
      if (sin.held.left) ship.a -= 4.2 * dt;
      if (sin.held.right) ship.a += 4.2 * dt;
      if (sin.held.up) {
        ship.vx += Math.cos(ship.a) * 280 * dt;
        ship.vy += Math.sin(ship.a) * 280 * dt;
      }
      const drag = Math.pow(0.45, dt);
      ship.vx *= drag;
      ship.vy *= drag;
      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > 340) {
        ship.vx *= 340 / sp;
        ship.vy *= 340 / sp;
      }
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      wrap(ship, SHIP_R);
      ship.invuln = Math.max(0, ship.invuln - dt);

      r.fireCd -= dt;
      if (sin.held.action && r.fireCd <= 0 && r.bullets.length < 6) {
        const c = Math.cos(ship.a);
        const s = Math.sin(ship.a);
        r.bullets.push({ x: ship.x + c * 14, y: ship.y + s * 14, vx: ship.vx + c * BULLET_SPEED, vy: ship.vy + s * BULLET_SPEED, life: 0.9 });
        r.fireCd = 0.22;
      }
    } else {
      r.respawn -= dt;
      const clear = r.rocks.every((rk) => Math.hypot(rk.x - W / 2, rk.y - H / 2) > rk.r + 80);
      if (r.respawn <= 0 && (clear || r.respawn < -2)) r.ship = newShip();
    }

    for (const b of r.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      wrap(b, 0);
    }

    const spawned = [];
    for (const b of r.bullets) {
      if (b.life <= 0) continue;
      for (const rock of r.rocks) {
        if (rock.dead || Math.hypot(b.x - rock.x, b.y - rock.y) > rock.r) continue;
        b.life = 0;
        breakRock(rock, spawned);
        break;
      }
    }

    if (r.ship && r.ship.invuln <= 0) {
      for (const rock of r.rocks) {
        if (rock.dead || Math.hypot(r.ship.x - rock.x, r.ship.y - rock.y) > rock.r + SHIP_R * 0.7) continue;
        breakRock(rock, spawned);
        burst(r.ship.x, r.ship.y, 30, "#e8903a");
        r.ship = null;
        r.lives--;
        r.respawn = 1;
        if (r.lives <= 0) end(1, "The rocks knocked the ship out of the sky!");
        break;
      }
    }

    r.bullets = r.bullets.filter((b) => b.life > 0);
    r.rocks = r.rocks.filter((rk) => !rk.dead).concat(spawned);

    r.time -= dt;
    if (r.winner === null && r.time <= 0) end(0, "The ship rode out the storm!");
    return r.winner;
  };

  r.status = () => `${formatTime(r.time)} · Ship ${"●".repeat(r.lives)} · Rocks ready ${Math.floor(r.supply)}`;
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

// ---------- Bots ----------

function shipBot(r, input, skill) {
  const clock = new Clock(lerp(0.3, 0.07, skill));
  let aim = null;
  let dodge = false;
  let aimNoise = 0;

  function decide() {
    const ship = r.ship;
    let target = null;
    let bestT = Infinity;
    dodge = false;
    for (const rock of r.rocks) {
      const px = rock.x - ship.x;
      const py = rock.y - ship.y;
      const vx = rock.vx - ship.vx;
      const vy = rock.vy - ship.vy;
      const vv = vx * vx + vy * vy || 1;
      const tca = clamp(-(px * vx + py * vy) / vv, 0, 3);
      const miss = Math.hypot(px + vx * tca, py + vy * tca);
      const threat = miss < rock.r + SHIP_R + 18;
      const t = threat ? tca : 3 + Math.hypot(px, py) / 100;
      if (t < bestT) {
        bestT = t;
        target = rock;
      }
      if (threat && tca < 0.6 && chance(skill)) dodge = true;
    }
    if (!target) {
      aim = null;
      return;
    }
    const dist = Math.hypot(target.x - ship.x, target.y - ship.y);
    const lead = dist / BULLET_SPEED;
    aimNoise = rand(-1, 1) * (1 - skill) * 0.35;
    if (dodge) aim = Math.atan2(ship.y - target.y, ship.x - target.x) + Math.PI / 2;
    else aim = Math.atan2(target.y + target.vy * lead - ship.y, target.x + target.vx * lead - ship.x) + aimNoise;
  }

  return {
    update(dt) {
      if (r.winner !== null) return;
      if (!r.ship) {
        input.held.left = input.held.right = input.held.up = input.held.action = false;
        return;
      }
      if (clock.tick(dt)) decide();
      if (aim === null) {
        input.held.left = input.held.right = input.held.up = input.held.action = false;
        return;
      }
      const diff = angleDiff(r.ship.a, aim);
      input.held.left = diff < -0.05;
      input.held.right = diff > 0.05;
      input.held.up = dodge && Math.abs(diff) < 0.6;
      input.held.action = !dodge && Math.abs(diff) < lerp(0.3, 0.1, skill);
    },
  };
}

function throwerBot(r, input, skill) {
  const clock = new Clock(lerp(1.1, 0.35, skill));
  return {
    update(dt) {
      if (r.winner !== null || !clock.tick(dt)) return;
      if (r.supply < 1 || r.rocks.length >= r.maxRocks || input.pendingFire) return;
      const ship = r.ship || { x: W / 2, y: H / 2, vx: 0, vy: 0 };
      const lead = 300 / r.rockSpeed; // roughly how long a rock takes to arrive
      const noise = (1 - skill) * 90;
      input.target = {
        x: ship.x + ship.vx * lead * skill + rand(-noise, noise),
        y: ship.y + ship.vy * lead * skill + rand(-noise, noise),
      };
      input.pendingFire = true;
    },
  };
}

// ---------- Drawing ----------

const STARS = Array.from({ length: 80 }, () => ({ x: rand(0, W), y: rand(0, H), s: rand(0.3, 1.6), a: rand(0.2, 0.8) }));

function draw(ctx, r) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#120c16");
  g.addColorStop(1, "#2e1b22");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#f3e6c9";
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#1c1116";
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (const [x, y] of [[0, 450], [70, 450], [95, 405], [210, 405], [230, 440], [360, 440], [380, 420], [470, 420], [490, 455], [640, 455]]) ctx.lineTo(x, y);
  ctx.lineTo(W, H);
  ctx.fill();

  for (const rock of r.rocks) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    ctx.rotate(rock.rot);
    ctx.beginPath();
    rock.shape.forEach((m, i) => {
      const a = (i / rock.shape.length) * Math.PI * 2;
      ctx.lineTo(Math.cos(a) * rock.r * m, Math.sin(a) * rock.r * m);
    });
    ctx.closePath();
    ctx.fillStyle = "#4a3325";
    ctx.fill();
    ctx.strokeStyle = "#d9b98a";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  ctx.fillStyle = "#f3c35a";
  for (const b of r.bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of r.particles) {
    ctx.globalAlpha = p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 2.5, 2.5);
  }
  ctx.globalAlpha = 1;

  const ship = r.ship;
  if (ship && !(ship.invuln > 0 && Math.floor(r.clock * 10) % 2 === 0)) {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.a);
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-11, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-11, 10);
    ctx.closePath();
    ctx.fillStyle = "#2a1a12";
    ctx.fill();
    ctx.strokeStyle = "#f1e4c7";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

export default {
  id: "asteroids",
  title: "Asteroids",
  kicker: "Turn + fire",
  accent: "var(--sky)",
  blurb: "A lone ship versus the fella hurling rocks.",
  width: W,
  height: H,
  sides: [
    {
      name: "Ship",
      emoji: "🚀",
      goal: `Survive ${ROUND_TIME} seconds. Shoot rocks apart before they hit you — 3 hits and you're done.`,
      controls: { dirs: "turn (← →) and thrust (↑)", action: "fire (hold)" },
      pointer: null,
      pad: { dirs: "ship", action: "Fire" },
      bot: shipBot,
    },
    {
      name: "Rock thrower",
      emoji: "☄️",
      goal: "Hit the ship 3 times before the clock runs out. Aim where it's going — rocks come in from the edge.",
      controls: { dirs: "move the crosshair", action: "throw a rock at it" },
      pointer: "aim",
      pointerHint: "Click or tap where you want a rock to go",
      pad: { dirs: "four", action: "Throw" },
      bot: throwerBot,
    },
  ],
  createRound,
};
