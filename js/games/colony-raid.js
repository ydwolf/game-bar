// The raid room: an action fight. You move and dodge with the arrows, hold Shift to block and
// click (or press Space) to swing your sword; your soldiers fight on their own beside you.
// Raiders come in waves, the last with their boss. Every raider flashes red before it hits —
// that's your moment to block or step out of reach.
//
// Win and the Raid trophy is yours. Fall and the raid fails: every soldier who went in comes
// back wounded and can't fight again until a Healer treats them.
import { clamp, rand } from "../util.js";
import { sfx } from "../sound.js";
import { CONFIG as K } from "./colony-config.js";
import { person, icon } from "./colony-art.js";

const R = K.raid;
const ARENA = { x0: 30, x1: 690, y0: 70, y1: 410 };

export function startRaid(c) {
  const pl = c.player;
  pl.x = 120;
  pl.y = 240;
  const allies = c.readySoldiers().map((v, i) => {
    const fight = v.buff ? v.buff.stats[1] : 0;
    const hp = R.soldierHP + R.fightStatHP * fight;
    return {
      v, x: 80 + (i % 3) * 26, y: 150 + Math.floor(i / 3) * 34 + (i % 2) * 10, hp, maxHp: hp,
      dmg: R.soldierDamage * K.tiers[v.tool].sword * (1 + R.fightStatDamage * fight), cd: rand(0.2, 0.8), down: false, walk: 0, flash: 0,
    };
  });
  const raid = {
    wave: -1,
    nextWave: 1.2,
    hp: R.playerHP,
    swingCd: 0,
    swing: null, // the current swing, for drawing
    hurt: 0,
    blocking: false,
    allies,
    foes: [],
    banner: { text: allies.length ? `The raid begins — ${allies.length} soldiers with you` : "The raid begins — you're on your own!", t: 2.2 },
    sparks: [],
  };
  return raid;
}

