// Life in the Colony — a pocket version of the colony sim in the Notion design docs, played as
// a race between two rival colonies.
//
// Each side founds a village on an identical patch of land. Gather by minigame, build, hire
// visitors at the Tavern, give workers tools, and let the village grow until it out-produces
// you. "Do it yourself, or delegate it" is the whole game: anything a villager does, the
// Founder can do by hand until someone is hired for it. The first colony to stockpile 1000 of
// every resource wins — so every log spent on a building is a log you have to earn back.
//
// Each level switches on more of the design: tools wear out (always), then the courier and
// blacksmith, then crops, hunger and cooking, then housing, then sickness.
import { clamp, lerp, rand, chance, Clock } from "../util.js";

const T = 36;
const W = 20 * T;
const H = 14 * T;
const HALL = { x: 9.5 * T, y: 7 * T };
const REACH = 34; // trees, rocks and plots
const BUILDING_REACH = 50; // the Hall, buildings and lots are bigger
const GOAL = 1000; // of every resource in play
const YIELD = 20; // per minigame success
const WORKER_YIELD = 40; // per villager trip — a hired hand out-gathers you, which is the point
const HIRE_FEE = 30;
const TOOL_COST = { ore: 10, log: 10 };
const MEAL_COST = { crop: 20 }; // makes 2 meals
const UPGRADE_COST = 40; // ore, to sharpen the Founder's own tools
const HOME_COST = 20;
const TOOL_DURABILITY = 6;
const SLOT_STACK = 200;
const MAX_GATHERERS = 3; // of each gathering job
const TIME_LIMIT = 600; // game seconds; if nobody reaches the goal, the closer colony wins

const ORIGINS = {
  forager: { name: "Forager", color: "#6f9a4a", weight: 0.4 },
  mechanic: { name: "Mechanic", color: "#a0723c", weight: 0.42 },
  magician: { name: "Magician", color: "#6a5aa8", weight: 0.18 },
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
};
const GATHERERS = ["lumberjack", "miner", "farmer"];

const TOOL_ICON = { axe: "🪓", pickaxe: "⛏️", hoe: "🌱", hammer: "🔨" };
const ITEM_ICON = { log: "🪵", ore: "🪨", crop: "🌾" };
const ITEM_NAME = { log: "wood", ore: "stone", crop: "crops" };

const BUILDINGS = {
  tavern: { name: "Tavern", emoji: "🍺", at: [8, 2.2], cost: { log: 40 } },
  minehut: { name: "Miner's Hut", emoji: "⛏️", at: [12, 2.2], cost: { log: 30 }, store: "ore" },
  kitchen: { name: "Kitchen", emoji: "🍲", at: [6.4, 4.6], cost: { log: 30, ore: 10 } },
  smithy: { name: "Smithy", emoji: "⚒️", at: [12.6, 4.6], cost: { log: 30, ore: 10 } },
  woodhut: { name: "Woodchopper Hut", emoji: "🪓", at: [5.6, 7], cost: { log: 30 }, store: "log" },
  healer: { name: "Healer's Hut", emoji: "💊", at: [6.4, 9.6], cost: { log: 30, crop: 10 } },
  farm: { name: "Farm", emoji: "🌻", at: [12.6, 9.6], cost: { log: 30 }, store: "crop" },
  post: { name: "Courier Post", emoji: "📦", at: [8, 12], cost: { log: 30 } },
  yard: { name: "Builder's Yard", emoji: "🔨", at: [11, 12], cost: { log: 30 } },
};
const HOME_SPOTS = [[8.6, 9.3], [9.6, 9.3], [10.6, 9.3], [8.6, 10.4], [9.6, 10.4], [10.6, 10.4], [9.1, 11.2], [10.1, 11.2]];

// Each level turns on more of the design. `res` is what has to reach 1000.
const LEVELS = [
  { roles: ["lumberjack", "miner"], res: ["log", "ore"], hunger: false, homes: false, sickness: false },
  { roles: ["lumberjack", "miner", "courier", "blacksmith"], res: ["log", "ore"], hunger: false, homes: false, sickness: false },
  { roles: ["lumberjack", "miner", "courier", "blacksmith", "farmer", "cook"], res: ["log", "ore", "crop"], hunger: true, homes: false, sickness: false },
  { roles: ["lumberjack", "miner", "courier", "blacksmith", "farmer", "cook", "builder"], res: ["log", "ore", "crop"], hunger: true, homes: true, sickness: false },
  { roles: ["lumberjack", "miner", "courier", "blacksmith", "farmer", "cook", "builder", "healer"], res: ["log", "ore", "crop"], hunger: true, homes: true, sickness: true },
];

const SIDE_EMOJI = ["🧑‍🌾", "🤠"];

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

// Both colonies get the same land, so neither starts with a luckier forest
function makeLayout() {
  return {
    trees: scatter(18, 0.5, 3.6, 1.3, 12.6, 1.05),
    rocks: scatter(8, 15.4, 19.5, 1.3, 3.9, 1.0),
    plots: Array.from({ length: 8 }, (_, i) => ({ x: (15.6 + (i % 4) * 1.15) * T, y: (10.4 + Math.floor(i / 4) * 1.4) * T, growth: rand(0.3, 0.9) })),
  };
}

// ---------- one colony: its land, stockpile, villagers and Founder ----------

