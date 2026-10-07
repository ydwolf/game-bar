// Life in the Colony — a pocket version of the colony sim in the Notion design docs.
//
// The Founder starts in an overgrown village and works toward the "soft win" (Ikur): a village
// that runs without them. Gather by minigame, build, hire visitors at the Tavern, and get every
// required profession working. "Do it yourself, or delegate it" is the whole game: anything a
// villager does, the Founder can do by hand until someone is hired for it.
//
// The Raider is the GDD's "prosperity attracts raids": the busier the colony, the faster the
// Raider earns notoriety to spend on bandit raids. Raids damage buildings and wound villagers —
// a setback, never a reset. Soldiers fight back, and the Founder fights *through* them: when a
// bandit winds up, "Shields up!" makes the soldiers block (the brainstorm's colony combat).
//
// Each level switches on more of the design: tools wear out (always), then hunger and cooking,
// then housing, then sickness, until the full eight-profession soft win is required.
import { clamp, lerp, rand, chance, pick, Clock, formatTime } from "../util.js";

const T = 36;
const W = 20 * T;
const H = 14 * T;
const HALL = { x: 9.5 * T, y: 7 * T };
const REACH = 34; // trees, rocks and plots
const BUILDING_REACH = 50; // the Hall, buildings and lots are bigger
const SOFT_WIN_HOLD = 5;
const HIRE_FEE = 3;
const TOOL_DURABILITY = 6;
const SLOT_STACK = 20;

const ORIGINS = {
  forager: { name: "Forager", color: "#6f9a4a", weight: 0.32 },
  mechanic: { name: "Mechanic", color: "#a0723c", weight: 0.38 },
  warrior: { name: "Warrior", color: "#b0432f", weight: 0.15 },
  magician: { name: "Magician", color: "#6a5aa8", weight: 0.15 },
};

// Villages filter jobs (brainstorm: "no blacksmith from the forestry village")
const JOBS = {
  lumberjack: { name: "Lumberjack", emoji: "🪓", origin: "forager", building: "woodhut", tool: "axe" },
  miner: { name: "Miner", emoji: "⛏️", origin: "mechanic", building: "minehut", tool: "pickaxe" },
  farmer: { name: "Farmer", emoji: "🌾", origin: "forager", building: "farm", tool: "hoe" },
  courier: { name: "Courier", emoji: "📦", origin: "mechanic", building: "post", tool: null },
  blacksmith: { name: "Blacksmith", emoji: "⚒️", origin: "mechanic", building: "smithy", tool: null },
  cook: { name: "Cook", emoji: "🍲", origin: "forager", building: "kitchen", tool: null },
  builder: { name: "Builder", emoji: "🔨", origin: "mechanic", building: "yard", tool: "hammer" },
  healer: { name: "Healer", emoji: "💊", origin: "magician", building: "healer", tool: null },
  soldier: { name: "Soldier", emoji: "🛡️", origin: "warrior", building: "barracks", tool: null },
};

const TOOL_ICON = { axe: "🪓", pickaxe: "⛏️", hoe: "🌱", hammer: "🔨" };
const ITEM_ICON = { log: "🪵", ore: "🪨", crop: "🌾" };

const BUILDINGS = {
  tavern: { name: "Tavern", emoji: "🍺", at: [8, 2.2], cost: { log: 4 } },
  minehut: { name: "Miner's Hut", emoji: "⛏️", at: [12, 2.2], cost: { log: 3 }, store: "ore" },
  kitchen: { name: "Kitchen", emoji: "🍲", at: [6.4, 4.6], cost: { log: 3, ore: 1 } },
  smithy: { name: "Smithy", emoji: "⚒️", at: [12.6, 4.6], cost: { log: 3, ore: 1 } },
  woodhut: { name: "Woodchopper Hut", emoji: "🪓", at: [5.6, 7], cost: { log: 3 }, store: "log" },
  barracks: { name: "Training Grounds", emoji: "🛡️", at: [13.4, 7], cost: { log: 4, ore: 1 } },
  healer: { name: "Healer's Hut", emoji: "💊", at: [6.4, 9.6], cost: { log: 3, crop: 1 } },
  farm: { name: "Farm", emoji: "🌻", at: [12.6, 9.6], cost: { log: 3 }, store: "crop" },
  post: { name: "Courier Post", emoji: "📦", at: [8, 12], cost: { log: 3 } },
  yard: { name: "Builder's Yard", emoji: "🔨", at: [11, 12], cost: { log: 3 } },
};
const HOME_SPOTS = [[8.6, 9.3], [9.6, 9.3], [10.6, 9.3], [8.6, 10.4], [9.6, 10.4], [10.6, 10.4], [9.1, 11.2], [10.1, 11.2]];

// Each level turns on more of the design and asks for more of the soft win
const LEVELS = [
  { roles: ["lumberjack", "courier", "miner", "blacksmith"], hunger: false, homes: false, sickness: false },
  { roles: ["lumberjack", "courier", "miner", "blacksmith", "farmer", "cook"], hunger: true, homes: false, sickness: false },
  { roles: ["lumberjack", "courier", "miner", "blacksmith", "farmer", "cook", "builder"], hunger: true, homes: true, sickness: false },
  { roles: ["lumberjack", "courier", "miner", "blacksmith", "farmer", "cook", "builder", "healer"], hunger: true, homes: true, sickness: true },
  { roles: ["lumberjack", "courier", "miner", "blacksmith", "farmer", "cook", "builder", "healer"], hunger: true, homes: true, sickness: true },
];
// Round length and how quickly the Raider earns notoriety (tuned with tests/fairness.js)
const ROUND_TIME = [110, 170, 180, 210, 210];
const NOTORIETY_RATE = [0.42, 0.28, 0.17, 0.2, 0.21];
const RAIDS = { small: { bandits: 2, cost: 5 }, big: { bandits: 5, cost: 12 } };

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tilePos = ([tx, ty]) => ({ x: tx * T, y: ty * T });

function scatter(n, x0, x1, y0, y1, minGap) {
  const pts = [];
  for (let tries = 0; pts.length < n && tries < 2000; tries++) {
    const p = { x: rand(x0, x1) * T, y: rand(y0, y1) * T };
    if (pts.every((q) => dist(p, q) >= minGap * T)) pts.push(p);
  }
  return pts;
}

function pickOrigin() {
  let roll = Math.random();
  for (const [key, o] of Object.entries(ORIGINS)) {
    roll -= o.weight;
    if (roll <= 0) return key;
  }
  return "mechanic";
}