function spawnWave(raid, n) {
  const last = raid.wave === R.waves.length - 1;
  for (let i = 0; i < n; i++) {
    raid.foes.push({ x: rand(600, 680), y: rand(ARENA.y0 + 20, ARENA.y1 - 20), hp: R.raiderHP, maxHp: R.raiderHP, dmg: R.raiderDamage, windup: 0, cd: rand(0.4, 1.2), boss: false, walk: 0, flash: 0, target: null });
  }
  if (last) raid.foes.push({ x: 660, y: 240, hp: R.bossHP, maxHp: R.bossHP, dmg: R.bossDamage, windup: 0, cd: 1.5, boss: true, walk: 0, flash: 0, target: null });
  raid.banner = { text: last ? "The raid boss is here!" : `Wave ${raid.wave + 1} of ${R.waves.length}`, t: 1.8 };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function stepToward(o, t, speed, dt, stop) {
  const d = dist(o, t);
  if (d <= stop) return true;
  const s = Math.min(speed * dt, d - stop);
  o.x += ((t.x - o.x) / d) * s;
  o.y += ((t.y - o.y) / d) * s;
  o.walk += dt;
  return false;
}

// Returns "win", "lose" or null while the fight goes on
export function updateRaid(c, raid, input, dt) {
  const pl = c.player;
  if (raid.banner && (raid.banner.t -= dt) <= 0) raid.banner = null;
  raid.hurt = Math.max(0, raid.hurt - dt);
  raid.swingCd = Math.max(0, raid.swingCd - dt);
  if (raid.swing && (raid.swing.t -= dt) <= 0) raid.swing = null;
  for (const s of raid.sparks) s.t -= dt;
  raid.sparks = raid.sparks.filter((s) => s.t > 0);

  // Next wave when the room is clear
  const alive = raid.foes.filter((f) => f.hp > 0);
  if (!alive.length) {
    if (raid.wave >= R.waves.length - 1) return finish(c, raid, true);
    raid.nextWave -= dt;
    if (raid.nextWave <= 0) {
      raid.wave++;
      raid.foes = [];
      spawnWave(raid, R.waves[raid.wave]);
      raid.nextWave = 1.5;
    }
  }

  // You: move (slower while blocking), block, swing
  raid.blocking = input.held.action2;
  const mx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
  const my = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
  if (mx || my) {
    const len = Math.hypot(mx, my);
    const speed = K.playerSpeed * (raid.blocking ? 0.45 : 1);
    pl.x = clamp(pl.x + (mx / len) * speed * dt, ARENA.x0, ARENA.x1);
    pl.y = clamp(pl.y + (my / len) * speed * dt, ARENA.y0, ARENA.y1);
    if (!raid.blocking) pl.face = { x: mx / len, y: my / len };
    pl.walk += dt;
  }
  const clicked = input.pendingFire && input.target && c.view;
  if ((input.pressed.action || clicked) && raid.swingCd === 0 && !raid.blocking) {
    let dir = pl.face;
    if (clicked) {
      const t = { x: c.view.x + input.target.x / c.view.zoom, y: c.view.y + input.target.y / c.view.zoom };
      const d = Math.hypot(t.x - pl.x, t.y - (pl.y - 14)) || 1;
      dir = { x: (t.x - pl.x) / d, y: (t.y - (pl.y - 14)) / d };
      pl.face = dir;
    }
    swing(raid, pl, dir, R.playerDamage * K.tiers[pl.sword].sword);
  }

  // Your soldiers pick the nearest raider and fight it
  for (const a of raid.allies) {
    if (a.down) continue;
    a.flash = Math.max(0, a.flash - dt);
    let target = null;
    for (const f of raid.foes) if (f.hp > 0 && (!target || dist(f, a) < dist(target, a))) target = f;
    if (!target) continue;
    a.cd -= dt;
    if (stepToward(a, target, 95, dt, target.boss ? 30 : 22) && a.cd <= 0) {
      a.cd = R.soldierCooldown;
      hit(raid, target, a.dmg);
    }
  }

  // Raiders go for the nearest of you and your soldiers, wind up (flash red), then strike
  const targets = () => [{ who: "you", x: pl.x, y: pl.y }, ...raid.allies.filter((a) => !a.down).map((a) => ({ who: a, x: a.x, y: a.y }))];
  for (const f of raid.foes) {
    if (f.hp <= 0) continue;
    f.flash = Math.max(0, f.flash - dt);
    const reach = f.boss ? 40 : 30;
    if (f.windup > 0) {
      f.windup -= dt;
      if (f.windup <= 0) strike(c, raid, f, reach);
      continue;
    }
    let t = null;
    for (const o of targets()) if (!t || dist(o, f) < dist(t, f)) t = o;
    f.target = t.who;
    f.cd -= dt;
    if (stepToward(f, t, f.boss ? 55 : 72, dt, reach - 8) && f.cd <= 0) f.windup = R.raiderWindup * (f.boss ? 1.3 : 1);
  }

  if (raid.hp <= 0) return finish(c, raid, false);
  return null;
}

function swing(raid, pl, dir, dmg) {
  raid.swingCd = R.swingCooldown;
  raid.swing = { dir, t: 0.18 };
  sfx("throw", { volume: 0.6 });
  for (const f of raid.foes) {
    if (f.hp <= 0) continue;
    const dx = f.x - pl.x;
    const dy = f.y - pl.y;
    const d = Math.hypot(dx, dy);
    const reach = R.swingRange + (f.boss ? 12 : 0);
    if (d > reach) continue;
    if (d > 8 && (dx * dir.x + dy * dir.y) / d < 0.35) continue; // only what's in front of you
    hit(raid, f, dmg);
  }
}

function hit(raid, f, dmg) {
  f.hp -= dmg;
  f.flash = 0.15;
  raid.sparks.push({ x: f.x, y: f.y - 20, t: 0.4, text: `-${Math.round(dmg)}` });
  if (f.hp <= 0) sfx(f.boss ? "explode" : "hit");
  else sfx("brick", { volume: 0.4 });
}

// A raider's blow lands on whoever is still in reach — you can block it, or dodge out of range
function strike(c, raid, f, reach) {
  f.cd = R.raiderCooldown * (f.boss ? 1.2 : 1);
  const pl = c.player;
  if (f.target === "you") {
    if (dist(f, pl) > reach + 6) return; // dodged
    let dmg = f.dmg;
    if (raid.blocking) {
      dmg *= 1 - R.blockReduction;
      raid.sparks.push({ x: pl.x, y: pl.y - 30, t: 0.4, text: "BLOCK" });
      sfx("bounce");
    } else {
      sfx("hit");
    }
    raid.hp -= dmg;
    raid.hurt = 0.25;
    return;
  }
  const a = f.target;
  if (!a || a.down || dist(f, a) > reach + 6) return;
  a.hp -= f.dmg;
  a.flash = 0.2;
  if (a.hp <= 0) {
    a.down = true;
    sfx("thud");
  }
}

function finish(c, raid, won) {
  const pl = c.player;
  pl.x = 120;
  pl.y = 300;
  if (!won) for (const a of raid.allies) a.v.wounded = true;
  for (const a of raid.allies) a.v.task = [];
  return won ? "win" : "lose";
}

// ---------- drawing (in world units; the arena is the raid zone) ----------

export function drawRaid(ctx, c, raid) {
  const pl = c.player;
  const items = [];
  for (const a of raid.allies) items.push({ y: a.y, fn: () => drawFighter(ctx, a, a.v.job === "soldier" ? "#8a2a2a" : "#3a6ea5", "#5a1a1a", false) });
  for (const f of raid.foes) if (f.hp > 0) items.push({ y: f.y, fn: () => drawFoe(ctx, f) });
  items.push({
    y: pl.y,
    fn: () => {
      person(ctx, pl.x, pl.y, { shirt: raid.hurt > 0 ? "#ffffff" : "#c94a3a", shirt2: "#8f2f22", hat: true, scale: 2.4, bob: Math.sin(pl.walk * 14) > 0 ? -1 : 0 });
      if (raid.blocking) {
        // A round shield on the side you're facing
        const sx = pl.x + pl.face.x * 12;
        const sy = pl.y - 18 + pl.face.y * 8;
        ctx.beginPath();
        ctx.arc(sx, sy, 10, 0, Math.PI * 2);
        ctx.fillStyle = "#8f5f34";
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#c4c8cc";
        ctx.stroke();
      }
      if (raid.swing) {
        const { dir } = raid.swing;
        const a = Math.atan2(dir.y, dir.x);
        ctx.beginPath();
        ctx.arc(pl.x, pl.y - 14, R.swingRange - 6, a - 0.9, a + 0.9);
        ctx.lineWidth = 5;
        ctx.strokeStyle = "rgba(240, 240, 255, 0.8)";
        ctx.stroke();
      }
    },
  });
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.fn();
  for (const s of raid.sparks) {
    ctx.font = 'bold 12px "Special Elite", monospace';
    ctx.textAlign = "center";
    ctx.fillStyle = s.text === "BLOCK" ? "#9fd0ff" : "#ffd27a";
    ctx.fillText(s.text, s.x, s.y - (0.4 - s.t) * 30);
  }
}

function bar(ctx, x, y, w, frac, color) {
  ctx.fillStyle = "rgba(20, 10, 5, 0.7)";
  ctx.fillRect(x - w / 2, y, w, 4);
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y, w * clamp(frac, 0, 1), 4);
}