function createColony({ level, input, human, side, layout }) {
  const cfg = LEVELS[level - 1];
  const c = {
    level,
    cfg,
    side,
    human,
    emoji: SIDE_EMOJI[side],
    stock: { log: 40, ore: 10, crop: 0, axe: 0, pickaxe: 0, hoe: 0, hammer: 0 },
    trees: layout.trees.map((p) => ({ ...p, grown: true, regrow: 0, claimed: null })),
    rocks: layout.rocks.map((p) => ({ ...p, ore: 3, regrow: 0, claimed: null })),
    plots: layout.plots.map((p) => ({ ...p, claimed: null })),
    buildings: {},
    homes: 2, // the Player Hall sleeps two
    villagers: [],
    visitors: [],
    visitT: 3,
    player: { x: HALL.x, y: HALL.y + 1.15 * T, slots: [null, null, null, null], toolLevel: 1, face: 1 },
    mg: null, // the Founder's current minigame
    msg: null,
    clock: 0,
    nextId: 1,
    hintTarget: null,
    view: null,
  };
  for (const [key, b] of Object.entries(BUILDINGS)) {
    c.buildings[key] = { key, ...tilePos(b.at), vines: 1, built: false, stock: 0, meals: 0 };
  }

  const say = (text) => (c.msg = { text, t: 2.2 });

  // ---------- helpers shared by the Founder, the villagers and the bots ----------

  const built = (key) => c.buildings[key].built;
  const villagersIn = (job) => c.villagers.filter((v) => v.job === job);
  const neededJobs = () => cfg.roles;
  const toolsInPlay = () => [...new Set(neededJobs().map((j) => JOBS[j].tool).filter(Boolean))];

  function isWorking(v) {
    if (v.sick) return false;
    const job = JOBS[v.job];
    if (!built(job.building)) return false;
    if (cfg.hunger && v.hunger >= 100) return false;
    if (job.tool && !(v.tool && v.tool.dur > 0) && c.stock[job.tool] <= 0) return false;
    return true;
  }
  c.working = (job) => c.villagers.some((v) => v.job === job && isWorking(v));
  c.workingCount = (job) => c.villagers.filter((v) => v.job === job && isWorking(v)).length;
  c.villagersIn = villagersIn;

  // Everything the colony owns counts toward the goal: the Hall, the huts' piles and the bag
  c.total = (item) => c.stock[item] + bagCount(item) + Object.values(c.buildings).reduce((n, b) => n + (BUILDINGS[b.key].store === item ? b.stock : 0), 0);
  c.done = () => cfg.res.every((item) => c.total(item) >= GOAL);
  c.score = () => cfg.res.reduce((n, item) => n + Math.min(GOAL, c.total(item)), 0);

  // Which tool the colony is shortest of: workers without one, minus spares at the Hall
  c.toolNeeded = () => {
    let best = null;
    let bestGap = 0;
    for (const tool of toolsInPlay()) {
      const job = Object.keys(JOBS).find((j) => JOBS[j].tool === tool);
      const lacking = villagersIn(job).filter((v) => !(v.tool && v.tool.dur > 0)).length;
      const gap = lacking + (built(JOBS[job].building) ? 1 : 0) - c.stock[tool];
      if (gap > bestGap) {
        bestGap = gap;
        best = tool;
      }
    }
    return best;
  };

  // The next job the Tavern can fill: every required job once, then extra gatherers
  c.openJob = () => {
    for (const job of neededJobs()) {
      if (built(JOBS[job].building) && villagersIn(job).length === 0) return job;
    }
    let best = null;
    for (const job of GATHERERS) {
      if (!neededJobs().includes(job) || !built(JOBS[job].building)) continue;
      const n = villagersIn(job).length;
      if (n < MAX_GATHERERS && (!best || n < villagersIn(best).length)) best = job;
    }
    return best;
  };
  c.isExtraJob = (job) => villagersIn(job).length > 0;

  c.reputation = () => Object.values(c.buildings).filter((b) => b.built).length + c.villagers.length;

  // ---------- the Founder's bag (four slots) ----------

  const bagCount = (item) => c.player.slots.reduce((n, s) => n + (s && s.item === item ? s.n : 0), 0);
  c.bagCount = bagCount;
  c.bagTotal = () => c.player.slots.reduce((n, s) => n + (s ? s.n : 0), 0);
  function bagAdd(item, n) {
    let left = n;
    for (const s of c.player.slots) if (s && s.item === item && s.n < SLOT_STACK && left) {
      const put = Math.min(left, SLOT_STACK - s.n);
      s.n += put;
      left -= put;
    }
    for (let i = 0; i < 4 && left; i++) if (!c.player.slots[i]) {
      const put = Math.min(left, SLOT_STACK);
      c.player.slots[i] = { item, n: put };
      left -= put;
    }
    return n - left;
  }
  c.bagHasRoom = (item) => c.player.slots.some((s) => !s || (s.item === item && s.n < SLOT_STACK));

  const canAfford = (cost) => Object.entries(cost).every(([k, n]) => c.stock[k] >= n);
  const pay = (cost) => Object.entries(cost).forEach(([k, n]) => (c.stock[k] -= n));
  c.canAfford = canAfford;

  // The Founder pays from their bag first and the Hall for the rest — no trip to the Hall needed
  const canPay = (cost) => Object.entries(cost).every(([k, n]) => c.stock[k] + bagCount(k) >= n);
  c.canPay = canPay;
  function payBoth(cost) {
    for (const [k, n] of Object.entries(cost)) {
      let left = n;
      for (let i = 0; i < 4 && left; i++) {
        const sl = c.player.slots[i];
        if (!sl || sl.item !== k) continue;
        const take = Math.min(left, sl.n);
        sl.n -= take;
        left -= take;
        if (!sl.n) c.player.slots[i] = null;
      }
      c.stock[k] -= left;
    }
  }
  const haveText = (cost) => Object.keys(cost).map((k) => `${c.stock[k] + bagCount(k)} ${ITEM_ICON[k]}`).join(" + ");

  // ---------- what the Founder is standing at ----------

  function interactables() {
    const list = [{ kind: "hall", obj: HALL, x: HALL.x, y: HALL.y, reach: BUILDING_REACH }];
    for (const t of c.trees) if (t.grown) list.push({ kind: "tree", obj: t, x: t.x, y: t.y });
    for (const k of c.rocks) if (k.ore > 0) list.push({ kind: "rock", obj: k, x: k.x, y: k.y });
    for (const p of c.plots) if (p.growth >= 1) list.push({ kind: "plot", obj: p, x: p.x, y: p.y });
    for (const b of Object.values(c.buildings)) list.push({ kind: b.built ? "building" : "lot", obj: b, x: b.x, y: b.y, reach: BUILDING_REACH });
    return list;
  }
  c.targetAt = (pos) => {
    let best = null;
    for (const it of interactables()) {
      // Compare by how far inside its reach you are, so a big building does not drown out a tree
      const d = Math.hypot(it.x - pos.x, it.y - pos.y) - (it.reach || REACH);
      if (d <= 0 && (!best || d < best.d)) best = { ...it, d };
    }
    return best;
  };

  function startMinigame(kind, target) {
    const speed = 0.85 + 0.08 * (level - 1);
    c.mg = { kind, target, phase: 0, dir: 1, speed, cool: 0, zoneC: rand(0.25, 0.75), zoneW: 0.24 + 0.06 * (c.player.toolLevel - 1) };
  }

  function act() {
    const it = c.targetAt(c.player);
    if (!it) return say("Nothing to do here");
    const { kind, obj } = it;
    if (kind === "tree" || kind === "rock" || kind === "plot") {
      const item = { tree: "log", rock: "ore", plot: "crop" }[kind];
      if (!c.bagHasRoom(item)) return say("Bag full — empty it at the Hall");
      return startMinigame(kind, obj);
    }
    if (kind === "hall") {
      let n = 0;
      c.player.slots.forEach((s, i) => {
        if (!s) return;
        c.stock[s.item] += s.n;
        n += s.n;
        c.player.slots[i] = null;
      });
      return say(n ? `Stored ${n} at the Hall` : "The Hall: your stockpile");
    }
    if (kind === "lot") {
      if (obj.vines > 0) {
        obj.vines = 0;
        return say(`Cleared the ${BUILDINGS[obj.key].name} lot — now build it here`);
      }
      const cost = BUILDINGS[obj.key].cost;
      if (!canPay(cost)) return say(`The ${BUILDINGS[obj.key].name} needs ${costText(cost)} — you have ${haveText(cost)}`);
      payBoth(cost);
      obj.built = true;
      return say(`Built the ${BUILDINGS[obj.key].name}`);
    }
    const def = BUILDINGS[obj.key];
    if (obj.key === "tavern") return hire();
    if (def.store && obj.stock > 0) {
      const took = bagAdd(def.store, obj.stock);
      obj.stock -= took;
      return say(took ? `Picked up ${took} ${ITEM_ICON[def.store]}` : "Bag full");
    }
    if (obj.key === "smithy") {
      if (c.working("blacksmith") && c.player.toolLevel < 3 && c.stock.ore >= UPGRADE_COST) {
        c.stock.ore -= UPGRADE_COST;
        c.player.toolLevel++;
        return say(`Your tools are now level ${c.player.toolLevel}`);
      }
      if (c.working("blacksmith")) return say("The blacksmith has the forge");
      if (!c.toolNeeded()) return say("Nobody needs a tool right now");
      if (!canPay(TOOL_COST)) return say(`A tool needs ${costText(TOOL_COST)}`);
      return startMinigame("forge", obj);
    }
    if (obj.key === "kitchen") {
      if (c.working("cook")) return say("The cook has the kitchen");
      if (!canPay(MEAL_COST)) return say(`Two meals need ${costText(MEAL_COST)}`);
      return startMinigame("cook", obj);
    }
    say(def.name);
  }

  function hire() {
    const tavern = c.buildings.tavern;
    const job = c.openJob();
    if (!job) return say("No open jobs — build a workplace first");
    const want = JOBS[job].origin;
    const i = c.visitors.findIndex((v) => v.origin === want);
    if (i < 0) return say(`Need a ${ORIGINS[want].name} for the ${JOBS[job].name} job`);
    if (!canPay({ log: HIRE_FEE })) return say(`Hiring costs ${HIRE_FEE} 🪵`);
    payBoth({ log: HIRE_FEE });
    const visitor = c.visitors.splice(i, 1)[0];
    c.villagers.push({
      id: c.nextId++, origin: visitor.origin, job, x: tavern.x, y: tavern.y + 14,
      task: [], tool: null, carry: null, hunger: 0, sick: false, recover: 0, blocked: null,
    });
    say(`Hired a ${ORIGINS[visitor.origin].name} as ${JOBS[job].name}`);
  }

  function finishMinigame() {
    const { kind, target } = c.mg;
    c.mg = null;
    if (kind === "tree" && target.grown) {
      target.grown = false;
      target.regrow = 7;
      bagAdd("log", YIELD);
    } else if (kind === "rock" && target.ore > 0) {
      target.ore--;
      if (!target.ore) target.regrow = 9;
      bagAdd("ore", YIELD);
    } else if (kind === "plot" && target.growth >= 1) {
      target.growth = 0;
      bagAdd("crop", YIELD);
    } else if (kind === "forge") {
      const tool = c.toolNeeded();
      if (tool && canPay(TOOL_COST)) {
        payBoth(TOOL_COST);
        c.stock[tool]++;
        say(`Forged a ${tool} ${TOOL_ICON[tool]}`);
      }
    } else if (kind === "cook" && canPay(MEAL_COST)) {
      payBoth(MEAL_COST);
      target.meals += 2;
      say("Cooked a meal 🍲");
    }
  }

  // ---------- villagers: decide what to do next, then carry it out ----------
  // Layer 1 (deciding) is the ordered provider list in decide(); layer 2 (executing) is the
  // task queue of walk/wait steps, which any interruption can safely throw away.

  const walk = (p) => ({ type: "walk", x: p.x, y: p.y });
  const wait = (t, done) => ({ type: "wait", t, done });
  const idle = () => [walk({ x: HALL.x + rand(-40, 40), y: HALL.y + rand(30, 60) }), wait(1)];

  function release(v) {
    for (const list of [c.trees, c.rocks, c.plots]) for (const n of list) if (n.claimed === v) n.claimed = null;
    v.task = [];
    v.carry = null;
  }

  const nearestFree = (list, from, ok) => {
    let best = null;
    for (const n of list) if (!n.claimed && ok(n) && (!best || dist(n, from) < dist(best, from))) best = n;
    return best;
  };

  function gatherTask(v, job) {
    const hut = c.buildings[job.building];
    const kind = { lumberjack: "tree", miner: "rock", farmer: "plot" }[v.job];
    const list = { tree: c.trees, rock: c.rocks, plot: c.plots }[kind];
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
      wait(0.2, () => { hut.stock += WORKER_YIELD; v.carry = null; }),
    ];
  }

  function fetchTool(v, tool) {
    if (c.stock[tool] <= 0) {
      v.blocked = `no ${tool}`;
      return null;
    }
    return [walk(HALL), wait(0.3, () => {
      if (c.stock[tool] <= 0) return false;
      c.stock[tool]--;
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
        const b = c.buildings[key];
        if (b.built && b.stock > 0 && (!hut || b.stock > hut.stock)) hut = b;
      }
      if (!hut) return null;
      const item = BUILDINGS[hut.key].store;
      let load = 0;
      return [
        walk(hut),
        wait(0.3, () => { load = Math.min(80, hut.stock); hut.stock -= load; v.carry = load ? item : null; }),
        walk(HALL),
        wait(0.3, () => { c.stock[item] += load; v.carry = null; }),
      ];
    },
    blacksmith() {
      const tool = c.toolNeeded();
      if (!tool || !canAfford(TOOL_COST)) return null;
      return [walk(HALL), takeFromHall(TOOL_COST), walk(c.buildings.smithy), wait(1.6, () => { c.stock[tool]++; })];
    },
    cook() {
      const kitchen = c.buildings.kitchen;
      if (kitchen.meals >= 6 || !canAfford(MEAL_COST)) return null;
      return [walk(HALL), takeFromHall(MEAL_COST), walk(kitchen), wait(1.6, () => { kitchen.meals += 2; })];
    },
    builder(v) {
      if (cfg.homes && c.homes < c.villagers.length && c.homes - 2 < HOME_SPOTS.length && c.stock.log >= HOME_COST) {
        const spot = tilePos(HOME_SPOTS[c.homes - 2]);
        return [walk(HALL), takeFromHall({ log: HOME_COST }), walk(spot), wait(2, () => { c.homes++; v.tool.dur--; })];
      }
      return null;
    },
    healer: () => [walk(c.buildings.healer), wait(1)],
  };

  function decide(v) {
    v.blocked = null;
    const job = JOBS[v.job];
    if (cfg.hunger && v.hunger >= 60 && built("kitchen") && c.buildings.kitchen.meals > 0) {
      const kitchen = c.buildings.kitchen;
      return [walk(kitchen), wait(0.8, () => {
        if (kitchen.meals <= 0) return false;
        kitchen.meals--;
        v.hunger = 0;
      })];
    }
    if (job.tool && !(v.tool && v.tool.dur > 0)) return fetchTool(v, job.tool) || idle();
    return PROVIDERS[v.job](v, job) || idle();
  }

  function speedOf(v) {
    let s = 82;
    if (cfg.hunger && v.hunger >= 100) s *= 0.5;
    if (cfg.homes && c.villagers.indexOf(v) >= c.homes) s *= 0.75; // homeless
    if (v.sick) s *= 0.6;
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
    if (cfg.sickness && !v.sick && v.job !== "healer" && chance(0.004 * dt)) {
      v.sick = true;
      v.recover = 22;
      release(v);
    }

    if (v.sick) {
      const hut = c.buildings.healer;
      if (c.working("healer")) {
        if (moveToward(v, hut, speedOf(v), dt)) v.recover -= dt * 8; // a healer cuts recovery to a few seconds
      } else {
        v.recover -= dt;
      }
      if (v.recover <= 0) v.sick = false;
      return;
    }

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

  // ---------- explaining what's going on, for a human Founder ----------

  const WHERE = { log: "chop trees in the forest (left)", ore: "mine rocks (top right)", crop: "harvest crops in the fields (bottom right)" };

  // What pressing Space will do where the Founder is standing
  c.promptFor = (it) => {
    if (!it) return null;
    const { kind, obj } = it;
    if (kind === "tree") return `Space: chop tree (+${YIELD} 🪵)`;
    if (kind === "rock") return `Space: mine rock (+${YIELD} 🪨)`;
    if (kind === "plot") return `Space: harvest (+${YIELD} 🌾)`;
    if (kind === "hall") return c.bagTotal() ? `Space: empty your bag into the Hall (${c.bagTotal()})` : "The Hall — your stockpile";
    const name = BUILDINGS[obj.key].name;
    if (kind === "lot") {
      if (obj.vines > 0) return `Space: clear the vines off the ${name} lot`;
      const cost = BUILDINGS[obj.key].cost;
      return canPay(cost) ? `Space: build the ${name} (${costText(cost)})` : `${name} needs ${costText(cost)} — you have ${haveText(cost)}`;
    }
    if (obj.key === "tavern") {
      const job = c.openJob();
      if (!job) return "Tavern: no open jobs — build a workplace";
      const origin = JOBS[job].origin;
      return c.visitors.some((v) => v.origin === origin)
        ? `Space: hire a ${ORIGINS[origin].name} as ${JOBS[job].name} (${HIRE_FEE} 🪵)`
        : `Tavern: waiting for a ${ORIGINS[origin].name} to visit`;
    }
    const store = BUILDINGS[obj.key].store;
    if (store && obj.stock > 0) return `Space: pick up ${obj.stock} ${ITEM_ICON[store]}`;
    if (obj.key === "smithy") {
      if (c.working("blacksmith")) return c.player.toolLevel < 3 ? `Space: sharpen your own tools (${UPGRADE_COST} 🪨)` : "The Blacksmith is at work";
      const tool = c.toolNeeded();
      return tool ? `Space: forge a ${tool} (${costText(TOOL_COST)})` : "Smithy: nobody needs a tool";
    }
    if (obj.key === "kitchen") return c.working("cook") ? "The Cook is at work" : `Space: cook 2 meals (${costText(MEAL_COST)})`;
    return name;
  };

  const nearestNode = (item) => {
    const pool = item === "log" ? c.trees.filter((t) => t.grown) : item === "ore" ? c.rocks.filter((k) => k.ore > 0) : c.plots.filter((q) => q.growth >= 1);
    let best = null;
    for (const n of pool) if (!best || dist(n, c.player) < dist(best, c.player)) best = n;
    return best;
  };
  c.nearestNode = nearestNode;

  // Returns [what to do, where to do it]
  function buildHint(key) {
    const lot = c.buildings[key];
    const name = BUILDINGS[key].name;
    if (lot.vines > 0) return [`Walk to the ${name} lot (arrow) and press Space to clear the vines`, lot];
    const cost = BUILDINGS[key].cost;
    if (canPay(cost)) return [`Build the ${name}: stand on its lot (arrow) and press Space`, lot];
    const k = Object.keys(cost).find((item) => c.stock[item] + bagCount(item) < cost[item]);
    return [`The ${name} needs ${costText(cost)} (you have ${haveText(cost)}) — ${WHERE[k]}`, nearestNode(k)];
  }

  c.lowest = () => cfg.res.reduce((a, b) => (c.total(b) < c.total(a) ? b : a));

  function step() {
    if (!built("tavern")) {
      const [t, at] = buildHint("tavern");
      return [`${t} — the Tavern is where you hire workers`, at];
    }
    for (const job of neededJobs()) {
      const key = JOBS[job].building;
      if (!built(key)) {
        const [t, at] = buildHint(key);
        return [`${t} — it's where the ${JOBS[job].name} works`, at];
      }
    }
    const open = neededJobs().find((j) => villagersIn(j).length === 0);
    if (open) {
      const origin = ORIGINS[JOBS[open].origin].name;
      return c.visitors.some((v) => v.origin === JOBS[open].origin)
        ? [`A ${origin} is at the Tavern — stand there and press Space to hire them as your ${JOBS[open].name} (${HIRE_FEE} 🪵)`, c.buildings.tavern]
        : [`Waiting for a ${origin} to visit the Tavern (only they can be a ${JOBS[open].name}) — gather meanwhile`, nearestNode(c.lowest())];
    }
    const toolless = c.villagers.find((v) => v.blocked && v.blocked.startsWith("no "));
    if (toolless) {
      const tool = toolless.blocked.slice(3);
      if (c.working("blacksmith")) return [`Your ${JOBS[toolless.job].name} needs a ${tool} — the Blacksmith makes it from ${costText(TOOL_COST)} in the Hall`, HALL];
      if (built("smithy")) return [`Your ${JOBS[toolless.job].name} needs a ${tool} — forge one at the Smithy (${costText(TOOL_COST)}, press Space there)`, c.buildings.smithy];
      const [t, at] = buildHint("smithy");
      return [`Your ${JOBS[toolless.job].name} needs a ${tool}, made at a Smithy. ${t}`, at];
    }
    if (cfg.hunger && !c.working("cook") && c.buildings.kitchen.meals === 0 && c.villagers.some((v) => v.hunger >= 60)) {
      return [`Villagers are hungry — cook at the Kitchen (${costText(MEAL_COST)} makes 2 meals)`, c.buildings.kitchen];
    }
    const extra = c.openJob();
    if (extra && c.visitors.some((v) => v.origin === JOBS[extra].origin)) {
      return [`More workers = faster! Hire another ${JOBS[extra].name} at the Tavern (${HIRE_FEE} 🪵)`, c.buildings.tavern];
    }
    const low = c.lowest();
    return [`Your village is working. Help out: you're lowest on ${ITEM_NAME[low]} ${ITEM_ICON[low]} — ${WHERE[low]}`, nearestNode(low)];
  }

  c.nextStep = () => {
    const [text, at] = step();
    c.hintTarget = at || null;
    return text;
  };

  // ---------- the frame ----------

  c.update = (dt) => {
    c.clock += dt;

    // World regrowth
    for (const t of c.trees) if (!t.grown && (t.regrow -= dt) <= 0) t.grown = true;
    for (const k of c.rocks) if (!k.ore && (k.regrow -= dt) <= 0) k.ore = 3;
    for (const p of c.plots) p.growth = Math.min(1, p.growth + dt / (built("farm") ? 10 : 16));

    // Visitors drift into the Tavern, more often as the colony's reputation grows; unhired ones leave
    if (built("tavern")) {
      c.visitT -= dt;
      if (c.visitT <= 0 && c.visitors.length < 3) {
        // Your workforce shapes who comes: half the visitors are from the village your open job needs
        const open = c.openJob();
        const origin = open && chance(0.5) ? JOBS[open].origin : pickOrigin();
        c.visitors.push({ origin, stay: 22 });
        c.visitT = Math.max(1.5, 3.5 - c.reputation() * 0.12);
      }
    }
    for (const v of c.visitors) v.stay -= dt;
    c.visitors = c.visitors.filter((v) => v.stay > 0);

    // The Founder: walk and work the minigame
    const p = c.player;
    const mx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const my = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my);
      p.x = clamp(p.x + (mx / len) * 150 * dt, 10, W - 10);
      p.y = clamp(p.y + (my / len) * 150 * dt, 30, H - 30);
      if (mx) p.face = mx;
    }
    if (c.mg) {
      const mg = c.mg;
      if (dist(p, mg.target) > BUILDING_REACH + 6) c.mg = null;
      else if (mg.cool > 0) mg.cool -= dt;
      else {
        mg.phase += mg.dir * mg.speed * dt;
        if (mg.phase > 1) { mg.phase = 1; mg.dir = -1; }
        if (mg.phase < 0) { mg.phase = 0; mg.dir = 1; }
        if (input.pressed.action) {
          if (Math.abs(mg.phase - mg.zoneC) <= mg.zoneW / 2) finishMinigame();
          else {
            mg.cool = 0.45;
            mg.zoneC = rand(0.25, 0.75);
          }
        }
      }
    } else if (input.pressed.action) {
      act();
    }

    for (const v of c.villagers) runVillager(v, dt);
    if (c.msg && (c.msg.t -= dt) <= 0) c.msg = null;
  };

  return c;
}