function createRound({ level, inputs }) {
  const cfg = LEVELS[level - 1];
  const r = {
    level,
    cfg,
    time: ROUND_TIME[level - 1],
    stock: { log: 4, ore: 1, crop: 0, axe: 0, pickaxe: 0, hoe: 0, hammer: 0 },
    trees: scatter(18, 0.5, 3.6, 1.3, 12.6, 1.05).map((p) => ({ ...p, grown: true, regrow: 0, claimed: null })),
    rocks: scatter(8, 15.4, 19.5, 1.3, 3.9, 1.0).map((p) => ({ ...p, ore: 3, regrow: 0, claimed: null })),
    plots: [],
    buildings: {},
    homes: 2, // the Player Hall sleeps two
    villagers: [],
    visitors: [],
    visitT: 3,
    bandits: [],
    sparks: [],
    player: { x: HALL.x, y: HALL.y + 1.15 * T, slots: [null, null, null, null], toolLevel: 1, face: 1 },
    mg: null, // the Founder's current minigame
    shield: 0,
    shieldCd: 0,
    notoriety: 1,
    notoRate: NOTORIETY_RATE[level - 1],
    raidCd: 2,
    softWin: 0,
    msg: null,
    clock: 0,
    nextId: 1,
    winner: null,
    endReason: "",
  };
  for (let i = 0; i < 8; i++) r.plots.push({ x: (15.6 + (i % 4) * 1.15) * T, y: (10.4 + Math.floor(i / 4) * 1.4) * T, growth: rand(0.3, 0.9), claimed: null });
  for (const [key, b] of Object.entries(BUILDINGS)) {
    r.buildings[key] = { key, ...tilePos(b.at), vines: 1, built: false, damaged: false, stock: 0, meals: 0 };
  }
  r.cursors = [null, { x: W * 0.6, y: H / 2, speed: 460, x0: 0, x1: W, y0: 0, y1: H }];

  const end = (winner, reason) => {
    r.winner = winner;
    r.endReason = reason;
  };
  const say = (text) => (r.msg = { text, t: 2.2 });

  // ---------- helpers shared by the Founder, the villagers and the bots ----------

  const usable = (b) => b && b.built && !b.damaged;
  r.usable = usable;
  const villagersIn = (job) => r.villagers.filter((v) => v.job === job);
  const neededJobs = () => cfg.roles;
  const toolsInPlay = () => [...new Set(neededJobs().map((j) => JOBS[j].tool).filter(Boolean))];

  function isWorking(v) {
    if (v.wounded || v.sick) return false;
    const job = JOBS[v.job];
    if (!usable(r.buildings[job.building])) return false;
    if (cfg.hunger && v.hunger >= 100) return false;
    if (job.tool && !(v.tool && v.tool.dur > 0) && r.stock[job.tool] <= 0) return false;
    return true;
  }
  r.isWorking = isWorking;
  r.working = (job) => r.villagers.some((v) => v.job === job && isWorking(v));
  r.rolesFilled = () => neededJobs().filter((j) => r.working(j)).length;

  // Which tool the colony is shortest of: workers without one, minus spares at the Hall
  r.toolNeeded = () => {
    let best = null;
    let bestGap = 0;
    for (const tool of toolsInPlay()) {
      const job = Object.keys(JOBS).find((j) => JOBS[j].tool === tool);
      const lacking = villagersIn(job).filter((v) => !(v.tool && v.tool.dur > 0)).length;
      const gap = lacking + (r.buildings[JOBS[job].building].built ? 1 : 0) - r.stock[tool];
      if (gap > bestGap) {
        bestGap = gap;
        best = tool;
      }
    }
    return best;
  };

  r.openJob = () => {
    for (const job of neededJobs()) {
      if (r.buildings[JOBS[job].building].built && villagersIn(job).length === 0) return job;
    }
    if (r.buildings.barracks.built && villagersIn("soldier").length < 3) return "soldier";
    return null;
  };

  r.reputation = () => Object.values(r.buildings).filter((b) => b.built).length + r.villagers.length;

  // ---------- the Founder's bag (four slots, stacks of twenty) ----------

  const bagCount = (item) => r.player.slots.reduce((n, s) => n + (s && s.item === item ? s.n : 0), 0);
  r.bagCount = bagCount;
  r.bagTotal = () => r.player.slots.reduce((n, s) => n + (s ? s.n : 0), 0);
  function bagAdd(item, n = 1) {
    let left = n;
    for (const s of r.player.slots) if (s && s.item === item && s.n < SLOT_STACK && left) {
      const put = Math.min(left, SLOT_STACK - s.n);
      s.n += put;
      left -= put;
    }
    for (let i = 0; i < 4 && left; i++) if (!r.player.slots[i]) {
      const put = Math.min(left, SLOT_STACK);
      r.player.slots[i] = { item, n: put };
      left -= put;
    }
    return n - left;
  }
  r.bagHasRoom = (item) => r.player.slots.some((s) => !s || (s.item === item && s.n < SLOT_STACK));

  const canAfford = (cost) => Object.entries(cost).every(([k, n]) => r.stock[k] >= n);
  const pay = (cost) => Object.entries(cost).forEach(([k, n]) => (r.stock[k] -= n));
  r.canAfford = canAfford;

  // ---------- what the Founder is standing at ----------

  function interactables() {
    const list = [{ kind: "hall", obj: HALL, x: HALL.x, y: HALL.y, reach: BUILDING_REACH }];
    for (const t of r.trees) if (t.grown) list.push({ kind: "tree", obj: t, x: t.x, y: t.y });
    for (const k of r.rocks) if (k.ore > 0) list.push({ kind: "rock", obj: k, x: k.x, y: k.y });
    for (const p of r.plots) if (p.growth >= 1) list.push({ kind: "plot", obj: p, x: p.x, y: p.y });
    for (const b of Object.values(r.buildings)) list.push({ kind: b.built ? "building" : "lot", obj: b, x: b.x, y: b.y, reach: BUILDING_REACH });
    return list;
  }
  r.targetAt = (pos) => {
    let best = null;
    for (const it of interactables()) {
      // Compare by how far inside its reach you are, so a big building does not drown out a tree
      const d = Math.hypot(it.x - pos.x, it.y - pos.y) - (it.reach || REACH);
      if (d <= 0 && (!best || d < best.d)) best = { ...it, d };
    }
    return best;
  };

  function startMinigame(kind, target) {
    const speed = 1.3 + 0.12 * (level - 1);
    r.mg = { kind, target, phase: 0, dir: 1, speed, cool: 0, zoneC: rand(0.25, 0.75), zoneW: 0.2 + 0.06 * (r.player.toolLevel - 1) };
  }

  function act() {
    const it = r.targetAt(r.player);
    if (!it) return say("Nothing to do here");
    const { kind, obj } = it;
    if (kind === "tree" || kind === "rock" || kind === "plot") {
      const item = { tree: "log", rock: "ore", plot: "crop" }[kind];
      if (!r.bagHasRoom(item)) return say("Bag full — drop it at the Hall");
      return startMinigame(kind, obj);
    }
    if (kind === "hall") {
      let n = 0;
      r.player.slots.forEach((s, i) => {
        if (!s) return;
        r.stock[s.item] += s.n;
        n += s.n;
        r.player.slots[i] = null;
      });
      return say(n ? `Stored ${n} at the Hall` : "The Hall: your stockpile");
    }
    if (kind === "lot") {
      if (obj.vines > 0) return startMinigame("clear", obj);
      const cost = BUILDINGS[obj.key].cost;
      if (!canAfford(cost)) return say(`${BUILDINGS[obj.key].name} needs ${costText(cost)} at the Hall`);
      pay(cost);
      obj.built = true;
      return say(`Built the ${BUILDINGS[obj.key].name}`);
    }
    // A built building: repair first, then whatever that building does
    if (obj.damaged) {
      if (r.stock.log < 2) return say("Repairs need 2 🪵 at the Hall");
      r.stock.log -= 2;
      obj.damaged = false;
      return say("Repaired");
    }
    const def = BUILDINGS[obj.key];
    if (obj.key === "tavern") return hire();
    if (def.store && obj.stock > 0) {
      const took = bagAdd(def.store, obj.stock);
      obj.stock -= took;
      return say(took ? `Picked up ${took} ${ITEM_ICON[def.store]}` : "Bag full");
    }
    if (obj.key === "smithy") {
      if (r.working("blacksmith") && r.player.toolLevel < 3 && r.stock.ore >= 4) {
        r.stock.ore -= 4;
        r.player.toolLevel++;
        return say(`Your tools are now level ${r.player.toolLevel}`);
      }
      if (r.working("blacksmith")) return say("The blacksmith has the forge");
      if (!r.toolNeeded()) return say("Nobody needs a tool right now");
      if (r.stock.ore < 1 || r.stock.log < 1) return say("A tool needs 1 🪨 + 1 🪵 at the Hall");
      return startMinigame("forge", obj);
    }
    if (obj.key === "kitchen") {
      if (r.working("cook")) return say("The cook has the kitchen");
      if (r.stock.crop < 2) return say("Two meals need 2 🌾 at the Hall");
      return startMinigame("cook", obj);
    }
    say(def.name);
  }

  function hire() {
    const tavern = r.buildings.tavern;
    const job = r.openJob();
    if (!job) return say("No open jobs — build a workplace first");
    const want = JOBS[job].origin;
    const i = r.visitors.findIndex((v) => v.origin === want);
    if (i < 0) return say(`Need a ${ORIGINS[want].name} for the ${JOBS[job].name} job`);
    if (r.stock.log < HIRE_FEE) return say(`Hiring costs ${HIRE_FEE} 🪵 at the Hall`);
    r.stock.log -= HIRE_FEE;
    const visitor = r.visitors.splice(i, 1)[0];
    r.villagers.push({
      id: r.nextId++, origin: visitor.origin, job, x: tavern.x, y: tavern.y + 14,
      task: [], tool: null, carry: null, hunger: 0, wounded: false, sick: false, recover: 0, atk: 0, blocked: null,
    });
    say(`Hired a ${ORIGINS[visitor.origin].name} as ${JOBS[job].name}`);
  }

  function finishMinigame() {
    const { kind, target } = r.mg;
    r.mg = null;
    if (kind === "tree" && target.grown) {
      target.grown = false;
      target.regrow = 7;
      bagAdd("log", 2);
    } else if (kind === "rock" && target.ore > 0) {
      target.ore--;
      if (!target.ore) target.regrow = 9;
      bagAdd("ore", 2);
    } else if (kind === "plot" && target.growth >= 1) {
      target.growth = 0;
      bagAdd("crop", 2);
    } else if (kind === "clear" && target.vines > 0) {
      target.vines--;
      if (!target.vines) say(`Cleared the ${BUILDINGS[target.key].name} lot`);
    } else if (kind === "forge") {
      const tool = r.toolNeeded();
      if (tool && r.stock.ore >= 1 && r.stock.log >= 1) {
        r.stock.ore -= 1;
        r.stock.log -= 1;
        r.stock[tool]++;
        say(`Forged a ${tool} ${TOOL_ICON[tool]}`);
      }
    } else if (kind === "cook" && r.stock.crop >= 2) {
      r.stock.crop -= 2;
      target.meals += 2;
      say("Cooked a meal 🍲");
    }
  }

  // ---------- villagers: decide what to do next, then carry it out ----------
  // Layer 1 (deciding) is the ordered provider list in decide(); layer 2 (executing) is the
  // task queue of walk/wait steps, which any interruption can safely throw away.

  const walk = (p) => ({ type: "walk", x: p.x, y: p.y });
  const wait = (t, done) => ({ type: "wait", t, done });
  const idle = (v) => [walk({ x: HALL.x + rand(-40, 40), y: HALL.y + rand(30, 60) }), wait(1)];

  function release(v) {
    for (const list of [r.trees, r.rocks, r.plots]) for (const n of list) if (n.claimed === v) n.claimed = null;
    v.task = [];
    v.carry = null;
  }

  const nearestFree = (list, from, ok) => {
    let best = null;
    for (const n of list) if (!n.claimed && ok(n) && (!best || dist(n, from) < dist(best, from))) best = n;
    return best;
  };

  function gatherTask(v, job) {
    const hut = r.buildings[job.building];
    const kind = { lumberjack: "tree", miner: "rock", farmer: "plot" }[v.job];
    const list = { tree: r.trees, rock: r.rocks, plot: r.plots }[kind];
    const ready = { tree: (n) => n.grown, rock: (n) => n.ore > 0, plot: (n) => n.growth >= 1 }[kind];
    const node = nearestFree(list, v, ready);
    if (!node) return null;
    node.claimed = v;
    const item = BUILDINGS[job.building].store;
    return [
      walk(node),
      wait(1.4, () => {
        node.claimed = null;
        if (!ready(node)) return false;
        if (kind === "tree") { node.grown = false; node.regrow = 7; }
        if (kind === "rock") { node.ore--; if (!node.ore) node.regrow = 9; }
        if (kind === "plot") node.growth = 0;
        v.tool.dur--;
        v.carry = item;
      }),
      walk(hut),
      wait(0.2, () => { hut.stock = Math.min(40, hut.stock + 2); v.carry = null; }),
    ];
  }

  function fetchTool(v, tool) {
    if (r.stock[tool] <= 0) {
      v.blocked = `no ${tool}`;
      return null;
    }
    return [walk(HALL), wait(0.3, () => {
      if (r.stock[tool] <= 0) return false;
      r.stock[tool]--;
      v.tool = { type: tool, dur: TOOL_DURABILITY };
    })];
  }

  function takeFromHall(cost) {
    return wait(0.3, () => {
      if (!canAfford(cost)) return false;
      pay(cost);
    });
  }

  const PROVIDERS = {
    lumberjack: (v, job) => gatherTask(v, job),
    miner: (v, job) => gatherTask(v, job),
    farmer: (v, job) => gatherTask(v, job),
    courier(v) {
      let hut = null;
      for (const key of ["woodhut", "minehut", "farm"]) {
        const b = r.buildings[key];
        if (b.built && b.stock > 0 && (!hut || b.stock > hut.stock)) hut = b;
      }
      if (!hut) return null;
      const item = BUILDINGS[hut.key].store;
      let load = 0;
      return [
        walk(hut),
        wait(0.3, () => { load = Math.min(8, hut.stock); hut.stock -= load; v.carry = load ? item : null; }),
        walk(HALL),
        wait(0.3, () => { r.stock[item] += load; v.carry = null; }),
      ];
    },
    blacksmith(v) {
      const tool = r.toolNeeded();
      if (!tool || r.stock.ore < 1 || r.stock.log < 1) return null;
      return [walk(HALL), takeFromHall({ ore: 1, log: 1 }), walk(r.buildings.smithy), wait(1.6, () => { r.stock[tool]++; })];
    },
    cook(v) {
      const kitchen = r.buildings.kitchen;
      if (kitchen.meals >= 6 || r.stock.crop < 2) return null;
      return [walk(HALL), takeFromHall({ crop: 2 }), walk(kitchen), wait(1.6, () => { kitchen.meals += 2; })];
    },
    builder(v) {
      const broken = Object.values(r.buildings).find((b) => b.built && b.damaged);
      if (broken && r.stock.log >= 2) {
        return [walk(HALL), takeFromHall({ log: 2 }), walk(broken), wait(2.5, () => { broken.damaged = false; v.tool.dur--; })];
      }
      if (cfg.homes && r.homes < r.villagers.length && r.homes - 2 < HOME_SPOTS.length && r.stock.log >= 2) {
        const spot = tilePos(HOME_SPOTS[r.homes - 2]);
        return [walk(HALL), takeFromHall({ log: 2 }), walk(spot), wait(2, () => { r.homes++; v.tool.dur--; })];
      }
      return null;
    },
    healer: () => [walk(r.buildings.healer), wait(1)],
  };

  function decide(v) {
    v.blocked = null;
    const job = JOBS[v.job];
    if (cfg.hunger && v.hunger >= 60 && usable(r.buildings.kitchen) && r.buildings.kitchen.meals > 0) {
      const kitchen = r.buildings.kitchen;
      return [walk(kitchen), wait(0.8, () => {
        if (kitchen.meals <= 0) return false;
        kitchen.meals--;
        v.hunger = 0;
      })];
    }
    if (!usable(r.buildings[job.building])) {
      v.blocked = "workplace down";
      return idle(v);
    }
    if (job.tool && !(v.tool && v.tool.dur > 0)) return fetchTool(v, job.tool) || idle(v);
    return PROVIDERS[v.job](v, job) || idle(v);
  }

  function speedOf(v) {
    let s = 82;
    if (cfg.hunger && v.hunger >= 100) s *= 0.5;
    if (cfg.homes && r.villagers.indexOf(v) >= r.homes) s *= 0.75; // homeless
    if (v.wounded || v.sick) s *= 0.6;
    return s;
  }

  function moveToward(o, target, speed, dt) {
    const d = dist(o, target);
    const step = speed * dt;
    if (d <= step) {
      o.x = target.x;
      o.y = target.y;
      return true;
    }
    o.x += ((target.x - o.x) / d) * step;
    o.y += ((target.y - o.y) / d) * step;
    return false;
  }

  function runVillager(v, dt) {
    if (cfg.hunger) v.hunger = Math.min(100, v.hunger + 0.8 * dt);
    if (cfg.sickness && !v.sick && !v.wounded && v.job !== "healer" && chance(0.004 * dt)) {
      v.sick = true;
      v.recover = 22;
      release(v);
    }

    if (v.wounded || v.sick) {
      const hut = r.buildings.healer;
      if (r.working("healer") && usable(hut)) {
        if (moveToward(v, hut, speedOf(v), dt)) {
          v.recover -= dt * 8; // a healer cuts recovery from ~20 days to ~1
        }
      } else {
        v.recover -= dt;
      }
      if (v.recover <= 0) {
        v.wounded = false;
        v.sick = false;
      }
      return;
    }

    if (v.job === "soldier") return runSoldier(v, dt);

    if (!v.task.length) v.task = decide(v);
    const s = v.task[0];
    if (!s) return;
    if (s.type === "walk") {
      if (moveToward(v, s, speedOf(v), dt)) v.task.shift();
    } else {
      s.t -= dt;
      if (s.t <= 0) {
        const ok = s.done ? s.done() : true;
        v.task.shift();
        if (ok === false) release(v);
      }
    }
  }

  function runSoldier(v, dt) {
    let target = null;
    for (const b of r.bandits) if (!target || dist(b, v) < dist(target, v)) target = b;
    if (target) {
      if (dist(target, v) > 18) moveToward(v, target, 72, dt);
    } else {
      const post = r.buildings.barracks;
      if (!v.task.length) v.task = [walk({ x: post.x + rand(-30, 30), y: post.y + rand(16, 34) }), wait(1.5)];
      const s = v.task[0];
      if (s.type === "walk") { if (moveToward(v, s, 50, dt)) v.task.shift(); }
      else if ((s.t -= dt) <= 0) v.task.shift();
    }
  }

  function wound(v) {
    if (v.wounded) return;
    v.wounded = true;
    v.recover = 18;
    release(v);
  }

  // ---------- raids ----------

  r.raidTargetAt = (pos) => {
    let best = null;
    for (const b of Object.values(r.buildings)) {
      if (b.built && dist(b, pos) < 70 && (!best || dist(b, pos) < dist(best, pos))) best = b;
    }
    if (!best && dist(HALL, pos) < 70) best = { key: "hall", ...HALL };
    return best;
  };

  function raid(size) {
    const spec = RAIDS[size];
    if (r.raidCd > 0 || r.notoriety < spec.cost) return;
    const target = r.raidTargetAt(r.cursors[1]);
    if (!target) return;
    r.notoriety -= spec.cost;
    r.raidCd = 6;
    const y = rand(6, 8) * T;
    for (let i = 0; i < spec.bandits; i++) {
      r.bandits.push({ x: W + 14 + i * 20, y: y + rand(-16, 16), target: target.key, tx: target.x, ty: target.y, hp: 3, cd: rand(0.5, 1.2), windup: 0, engaged: false });
    }
  }

  function impact(b) {
    if (b.target === "hall") {
      for (const item of ["log", "ore", "crop"]) r.stock[item] -= Math.floor(r.stock[item] * 0.35);
    } else {
      r.buildings[b.target].damaged = true;
    }
    for (const v of r.villagers) if (v.job !== "soldier" && Math.hypot(v.x - b.tx, v.y - b.ty) < 55) wound(v);
    r.sparks.push({ x: b.tx, y: b.ty, t: 0.8, text: "🔥" });
  }

  function runBandits(dt) {
    const soldiers = r.villagers.filter((v) => v.job === "soldier" && !v.wounded);
    for (const b of r.bandits) {
      const foe = soldiers.find((s) => dist(s, b) < 24);
      b.engaged = !!foe;
      if (foe) {
        // The soldier swings on their own; the bandit telegraphs before every strike
        foe.atk -= dt;
        if (foe.atk <= 0) {
          foe.atk = 0.8;
          b.hp--;
        }
        if (b.windup > 0) {
          b.windup -= dt;
          if (b.windup <= 0) {
            if (r.shield > 0) r.sparks.push({ x: foe.x, y: foe.y - 14, t: 0.6, text: "🛡️" });
            else wound(foe);
            b.cd = rand(1.1, 1.7);
          }
        } else if ((b.cd -= dt) <= 0) {
          b.windup = 0.75;
        }
      } else {
        b.windup = 0;
        if (moveToward(b, { x: b.tx, y: b.ty }, 46, dt)) {
          impact(b);
          b.hp = 0;
        }
      }
    }
    r.bandits = r.bandits.filter((b) => b.hp > 0);
  }

  // ---------- the frame ----------

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    r.clock += dt;
    const fin = inputs[0];
    const rin = inputs[1];

    // World regrowth
    for (const t of r.trees) if (!t.grown && (t.regrow -= dt) <= 0) t.grown = true;
    for (const k of r.rocks) if (!k.ore && (k.regrow -= dt) <= 0) k.ore = 3;
    for (const p of r.plots) p.growth = Math.min(1, p.growth + dt / (usable(r.buildings.farm) ? 10 : 16));

    // Visitors drift into the Tavern, more often as the colony's reputation grows; unhired ones leave
    if (usable(r.buildings.tavern)) {
      r.visitT -= dt;
      if (r.visitT <= 0 && r.visitors.length < 3) {
        // Your workforce shapes who comes: half the visitors are from the village your open job needs
        const open = r.openJob();
        const origin = open && chance(0.5) ? JOBS[open].origin : pickOrigin();
        r.visitors.push({ origin, stay: 22 });
        r.visitT = Math.max(1.5, 3.5 - r.reputation() * 0.12);
      }
    }
    for (const v of r.visitors) v.stay -= dt;
    r.visitors = r.visitors.filter((v) => v.stay > 0);

    // The Founder: walk, work the minigame, raise shields
    const p = r.player;
    const mx = (fin.held.right ? 1 : 0) - (fin.held.left ? 1 : 0);
    const my = (fin.held.down ? 1 : 0) - (fin.held.up ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.x = clamp(p.x + (mx / len) * 190 * dt, 10, W - 10);
      p.y = clamp(p.y + (my / len) * 190 * dt, 30, H - 30);
      if (mx) p.face = mx;
    }
    if (r.mg) {
      const mg = r.mg;
      if (dist(p, mg.target) > BUILDING_REACH + 6) r.mg = null;
      else if (mg.cool > 0) mg.cool -= dt;
      else {
        mg.phase += mg.dir * mg.speed * dt;
        if (mg.phase > 1) { mg.phase = 1; mg.dir = -1; }
        if (mg.phase < 0) { mg.phase = 0; mg.dir = 1; }
        if (fin.pressed.action) {
          if (Math.abs(mg.phase - mg.zoneC) <= mg.zoneW / 2) finishMinigame();
          else {
            mg.cool = 0.45;
            mg.zoneC = rand(0.25, 0.75);
          }
        }
      }
    } else if (fin.pressed.action) {
      act();
    }
    r.shieldCd = Math.max(0, r.shieldCd - dt);
    r.shield = Math.max(0, r.shield - dt);
    if (fin.pressed.action2 && r.shieldCd === 0) {
      r.shield = 0.45;
      r.shieldCd = 1;
    }

    // The Raider: notoriety comes from the colony's own success
    r.notoriety = Math.min(20, r.notoriety + (r.notoRate + 0.012 * r.reputation()) * dt);
    r.raidCd = Math.max(0, r.raidCd - dt);
    if (rin.pressed.action) raid("small");
    if (rin.pressed.action2) raid("big");

    for (const v of r.villagers) runVillager(v, dt);
    runBandits(dt);
    for (const s of r.sparks) s.t -= dt;
    r.sparks = r.sparks.filter((s) => s.t > 0);
    if (r.msg && (r.msg.t -= dt) <= 0) r.msg = null;

    // The soft win: every required profession working, held long enough to know it runs itself
    if (r.rolesFilled() === neededJobs().length) {
      r.softWin += dt;
      if (r.softWin >= SOFT_WIN_HOLD) end(0, "The village runs without you — that's the soft win!");
    } else {
      r.softWin = 0;
    }

    r.time -= dt;
    if (r.winner === null && r.time <= 0) end(1, "The raids kept the colony from standing on its own.");
    return r.winner;
  };

  r.status = () =>
    `${formatTime(r.time)} · Soft win ${r.rolesFilled()}/${neededJobs().length} · Villagers ${r.villagers.length} · Notoriety ${Math.floor(r.notoriety)}`;
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

