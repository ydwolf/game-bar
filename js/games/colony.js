// Life in the Colony — Ready for Winter. A one-player arcade take on the colony sim in the
// Notion design docs.
//
// Each round is a year: spring, summer and autumn, then the first snow. Before it falls the
// colony must have enough people, a bed for each of them, and enough food and firewood to last
// the winter. Make it and the village carries on into a harder year; miss and the game is over.
//
// The heart of it is the design doc's core choice: do it yourself, or delegate it. You can chop,
// mine, farm, forge and build by hand, but hired villagers do it for you — once they have a
// workplace and a tool. Each year switches on a little more of the design, so a new player
// learns one thing at a time: gatherers → couriers and blacksmiths → builders → cooking,
// hunger and food poisoning (and a healer to treat it).
import { clamp, lerp, rand, chance, Clock } from "../util.js";
import { sfx } from "../sound.js";
import { sprite, icon, person, personIcon, building, groundTile } from "./colony-art.js";

const T = 36;
const W = 20 * T;
const H = 14 * T;
const HALL = { x: 9.5 * T, y: 7 * T };
const REACH = 34; // trees, rocks and crops
const BUILDING_REACH = 50; // the Hall, buildings and lots are bigger

const DAY = 20; // game seconds in a day (the colony runs at 0.75×, so ~27 real seconds)
const DAYS = 9; // three seasons of three days, then the first snow
const SEASONS = ["spring", "summer", "autumn"];

const YIELD = 2; // per minigame success, and per villager trip
const HIRE_FEE = 3; // wood
const TOOL_COST = { log: 1, stone: 1 };
const TOOL_DURABILITY = 8;
const HOUSE_COST = { log: 6, stone: 2 };
const BEDS_PER_HOUSE = 2;
const UPGRADE_COST = 6; // stone, to sharpen your own tools once a Blacksmith works the forge
const SLOT_STACK = 20;
const MAX_GATHERERS = 3; // of each gathering job
const FOOD_EACH = 6; // food each villager needs for the winter
const WOOD_EACH = 6; // firewood each villager needs for the winter
const POISON_CHANCE = 0.3; // eating raw food from the Hall; cooked meals are always safe

// What each job needs and where it works
const JOBS = {
  lumberjack: { name: "Lumberjack", building: "woodhut", tool: "axe", shirt: "#b0432f", shirt2: "#7a2a1e" },
  farmer: { name: "Farmer", building: "farm", tool: "hoe", shirt: "#5f8a3c", shirt2: "#3e5e26" },
  miner: { name: "Miner", building: "quarry", tool: "pickaxe", shirt: "#6c6c78", shirt2: "#4a4a54" },
  courier: { name: "Courier", building: "post", tool: null, shirt: "#3a6ea5", shirt2: "#264c74" },
  blacksmith: { name: "Blacksmith", building: "smithy", tool: null, shirt: "#4a3a30", shirt2: "#2e231c" },
  builder: { name: "Builder", building: "yard", tool: "hammer", shirt: "#d0802f", shirt2: "#9a5a1c" },
  cook: { name: "Cook", building: "kitchen", tool: null, shirt: "#e8e0d0", shirt2: "#b8ae9a" },
  healer: { name: "Healer", building: "healer", tool: null, shirt: "#7a5aa8", shirt2: "#55407a" },
};
const GATHERERS = ["lumberjack", "farmer", "miner"];
const JOB_ORDER = ["lumberjack", "farmer", "miner", "courier", "blacksmith", "builder", "cook", "healer"];
const VISITOR_SHIRT = "#8a6a4a";

const ITEM_WORD = { log: "wood", stone: "stone", food: "food", meal: "meals" };

const BUILDINGS = {
  tavern: { name: "Tavern", at: [8, 2.2], cost: { log: 4 }, year: 1, roof: "#a8402e", sign: "mug" },
  woodhut: { name: "Woodchopper Hut", at: [5.6, 7], cost: { log: 3 }, year: 1, store: "log", roof: "#6e4529", sign: "axe" },
  farm: { name: "Farm", at: [12.6, 9.6], cost: { log: 3 }, year: 1, store: "food", roof: "#c9953e", sign: "food" },
  quarry: { name: "Quarry Hut", at: [12, 2.2], cost: { log: 3 }, year: 1, store: "stone", roof: "#6c6c78", sign: "pickaxe", stone: true },
  smithy: { name: "Smithy", at: [12.6, 4.6], cost: { log: 3, stone: 2 }, year: 1, roof: "#3d3a3a", sign: "anvil", stone: true },
  post: { name: "Courier Post", at: [6.4, 4.6], cost: { log: 4 }, year: 2, roof: "#3a6ea5", sign: "box" },
  yard: { name: "Builder's Yard", at: [6.4, 9.6], cost: { log: 4, stone: 2 }, year: 3, roof: "#d0802f", sign: "hammer" },
  kitchen: { name: "Kitchen", at: [8, 12.1], cost: { log: 4, stone: 2 }, year: 4, roof: "#b85a18", sign: "meal" },
  healer: { name: "Healer's Hut", at: [11, 12.1], cost: { log: 4, stone: 2 }, year: 4, roof: "#e8e0d0", sign: "cross" },
};
const HOUSE_SPOTS = [[8.4, 9.3], [9.6, 9.3], [10.8, 9.3], [8.4, 10.6], [9.6, 10.6], [10.8, 10.6], [4.6, 11.2], [14, 7.2]];

// Each year asks for more people and more stores, and switches on more of the design
function yearCfg(year) {
  const jobs = ["lumberjack", "farmer", "miner"];
  if (year >= 2) jobs.push("courier", "blacksmith");
  if (year >= 3) jobs.push("builder");
  if (year >= 4) jobs.push("cook", "healer");
  const pop = Math.min(2 * year, 14);
  // From year 5 the winters get harsher: each person needs more food and firewood
  const harsh = Math.max(0, year - 4);
  return { year, jobs, hunger: year >= 4, pop, each: { food: FOOD_EACH + harsh, wood: WOOD_EACH + harsh }, food: pop * (FOOD_EACH + harsh), wood: pop * (WOOD_EACH + harsh) };
}