// ---------- the round: two colonies racing ----------

function createRound({ level, inputs, humans = [false, false] }) {
  const cfg = LEVELS[level - 1];
  const layout = makeLayout();
  const cols = [0, 1].map((side) => createColony({ level, input: inputs[side], human: humans[side], side, layout }));
  const nHumans = humans.filter(Boolean).length;
  // One person: full screen on their colony, zoomed in. Otherwise split screen, one colony a side.
  const focus = nHumans === 1 ? humans.indexOf(true) : -1;
  const tags = nHumans === 1 ? cols.map((c) => (c.human ? "YOU" : "RIVAL")) : nHumans === 2 ? ["P1", "P2"] : ["FOUNDER", "RIVAL"];
  cols.forEach((c, i) => (c.tag = tags[i]));

  const r = {
    level,
    cfg,
    cols,
    focus,
    time: TIME_LIMIT,
    winner: null,
    endReason: "",
    timeScale: 0.75, // the whole colony runs at three-quarter speed
    countdown: 6,
    view: null,
  };

  const resList = cfg.res.map((k) => ITEM_ICON[k]).join(" ");
  const end = (winner, reason) => {
    r.winner = winner;
    r.endReason = reason;
  };

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    for (const c of cols) c.update(dt);
    const done = cols.map((c) => c.done());
    if (done[0] || done[1]) {
      const w = done[0] && done[1] ? (cols[0].score() >= cols[1].score() ? 0 : 1) : done[0] ? 0 : 1;
      end(w, `${cols[w].emoji} ${cols[w].tag === "YOU" ? "Your colony" : `The ${cols[w].tag.toLowerCase()} colony`} stockpiled ${GOAL} of ${resList} first!`);
    }
    r.time -= dt;
    if (r.winner === null && r.time <= 0) {
      const w = cols[0].score() >= cols[1].score() ? 0 : 1;
      end(w, `Time's up — the ${cols[w].tag.toLowerCase()} colony was closer to ${GOAL} of everything.`);
    }
    return r.winner;
  };

  r.intro = () => {
    const extra = [
      level >= 2 && "Couriers and Blacksmiths",
      cfg.hunger && "crops and hunger",
      cfg.homes && "homes",
      cfg.sickness && "sickness",
    ].filter(Boolean);
    return [
      "Race the rival colony!",
      `First to ${GOAL} of each: ${resList}`,
      "Gather by hand, then hire workers to gather for you.",
      "More workers = faster. Everything you spend, you have to earn back.",
      extra.length ? `This level: ${extra.join(", ")}.` : "Build, hire at the Tavern, give them tools.",
      "Tip: follow the NEXT bar and the 👇 arrow.",
    ];
  };

  r.status = () =>
    cols.map((c) => `${c.tag} ${cfg.res.map((k) => `${ITEM_ICON[k]}${Math.min(GOAL, c.total(k))}`).join(" ")}`).join("  vs  ");
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