function costText(cost) {
  return Object.entries(cost).map(([k, n]) => `${n} ${ITEM_ICON[k]}`).join(" + ");
}

// ---------- Bots ----------

// The Founder bot walks an ordered list of goals — the same "first provider with an answer
// wins" shape the Dev Documentation chose for villagers — and plays the minigame by watching
// the marker, a little late, like a person.
function founderBot(r, input, skill) {
  const clock = new Clock(lerp(0.5, 0.15, skill));
  const lag = lerp(0.1, 0.03, skill);
  const tolerance = lerp(0.55, 0.8, skill);
  const BUILD_ORDER = ["tavern", "woodhut", "post", "minehut", "smithy", "farm", "kitchen", "yard", "healer", "barracks"];
  let goal = null;
  let pressCd = 0;
  let lastWindup = new Set();

  const needed = (key) => {
    if (key === "tavern") return true;
    if (key === "barracks") return r.level >= 2;
    return r.cfg.roles.some((j) => JOBS[j].building === key);
  };
  const go = (obj) => ({ x: obj.x, y: obj.y });

  function gather(item) {
    const p = r.player;
    const pool = item === "log" ? r.trees.filter((t) => t.grown) : item === "ore" ? r.rocks.filter((k) => k.ore > 0) : r.plots.filter((q) => q.growth >= 1);
    let best = null;
    for (const n of pool) if (!best || dist(n, p) < dist(best, p)) best = n;
    return best ? go(best) : null;
  }

  function plan() {
    const p = r.player;
    const carried = r.bagTotal();
    const have = (item) => r.stock[item] + r.bagCount(item);
    const toHall = go(HALL);
    if (carried >= 16 || r.player.slots.every((s) => s && s.n >= SLOT_STACK)) return toHall;

    const damaged = Object.values(r.buildings).find((b) => b.built && b.damaged);
    if (damaged && !r.working("builder")) {
      if (r.stock.log >= 2) return go(damaged);
      if (have("log") >= 2) return toHall;
    }

    const job = r.openJob();
    if (job && r.usable(r.buildings.tavern) && r.visitors.some((v) => v.origin === JOBS[job].origin)) {
      if (r.stock.log >= HIRE_FEE) return go(r.buildings.tavern);
      if (have("log") >= HIRE_FEE) return toHall;
    }

    if (r.toolNeeded() && !r.working("blacksmith") && r.buildings.smithy.built && !r.buildings.smithy.damaged) {
      if (r.stock.ore >= 1 && r.stock.log >= 1) return go(r.buildings.smithy);
    }
    if (r.cfg.hunger && !r.working("cook") && r.usable(r.buildings.kitchen) && r.buildings.kitchen.meals < 2 && r.stock.crop >= 2) {
      return go(r.buildings.kitchen);
    }

    const next = BUILD_ORDER.find((k) => needed(k) && !r.buildings[k].built);
    if (next) {
      const lot = r.buildings[next];
      const cost = BUILDINGS[next].cost;
      if (lot.vines > 0) return go(lot);
      if (r.canAfford(cost)) return go(lot);
      const missing = Object.keys(cost).find((k) => have(k) < cost[k]);
      if (!missing && carried) return toHall;
      if (missing) return gather(missing) || toHall;
    }

    if (!r.working("courier")) {
      const hut = ["woodhut", "minehut", "farm"].map((k) => r.buildings[k]).find((b) => b.built && b.stock >= 4);
      if (hut && carried < 10) return go(hut);
    }
    if (carried >= 6) return toHall;

    // Keep the stockpile topped up for hiring, tools and food
    const wants = [["log", 14], ["ore", r.buildings.smithy.built ? 6 : 2], ["crop", r.cfg.hunger ? 6 : 0]];
    wants.sort((a, b) => have(a[0]) / Math.max(1, a[1]) - have(b[0]) / Math.max(1, b[1]));
    for (const [item, target] of wants) if (target && have(item) < target) return gather(item) || toHall;
    return carried ? toHall : { x: HALL.x + 30, y: HALL.y + 40 };
  }

  return {
    update(dt) {
      if (r.winner !== null) return;
      pressCd -= dt;

      // Shields up when a bandit fighting a soldier winds up
      for (const b of r.bandits) {
        if (b.windup > 0 && b.windup < 0.5 && !lastWindup.has(b) && chance(0.35 + 0.6 * skill)) {
          input.press("action2");
          lastWindup.add(b);
        }
        if (b.windup <= 0) lastWindup.delete(b);
      }

      const mg = r.mg;
      if (mg) {
        input.held.left = input.held.right = input.held.up = input.held.down = false;
        if (mg.cool <= 0 && pressCd <= 0) {
          const seen = mg.phase - mg.dir * mg.speed * lag; // reacts to where the marker *was*
          if (Math.abs(seen - mg.zoneC) <= (mg.zoneW / 2) * tolerance) {
            input.press("action");
            pressCd = 0.15;
          }
        }
        return;
      }

      if (clock.tick(dt) || !goal) goal = plan();
      const p = r.player;
      const dx = goal.x - p.x;
      const dy = goal.y - p.y;
      const close = Math.hypot(dx, dy) < 12;
      input.held.right = dx > 4 && !close;
      input.held.left = dx < -4 && !close;
      input.held.down = dy > 4 && !close;
      input.held.up = dy < -4 && !close;
      if (close && pressCd <= 0) {
        input.press("action");
        pressCd = lerp(0.6, 0.25, skill);
        goal = null;
      }
    },
  };
}

