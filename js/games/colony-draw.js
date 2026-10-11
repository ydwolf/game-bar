// Everything Life in the Colony puts on screen: the zone you're in (seen through a camera that
// follows you), the HUD, menus, the build preview and the raid.
import { clamp } from "../util.js";
import { sprite, icon, person, personIcon, building, groundPattern, tomatoPlant } from "./colony-art.js";
import { drawRaid } from "./colony-raid.js";
import { W, H, ZONES, EXITS, BUILDINGS, JOBS, IDLE_SHIRT, exitCenter, seedKey, countOf, formatClock, costText } from "./colony.js";
import { CONFIG as K } from "./colony-config.js";

const TOP = 48; // trophies strip, then the NEXT bar
const BOT = 28; // bag, Hall and villagers
const INK = "#2b1d12";
const CREAM = "#f3e6c9";
const DIM = "#d4bd8f";
const SHADE = "rgba(28, 17, 10, 0.88)";

function text(ctx, str, x, y, size, color, align = "left") {
  ctx.font = `${size}px "Special Elite", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
}

function fitText(ctx, str, x, y, max, maxW, color, align = "left") {
  ctx.font = `${max}px "Special Elite", monospace`;
  const size = Math.max(7, Math.min(max, Math.floor((max * maxW) / ctx.measureText(str).width)));
  text(ctx, str, x, y, size, color, align);
}

function label(ctx, str, x, y) {
  ctx.font = '9px "Special Elite", monospace';
  const w = ctx.measureText(str).width + 8;
  ctx.fillStyle = "rgba(243, 230, 201, 0.88)";
  ctx.fillRect(x - w / 2, y - 6, w, 12);
  text(ctx, str, x, y, 9, INK, "center");
}

function pill(ctx, str, x, y, color) {
  ctx.font = '13px "Special Elite", monospace';
  const size = Math.max(8, Math.min(13, Math.floor((13 * (W - 24)) / ctx.measureText(str).width)));
  ctx.font = `${size}px "Special Elite", monospace`;
  const w = ctx.measureText(str).width + 16;
  const cx = clamp(x, w / 2 + 4, W - w / 2 - 4);
  const cy = clamp(y, TOP + 14, H - BOT - 14);
  ctx.fillStyle = "rgba(28, 17, 10, 0.9)";
  ctx.fillRect(cx - w / 2, cy - 11, w, 22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - w / 2 + 0.5, cy - 10.5, w - 1, 21);
  text(ctx, str, cx, cy, size, color, "center");
}

function arrowDown(ctx, x, y) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - 9, y - 10);
  ctx.lineTo(x - 4, y - 10);
  ctx.lineTo(x - 4, y - 21);
  ctx.lineTo(x + 4, y - 21);
  ctx.lineTo(x + 4, y - 10);
  ctx.lineTo(x + 9, y - 10);
  ctx.closePath();
  const g = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
  g.addColorStop(0, "#ffe38a");
  g.addColorStop(1, "#e0a030");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.stroke();
}

export function draw(ctx, r) {
  const c = r.colony;
  const pl = c.player;
  const z = ZONES[pl.zone];
  const zoom = z.zoom;
  const vw = W / zoom;
  const vh = (H - TOP - BOT) / zoom;
  c.view = {
    zoom,
    x: z.w <= vw ? (z.w - vw) / 2 : clamp(pl.x - vw / 2, 0, z.w - vw),
    y: (z.h <= vh ? (z.h - vh) / 2 : clamp(pl.y - 20 - vh / 2, 0, z.h - vh)) - TOP / zoom,
  };
  ctx.fillStyle = "#1f130b";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-c.view.x, -c.view.y);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, z.w, z.h);
  ctx.clip();
  drawZone(ctx, c, pl.zone);
  ctx.restore();
  ctx.restore();

  drawPlayerText(ctx, c);
  if (c.raid) drawRaidHud(ctx, c);
  drawHud(ctx, c);
  if (c.hint && !c.raid) drawEdgeArrow(ctx, c);
  if (c.menu) drawMenu(ctx, c);
  if (c.fade > 0) {
    ctx.fillStyle = `rgba(20, 12, 6, ${c.fade})`;
    ctx.fillRect(0, TOP, W, H - TOP - BOT);
    text(ctx, ZONES[pl.zone].name.toUpperCase(), W / 2, H / 2, 26, `rgba(243, 230, 201, ${c.fade})`, "center");
  }
}

// ---------- the world ----------

function drawZone(ctx, c, zone) {
  const z = ZONES[zone];
  const pl = c.player;
  ctx.fillStyle = groundPattern(ctx, zone);
  ctx.fillRect(0, 0, z.w, z.h);
  if (zone === "village") {
    // Dirt roads from the square to each doorway
    ctx.fillStyle = "rgba(150, 110, 60, 0.5)";
    ctx.fillRect(0, 486, z.w, 36);
    ctx.fillRect(702, 0, 36, z.h);
  }
  if (zone === "farm") {
    ctx.fillStyle = "rgba(90, 60, 30, 0.35)";
    for (let y = 120; y < z.h; y += 18) ctx.fillRect(0, y, z.w, 4);
  }
  if (zone === "raid") {
    ctx.strokeStyle = "rgba(20, 15, 10, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x < z.w; x += 40) for (let y = 0; y < z.h; y += 40) ctx.strokeRect(x + (Math.floor(y / 40) % 2) * 20, y, 40, 40);
    ctx.fillStyle = "rgba(10, 5, 2, 0.35)";
    ctx.fillRect(0, 0, z.w, 50);
  }

  // Doorways out, each with a signpost
  for (const e of EXITS) {
    if (e.zone !== zone) continue;
    const d = exitCenter(e);
    ctx.fillStyle = "rgba(243, 195, 90, 0.18)";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    const sx = clamp(d.x, 40, z.w - 40);
    const sy = clamp(d.y, 40, z.h - 30);
    const off = e.w < e.h ? { x: d.x < z.w / 2 ? 30 : -30, y: -60 } : { x: 80, y: d.y < z.h / 2 ? 20 : -10 };
    sprite(ctx, "sign", sx + off.x, sy + off.y + 30, 2);
    label(ctx, `${ZONES[e.to].name} ${arrowFor(e, z)}`, sx + off.x, sy + off.y + 4);
  }

  const items = [];
  const add = (y, fn) => items.push({ y, fn });

  for (const b of c.buildings) if (b.zone === zone) add(b.y + b.h / 2, () => drawBuilding(ctx, c, b));
  if (zone === "forest") for (const t of c.trees) add(t.y, () => sprite(ctx, t.grown ? "tree" : "stump", t.x, t.y + 4, 2.3));
  if (zone === "mine") for (const k of c.rocks) add(k.y, () => sprite(ctx, k.left > 0 ? "rock" : "rubble", k.x, k.y + 4, 1.4 + 0.25 * k.left));
  for (const v of c.villagers) if (v.zone === zone && !(c.raid && zone === "raid")) add(v.y, () => drawVillager(ctx, c, v));
  if (!c.raid) {
    add(pl.y, () => {
      ctx.fillStyle = "rgba(243, 195, 90, 0.45)";
      ctx.beginPath();
      ctx.ellipse(pl.x, pl.y, 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      person(ctx, pl.x, pl.y, { shirt: "#c94a3a", shirt2: "#8f2f22", hat: true, scale: 2, bob: Math.sin(pl.walk * 14) > 0 ? -1 : 0 });
    });
  }
  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.fn();

  if (c.raid && zone === "raid") drawRaid(ctx, c, c.raid);

  // The building you're placing, green where it fits and red where it doesn't
  const g = c.ghost();
  if (g) {
    ctx.globalAlpha = 0.55;
    if (g.def.roof) building(ctx, g.x, g.y, { w: g.w, h: g.h, roof: g.def.roof, sign: g.def.sign, stone: g.def.stone });
    else if (c.placing.key === "plot") drawPlotBed(ctx, g);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = g.ok ? "#7fe07a" : "#ff5a3a";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(g.x - g.w / 2 - 3, g.y - g.h / 2 - 3, g.w + 6, g.h + 6);
    ctx.setLineDash([]);
  }

  // Where the NEXT bar points, when it's in this zone
  if (c.hint && c.hint.x !== undefined && c.hint.zone === zone && !c.raid) {
    arrowDown(ctx, c.hint.x, c.hint.y - c.hint.h / 2 - 6 + Math.sin(c.time * 6) * 3);
  }

  // The gathering minigame over your head
  if (c.mg) {
    const mg = c.mg;
    const bx = pl.x - 40;
    const by = pl.y - 56;
    ctx.fillStyle = INK;
    ctx.fillRect(bx - 2, by - 2, 84, 12);
    ctx.fillStyle = mg.cool > 0 ? "#b8442e" : "#d4bd8f";
    ctx.fillRect(bx, by, 80, 8);
    ctx.fillStyle = "#5f8a3c";
    ctx.fillRect(bx + (mg.zoneC - mg.zoneW / 2) * 80, by, mg.zoneW * 80, 8);
    ctx.fillStyle = INK;
    ctx.fillRect(bx + mg.phase * 80 - 1.5, by - 3, 3, 14);
  }
}

function arrowFor(e, z) {
  if (e.w < e.h) return e.x < z.w / 2 ? "◀" : "▶";
  return e.y < z.h / 2 ? "▲" : "▼";
}

function drawPlotBed(ctx, p) {
  ctx.fillStyle = "#4a3418";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 2, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#6e4f2c";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, p.w / 2 - 2, p.h / 2 - 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuilding(ctx, c, b) {
  const def = BUILDINGS[b.key];
  if (b.key === "plot") {
    drawPlotBed(ctx, b);
    if (b.seed) tomatoPlant(ctx, b.x, b.y + 6, b.grow, 1.7);
    if (b.seed) label(ctx, seedKey(b.seed), b.x, b.y + 20);
    return;
  }
  if (b.key === "sculpture") {
    sprite(ctx, c.trophies.resource ? "statue" : "plinth", b.x, b.y + b.h / 2, 3.2);
    label(ctx, c.trophies.resource ? "Resource Master" : "Sculpture plinth", b.x, b.y + b.h / 2 + 10);
    return;
  }
  if (b.key === "bench") {
    sprite(ctx, "bench", b.x, b.y + b.h / 2, 3.6);
    label(ctx, "Seed Bench", b.x, b.y + b.h / 2 + 10);
    return;
  }
  if (b.key === "gate") {
    if (!c.raid) {
      sprite(ctx, "gate", b.x, b.y + b.h / 2, 5.6);
      label(ctx, c.trophies.raid ? "Raid Room — cleared" : "Raid Gate", b.x, b.y + b.h / 2 + 10);
    }
    return;
  }
  building(ctx, b.x, b.y, { w: b.w, h: b.h, roof: def.roof, sign: def.sign, stone: def.stone });
  label(ctx, def.name, b.x, b.y + b.h / 2 + 10);
  // Pile waiting at a hut, and empty jobs
  if (def.store) {
    const n = def.store === "tomato" ? countOf(b.stock.tomatoes) : b.stock[def.store];
    if (n) {
      icon(ctx, def.store === "tomato" ? "tomato" : def.store, b.x - b.w / 2 - 6, b.y + b.h / 2 - 6, 12);
      text(ctx, String(n), b.x - b.w / 2 + 2, b.y + b.h / 2 - 6, 10, CREAM);
    }
  }
  if (b.key === "kitchen") {
    const n = countOf(b.stock.tomatoes);
    if (n) {
      icon(ctx, "meal", b.x - b.w / 2 - 6, b.y + b.h / 2 - 6, 12);
      text(ctx, String(n), b.x - b.w / 2 + 2, b.y + b.h / 2 - 6, 10, CREAM);
    }
  }
  if (def.job && b.workers.length < def.slots) {
    ctx.fillStyle = "rgba(243, 195, 90, 0.95)";
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y - b.h / 2 + 4, 8, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, `${def.slots - b.workers.length}`, b.x + b.w / 2, b.y - b.h / 2 + 5, 10, INK, "center");
  }
  if (b.key === "hall") label(ctx, `${Math.floor(c.hall.log)} wood · ${Math.floor(c.hall.stone)} stone`, b.x, b.y + b.h / 2 + 23);
}

function drawVillager(ctx, c, v) {
  const job = v.job ? JOBS[v.job] : null;
  const bob = Math.sin(v.walk * 14) > 0 ? -1 : 0;
  ctx.globalAlpha = v.wounded ? 0.7 : 1;
  person(ctx, v.x, v.y, { shirt: job ? job.shirt : IDLE_SHIRT, shirt2: job ? job.shirt2 : "#5e4630", scale: 1.5, bob });
  ctx.globalAlpha = 1;
  const tag = v.wounded ? "sick" : !v.job ? "alert" : v.carry === "tomato" ? "tomato" : v.carry || null;
  if (tag) icon(ctx, tag, v.x + 10, v.y - 28, 10);
  if (v.buff && !v.wounded) icon(ctx, "star", v.x - 10, v.y - 28, 8);
  if (job && job.tool && v.tool > 0) {
    // A coloured dot for the tool's tier: stone, iron, legendary
    ctx.fillStyle = ["", "#a9a296", "#c4c8cc", "#f3c35a"][v.tool];
    ctx.beginPath();
    ctx.arc(v.x + 8, v.y - 6, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

// ---------- screen overlays ----------

function drawPlayerText(ctx, c) {
  const pl = c.player;
  const z = c.view.zoom;
  const sx = (pl.x - c.view.x) * z;
  const sy = (pl.y - c.view.y) * z;
  if (!c.raid && !c.menu) {
    let prompt;
    if (c.placing) prompt = "Space: build here · Shift: cancel · walk to move it";
    else if (c.mg) prompt = "Press Space when the marker is in the green";
    else prompt = c.promptFor(c.targetAt());
    if (prompt) pill(ctx, prompt, sx, sy - 90, "#f3c35a");
  }
  if (c.msg) pill(ctx, c.msg.text, sx, sy + 24, CREAM);
}

// Points at the NEXT bar's target: a building in another zone, or the doorway toward that zone
function drawEdgeArrow(ctx, c) {
  const pl = c.player;
  let t = null;
  if (c.hint.zone !== pl.zone) {
    const e = c.routeExit(pl.zone, c.hint.zone);
    if (e) t = exitCenter(e);
  } else if (c.hint.x !== undefined) t = c.hint;
  if (!t) return;
  const z = c.view.zoom;
  const sx = (t.x - c.view.x) * z;
  const sy = (t.y - c.view.y) * z;
  const top = TOP + 4;
  const bottom = H - BOT - 8;
  if (sx > 20 && sx < W - 20 && sy > top && sy < bottom && c.hint.zone === pl.zone) return;
  const cx = W / 2;
  const cy = (top + bottom) / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = clamp(cx + Math.cos(a) * 1000, 26, W - 26);
  const ey = clamp(cy + Math.sin(a) * 1000, top + 16, bottom - 16);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = "#f3c35a";
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -12);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawMenu(ctx, c) {
  const m = c.menu;
  const rows = Math.min(m.items.length, 9);
  const first = clamp(m.sel - 4, 0, Math.max(0, m.items.length - rows));
  const w = 460;
  const h = 56 + rows * 30;
  const x = (W - w) / 2;
  const y = clamp(H / 2 - h / 2, TOP + 6, H - BOT - h - 6);
  ctx.fillStyle = "rgba(243, 230, 201, 0.97)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  fitText(ctx, m.title, x + 14, y + 18, 15, w - 28, INK);
  for (let i = 0; i < rows; i++) {
    const idx = first + i;
    const it = m.items[idx];
    const ry = y + 40 + i * 30;
    if (idx === m.sel) {
      ctx.fillStyle = "rgba(201, 164, 92, 0.45)";
      ctx.fillRect(x + 6, ry - 2, w - 12, 28);
    }
    const col = it.ok ? INK : "rgba(43, 29, 18, 0.45)";
    let lx = x + 14;
    if (it.seed) {
      icon(ctx, "seed", lx + 6, ry + 12, 14);
      lx += 18;
      drawSeedBars(ctx, it.seed, x + w - 126, ry + 6);
    }
    fitText(ctx, `${idx === m.sel ? "▶ " : ""}${it.label}`, lx, ry + 8, 12, it.seed ? 200 : w - 40, col);
    if (it.detail) fitText(ctx, it.detail, lx, ry + 20, 9, it.seed ? 200 : w - 40, it.ok ? "#6b5540" : "rgba(107, 85, 64, 0.5)");
  }
  text(ctx, "↑↓ choose · Space select · Shift close", x + w - 12, y + h - 9, 9, "#6b5540", "right");
}

// Four little bars for a seed's stats: walk, fight, heal, work
function drawSeedBars(ctx, seed, x, y) {
  const cols = ["#3a6ea5", "#b8302a", "#5f8a3c", "#c98a1a"];
  const names = ["Walk", "Fight", "Heal", "Work"];
  seed.forEach((v, i) => {
    const bx = x + i * 28;
    text(ctx, names[i], bx + 16, y - 3, 7, "#6b5540", "center");
    ctx.fillStyle = "rgba(43, 29, 18, 0.15)";
    ctx.fillRect(bx + 7, y + 2, 18, 16);
    ctx.fillStyle = cols[i];
    ctx.fillRect(bx + 7, y + 18 - (16 * v) / 10, 18, (16 * v) / 10);
    text(ctx, String(v), bx + 16, y + 10, 9, v >= 10 ? "#ffffff" : INK, "center");
  });
}

function drawRaidHud(ctx, c) {
  const raid = c.raid;
  const y = TOP + 8;
  ctx.fillStyle = SHADE;
  ctx.fillRect(8, y, 220, 18);
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(40, y + 4, 180, 10);
  ctx.fillStyle = raid.hp > 35 ? "#7fc25a" : "#e0603a";
  ctx.fillRect(40, y + 4, (180 * Math.max(0, raid.hp)) / K.raid.playerHP, 10);
  text(ctx, "YOU", 12, y + 9, 10, CREAM);
  const standing = raid.allies.filter((a) => !a.down).length;
  ctx.fillStyle = SHADE;
  ctx.fillRect(W - 230, y, 222, 18);
  text(ctx, `Soldiers ${standing}/${raid.allies.length} · Wave ${Math.max(1, raid.wave + 1)}/${K.raid.waves.length}`, W - 222, y + 9, 10, CREAM);
  if (raid.banner) pill(ctx, raid.banner.text, W / 2, TOP + 50, "#f3c35a");
  text(ctx, "Arrows: move · Shift: block · Click or Space: attack", W / 2, H - BOT - 10, 10, CREAM, "center");
}

function drawHud(ctx, c) {
  const t = c.trophies;
  // Top strip: the clock, then the three trophies and how close each is
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, 0, W, 26);
  text(ctx, formatClock(c.time), 10, 13, 14, "#f3c35a");
  const cells = [
    { icon: "trophy", done: t.resource, text: `Wood ${short(c.hall.log)}/${short(K.sculpture.log)} · Stone ${short(c.hall.stone)}/${short(K.sculpture.stone)}` },
    { icon: "tomato", done: t.farm, text: `Best seed ${seedKey(c.bestSeed)}` },
    { icon: "sword", done: t.raid, text: `Raid · ${c.readySoldiers().length} ready${c.wounded().length ? `, ${c.wounded().length} hurt` : ""}` },
  ];
  let x = 96;
  const widths = [250, 170, 190];
  cells.forEach((cell, i) => {
    ctx.fillStyle = cell.done ? "#5f8a3c" : "rgba(90, 60, 40, 0.8)";
    ctx.fillRect(x, 4, widths[i] - 4, 18);
    icon(ctx, cell.done ? "trophy" : cell.icon, x + 10, 13, 14);
    fitText(ctx, cell.done ? "TROPHY WON" : cell.text, x + 20, 13, 10, widths[i] - 28, CREAM);
    x += widths[i];
  });

  // NEXT bar
  const hint = c.nextStep();
  ctx.fillStyle = "rgba(243, 230, 201, 0.94)";
  ctx.fillRect(0, 26, W, 22);
  fitText(ctx, `NEXT: ${hint}`, 6, 37, 12, W - 110, INK);
  text(ctx, ZONES[c.player.zone].name.toUpperCase(), W - 8, 37, 11, "#6b5540", "right");

  // Bottom strip: your bag, the Hall, villagers
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, H - BOT, W, BOT);
  const y = H - BOT / 2;
  const pl = c.player;
  x = 8;
  text(ctx, "BAG", x, y, 9, DIM);
  x += 28;
  for (const [ic, n] of [["log", pl.bag.log], ["stone", pl.bag.stone], ["tomato", countOf(pl.bag.tomatoes)]]) {
    icon(ctx, ic, x + 6, y, 12);
    text(ctx, short(n), x + 14, y, 10, CREAM);
    x += 46;
  }
  x += 6;
  text(ctx, "HALL", x, y, 9, DIM);
  x += 32;
  for (const [ic, n] of [["log", c.hall.log], ["stone", c.hall.stone], ["tomato", c.tomatoes()], ["meal", c.meals()], ["seed", Object.values(c.seeds).reduce((a, b) => a + b, 0)]]) {
    icon(ctx, ic, x + 6, y, 12);
    text(ctx, short(n), x + 14, y, 10, CREAM);
    x += 50;
  }
  x += 6;
  text(ctx, "VILLAGERS", x, y, 9, DIM);
  x += 64;
  const idle = c.idle().length;
  personIcon(ctx, x + 6, y, 13, IDLE_SHIRT);
  text(ctx, `${c.villagers.length}${idle ? ` (${idle} idle)` : ""}`, x + 15, y, 10, idle ? "#f3c35a" : CREAM);
}

function short(n) {
  n = Math.floor(n);
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