const NEW_IN_YEAR = {
  1: "Hire a Lumberjack, a Farmer and a Miner — they need tools from the Smithy.",
  2: "New: Couriers haul piles to the Hall; a Blacksmith makes tools for you.",
  3: "New: a Builder puts up houses on their own.",
  4: "New: villagers get hungry. Raw food can make them sick — a Cook makes safe meals, a Healer cures.",
  5: "From now on every winter is harsher: each person needs more food and firewood.",
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const aTool = (tool) => (tool === "axe" ? "an axe" : `a ${tool}`);
const tilePos = ([tx, ty]) => ({ x: tx * T, y: ty * T });
const costText = (cost) => Object.entries(cost).map(([k, n]) => `${n} ${ITEM_WORD[k]}`).join(" + ");

function scatter(n, x0, x1, y0, y1, minGap) {
  const pts = [];
  for (let tries = 0; pts.length < n && tries < 2000; tries++) {
    const p = { x: rand(x0, x1) * T, y: rand(y0, y1) * T };
    if (pts.every((q) => dist(p, q) >= minGap * T)) pts.push(p);
  }
  return pts;
}

// ---------- the colony: land, stores, villagers and you ----------

function createColony(input) {
  const c = {
    input,
    cfg: yearCfg(1),
    stock: { log: 6, stone: 2, food: 0, meal: 0, axe: 0, pickaxe: 0, hoe: 0, hammer: 0 },
    trees: scatter(18, 0.5, 3.6, 1.6, 12.6, 1.05).map((p) => ({ ...p, grown: true, regrow: 0, claimed: null })),
    rocks: scatter(8, 15.4, 19.5, 1.6, 3.9, 1.0).map((p) => ({ ...p, left: 3, regrow: 0, claimed: null })),
    crops: Array.from({ length: 8 }, (_, i) => ({ x: (15.6 + (i % 4) * 1.15) * T, y: (10.5 + Math.floor(i / 4) * 1.4) * T, growth: rand(0.4, 1), claimed: null })),
    buildings: {},
    houses: HOUSE_SPOTS.map((s) => ({ ...tilePos(s), built: false })),
    villagers: [],
    visitors: [],
    visitT: 2,
    player: { x: HALL.x, y: HALL.y + 1.15 * T, slots: [null, null, null, null], toolLevel: 1, face: 1, walk: 0 },
    mg: null, // your current minigame
    msg: null,
    clock: 0, // seconds into the year
    nextId: 1,
    hintTarget: null,
    view: null,
    over: null, // "ready" | "late" once the year has ended
  };
  for (const [key, b] of Object.entries(BUILDINGS)) {
    c.buildings[key] = { key, ...tilePos(b.at), vines: true, built: false, stock: 0 };
  }

  const say = (text) => (c.msg = { text, t: 2.4 });

  // ---------- reading the colony's state ----------

  const built = (key) => c.buildings[key].built;
  const unlocked = (key) => BUILDINGS[key].year <= c.cfg.year;
  const villagersIn = (job) => c.villagers.filter((v) => v.job === job);
  c.villagersIn = villagersIn;
  c.unlocked = unlocked;
  c.beds = () => c.houses.filter((h) => h.built).length * BEDS_PER_HOUSE;

  function isWorking(v) {
    if (v.sick) return false;
    const job = JOBS[v.job];
    if (!built(job.building)) return false;
    if (job.tool && !(v.tool && v.tool.dur > 0) && c.stock[job.tool] <= 0) return false;
    return true;
  }
  c.working = (job) => c.villagers.some((v) => v.job === job && isWorking(v));
  c.workingCount = (job) => c.villagers.filter((v) => v.job === job && isWorking(v)).length;

  // Everything the colony owns counts toward winter: the Hall, the huts' piles, the Kitchen and your bag
  c.total = (item) => {
    let n = c.stock[item] + bagCount(item);
    for (const b of Object.values(c.buildings)) if (BUILDINGS[b.key].store === item) n += b.stock;
    if (item === "meal") n += c.buildings.kitchen.stock;
    return n;
  };
  c.food = () => c.total("food") + c.total("meal");
  c.wood = () => c.total("log");

  // The four things winter asks for, each [have, need]
  c.needs = () => ({
    people: [c.villagers.length, c.cfg.pop],
    beds: [c.beds(), Math.max(c.cfg.pop, c.villagers.length)],
    food: [c.food(), Math.max(c.cfg.food, c.villagers.length * c.cfg.each.food)],
    wood: [c.wood(), Math.max(c.cfg.wood, c.villagers.length * c.cfg.each.wood)],
  });
  c.ready = () => Object.values(c.needs()).every(([have, need]) => have >= need);
  c.missing = () => {
    const n = c.needs();
    const out = [];
    if (n.people[0] < n.people[1]) out.push(`${n.people[1] - n.people[0]} more ${n.people[1] - n.people[0] === 1 ? "person" : "people"}`);
    if (n.beds[0] < n.beds[1]) out.push(`${n.beds[1] - n.beds[0]} more beds`);
    if (n.food[0] < n.food[1]) out.push(`${n.food[1] - n.food[0]} more food`);
    if (n.wood[0] < n.wood[1]) out.push(`${n.wood[1] - n.wood[0]} more wood`);
    return out;
  };

  // Calendar
  c.day = () => Math.min(DAYS, Math.floor(c.clock / DAY) + 1);
  c.season = () => SEASONS[Math.min(2, Math.floor((c.day() - 1) / 3))];
  c.daysLeft = () => Math.max(0, (DAYS * DAY - c.clock) / DAY);

  // Which tool the colony is shortest of: workers without one, minus spares at the Hall
  const toolsInPlay = () => [...new Set(c.cfg.jobs.map((j) => JOBS[j].tool).filter(Boolean))];
  c.toolNeeded = () => {
    let best = null;
    let bestGap = 0;
    for (const tool of toolsInPlay()) {
      const job = Object.keys(JOBS).find((j) => JOBS[j].tool === tool);
      const lacking = villagersIn(job).filter((v) => !(v.tool && v.tool.dur > 0)).length;
      const gap = lacking - c.stock[tool];
      if (gap > bestGap) {
        bestGap = gap;
        best = tool;
      }
    }
    return best;
  };

  // The next job the Tavern can fill: one of each job first, then extra gatherers
  c.openJob = () => {
    for (const job of JOB_ORDER) {
      if (c.cfg.jobs.includes(job) && built(JOBS[job].building) && villagersIn(job).length === 0) return job;
    }
    let best = null;
    for (const job of GATHERERS) {
      if (!built(JOBS[job].building)) continue;
      const n = villagersIn(job).length;
      if (n < MAX_GATHERERS && (!best || n < villagersIn(best).length)) best = job;
    }
    return best;
  };

  // ---------- your bag: four slots of up to twenty ----------

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

  // You pay from your bag first and the Hall for the rest — no trip to the Hall needed
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
  const haveText = (cost) => Object.keys(cost).map((k) => `${c.stock[k] + bagCount(k)} ${ITEM_WORD[k]}`).join(" + ");

  // Winter uses up stores: Kitchen meals and the Hall first, then the huts' piles, then your bag
  c.consume = (item, n) => {
    let left = n;
    const take = (have) => {
      const t = Math.min(have, left);
      left -= t;
      return have - t;
    };
    if (item === "meal") c.buildings.kitchen.stock = take(c.buildings.kitchen.stock);
    c.stock[item] = take(c.stock[item]);
    for (const b of Object.values(c.buildings)) if (BUILDINGS[b.key].store === item) b.stock = take(b.stock);
    for (const s of c.player.slots) if (s && s.item === item) s.n = take(s.n);
    c.player.slots = c.player.slots.map((s) => (s && s.n > 0 ? s : null));
    return n - left;
  };

  // ---------- what you're standing at ----------

  function interactables() {
    const list = [{ kind: "hall", obj: HALL, x: HALL.x, y: HALL.y, reach: BUILDING_REACH }];
    for (const t of c.trees) if (t.grown) list.push({ kind: "tree", obj: t, x: t.x, y: t.y - 10 });
    for (const k of c.rocks) if (k.left > 0) list.push({ kind: "rock", obj: k, x: k.x, y: k.y - 8 });
    for (const p of c.crops) if (p.growth >= 1) list.push({ kind: "crop", obj: p, x: p.x, y: p.y });
    for (const b of Object.values(c.buildings)) if (unlocked(b.key)) list.push({ kind: b.built ? "building" : "lot", obj: b, x: b.x, y: b.y, reach: BUILDING_REACH });
    for (const h of c.houses) if (!h.built) list.push({ kind: "house", obj: h, x: h.x, y: h.y, reach: 26 });
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
    const speed = 0.8 + 0.05 * Math.min(6, c.cfg.year - 1);
    c.mg = { kind, target, phase: 0, dir: 1, speed, cool: 0, zoneC: rand(0.25, 0.75), zoneW: 0.26 + 0.07 * (c.player.toolLevel - 1) };
  }

  function act() {
    const it = c.targetAt(c.player);
    if (!it) return say("Nothing to do here");
    const { kind, obj } = it;
    if (kind === "tree" || kind === "rock" || kind === "crop") {
      const item = { tree: "log", rock: "stone", crop: "food" }[kind];
      if (!c.bagHasRoom(item)) return say("Bag full — empty it at the Hall");
      return startMinigame(kind, obj);
    }
    if (kind === "hall") {
      if (c.ready()) {
        c.over = "ready";
        return;
      }
      let n = 0;
      c.player.slots.forEach((s, i) => {
        if (!s) return;
        c.stock[s.item] += s.n;
        n += s.n;
        c.player.slots[i] = null;
      });
      if (n) sfx("place");
      return say(n ? `Stored ${n} at the Hall` : "The Hall: your stockpile");
    }
    if (kind === "lot") {
      const def = BUILDINGS[obj.key];
      if (obj.vines) {
        obj.vines = false;
        sfx("chop");
        return say(`Cleared the ${def.name} lot — now build it here`);
      }
      if (!canPay(def.cost)) return fail(`The ${def.name} needs ${costText(def.cost)} — you have ${haveText(def.cost)}`);
      payBoth(def.cost);
      obj.built = true;
      sfx("place");
      return say(`Built the ${def.name}`);
    }
    if (kind === "house") {
      if (!canPay(HOUSE_COST)) return fail(`A house needs ${costText(HOUSE_COST)} — you have ${haveText(HOUSE_COST)}`);
      payBoth(HOUSE_COST);
      obj.built = true;
      sfx("place");
      return say(`Built a house: ${BEDS_PER_HOUSE} more beds`);
    }
    const def = BUILDINGS[obj.key];
    if (obj.key === "tavern") return hire();
    if (def.store && obj.stock > 0) {
      const took = bagAdd(def.store, obj.stock);
      obj.stock -= took;
      if (took) sfx("pickup");
      return say(took ? `Picked up ${took} ${ITEM_WORD[def.store]}` : "Bag full");
    }
    if (obj.key === "smithy") {
      if (c.working("blacksmith") && c.player.toolLevel < 3 && c.stock.stone >= UPGRADE_COST) {
        c.stock.stone -= UPGRADE_COST;
        c.player.toolLevel++;
        sfx("power");
        return say(`Your own tools are now level ${c.player.toolLevel} — a wider green zone`);
      }
      if (c.working("blacksmith")) return say("The Blacksmith has the forge");
      if (!c.toolNeeded()) return say("Nobody needs a tool right now");
      if (!canPay(TOOL_COST)) return fail(`A tool needs ${costText(TOOL_COST)}`);
      return startMinigame("forge", obj);
    }
    if (obj.key === "kitchen") {
      if (c.working("cook")) return say("The Cook has the kitchen");
      if (!canPay({ food: 2 })) return fail("Cooking needs 2 food");
      return startMinigame("cook", obj);
    }
    say(def.name);
  }

  function fail(text) {
    sfx("error");
    say(text);
  }

  function hire() {
    const tavern = c.buildings.tavern;
    const job = c.openJob();
    if (!job) return fail("No open jobs — build a workplace first");
    if (!c.visitors.length) return say("Nobody's visiting right now — they'll come");
    if (!canPay({ log: HIRE_FEE })) return fail(`Hiring costs ${HIRE_FEE} wood`);
    payBoth({ log: HIRE_FEE });
    c.visitors.shift();
    c.villagers.push({
      id: c.nextId++, job, x: tavern.x, y: tavern.y + 24,
      task: [], tool: null, carry: null, hunger: 0, sick: false, recover: 0, blocked: null, walk: 0,
    });
    sfx("coin");
    say(`Hired a ${JOBS[job].name}`);
  }

  function finishMinigame() {
    const { kind, target } = c.mg;
    c.mg = null;
    if (kind === "tree" && target.grown) {
      target.grown = false;
      target.regrow = 8;
      bagAdd("log", YIELD);
      sfx("chop");
    } else if (kind === "rock" && target.left > 0) {
      target.left--;
      if (!target.left) target.regrow = 10;
      bagAdd("stone", YIELD);
      sfx("thud");
    } else if (kind === "crop" && target.growth >= 1) {
      target.growth = 0;
      bagAdd("food", YIELD);
      sfx("pickup");
    } else if (kind === "forge") {
      const tool = c.toolNeeded();
      if (tool && canPay(TOOL_COST)) {
        payBoth(TOOL_COST);
        c.stock[tool]++;
        sfx("brick");
        say(`Forged ${aTool(tool)} — it's waiting at the Hall`);
      }
    } else if (kind === "cook" && canPay({ food: 2 })) {
      payBoth({ food: 2 });
      target.stock += 3;
      sfx("score");
      say("Cooked 3 safe meals from 2 food");
    }
  }

  // ---------- villagers: decide what to do next, then carry it out ----------
  // Deciding is the ordered list in decide(); doing is the task queue of walk/wait steps,
  // which any interruption can safely throw away.

  const walk = (p) => ({ type: "walk", x: p.x, y: p.y });
  const wait = (t, done) => ({ type: "wait", t, done });
  const idle = () => [walk({ x: HALL.x + rand(-40, 40), y: HALL.y + rand(34, 60) }), wait(1)];

  function release(v) {
    for (const list of [c.trees, c.rocks, c.crops]) for (const n of list) if (n.claimed === v) n.claimed = null;
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
    const kind = { lumberjack: "tree", miner: "rock", farmer: "crop" }[v.job];
    const list = { tree: c.trees, rock: c.rocks, crop: c.crops }[kind];
    const ready = { tree: (n) => n.grown, rock: (n) => n.left > 0, crop: (n) => n.growth >= 1 }[kind];
    const node = nearestFree(list, v, ready);
    if (!node) return null;
    node.claimed = v;
    const item = BUILDINGS[job.building].store;
    return [
      walk({ x: node.x, y: node.y + 4 }),
      wait(1.4, () => {
        node.claimed = null;
        if (!ready(node)) return false;
        if (kind === "tree") { node.grown = false; node.regrow = 8; }
        if (kind === "rock") { node.left--; if (!node.left) node.regrow = 10; }
        if (kind === "crop") node.growth = 0;
        v.tool.dur--;
        v.carry = item;
      }),
      walk({ x: hut.x, y: hut.y + 24 }),
      wait(0.2, () => { hut.stock += YIELD; v.carry = null; }),
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

  const takeFromHall = (cost) => wait(0.3, () => {
    if (!canAfford(cost)) return false;
    pay(cost);
  });

  const PROVIDERS = {
    lumberjack: gatherTask,
    farmer: gatherTask,
    miner: gatherTask,
    courier(v) {
      let hut = null;
      for (const key of ["woodhut", "quarry", "farm"]) {
        const b = c.buildings[key];
        if (b.built && b.stock > 0 && (!hut || b.stock > hut.stock)) hut = b;
      }
      if (!hut) return null;
      const item = BUILDINGS[hut.key].store;
      let load = 0;
      return [
        walk({ x: hut.x, y: hut.y + 24 }),
        wait(0.3, () => { load = Math.min(10, hut.stock); hut.stock -= load; v.carry = load ? item : null; }),
        walk(HALL),
        wait(0.3, () => { c.stock[item] += load; v.carry = null; }),
      ];
    },
    blacksmith() {
      const tool = c.toolNeeded();
      if (!tool || !canAfford(TOOL_COST)) return null;
      const smithy = c.buildings.smithy;
      return [walk(HALL), takeFromHall(TOOL_COST), walk({ x: smithy.x, y: smithy.y + 24 }), wait(2, () => { c.stock[tool]++; })];
    },
    builder(v) {
      const spot = c.houses.find((h) => !h.built);
      if (!spot || c.beds() >= Math.max(c.cfg.pop, c.villagers.length) || !canAfford(HOUSE_COST)) return null;
      return [walk(HALL), takeFromHall(HOUSE_COST), walk(spot), wait(3, () => { spot.built = true; v.tool.dur--; })];
    },
    cook() {
      const kitchen = c.buildings.kitchen;
      if (kitchen.stock >= 12 || !canAfford({ food: 2 })) return null;
      return [walk(HALL), takeFromHall({ food: 2 }), walk({ x: kitchen.x, y: kitchen.y + 24 }), wait(1.6, () => { kitchen.stock += 3; })];
    },
    healer: () => {
      const hut = c.buildings.healer;
      return [walk({ x: hut.x + rand(-14, 14), y: hut.y + 26 }), wait(1.5)];
    },
  };

  // Hungry villagers eat a safe Kitchen meal if there is one, otherwise raw food from the Hall
  function eatTask(v) {
    const kitchen = c.buildings.kitchen;
    if (built("kitchen") && kitchen.stock > 0) {
      return [walk({ x: kitchen.x, y: kitchen.y + 24 }), wait(0.8, () => {
        if (kitchen.stock <= 0) return false;
        kitchen.stock--;
        v.hunger = 0;
      })];
    }
    if (c.stock.food > 0) {
      return [walk(HALL), wait(0.8, () => {
        if (c.stock.food <= 0) return false;
        c.stock.food--;
        v.hunger = 0;
        if (chance(POISON_CHANCE)) {
          v.sick = true;
          v.recover = DAY;
          release(v);
          say("Food poisoning! Raw food made a villager sick");
        }
      })];
    }
    return null;
  }

  function decide(v) {
    v.blocked = null;
    const job = JOBS[v.job];
    if (c.cfg.hunger && v.hunger >= 60) {
      const eat = eatTask(v);
      if (eat) return eat;
    }
    if (!built(job.building)) return idle();
    if (job.tool && !(v.tool && v.tool.dur > 0)) return fetchTool(v, job.tool) || idle();
    return PROVIDERS[v.job](v, job) || idle();
  }

  function speedOf(v) {
    let s = 82;
    if (c.cfg.hunger && v.hunger >= 100) s *= 0.5; // starving
    if (c.villagers.indexOf(v) >= c.beds()) s *= 0.75; // no bed: tired
    if (v.sick) s *= 0.6;
    return s;
  }

  function moveToward(o, target, speed, dt) {
    const d = dist(o, target);
    const step = speed * dt;
    o.walk += dt;
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
    if (c.cfg.hunger) v.hunger = Math.min(100, v.hunger + (100 / (DAY * 1.5)) * dt);

    if (v.sick) {
      const hut = c.buildings.healer;
      if (c.working("healer")) {
        if (moveToward(v, { x: hut.x, y: hut.y + 24 }, speedOf(v), dt)) v.recover -= dt * 6; // a healer cures in a few seconds
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

  // ---------- explaining what to do ----------

  const WHERE = { log: "chop trees in the forest (left)", stone: "mine rocks in the quarry (top right)", food: "harvest the fields (bottom right)" };

  // What pressing Space will do where you're standing
  c.promptFor = (it) => {
    if (!it) return null;
    const { kind, obj } = it;
    if (kind === "tree") return `Space: chop (+${YIELD} wood)`;
    if (kind === "rock") return `Space: mine (+${YIELD} stone)`;
    if (kind === "crop") return `Space: harvest (+${YIELD} food)`;
    if (kind === "hall") {
      if (c.ready()) return "Space: settle in for winter now";
      return c.bagTotal() ? `Space: empty your bag into the Hall (${c.bagTotal()})` : "The Hall — your stockpile";
    }
    if (kind === "house") return canPay(HOUSE_COST) ? `Space: build a house, ${BEDS_PER_HOUSE} beds (${costText(HOUSE_COST)})` : `House: ${costText(HOUSE_COST)} — you have ${haveText(HOUSE_COST)}`;
    const def = BUILDINGS[obj.key];
    if (kind === "lot") {
      if (obj.vines) return `Space: clear the bushes off the ${def.name} lot`;
      return canPay(def.cost) ? `Space: build the ${def.name} (${costText(def.cost)})` : `${def.name}: ${costText(def.cost)} — you have ${haveText(def.cost)}`;
    }
    if (obj.key === "tavern") {
      const job = c.openJob();
      if (!job) return "Tavern: no open jobs — build a workplace";
      return c.visitors.length ? `Space: hire a ${JOBS[job].name} (${HIRE_FEE} wood)` : "Tavern: waiting for a visitor";
    }
    if (def.store && obj.stock > 0) return `Space: pick up ${obj.stock} ${ITEM_WORD[def.store]}`;
    if (obj.key === "smithy") {
      if (c.working("blacksmith")) return c.player.toolLevel < 3 ? `Space: sharpen your own tools (${UPGRADE_COST} stone)` : "The Blacksmith is at work";
      const tool = c.toolNeeded();
      return tool ? `Space: forge ${aTool(tool)} (${costText(TOOL_COST)})` : "Smithy: nobody needs a tool";
    }
    if (obj.key === "kitchen") return c.working("cook") ? "The Cook is at work" : "Space: cook 3 meals (2 food)";
    return def.name;
  };

  const nearestNode = (item) => {
    const pool = item === "log" ? c.trees.filter((t) => t.grown) : item === "stone" ? c.rocks.filter((k) => k.left > 0) : c.crops.filter((q) => q.growth >= 1);
    let best = null;
    for (const n of pool) if (!best || dist(n, c.player) < dist(best, c.player)) best = n;
    return best;
  };
  c.nearestNode = nearestNode;

  // Returns [what to do, where]
  function buildHint(key) {
    const lot = c.buildings[key];
    const def = BUILDINGS[key];
    if (lot.vines) return [`Walk to the ${def.name} lot (arrow) and press Space to clear it`, lot];
    if (canPay(def.cost)) return [`Build the ${def.name}: stand on its lot (arrow) and press Space`, lot];
    const k = Object.keys(def.cost).find((item) => c.stock[item] + bagCount(item) < def.cost[item]);
    return [`The ${def.name} needs ${costText(def.cost)} (you have ${haveText(def.cost)}) — ${WHERE[k]}`, nearestNode(k)];
  }

  function step() {
    if (c.ready()) return ["Ready for winter! Press Space at the Hall to settle in, or keep stocking up for next year", HALL];
    if (!built("tavern")) {
      const [t, at] = buildHint("tavern");
      return [`${t} — the Tavern is where you hire people`, at];
    }
    for (const job of c.cfg.jobs) {
      const key = JOBS[job].building;
      if (!built(key)) {
        const [t, at] = buildHint(key);
        return [`${t} — it's where a ${JOBS[job].name} works`, at];
      }
    }
    const toolless = c.villagers.find((v) => v.blocked && v.blocked.startsWith("no "));
    if (toolless) {
      const tool = toolless.blocked.slice(3);
      if (c.working("blacksmith")) return [`Your ${JOBS[toolless.job].name} needs ${aTool(tool)} — the Blacksmith makes it from ${costText(TOOL_COST)} in the Hall`, HALL];
      if (built("smithy")) return [`Your ${JOBS[toolless.job].name} needs ${aTool(tool)} — forge one at the Smithy (${costText(TOOL_COST)})`, c.buildings.smithy];
      const [t, at] = buildHint("smithy");
      return [`Your ${JOBS[toolless.job].name} needs ${aTool(tool)}, made at the Smithy. ${t}`, at];
    }
    const empty = c.cfg.jobs.find((j) => villagersIn(j).length === 0);
    if (empty) {
      return c.visitors.length
        ? [`Someone's at the Tavern — stand there and press Space to hire them as your ${JOBS[empty].name} (${HIRE_FEE} wood)`, c.buildings.tavern]
        : [`Waiting for a visitor at the Tavern to hire as your ${JOBS[empty].name} — gather meanwhile`, nearestNode(lowest())];
    }
    if (c.cfg.hunger && !c.working("cook") && c.buildings.kitchen.stock === 0 && c.villagers.some((v) => v.hunger >= 60)) {
      return ["People are hungry and raw food can make them sick — cook meals at the Kitchen (2 food → 3 meals)", c.buildings.kitchen];
    }
    const n = c.needs();
    if (n.beds[0] < n.beds[1]) {
      if (c.working("builder")) return [`Your Builder is putting up houses — keep ${costText(HOUSE_COST)} in the Hall for each`, HALL];
      const spot = c.houses.find((h) => !h.built);
      return canPay(HOUSE_COST)
        ? [`Everyone needs a bed: build a house on a house plot (arrow) — ${costText(HOUSE_COST)}`, spot]
        : [`Everyone needs a bed: a house costs ${costText(HOUSE_COST)} (you have ${haveText(HOUSE_COST)})`, nearestNode(c.stock.log + bagCount("log") < HOUSE_COST.log ? "log" : "stone")];
    }
    if (n.people[0] < n.people[1]) {
      const job = c.openJob();
      return c.visitors.length && job
        ? [`You need ${n.people[1]} people by winter — hire another ${JOBS[job].name} at the Tavern`, c.buildings.tavern]
        : [`You need ${n.people[1]} people by winter — wait for visitors at the Tavern`, c.buildings.tavern];
    }
    const low = lowest();
    return [`Stock up for winter: ${ITEM_WORD[low]} is furthest behind — ${WHERE[low]}`, nearestNode(low)];
  }

  // The winter store furthest from its goal
  function lowest() {
    const n = c.needs();
    return n.food[0] / n.food[1] < n.wood[0] / n.wood[1] ? "food" : "log";
  }
  c.lowest = lowest;

  c.nextStep = () => {
    const [text, at] = step();
    c.hintTarget = at || null;
    return text;
  };

  // ---------- one frame ----------

  c.update = (dt) => {
    const input = c.input;
    const prevDay = c.day();
    c.clock += dt;
    if (c.day() !== prevDay) sfx("tick");

    // Regrowth: fields grow faster once the Farm is built
    for (const t of c.trees) if (!t.grown && (t.regrow -= dt) <= 0) t.grown = true;
    for (const k of c.rocks) if (!k.left && (k.regrow -= dt) <= 0) k.left = 3;
    for (const p of c.crops) p.growth = Math.min(1, p.growth + dt / (built("farm") ? 9 : 15));

    // Visitors drift into the Tavern and wait a while
    if (built("tavern")) {
      c.visitT -= dt;
      if (c.visitT <= 0 && c.visitors.length < 2) {
        c.visitors.push({ stay: 25 });
        c.visitT = rand(3, 6);
      }
    }
    for (const v of c.visitors) v.stay -= dt;
    c.visitors = c.visitors.filter((v) => v.stay > 0);

    // You: walk and play the minigame
    const p = c.player;
    const mx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const my = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    if ((mx || my) && !c.mg) {
      const len = Math.hypot(mx, my);
      p.x = clamp(p.x + (mx / len) * 140 * dt, 10, W - 10);
      p.y = clamp(p.y + (my / len) * 140 * dt, 40, H - 12);
      if (mx) p.face = mx;
      p.walk += dt;
    }
    if (c.mg) {
      const mg = c.mg;
      if (mx || my || dist(p, mg.target) > BUILDING_REACH + 10) c.mg = null; // walking away cancels
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
            sfx("error", { volume: 0.5 });
          }
        }
      }
    } else if (input.pressed.action) {
      act();
    }

    for (const v of c.villagers) runVillager(v, dt);
    if (c.msg && (c.msg.t -= dt) <= 0) c.msg = null;

    if (!c.over && c.clock >= DAYS * DAY) c.over = c.ready() ? "ready" : "late";
  };

  // A new year: winter has eaten its share, the calendar restarts, and the goal grows
  c.newYear = (year, input) => {
    c.cfg = yearCfg(year);
    c.input = input;
    c.clock = 0;
    c.over = null;
    c.mg = null;
    c.visitors = [];
    c.player.x = HALL.x;
    c.player.y = HALL.y + 1.15 * T;
    for (const v of c.villagers) {
      release(v);
      v.sick = false;
      v.hunger = 0;
      v.x = HALL.x + rand(-40, 40);
      v.y = HALL.y + rand(34, 60);
    }
    for (const t of c.trees) t.grown = true;
    for (const k of c.rocks) k.left = 3;
  };

  return c;
}

// Winter eats food (meals first) and burns firewood
function winter(c) {
  const foodNeed = Math.max(c.cfg.food, c.villagers.length * c.cfg.each.food);
  const woodNeed = Math.max(c.cfg.wood, c.villagers.length * c.cfg.each.wood);
  const fromMeals = c.consume("meal", foodNeed);
  c.consume("food", foodNeed - fromMeals);
  c.consume("log", woodNeed);
}

// Starting at a later year (the level select): everything earlier years would have built
function headStart(c, year) {
  for (const b of Object.values(c.buildings)) {
    if (BUILDINGS[b.key].year < year) {
      b.vines = false;
      b.built = true;
    }
  }
  const pop = yearCfg(year - 1).pop;
  c.cfg = yearCfg(year - 1);
  for (let i = 0; i < pop; i++) {
    const job = c.openJob() || "lumberjack";
    const tool = JOBS[job].tool;
    c.villagers.push({
      id: c.nextId++, job, x: HALL.x + rand(-40, 40), y: HALL.y + rand(34, 60),
      task: [], tool: tool ? { type: tool, dur: TOOL_DURABILITY } : null, carry: null, hunger: 0, sick: false, recover: 0, blocked: null, walk: 0,
    });
  }
  for (let i = 0; i < Math.ceil(pop / BEDS_PER_HOUSE); i++) c.houses[i].built = true;
  c.cfg = yearCfg(year);
  c.stock.log += Math.round(c.cfg.wood / 2);
  c.stock.food += Math.round(c.cfg.food / 2);
  c.stock.stone += 6;
}

// ---------- the round: one year ----------

function createRound({ level, inputs, humans = [true, false], prev = null }) {
  let c;
  if (prev && prev.colony) {
    c = prev.colony;
    winter(c);
    c.newYear(level, inputs[0]);
  } else {
    c = createColony(inputs[0]);
    if (level > 1) headStart(c, level);
  }

  const r = {
    level,
    colony: c,
    human: humans[0],
    winner: null,
    endReason: "",
    roundLabel: `Year ${level}`,
    winTitle: "Ready for winter!",
    loseTitle: "Winter came too soon",
    timeScale: 0.75,
    countdown: 7,
    view: null,
    snow: 0, // 0..1 as the first snow settles
  };

  r.intro = () => {
    const n = c.needs();
    return [
      `The first snow falls in ${DAYS} days. Before it does, you need:`,
      `${n.people[1]} people · ${n.beds[1]} beds · ${n.food[1]} food · ${n.wood[1]} firewood`,
      "Hire people at the Tavern. Build houses for beds.",
      "Gather food and wood — or hire workers to gather for you.",
      NEW_IN_YEAR[level] || "Every year asks for more.",
      "Follow the NEXT bar and the yellow arrow.",
    ];
  };

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    if (c.over) {
      // Let the snow settle for a moment before the year's verdict
      r.snow = Math.min(1, r.snow + dt / 1.6);
      if (r.snow >= 1) {
        if (c.over === "ready") {
          r.winner = 0;
          r.endReason = `Everyone is housed, fed and warm. Year ${level + 1} will ask for more.`;
          sfx("win");
        } else {
          r.winner = 1;
          r.endReason = `The snow came and you still needed ${c.missing().join(", ")}.`;
          sfx("lose");
        }
      }
      return r.winner;
    }
    c.update(dt);
    return null;
  };

  r.status = () => {
    const n = c.needs();
    return `${cap(c.season())}, day ${c.day()} of ${DAYS} · People ${n.people[0]}/${n.people[1]} · Beds ${n.beds[0]}/${n.beds[1]} · Food ${n.food[0]}/${n.food[1]} · Wood ${n.wood[0]}/${n.wood[1]}`;
  };
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---------- a computer player, used only to tune the numbers (tests/colony-tune.js) ----------

function founderBot(r, input, skill) {
  const c = r.colony;
  const clock = new Clock(lerp(0.5, 0.15, skill));
  const lag = lerp(0.1, 0.03, skill);
  const tolerance = lerp(0.55, 0.8, skill);
  let goal = null;
  let pressCd = 0;
  const go = (obj) => ({ x: obj.x, y: obj.y });
  const gather = (item) => {
    const n = c.nearestNode(item);
    return n ? { x: n.x, y: n.y - (item === "log" ? 10 : item === "stone" ? 8 : 0) } : null;
  };

  function plan() {
    const carried = c.bagTotal();
    const have = (item) => c.stock[item] + c.bagCount(item);
    const toHall = go(HALL);
    if (c.ready()) return toHall;
    if (carried >= 16) return toHall;

    const job = c.openJob();
    const n = c.needs();
    if (job && c.buildings.tavern.built && c.visitors.length && c.villagers.length < n.people[1] + 2) {
      if (have("log") >= HIRE_FEE) return go(c.buildings.tavern);
    }
    if (c.toolNeeded() && !c.working("blacksmith") && c.buildings.smithy.built && c.canPay(TOOL_COST)) return go(c.buildings.smithy);
    if (c.cfg.hunger && !c.working("cook") && c.buildings.kitchen.built && c.buildings.kitchen.stock < 3 && c.canPay({ food: 2 })) return go(c.buildings.kitchen);

    const order = ["tavern", "woodhut", "farm", "smithy", "quarry", "post", "yard", "kitchen", "healer"];
    const next = order.find((k) => c.unlocked(k) && !c.buildings[k].built);
    if (next) {
      const lot = c.buildings[next];
      const cost = BUILDINGS[next].cost;
      if (lot.vines || c.canPay(cost)) return go(lot);
      const missing = Object.keys(cost).find((k) => have(k) < cost[k]);
      return gather(missing) || toHall;
    }
    if (n.beds[0] < n.beds[1] && !c.working("builder")) {
      const spot = c.houses.find((h) => !h.built);
      if (spot && c.canPay(HOUSE_COST)) return go(spot);
      return gather(have("log") < HOUSE_COST.log ? "log" : "stone") || toHall;
    }
    if (!c.working("courier")) {
      const hut = ["woodhut", "quarry", "farm"].map((k) => c.buildings[k]).find((b) => b.built && b.stock >= 8);
      if (hut && carried < 10) return { x: hut.x, y: hut.y };
    }
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

const TOP = 48; // calendar + checklist strip, then the NEXT bar
const BOT = 28; // bag, tools and workers
const ZOOM = 1.8;
const INK = "#2b1d12";
const CREAM = "#f3e6c9";
const SHADE = "rgba(28, 17, 10, 0.86)";

function text(ctx, str, x, y, size, color, align = "left") {
  ctx.font = `${size}px "Special Elite", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
}

function fitText(ctx, str, x, y, max, maxW, color) {
  ctx.font = `${max}px "Special Elite", monospace`;
  const size = Math.max(7, Math.min(max, Math.floor((max * maxW) / ctx.measureText(str).width)));
  text(ctx, str, x, y, size, color);
}

function label(ctx, str, x, y) {
  ctx.font = '9px "Special Elite", monospace';
  const w = ctx.measureText(str).width + 6;
  ctx.fillStyle = "rgba(243, 230, 201, 0.85)";
  ctx.fillRect(Math.round(x - w / 2), Math.round(y - 6), Math.round(w), 12);
  text(ctx, str, x, y, 9, INK, "center");
}

// A text pill that shrinks to fit the screen
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

// A pixel arrow pointing down at (x, y)
function arrowDown(ctx, x, y) {
  const px = 3;
  const rows = ["..kkk..", "..kyk..", "..kyk..", "kkkykkk", ".kyyyk.", "..kyk..", "...k..."];
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      if (row[i] === ".") continue;
      ctx.fillStyle = row[i] === "k" ? INK : "#f3c35a";
      ctx.fillRect(Math.round(x + (i - 3.5) * px), Math.round(y + (j - 7) * px), px, px);
    }
  });
}

function draw(ctx, r) {
  const c = r.colony;
  const vh = (H - TOP - BOT) / ZOOM;
  const vw = W / ZOOM;
  c.view = {
    zoom: ZOOM,
    x: clamp(c.player.x - vw / 2, 0, W - vw),
    y: clamp(c.player.y - 20 - vh / 2, 0, H - vh) - TOP / ZOOM,
  };
  r.view = null; // no cursors to place
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#3d2616";
  ctx.fillRect(0, 0, W, H);
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-c.view.x, -c.view.y);
  drawWorld(ctx, c, r);
  ctx.restore();
  drawDusk(ctx, c);
  drawSnow(ctx, c, r);
  drawPlayerText(ctx, c);
  drawHud(ctx, c);
  drawMinimap(ctx, c);
  if (c.hintTarget && !c.over) drawEdgeArrow(ctx, c);
}

// Evening light at the end of each day, so days are felt as well as counted
function drawDusk(ctx, c) {
  const f = (c.clock % DAY) / DAY;
  const a = f > 0.8 ? (f - 0.8) * 1.2 : 0;
  if (a <= 0) return;
  ctx.fillStyle = `rgba(40, 20, 60, ${a})`;
  ctx.fillRect(0, TOP, W, H - TOP - BOT);
}

// Flurries late in autumn, then the first snow settling over everything
function drawSnow(ctx, c, r) {
  const left = c.daysLeft();
  const flurry = c.over ? 1 : left < 1.5 ? (1.5 - left) / 1.5 : 0;
  if (flurry > 0) {
    const n = Math.round(90 * flurry);
    for (let i = 0; i < n; i++) {
      const speed = 22 + (i % 5) * 9;
      const x = (i * 97.3 + Math.sin(c.clock * 0.8 + i) * 14 + c.clock * 6) % W;
      const y = TOP + ((i * 53.7 + c.clock * speed) % (H - TOP - BOT));
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(x), Math.round(y), i % 3 === 0 ? 3 : 2, i % 3 === 0 ? 3 : 2);
    }
  }
  if (r.snow > 0) {
    ctx.fillStyle = `rgba(236, 244, 250, ${0.85 * r.snow})`;
    ctx.fillRect(0, TOP, W, H - TOP - BOT);
  }
}

function drawEdgeArrow(ctx, c) {
  const z = c.view.zoom;
  const sx = (c.hintTarget.x - c.view.x) * z;
  const sy = (c.hintTarget.y - c.view.y) * z;
  const top = TOP + 4;
  const bottom = H - BOT - 8;
  if (sx > 20 && sx < W - 20 && sy > top && sy < bottom) return; // on screen: the arrow above it is enough
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

function drawZones(ctx, c) {
  const season = c.over ? "winter" : c.season();
  ctx.fillStyle = ctx.createPattern(groundTile(season), "repeat");
  ctx.fillRect(0, 0, W, H);
  // Forest floor, the quarry's gravel and the tilled fields
  ctx.fillStyle = "rgba(30, 60, 25, 0.28)";
  ctx.fillRect(0, 0, 4.2 * T, H);
  ctx.fillStyle = "#8a8378";
  ctx.fillRect(15 * T, 0, 5 * T, 4.6 * T);
  ctx.fillStyle = "#77706a";
  for (let i = 0; i < 70; i++) ctx.fillRect(15 * T + ((i * 37) % (5 * T)), (i * 23) % Math.round(4.6 * T), 2, 2);
  ctx.fillStyle = "#6e4f2c";
  ctx.fillRect(15 * T, 9.6 * T, 5 * T, 4.4 * T);
  ctx.fillStyle = "#5a3f22";
  for (let y = 9.6 * T + 4; y < H; y += 8) ctx.fillRect(15 * T, y, 5 * T, 2);
  // A dirt path from the Hall to each part of the map
  ctx.fillStyle = "rgba(150, 110, 60, 0.45)";
  ctx.fillRect(4.2 * T, HALL.y + 22, 10.8 * T, 14);
  ctx.fillRect(HALL.x - 7, 2.2 * T + 20, 14, HALL.y - 2.2 * T);
  ctx.fillRect(HALL.x - 7, HALL.y + 22, 14, 4.8 * T);
}

function drawWorld(ctx, c, r) {
  drawZones(ctx, c);

  // Things are drawn back to front by their feet, so nearer things overlap farther ones
  const items = [];
  const add = (y, fn) => items.push({ y, fn });

  // The Hall
  add(HALL.y + 26, () => {
    building(ctx, HALL.x, HALL.y, { w: 70, h: 54, roof: "#7a2e22", stone: true });
    label(ctx, "HALL", HALL.x, HALL.y + 34);
  });

  for (const b of Object.values(c.buildings)) {
    const def = BUILDINGS[b.key];
    if (!c.unlocked(b.key)) continue;
    if (!b.built) {
      add(b.y - 30, () => drawLot(ctx, c, b, def));
      continue;
    }
    add(b.y + 20, () => {
      building(ctx, b.x, b.y, { w: 52, h: 42, roof: def.roof, sign: def.sign, stone: def.stone });
      label(ctx, def.name, b.x, b.y + 30);
      if (def.store && b.stock > 0) {
        icon(ctx, def.store, b.x - 30, b.y + 12, 12);
        text(ctx, String(b.stock), b.x - 22, b.y + 12, 10, CREAM);
      }
      if (b.key === "kitchen" && b.stock > 0) {
        icon(ctx, "meal", b.x - 30, b.y + 12, 12);
        text(ctx, String(b.stock), b.x - 22, b.y + 12, 10, CREAM);
      }
      if (b.key === "tavern") {
        c.visitors.forEach((v, i) => person(ctx, b.x - 14 + i * 22, b.y + 46, { shirt: VISITOR_SHIRT, shirt2: "#5e4630", scale: 1.5 }));
      }
    });
  }

  for (const h of c.houses) {
    if (h.built) add(h.y + 14, () => sprite(ctx, "house", h.x, h.y + 16, 2));
    else add(h.y - 30, () => drawHousePlot(ctx, c, h));
  }

  for (const t of c.trees) add(t.y, () => sprite(ctx, t.grown ? "tree" : "stump", t.x, t.y + 4, 2.2));
  for (const k of c.rocks) add(k.y, () => sprite(ctx, k.left > 0 ? "rock" : "rubble", k.x, k.y + 4, 1.6 + 0.2 * k.left));
  for (const q of c.crops) {
    add(q.y - 20, () => {
      ctx.fillStyle = "#4a3418";
      ctx.fillRect(q.x - 16, q.y - 10, 32, 22);
      ctx.fillStyle = "#6e4f2c";
      ctx.fillRect(q.x - 14, q.y - 8, 28, 18);
      if (q.growth >= 1) sprite(ctx, "crop", q.x, q.y + 12, 1.6);
      else if (q.growth > 0.35) sprite(ctx, "sprout", q.x, q.y + 12, 1.6);
    });
  }

  for (const v of c.villagers) {
    add(v.y, () => {
      const job = JOBS[v.job];
      const bob = Math.sin(v.walk * 14) > 0 ? -1 : 0;
      person(ctx, v.x, v.y, { shirt: job.shirt, shirt2: job.shirt2, scale: 1.5, bob });
      const tag = v.sick ? "sick" : v.blocked ? "alert" : c.cfg.hunger && v.hunger >= 60 ? "hungry" : v.carry || null;
      if (tag) icon(ctx, tag, v.x + 10, v.y - 26, 10);
    });
  }

  // You
  const p = c.player;
  add(p.y, () => {
    ctx.fillStyle = "rgba(243, 195, 90, 0.45)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const bob = Math.sin(p.walk * 14) > 0 ? -1 : 0;
    person(ctx, p.x, p.y, { shirt: "#c94a3a", shirt2: "#8f2f22", hat: true, scale: 2, bob });
  });

  items.sort((a, b) => a.y - b.y);
  for (const it of items) it.fn();

  // Where the NEXT bar is pointing
  if (c.hintTarget && !c.over) arrowDown(ctx, c.hintTarget.x, c.hintTarget.y - 30 + Math.sin(c.clock * 6) * 3);

  // The minigame bar: stop the marker inside the green
  if (c.mg) {
    const mg = c.mg;
    const bx = clamp(p.x - 40, 4, W - 84);
    const by = p.y - 50;
    ctx.fillStyle = INK;
    ctx.fillRect(bx - 2, by - 2, 84, 12);
    ctx.fillStyle = mg.cool > 0 ? "#b8442e" : "#d4bd8f";
    ctx.fillRect(bx, by, 80, 8);
    ctx.fillStyle = "#5f8a3c";
    ctx.fillRect(bx + (mg.zoneC - mg.zoneW / 2) * 80, by, mg.zoneW * 80, 8);
    ctx.fillStyle = INK;
    ctx.fillRect(Math.round(bx + mg.phase * 80 - 1.5), by - 3, 3, 14);
  }
}

function drawCost(ctx, cost, x, y) {
  const entries = Object.entries(cost);
  let cx = x - (entries.length * 24) / 2 + 6;
  for (const [k, n] of entries) {
    icon(ctx, k, cx, y, 10);
    text(ctx, String(n), cx + 7, y, 9, INK);
    cx += 24;
  }
}

function drawLot(ctx, c, b, def) {
  ctx.strokeStyle = "rgba(243, 230, 201, 0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.strokeRect(b.x - 26, b.y - 22, 52, 44);
  ctx.setLineDash([]);
  if (b.vines) {
    sprite(ctx, "bush", b.x - 8, b.y + 12, 1.6);
    sprite(ctx, "bush", b.x + 10, b.y + 16, 1.4);
  } else {
    if (c.canPay(def.cost)) {
      // Ready to build: make it obvious
      ctx.strokeStyle = `rgba(243, 195, 90, ${0.6 + 0.4 * Math.sin(c.clock * 5)})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - 28, b.y - 24, 56, 48);
    }
    ctx.fillStyle = "rgba(243, 230, 201, 0.75)";
    ctx.fillRect(b.x - 24, b.y - 4, 48, 14);
    drawCost(ctx, def.cost, b.x, b.y + 3);
  }
  label(ctx, def.name, b.x, b.y + 30);
}

function drawHousePlot(ctx, c, h) {
  ctx.strokeStyle = "rgba(243, 230, 201, 0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(h.x - 16, h.y - 14, 32, 30);
  ctx.setLineDash([]);
  if (c.canPay(HOUSE_COST) && c.beds() < Math.max(c.cfg.pop, c.villagers.length)) {
    ctx.strokeStyle = `rgba(243, 195, 90, ${0.5 + 0.4 * Math.sin(c.clock * 5)})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(h.x - 18, h.y - 16, 36, 34);
  }
  icon(ctx, "bed", h.x, h.y, 14);
}

// The prompt and messages around you stay at normal size even though the camera zooms
function drawPlayerText(ctx, c) {
  const p = c.player;
  const z = c.view.zoom;
  const sx = (p.x - c.view.x) * z;
  const sy = (p.y - c.view.y) * z;
  const prompt = c.mg ? "Press Space when the marker is in the green" : c.promptFor(c.targetAt(p));
  if (prompt && !c.over) pill(ctx, prompt, sx, sy - (c.mg ? 120 : 82), "#f3c35a");
  if (c.msg) pill(ctx, c.msg.text, sx, sy + 22, CREAM);
}

function drawMinimap(ctx, c) {
  const s = 0.18;
  const mw = W * s;
  const mh = H * s;
  const x0 = W - mw - 8;
  const y0 = H - BOT - mh - 8;
  ctx.save();
  ctx.fillStyle = SHADE;
  ctx.fillRect(x0 - 3, y0 - 3, mw + 6, mh + 6);
  ctx.translate(x0, y0);
  ctx.scale(s, s);
  ctx.fillStyle = "#6f9447";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#3f6a2e";
  ctx.fillRect(0, 0, 4.2 * T, H);
  ctx.fillStyle = "#8a8378";
  ctx.fillRect(15 * T, 0, 5 * T, 4.6 * T);
  ctx.fillStyle = "#6e4f2c";
  ctx.fillRect(15 * T, 9.6 * T, 5 * T, 4.4 * T);
  ctx.fillStyle = "#7a2e22";
  ctx.fillRect(HALL.x - 30, HALL.y - 26, 60, 52);
  for (const b of Object.values(c.buildings)) {
    if (!c.unlocked(b.key)) continue;
    ctx.fillStyle = b.built ? BUILDINGS[b.key].roof : "rgba(40, 70, 30, 0.9)";
    ctx.fillRect(b.x - 22, b.y - 18, 44, 36);
  }
  for (const h of c.houses) if (h.built) {
    ctx.fillStyle = "#a8402e";
    ctx.fillRect(h.x - 14, h.y - 12, 28, 24);
  }
  ctx.fillStyle = CREAM;
  for (const v of c.villagers) ctx.fillRect(v.x - 9, v.y - 9, 18, 18);
  ctx.fillStyle = "#f3c35a";
  ctx.fillRect(c.player.x - 16, c.player.y - 16, 32, 32);
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 8;
  ctx.strokeRect(c.view.x, c.view.y + TOP / c.view.zoom, W / c.view.zoom, (H - TOP - BOT) / c.view.zoom);
  ctx.restore();
}

function drawHud(ctx, c) {
  // Top strip: the calendar on the left, winter's checklist on the right
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, 0, W, 26);
  const season = c.season();
  text(ctx, `${season.toUpperCase()}  DAY ${c.day()}/${DAYS}`, 8, 13, 11, CREAM);
  // Calendar bar: three season bands filling toward the snowflake
  const bx = 150;
  const bw = 150;
  const bands = ["#7aa04e", "#c9b048", "#c07a32"];
  bands.forEach((col, i) => {
    ctx.fillStyle = "#3a2418";
    ctx.fillRect(bx + (i * bw) / 3, 7, bw / 3 - 2, 12);
  });
  const frac = Math.min(1, c.clock / (DAYS * DAY));
  bands.forEach((col, i) => {
    const segStart = i / 3;
    const fill = clamp((frac - segStart) * 3, 0, 1);
    ctx.fillStyle = col;
    ctx.fillRect(bx + (i * bw) / 3, 7, (bw / 3 - 2) * fill, 12);
  });
  icon(ctx, "snow", bx + bw + 10, 13, 14);

  const needs = c.needs();
  const cells = [
    ["person", needs.people, "people"],
    ["bed", needs.beds, "beds"],
    ["food", needs.food, "food"],
    ["log", needs.wood, "wood"],
  ];
  let x = 340;
  text(ctx, "WINTER:", x, 13, 10, "#d4bd8f");
  x += 56;
  for (const [ic, [have, need]] of cells) {
    const ok = have >= need;
    ctx.fillStyle = ok ? "#5f8a3c" : "rgba(184, 68, 46, 0.8)";
    ctx.fillRect(x, 4, 76, 18);
    if (ic === "person") personIcon(ctx, x + 10, 13, 14, "#c94a3a");
    else icon(ctx, ic, x + 10, 13, 14);
    text(ctx, `${Math.min(have, 999)}/${need}`, x + 20, 13, 11, CREAM);
    x += 80;
  }

  // NEXT bar
  const hint = c.nextStep();
  const ready = c.ready();
  ctx.fillStyle = ready ? "rgba(201, 224, 138, 0.95)" : "rgba(243, 230, 201, 0.94)";
  ctx.fillRect(0, 26, W, 22);
  fitText(ctx, `NEXT: ${hint}`, 6, 37, 13, W - 12, INK);

  // Bottom strip: your bag, spare tools at the Hall, and who's working
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, H - BOT, W, BOT);
  const y = H - BOT / 2;
  x = 8;
  text(ctx, "BAG", x, y, 10, "#d4bd8f");
  x += 30;
  c.player.slots.forEach((s, i) => {
    ctx.strokeStyle = "#d4bd8f";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + i * 40 + 0.5, y - 9.5, 36, 19);
    if (s) {
      icon(ctx, s.item, x + i * 40 + 9, y, 12);
      text(ctx, String(s.n), x + i * 40 + 18, y, 10, CREAM);
    }
  });
  x += 172;
  text(ctx, "TOOLS", x, y, 10, "#d4bd8f");
  x += 44;
  const tools = [...new Set(c.cfg.jobs.map((j) => JOBS[j].tool).filter(Boolean))];
  for (const tool of tools) {
    icon(ctx, tool, x + 7, y, 12);
    text(ctx, String(c.stock[tool]), x + 16, y, 10, CREAM);
    x += 32;
  }
  x += 10;
  text(ctx, "WORKERS", x, y, 10, "#d4bd8f");
  x += 60;
  for (const job of c.cfg.jobs) {
    const hired = c.villagersIn(job).length;
    const n = c.workingCount(job);
    ctx.globalAlpha = hired ? 1 : 0.35;
    personIcon(ctx, x + 6, y, 13, JOBS[job].shirt);
    text(ctx, hired ? String(n) : "-", x + 15, y, 10, n < hired ? "#f08a6e" : CREAM);
    ctx.globalAlpha = 1;
    x += 28;
  }
}

export default {
  id: "colony",
  title: "Life in the Colony",
  kicker: "Ready for winter",
  accent: "var(--brass)",
  blurb: "Grow a frontier village and get everyone housed, fed and warm before the first snow.",
  solo: true,
  levelSelect: 6,
  levelName: (n) => `Year ${n}`,
  scoreText: (n) => `Winters survived: ${n}`,
  howTo: [
    "Each round is a year. The first snow falls after 9 days — before it does, you need enough people, a bed for each, and enough food and firewood. The WINTER boxes at the top turn green as you get there.",
    "Walk with the arrow keys and press Space at whatever you're standing next to. The yellow prompt above you says what Space will do.",
    "Gathering is a timing game: press Space again when the marker is in the green.",
    "Build on a lot by pressing Space to clear it, then Space again. Hire people at the Tavern. Workers need a tool from the Smithy, then gather for you.",
    "Follow the NEXT bar and the yellow arrow — they always say what to do next.",
    "Make it and the village carries on into a harder year. How many winters can you last?",
  ],
  width: W,
  height: H,
  sides: [
    {
      name: "Founder",
      emoji: "🏡",
      goal: "Before the first snow: enough people, a bed for each, and enough food and firewood. Every year asks for more.",
      controls: { dirs: "walk", action: "work / build / hire — whatever you're standing at" },
      pointer: null,
      pad: { dirs: "four", action: "Act" },
      bot: founderBot,
    },
  ],
  createRound,
};