// The Raider bot saves up notoriety and spends it on whatever would set the colony back
// most right now — a working building the soft win depends on, away from the soldiers.
function raiderBot(r, input, skill) {
  const clock = new Clock(lerp(1.6, 0.6, skill));
  let bigAt = null; // where a big raid is headed once the crosshair glides there
  return {
    update(dt) {
      if (r.winner !== null) return;
      if (bigAt) {
        const c = r.cursors[1];
        if (Math.hypot(c.x - bigAt.x, c.y - bigAt.y) < 3) {
          input.press("action2");
          bigAt = null;
        }
        return;
      }
      if (!clock.tick(dt) || input.pendingFire || r.raidCd > 0) return;
      const big = r.notoriety >= RAIDS.big.cost && chance(0.3 + 0.5 * skill);
      if (!big && r.notoriety < RAIDS.small.cost + 3 * skill) return; // a sharper raider saves up a little
      const soldiers = r.villagers.filter((v) => v.job === "soldier" && !v.wounded);
      let best = null;
      const consider = (target, value) => {
        const guarded = soldiers.filter((s) => dist(s, target) < 140).length;
        const score = value * skill - guarded * 1.5 * skill + rand(0, 3 * (1 - skill) + 0.5);
        if (!best || score > best.score) best = { score, x: target.x, y: target.y };
      };
      for (const b of Object.values(r.buildings)) {
        if (!b.built || b.damaged) continue;
        const job = Object.keys(JOBS).find((j) => JOBS[j].building === b.key);
        const value = job && r.cfg.roles.includes(job) ? (r.working(job) ? 4 : 2) : b.key === "tavern" ? 2 : 1;
        consider(b, value);
      }
      consider(HALL, (r.stock.log + r.stock.ore + r.stock.crop) / 10);
      if (!best) return;
      const noise = (1 - skill) * 30;
      input.target = { x: best.x + rand(-noise, noise), y: best.y + rand(-noise, noise) };
      if (big) {
        bigAt = { x: clamp(input.target.x, 0, W), y: clamp(input.target.y, 0, H) };
      } else {
        input.pendingFire = true;
      }
    },
  };
}