function drawFighter(ctx, a, shirt, shirt2) {
  if (a.down) {
    ctx.globalAlpha = 0.45;
    person(ctx, a.x, a.y, { shirt, shirt2, scale: 2 });
    ctx.globalAlpha = 1;
    icon(ctx, "sick", a.x + 12, a.y - 36, 12);
    return;
  }
  person(ctx, a.x, a.y, { shirt: a.flash > 0 ? "#ffffff" : shirt, shirt2, scale: 2, bob: Math.sin(a.walk * 14) > 0 ? -1 : 0 });
  icon(ctx, "sword", a.x + 12, a.y - 18, 12);
  bar(ctx, a.x, a.y - 38, 26, a.hp / a.maxHp, "#7fc25a");
}

function drawFoe(ctx, f) {
  const scale = f.boss ? 3.4 : 2.1;
  if (f.windup > 0) {
    // The tell: a red ring before every strike
    ctx.beginPath();
    ctx.arc(f.x, f.y - 8 * scale, 9 * scale, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(255, 60, 40, ${0.5 + 0.5 * Math.sin(f.windup * 30)})`;
    ctx.stroke();
  }
  person(ctx, f.x, f.y, { shirt: f.flash > 0 ? "#ffffff" : f.boss ? "#2a2a2a" : "#4a4a4a", shirt2: "#1f1f1f", scale, bob: Math.sin(f.walk * 14) > 0 ? -1 : 0, bandana: true });
  bar(ctx, f.x, f.y - 17 * scale - 6, f.boss ? 50 : 24, f.hp / f.maxHp, "#e0603a");
}