function costText(cost) {
  return Object.entries(cost).map(([k, n]) => `${n} ${ITEM_ICON[k]}`).join(" + ");
}

// ---------- Bot ----------

// The Founder bot walks an ordered list of goals — the same "first provider with an answer
// wins" shape the Dev Documentation chose for villagers — and plays the minigame by watching
// the marker, a little late, like a person. Both colonies use it.
function founderBot(c, input, skill) {
  const clock = new Clock(lerp(0.5, 0.15, skill));
  const lag = lerp(0.1, 0.03, skill);
  const tolerance = lerp(0.55, 0.8, skill);
  const BUILD_ORDER = ["tavern", "woodhut", "post", "minehut", "smithy", "farm", "kitchen", "yard", "healer"];
  let goal = null;
  let pressCd = 0;

  const needed = (key) => {
    if (key === "tavern") return true;
    if (key === "smithy") return c.cfg.roles.some((j) => JOBS[j].tool); // tools are forged there
    return c.cfg.roles.some((j) => JOBS[j].building === key);
  };
  const go = (obj) => ({ x: obj.x, y: obj.y });
  const gather = (item) => {
    const n = c.nearestNode(item);
    return n ? go(n) : null;
  };

  function plan() {
    const carried = c.bagTotal();
    const have = (item) => c.stock[item] + c.bagCount(item);
    const toHall = go(HALL);
    if (carried >= 160 || c.player.slots.every((s) => s && s.n >= SLOT_STACK)) return toHall;

    const job = c.openJob();
    if (job && c.buildings.tavern.built && c.visitors.some((v) => v.origin === JOBS[job].origin)) {
      if (c.stock.log >= HIRE_FEE) return go(c.buildings.tavern);
      if (have("log") >= HIRE_FEE) return toHall;
    }

    if (c.toolNeeded() && !c.working("blacksmith") && c.buildings.smithy.built) {
      if (c.canAfford(TOOL_COST)) return go(c.buildings.smithy);
    }
    if (c.cfg.hunger && !c.working("cook") && c.buildings.kitchen.built && c.buildings.kitchen.meals < 2 && c.canAfford(MEAL_COST)) {
      return go(c.buildings.kitchen);
    }

    const next = BUILD_ORDER.find((k) => needed(k) && !c.buildings[k].built);
    if (next) {
      const lot = c.buildings[next];
      const cost = BUILDINGS[next].cost;
      if (lot.vines > 0) return go(lot);
      if (c.canAfford(cost)) return go(lot);
      const missing = Object.keys(cost).find((k) => have(k) < cost[k]);
      if (!missing && carried) return toHall;
      if (missing) return gather(missing) || toHall;
    }

    if (!c.working("courier")) {
      const hut = ["woodhut", "minehut", "farm"].map((k) => c.buildings[k]).find((b) => b.built && b.stock >= 40);
      if (hut && carried < 100) return go(hut);
    }
    if (carried >= 60) return toHall;

    // Keep the Hall topped up for hiring, tools and food, then race on the weakest resource
    const wants = [["log", 80], ["ore", c.buildings.smithy.built ? 40 : 10], ["crop", c.cfg.hunger ? 40 : 0]];
    wants.sort((a, b) => have(a[0]) / Math.max(1, a[1]) - have(b[0]) / Math.max(1, b[1]));
    for (const [item, target] of wants) if (target && have(item) < target) return gather(item) || toHall;
    return gather(c.lowest()) || toHall;
  }

  return {
    update(dt) {
      pressCd -= dt;
      const mg = c.mg;
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
      const p = c.player;
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

// ---------- Drawing ----------

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TOP = 46; // race strip + NEXT bar
const BOT = 26; // bag and tools
const ZOOM = 1.8; // one person: zoomed in on their colony
const SPLIT_ZOOM = 1; // split screen: half the canvas each

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

function label(ctx, str, x, y) {
  ctx.font = '9px "Special Elite", monospace';
  const w = ctx.measureText(str).width + 6;
  ctx.fillStyle = "rgba(243, 230, 201, 0.75)";
  ctx.fillRect(x - w / 2, y - 6, w, 12);
  text(ctx, str, x, y, 9, "#2b1d12", "center");
}

// A text pill that shrinks to fit inside a view `vw` wide
function pill(ctx, str, x, y, color, vw) {
  ctx.font = '13px "Special Elite", monospace';
  const size = Math.max(8, Math.min(13, Math.floor((13 * (vw - 24)) / ctx.measureText(str).width)));
  ctx.font = `${size}px "Special Elite", monospace`;
  const w = ctx.measureText(str).width + 16;
  const cx = clamp(x, w / 2 + 4, vw - w / 2 - 4);
  const cy = clamp(y, TOP + 14, H - BOT - 14);
  ctx.fillStyle = "rgba(28, 17, 10, 0.88)";
  ctx.fillRect(cx - w / 2, cy - 11, w, 22);
  text(ctx, str, cx, cy, size, color, "center");
}

function fitText(ctx, str, x, y, max, maxW, color) {
  ctx.font = `${max}px "Special Elite", monospace`;
  const size = Math.max(7, Math.min(max, Math.floor((max * maxW) / ctx.measureText(str).width)));
  text(ctx, str, x, y, size, color);
}

function draw(ctx, r) {
  ctx.fillStyle = "#56743a";
  ctx.fillRect(0, 0, W, H);
  if (r.focus >= 0) {
    drawColony(ctx, r, r.cols[r.focus], 0, W, ZOOM, true);
  } else {
    drawColony(ctx, r, r.cols[0], 0, W / 2, SPLIT_ZOOM, false);
    drawColony(ctx, r, r.cols[1], W / 2, W / 2, SPLIT_ZOOM, false);
    ctx.fillStyle = "#2b1d12";
    ctx.fillRect(W / 2 - 2, 0, 4, H);
  }
}

// One colony's view: a camera on its Founder, drawn into a slice of the canvas `vw` wide
function drawColony(ctx, r, c, x0, vw, zoom, full) {
  const vh = (H - TOP - BOT) / zoom;
  const ww = vw / zoom;
  c.view = {
    zoom,
    x: clamp(c.player.x - ww / 2, 0, Math.max(0, W - ww)),
    y: clamp(c.player.y - vh / 2, 0, Math.max(0, H - vh)) - TOP / zoom,
  };
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, 0, vw, H);
  ctx.clip();
  ctx.translate(x0, 0);
  ctx.save();
  ctx.scale(zoom, zoom);
  ctx.translate(-c.view.x, -c.view.y);
  drawWorld(ctx, c);
  ctx.restore();
  drawFounderText(ctx, c, vw);
  drawHud(ctx, r, c, vw, full);
  if (full) drawMinimap(ctx, c, vw);
  if (c.human && c.hintTarget) drawEdgeArrow(ctx, c, vw);
  ctx.restore();
}

function drawEdgeArrow(ctx, c, vw) {
  const z = c.view.zoom;
  const sx = (c.hintTarget.x - c.view.x) * z;
  const sy = (c.hintTarget.y - c.view.y) * z;
  const top = TOP + 4;
  const bottom = H - BOT - 8;
  if (sx > 20 && sx < vw - 20 && sy > top && sy < bottom) return; // on screen: the 👇 is enough
  const cx = vw / 2;
  const cy = (top + bottom) / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ex = clamp(cx + Math.cos(a) * 1000, 26, vw - 26);
  const ey = clamp(cy + Math.sin(a) * 1000, top + 16, bottom - 16);
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(a);
  ctx.fillStyle = "#f3c35a";
  ctx.strokeStyle = "#2b1d12";
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

function drawZones(ctx) {
  ctx.fillStyle = "#7f9a52";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#56743a";
  ctx.fillRect(0, 0, 4.2 * T, H);
  ctx.fillStyle = "#8a8070";
  ctx.fillRect(15 * T, 0, 5 * T, 4.6 * T);
  ctx.fillStyle = "#9c7a4c";
  ctx.fillRect(15 * T, 9.4 * T, 5 * T, 4.6 * T);
}

function drawMinimap(ctx, c, vw) {
  const s = 0.2;
  const mw = W * s;
  const mh = H * s;
  const x0 = vw - mw - 8;
  const y0 = H - BOT - mh - 8;
  ctx.save();
  ctx.fillStyle = "rgba(28, 17, 10, 0.85)";
  ctx.fillRect(x0 - 3, y0 - 3, mw + 6, mh + 6);
  ctx.translate(x0, y0);
  ctx.scale(s, s);
  drawZones(ctx);
  ctx.fillStyle = "#3d2616";
  ctx.fillRect(HALL.x - 25, HALL.y - 25, 50, 50);
  for (const b of Object.values(c.buildings)) {
    ctx.fillStyle = b.built ? "#c79a62" : "rgba(60, 90, 40, 0.8)";
    ctx.fillRect(b.x - 20, b.y - 18, 40, 36);
  }
  ctx.fillStyle = "#f3e6c9";
  for (const v of c.villagers) ctx.fillRect(v.x - 8, v.y - 8, 16, 16);
  ctx.fillStyle = "#f3c35a";
  ctx.beginPath();
  ctx.arc(c.player.x, c.player.y, 22, 0, Math.PI * 2);
  ctx.fill();
  // Where the camera is looking
  ctx.strokeStyle = "#f3e6c9";
  ctx.lineWidth = 8;
  ctx.strokeRect(c.view.x, c.view.y + TOP / c.view.zoom, vw / c.view.zoom, (H - TOP - BOT) / c.view.zoom);
  ctx.restore();
}

function drawWorld(ctx, c) {
  // Zones: forest, mine, fields, and the village between
  drawZones(ctx);
  text(ctx, "FOREST", 0.3 * T, 1.55 * T, 11, "rgba(255,255,255,0.6)");
  text(ctx, "MINE", 15.3 * T, 1.55 * T, 11, "rgba(255,255,255,0.6)");
  text(ctx, "FIELDS", 15.3 * T, 9.85 * T, 11, "rgba(255,255,255,0.6)");

  for (let i = 0; i < c.homes - 2; i++) {
    const s = tilePos(HOME_SPOTS[i]);
    emoji(ctx, "🏠", s.x, s.y, 20);
  }

  // The Player Hall: stockpile and home
  ctx.fillStyle = "rgba(60, 35, 15, 0.35)";
  ctx.fillRect(HALL.x - 30, HALL.y - 26, 60, 52);
  emoji(ctx, "🏛️", HALL.x, HALL.y - 2, 38);
  text(ctx, "HALL", HALL.x, HALL.y + 22, 10, "#f3e6c9", "center");

  for (const b of Object.values(c.buildings)) {
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
        label(ctx, def.name, b.x, b.y + 27);
      } else {
        label(ctx, def.name, b.x, b.y + 27);
        if (c.human && c.canPay(def.cost)) {
          // Ready to build: make it obvious
          ctx.strokeStyle = `rgba(243, 195, 90, ${0.6 + 0.4 * Math.sin(c.clock * 5)})`;
          ctx.lineWidth = 3;
          ctx.strokeRect(b.x - 26, b.y - 22, 52, 44);
        }
        emoji(ctx, def.emoji, b.x, b.y - 4, 16);
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
    if (b.key === "tavern") c.visitors.forEach((v, i) => {
      ctx.fillStyle = ORIGINS[v.origin].color;
      ctx.beginPath();
      ctx.arc(b.x - 16 + i * 16, b.y + 26, 6, 0, Math.PI * 2);
      ctx.fill();
    });
    if (b.key !== "tavern") label(ctx, def.name, b.x, b.y + 27);
  }

  for (const t of c.trees) {
    if (t.grown) emoji(ctx, "🌲", t.x, t.y, 28);
    else {
      ctx.fillStyle = "#6b4a2a";
      ctx.beginPath();
      ctx.arc(t.x, t.y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const k of c.rocks) {
    if (k.ore > 0) emoji(ctx, "🪨", k.x, k.y, 14 + k.ore * 4);
    else {
      ctx.fillStyle = "#6c6458";
      ctx.fillRect(k.x - 5, k.y, 10, 4);
    }
  }
  if (c.cfg.res.includes("crop")) {
    for (const q of c.plots) {
      ctx.fillStyle = "#6e4f2c";
      ctx.fillRect(q.x - 15, q.y - 12, 30, 24);
      emoji(ctx, q.growth >= 1 ? "🌾" : "🌱", q.x, q.y, 10 + q.growth * 12);
    }
  }

  for (const v of c.villagers) {
    ctx.fillStyle = ORIGINS[v.origin].color;
    ctx.beginPath();
    ctx.arc(v.x, v.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#2b1d12";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    emoji(ctx, JOBS[v.job].emoji, v.x, v.y, 11);
    const tag = v.sick ? "🤢" : v.blocked ? "❗" : c.cfg.hunger && v.hunger >= 60 ? "🍗" : v.carry ? ITEM_ICON[v.carry] : null;
    if (tag) emoji(ctx, tag, v.x + 10, v.y - 11, 11);
  }

  // Where the NEXT bar is pointing
  if (c.human && c.hintTarget) {
    const bob = Math.sin(c.clock * 6) * 4;
    emoji(ctx, "👇", c.hintTarget.x, c.hintTarget.y - 34 + bob, 22);
  }

  // The Founder
  const p = c.player;
  ctx.fillStyle = "rgba(201, 164, 92, 0.5)";
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 12, 13, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  emoji(ctx, c.emoji, p.x, p.y, 26);

  // The minigame bar: stop the marker inside the green
  if (c.mg) {
    const mg = c.mg;
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
}

// The prompt and messages around the Founder stay at normal size even when the camera zooms
function drawFounderText(ctx, c, vw) {
  if (!c.human) return;
  const p = c.player;
  const z = c.view.zoom;
  const sx = (p.x - c.view.x) * z;
  const sy = (p.y - c.view.y) * z;
  const prompt = c.mg ? "Press Space when the marker is in the green" : c.promptFor(c.targetAt(p));
  if (prompt) pill(ctx, prompt, sx, sy - (c.mg ? 58 : 32) * z, "#f3c35a", vw);
  if (c.msg) pill(ctx, c.msg.text, sx, sy + 26 * z, "#f3e6c9", vw);
}

// The race: a bar per resource toward the goal
function drawRace(ctx, c, x, w, highlight) {
  const res = c.cfg.res;
  text(ctx, c.tag, x, 12, 10, highlight ? "#f3c35a" : "#f08a6e");
  const x1 = x + 48;
  const seg = (w - 48) / res.length;
  res.forEach((item, i) => {
    const sx = x1 + i * seg;
    const n = Math.min(GOAL, c.total(item));
    emoji(ctx, ITEM_ICON[item], sx + 7, 12, 12);
    const bx = sx + 16;
    const bw = seg - 22;
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(bx, 5, bw, 14);
    ctx.fillStyle = n >= GOAL ? "#8fc25a" : "#5f8a3c";
    ctx.fillRect(bx, 5, (bw * n) / GOAL, 14);
    text(ctx, `${n}`, bx + bw / 2, 12, 9, "#f3e6c9", "center");
  });
}

function drawHud(ctx, r, c, vw, full) {
  // Top strip: the race to the goal (yours, and in full screen the rival's too)
  ctx.fillStyle = "rgba(28, 17, 10, 0.85)";
  ctx.fillRect(0, 0, vw, 24);
  if (full) {
    drawRace(ctx, c, 6, vw / 2 - 12, true);
    drawRace(ctx, r.cols[1 - c.side], vw / 2 + 6, vw / 2 - 12, false);
  } else {
    drawRace(ctx, c, 6, vw - 12, c.human);
  }

  // "Next step" bar: what to do now, worked out from the colony's actual state
  const hint = c.nextStep();
  ctx.fillStyle = "rgba(243, 230, 201, 0.9)";
  ctx.fillRect(0, 24, vw, 22);
  fitText(ctx, `NEXT: ${hint}`, 6, 35, 13, vw - 12, "#2b1d12");

  // Bottom strip: your bag, spare tools, and who's working
  ctx.fillStyle = "rgba(28, 17, 10, 0.85)";
  ctx.fillRect(0, H - BOT, vw, BOT);
  const y = H - 13;
  let x = 6;
  text(ctx, "BAG", x, y, 10, "#d4bd8f");
  x += 28;
  c.player.slots.forEach((s, i) => {
    ctx.strokeStyle = "#d4bd8f";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + i * 40, y - 9, 36, 18);
    if (s) {
      emoji(ctx, ITEM_ICON[s.item], x + i * 40 + 8, y, 10);
      text(ctx, String(s.n), x + i * 40 + 16, y, 9, "#f3e6c9");
    }
  });
  x += 166;
  const tools = [...new Set(c.cfg.roles.map((j) => JOBS[j].tool).filter(Boolean))];
  for (const tool of tools) {
    emoji(ctx, TOOL_ICON[tool], x + 7, y, 11);
    text(ctx, String(c.stock[tool]), x + 16, y, 10, "#d4bd8f");
    x += 32;
  }
  if (full) {
    x += 10;
    text(ctx, "WORKING", x, y, 10, "#d4bd8f");
    x += 58;
    for (const job of c.cfg.roles) {
      const n = c.workingCount(job);
      const hired = c.villagersIn(job).length;
      ctx.globalAlpha = hired ? 1 : 0.35;
      emoji(ctx, JOBS[job].emoji, x + 7, y, 12);
      text(ctx, hired ? `${n}` : "–", x + 16, y, 10, n < hired ? "#f08a6e" : "#f3e6c9");
      ctx.globalAlpha = 1;
      x += 30;
    }
  }
}

export default {
  id: "colony",
  title: "Life in the Colony",
  kicker: "Gather + build",
  accent: "var(--brass)",
  blurb: "Two rival colonies race to stockpile 1000 of everything.",
  howTo: [
    "Two colonies race on identical land. The first to stockpile 1000 of each resource (shown at the top) wins the round.",
    "Walk with the arrow keys and press Space at whatever you're standing next to. The yellow prompt above you says what Space will do.",
    "Gathering is a minigame: press Space again when the marker is in the green. Each success gives 20.",
    "To build: walk to a lot (the labelled squares), press Space to clear the vines, then Space again to build. It pays from your bag, then from the Hall. A lot glows yellow when you can afford it.",
    "Hire visitors at the Tavern. Each job needs someone from the right village, and gatherers need a tool from the Smithy. You can hire up to 3 of each gatherer.",
    "Workers' piles in their huts count toward your total. Everything you spend on buildings, tools and hiring has to be earned back, so grow the village, then let it out-gather you.",
    "Follow the 👇 arrow: it points at whatever the NEXT bar at the top is asking for.",
  ],
  width: W,
  height: H,
  sides: [
    {
      name: "Founder",
      emoji: SIDE_EMOJI[0],
      goal: "Grow your colony and be first to stockpile 1000 of each resource. Gather, build, hire at the Tavern, forge tools and let your workers out-gather the rival.",
      controls: { dirs: "walk", action: "work / build / hire — whatever you're standing at" },
      pointer: null,
      pad: { dirs: "four", action: "Act" },
      bot: (r, input, skill) => founderBot(r.cols[0], input, skill),
    },
    {
      name: "Rival",
      emoji: SIDE_EMOJI[1],
      goal: "Grow the rival colony and be first to stockpile 1000 of each resource. Same land, same rules — just faster.",
      controls: { dirs: "walk", action: "work / build / hire — whatever you're standing at" },
      pointer: null,
      pad: { dirs: "four", action: "Act" },
      bot: (r, input, skill) => founderBot(r.cols[1], input, skill),
    },
  ],
  createRound,
};