// ---------- Drawing ----------

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

function emoji(ctx, ch, x, y, size) {
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, x, y);
}

function text(ctx, str, x, y, size, color, align = "left") {
  ctx.font = `${size}px "Special Elite", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
}

function draw(ctx, r) {
  // Zones: forest, mine, fields, the road the raiders use, and the village between
  ctx.fillStyle = "#7f9a52";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#56743a";
  ctx.fillRect(0, 0, 4.2 * T, H);
  ctx.fillStyle = "#8a8070";
  ctx.fillRect(15 * T, 0, 5 * T, 4.6 * T);
  ctx.fillStyle = "#9c7a4c";
  ctx.fillRect(15 * T, 9.4 * T, 5 * T, 4.6 * T);
  ctx.fillStyle = "#c2a36b";
  ctx.fillRect(14.6 * T, 5.6 * T, 5.4 * T, 2.8 * T);
  text(ctx, "FOREST", 0.3 * T, 0.95 * T, 11, "rgba(255,255,255,0.6)");
  text(ctx, "MINE", 15.3 * T, 0.95 * T, 11, "rgba(255,255,255,0.6)");
  text(ctx, "FIELDS", 15.3 * T, 9.85 * T, 11, "rgba(255,255,255,0.6)");
  text(ctx, "ROAD ▸", 18.2 * T, 5.95 * T, 11, "rgba(60,30,10,0.6)");

  for (let i = 0; i < r.homes - 2; i++) {
    const s = tilePos(HOME_SPOTS[i]);
    emoji(ctx, "🏠", s.x, s.y, 20);
  }

  // The Player Hall: stockpile and home
  ctx.fillStyle = "rgba(60, 35, 15, 0.35)";
  ctx.fillRect(HALL.x - 30, HALL.y - 26, 60, 52);
  emoji(ctx, "🏛️", HALL.x, HALL.y - 2, 38);
  text(ctx, "HALL", HALL.x, HALL.y + 22, 10, "#f3e6c9", "center");

  for (const b of Object.values(r.buildings)) {
    const def = BUILDINGS[b.key];
    if (!b.built) {
      ctx.strokeStyle = "rgba(243, 230, 201, 0.45)";
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(b.x - 24, b.y - 20, 48, 40);
      ctx.setLineDash([]);
      if (b.vines > 0) {
        ctx.globalAlpha = 0.35;
        emoji(ctx, def.emoji, b.x, b.y - 4, 16);
        ctx.globalAlpha = 1;
        emoji(ctx, "🌿", b.x - 8, b.y - 2, 20);
        emoji(ctx, "🌿", b.x + 9, b.y + 3, 18);
      } else {
        emoji(ctx, def.emoji, b.x, b.y - 4, 16);
        ctx.globalAlpha = 1;
        text(ctx, costText(def.cost), b.x, b.y + 12, 9, "#2b1d12", "center");
      }
      continue;
    }
    ctx.fillStyle = "#c79a62";
    ctx.fillRect(b.x - 22, b.y - 18, 44, 36);
    ctx.fillStyle = "#8a5a33";
    ctx.fillRect(b.x - 24, b.y - 22, 48, 7);
    emoji(ctx, def.emoji, b.x, b.y + 2, 22);
    if (def.store && b.stock > 0) text(ctx, `${b.stock}`, b.x + 18, b.y + 14, 10, "#2b1d12", "center");
    if (b.key === "kitchen" && b.meals > 0) text(ctx, `🍲${b.meals}`, b.x + 14, b.y + 14, 10, "#2b1d12", "center");
    if (b.key === "tavern") r.visitors.forEach((v, i) => {
      ctx.fillStyle = ORIGINS[v.origin].color;
      ctx.beginPath();
      ctx.arc(b.x - 16 + i * 16, b.y + 26, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    if (b.damaged) emoji(ctx, "🔥", b.x + 12, b.y - 14, 18);
  }

  for (const t of r.trees) {
    if (t.grown) emoji(ctx, "🌲", t.x, t.y, 28);
    else {
      ctx.fillStyle = "#6b4a2a";
      ctx.beginPath();
      ctx.arc(t.x, t.y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const k of r.rocks) {
    if (k.ore > 0) emoji(ctx, "🪨", k.x, k.y, 14 + k.ore * 4);
    else {
      ctx.fillStyle = "#6c6458";
      ctx.fillRect(k.x - 5, k.y, 10, 4);
    }
  }
  for (const q of r.plots) {
    ctx.fillStyle = "#6e4f2c";
    ctx.fillRect(q.x - 15, q.y - 12, 30, 24);
    emoji(ctx, q.growth >= 1 ? "🌾" : "🌱", q.x, q.y, 10 + q.growth * 12);
  }

  for (const v of r.villagers) {
    ctx.fillStyle = ORIGINS[v.origin].color;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2b1d12";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (v.job === "soldier" && r.shield > 0) {
      ctx.strokeStyle = "#7fb6e6";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
    emoji(ctx, JOBS[v.job].emoji, v.x, v.y, 11);
    const tag = v.wounded ? "🤕" : v.sick ? "🤢" : v.blocked ? "❗" : r.cfg.hunger && v.hunger >= 60 ? "🍗" : v.carry ? ITEM_ICON[v.carry] : null;
    if (tag) emoji(ctx, tag, v.x + 10, v.y - 11, 11);
  }

  for (const b of r.bandits) {
    emoji(ctx, "🦹", b.x, b.y, 22);
    if (b.windup > 0) {
      ctx.strokeStyle = "#ff5a3a";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 15, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const s of r.sparks) emoji(ctx, s.text, s.x, s.y - (0.8 - s.t) * 20, 20);

  // The Founder
  const p = r.player;
  ctx.fillStyle = "rgba(201, 164, 92, 0.5)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 12, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  emoji(ctx, "🧑‍🌾", p.x, p.y, 26);

  // The minigame bar: stop the marker inside the green
  if (r.mg) {
    const mg = r.mg;
    const bx = clamp(p.x - 50, 4, W - 104);
    const by = p.y - 40;
    ctx.fillStyle = "rgba(28, 17, 10, 0.85)";
    ctx.fillRect(bx - 2, by - 2, 104, 14);
    ctx.fillStyle = mg.cool > 0 ? "#b8442e" : "#d4bd8f";
    ctx.fillRect(bx, by, 100, 10);
    ctx.fillStyle = "#6f9a4a";
    ctx.fillRect(bx + (mg.zoneC - mg.zoneW / 2) * 100, by, mg.zoneW * 100, 10);
    ctx.fillStyle = "#1f130b";
    ctx.fillRect(bx + mg.phase * 100 - 2, by - 3, 4, 16);
  }
  if (r.msg) {
    const w = Math.min(W - 20, r.msg.text.length * 7 + 16);
    const mx = clamp(p.x, w / 2 + 4, W - w / 2 - 4);
    ctx.fillStyle = "rgba(243, 230, 201, 0.92)";
    ctx.fillRect(mx - w / 2, p.y + 22, w, 18);
    text(ctx, r.msg.text, mx, p.y + 31, 11, "#2b1d12", "center");
  }

  // Top strip: the Hall's stockpile, tools, your bag, and the Raider's notoriety
  ctx.fillStyle = "rgba(28, 17, 10, 0.78)";
  ctx.fillRect(0, 0, W, 24);
  let x = 8;
  for (const item of ["log", "ore", "crop"]) {
    emoji(ctx, ITEM_ICON[item], x + 7, 12, 13);
    text(ctx, String(r.stock[item]), x + 17, 12, 12, "#f3e6c9");
    x += 46;
  }
  x += 6;
  for (const tool of Object.keys(TOOL_ICON)) {
    emoji(ctx, TOOL_ICON[tool], x + 7, 12, 12);
    text(ctx, String(r.stock[tool]), x + 16, 12, 11, "#d4bd8f");
    x += 36;
  }
  x += 8;
  text(ctx, "BAG", x, 12, 10, "#d4bd8f");
  x += 30;
  r.player.slots.forEach((s, i) => {
    ctx.strokeStyle = "#d4bd8f";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + i * 34, 3, 30, 18);
    if (s) {
      emoji(ctx, ITEM_ICON[s.item], x + i * 34 + 9, 12, 11);
      text(ctx, String(s.n), x + i * 34 + 17, 12, 10, "#f3e6c9");
    }
  });
  const nx = W - 128;
  text(ctx, "NOTORIETY", nx - 4, 12, 10, "#f08a6e", "right");
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(nx, 6, 120, 12);
  ctx.fillStyle = "#d0692f";
  ctx.fillRect(nx, 6, (120 * r.notoriety) / 20, 12);
  ctx.fillStyle = "#f3e6c9";
  for (const spec of Object.values(RAIDS)) ctx.fillRect(nx + (120 * spec.cost) / 20, 4, 2, 16);

  // Bottom strip: the soft-win checklist
  ctx.fillStyle = "rgba(28, 17, 10, 0.78)";
  ctx.fillRect(0, H - 26, W, 26);
  text(ctx, "SOFT WIN", 8, H - 13, 10, "#d4bd8f");
  r.cfg.roles.forEach((job, i) => {
    const ok = r.working(job);
    const cx = 92 + i * 40;
    ctx.fillStyle = ok ? "#6f9a4a" : "rgba(184, 68, 46, 0.7)";
    ctx.fillRect(cx - 16, H - 23, 32, 20);
    emoji(ctx, JOBS[job].emoji, cx, H - 13, 13);
  });
  const fx = 92 + r.cfg.roles.length * 40 + 6;
  ctx.fillStyle = "#3a2418";
  ctx.fillRect(fx, H - 19, 90, 12);
  ctx.fillStyle = "#c9a45c";
  ctx.fillRect(fx, H - 19, (90 * r.softWin) / SOFT_WIN_HOLD, 12);
  const extras = [r.cfg.hunger && "🍲 hunger", r.cfg.homes && "🏠 housing", r.cfg.sickness && "🤢 sickness"].filter(Boolean).join("  ");
  if (extras) text(ctx, extras, W - 8, H - 13, 10, "#d4bd8f", "right");
}

export default {
  id: "colony",
  title: "Life in the Colony",
  kicker: "Gather + build",
  accent: "var(--brass)",
  blurb: "Build a village that runs without you — while raiders take notice.",
  width: W,
  height: H,
  sides: [
    {
      name: "Founder",
      emoji: "🧑‍🌾",
      goal: "Reach the soft win: every profession on the checklist working on its own. Gather (stop the marker in the green), build, hire at the Tavern, forge tools and cook until villagers take over.",
      controls: { dirs: "walk", action: "work / build / hire — whatever you're standing at", action2: "shields up (your soldiers block)" },
      pointer: null,
      pad: { dirs: "four", action: "Act", action2: "Shield" },
      bot: founderBot,
    },
    {
      name: "Raider",
      emoji: "🦹",
      goal: "Keep the colony from standing on its own until time runs out. Prosperity earns you notoriety — spend it on raids that wreck buildings and wound villagers.",
      controls: { dirs: "move the crosshair", action: `small raid (${RAIDS.small.cost} notoriety)`, action2: `big raid (${RAIDS.big.cost} notoriety)` },
      pointer: "aim",
      pointerHint: "Click a building to raid it · right-click for a big raid",
      pad: { dirs: "four", action: "Raid", action2: "Big raid" },
      bot: raiderBot,
    },
  ],
  createRound,
};
