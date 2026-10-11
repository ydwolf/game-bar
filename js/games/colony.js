// Life in the Colony — Arcade Demo. A timed one-player run built from the Notion design docs.
//
// Collect three trophies as fast as you can; your time is your score.
//   Resource Master — build the sculpture (10,000 wood and 10,000 stone at the Hall)
//   Perfect Tomato  — breed a 10/10/10/10 seed at the seed bench
//   Raid            — fight through the raid room with your soldiers
//
// You can do every job yourself, but villagers are faster: hire them at the Tavern, give them
// a building to work in (one per hut — build as many huts as you like), and better tools from
// the Smithy multiply what they bring back. That's the engine that gets you to the trophies.
//
// The world is five zones you walk between: the village in the middle, the forest to the west,
// the mine to the north, the farm to the south and the raid room to the east.
//
// Files: colony-config.js (every number, all placeholders), colony-raid.js (the fight),
// colony-draw.js (everything on screen), colony-art.js (the shapes).
import { clamp, rand } from "../util.js";
import { sfx } from "../sound.js";
import { CONFIG as K } from "./colony-config.js";
import { startRaid, updateRaid } from "./colony-raid.js";
import { draw } from "./colony-draw.js";

export const W = 720; // the screen, in game units
export const H = 504;

export const ZONES = {
  village: { name: "Village", w: 1440, h: 1008, zoom: 1.4 },
  forest: { name: "Forest", w: 1440, h: 1008, zoom: 1.4 },
  mine: { name: "Mine", w: 1440, h: 1008, zoom: 1.4 },
  farm: { name: "Farm", w: 1440, h: 1008, zoom: 1.4 },
  raid: { name: "Raid Room", w: 720, h: 428, zoom: 1 },
};

// Doorways between zones: walk into one and you arrive at the matching doorway on the other side
export const EXITS = [
  { zone: "village", x: 0, y: 444, w: 22, h: 120, to: "forest", arrive: { x: 1395, y: 504 } },
  { zone: "village", x: 660, y: 0, w: 120, h: 22, to: "mine", arrive: { x: 720, y: 960 } },
  { zone: "village", x: 660, y: 986, w: 120, h: 22, to: "farm", arrive: { x: 720, y: 50 } },
  { zone: "village", x: 1418, y: 444, w: 22, h: 120, to: "raid", arrive: { x: 50, y: 214 } },
  { zone: "forest", x: 1418, y: 444, w: 22, h: 120, to: "village", arrive: { x: 45, y: 504 } },
  { zone: "mine", x: 660, y: 986, w: 120, h: 22, to: "village", arrive: { x: 720, y: 50 } },
  { zone: "farm", x: 660, y: 0, w: 120, h: 22, to: "village", arrive: { x: 720, y: 960 } },
  { zone: "raid", x: 0, y: 160, w: 22, h: 110, to: "village", arrive: { x: 1395, y: 504 } },
];
export const exitCenter = (e) => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });

// What can be built, where, and who works there. `slots` is how many villagers a building
// employs (huts take one each — build more huts for more output).
export const BUILDINGS = {
  hall: { name: "Hall", zone: "village", w: 84, h: 64, roof: "#7a2e22", stone: true },
  tavern: { name: "Tavern", zone: "village", w: 64, h: 50, roof: "#a8402e", sign: "mug" },
  sculpture: { name: "Sculpture plinth", zone: "village", w: 50, h: 50 },
  bench: { name: "Seed Bench", zone: "farm", w: 56, h: 36 },
  gate: { name: "Raid Gate", zone: "raid", w: 70, h: 90 },
  post: { name: "Courier Post", zone: "village", w: 52, h: 42, roof: "#3a6ea5", sign: "box", job: "courier", slots: 1, cost: { log: 25 } },
  smithy: { name: "Smithy", zone: "village", w: 56, h: 44, roof: "#3d3a3a", sign: "anvil", stone: true, job: "blacksmith", slots: 1, cost: { log: 30, stone: 10 } },
  kitchen: { name: "Kitchen", zone: "village", w: 52, h: 42, roof: "#b85a18", sign: "meal", job: "cook", slots: 1, cost: { log: 30, stone: 10 } },
  healer: { name: "Healer's Hut", zone: "village", w: 52, h: 42, roof: "#e8e0d0", sign: "cross", job: "healer", slots: 1, cost: { log: 30, stone: 10 } },
  barracks: { name: "Barracks", zone: "village", w: 64, h: 48, roof: "#55402a", sign: "sword", stone: true, job: "soldier", slots: K.raid.soldiersPerBarracks, cost: { log: 60, stone: 30 } },
  woodhut: { name: "Woodchopper Hut", zone: "forest", w: 50, h: 40, roof: "#6e4529", sign: "axe", job: "woodcutter", slots: 1, store: "log", cost: { log: 15 } },
  quarry: { name: "Quarry Hut", zone: "mine", w: 50, h: 40, roof: "#6c6c78", sign: "pickaxe", stone: true, job: "miner", slots: 1, store: "stone", cost: { log: 20 } },
  farmhouse: { name: "Farmhouse", zone: "farm", w: 54, h: 42, roof: "#c9953e", sign: "tomato", job: "farmer", slots: 1, store: "tomato", cost: { log: 25 } },
  plot: { name: "Tomato Plot", zone: "farm", w: 34, h: 26, cost: { log: 5 } },
};
const BUILDABLE = Object.keys(BUILDINGS).filter((k) => BUILDINGS[k].cost);

export const JOBS = {
  woodcutter: { name: "Woodcutter", shirt: "#b0432f", shirt2: "#7a2a1e", tool: "axe" },
  miner: { name: "Miner", shirt: "#6c6c78", shirt2: "#4a4a54", tool: "pickaxe" },
  farmer: { name: "Farmer", shirt: "#5f8a3c", shirt2: "#3e5e26", tool: null },
  courier: { name: "Courier", shirt: "#3a6ea5", shirt2: "#264c74", tool: null },
  blacksmith: { name: "Blacksmith", shirt: "#4a3a30", shirt2: "#2e231c", tool: null },
  cook: { name: "Cook", shirt: "#e8e0d0", shirt2: "#b8ae9a", tool: null },
  healer: { name: "Healer", shirt: "#7a5aa8", shirt2: "#55407a", tool: null },
  soldier: { name: "Soldier", shirt: "#8a2a2a", shirt2: "#5a1a1a", tool: "sword" },
};
export const IDLE_SHIRT = "#8a6a4a";

// Tomato stats, each 1–10: what a meal made from it does
export const STATS = ["walk", "fight", "heal", "work"];
export const STAT_NAMES = { walk: "Walk speed", fight: "Fight", heal: "Healing", work: "Work speed" };
export const seedKey = (s) => s.join("/");
export const seedTotal = (s) => s.reduce((a, b) => a + b, 0);

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const costText = (cost) => Object.entries(cost).map(([k, n]) => `${n} ${k === "log" ? "wood" : k}`).join(" + ");

function scatter(n, x0, x1, y0, y1, minGap, avoid = []) {
  const pts = [];
  for (let tries = 0; pts.length < n && tries < 6000; tries++) {
    const p = { x: rand(x0, x1), y: rand(y0, y1) };
    if (pts.every((q) => dist(p, q) >= minGap) && avoid.every((a) => dist(p, a) >= a.r)) pts.push(p);
  }
  return pts;
}

// A count of tomatoes by variety: { "7/5/6/4": 12, ... }
const addTo = (bag, key, n) => (bag[key] = (bag[key] || 0) + n);
export const countOf = (bag) => Object.values(bag).reduce((a, b) => a + b, 0);
// Take n tomatoes, best varieties first (by `stat`, or overall)
function takeBest(bag, n, stat = null) {
  const keys = Object.keys(bag).filter((k) => bag[k] > 0);
  const score = (k) => (stat === null ? seedTotal(k.split("/").map(Number)) : Number(k.split("/")[STATS.indexOf(stat)]));
  keys.sort((a, b) => score(b) - score(a));
  const out = [];
  for (const k of keys) {
    while (bag[k] > 0 && out.length < n) {
      bag[k]--;
      out.push(k);
    }
    if (!bag[k]) delete bag[k];
  }
  return out;
}

// ---------- the colony ----------

function createColony(input) {
  const c = {
    input,
    time: 0,
    trophies: { resource: false, farm: false, raid: false },
    hall: { log: 0, stone: 0, tomatoes: {} },
    seeds: {}, // the seed bank: variety → count
    buildings: [],
    villagers: [],
    trees: [],
    rocks: [],
    player: {
      zone: "village", x: 720, y: 640, face: { x: 0, y: 1 }, walk: 0,
      bag: { log: 0, stone: 0, tomatoes: {} }, axe: 0, pickaxe: 0, sword: 0,
    },
    smithTarget: 1, // the tool tier the Blacksmith works toward
    mg: null, // the gathering minigame
    menu: null, // an open menu
    placing: null, // a building being placed
    msg: null,
    raid: null, // the fight, while it's on
    fade: 0, // the fade when you change zone
    hint: null,
    nextId: 1,
    bestSeed: null,
  };
  for (const s of K.startSeeds) addTo(c.seeds, seedKey(s), 3);
  c.bestSeed = K.startSeeds.slice().sort((a, b) => seedTotal(b) - seedTotal(a))[0];

  const say = (text, t = 2.6) => (c.msg = { text, t });
  c.say = say;

  // ---------- buildings ----------

  function addBuilding(key, zone, x, y) {
    const def = BUILDINGS[key];
    const b = { id: c.nextId++, key, zone, x, y, w: def.w, h: def.h, workers: [], stock: { log: 0, stone: 0, tomatoes: {} } };
    if (key === "plot") Object.assign(b, { seed: null, grow: 0, claimed: null });
    c.buildings.push(b);
    return b;
  }
  c.addBuilding = addBuilding;
  c.find = (key) => c.buildings.find((b) => b.key === key);
  c.all = (key) => c.buildings.filter((b) => b.key === key);

  // The world starts with the Hall, the Tavern, the sculpture's plinth, the seed bench and the gate
  addBuilding("hall", "village", 720, 470);
  addBuilding("tavern", "village", 560, 330);
  addBuilding("sculpture", "village", 900, 330);
  addBuilding("bench", "farm", 560, 180);
  addBuilding("gate", "raid", 360, 190);
  for (let i = 0; i < 4; i++) {
    const p = addBuilding("plot", "farm", 760 + (i % 2) * 48, 200 + Math.floor(i / 2) * 40);
    p.seed = K.startSeeds[i].slice();
    p.grow = rand(0.3, 0.8);
  }

  // Trees fill the forest and rocks the mine, with clear ground near the entrance for huts
  c.trees = scatter(90, 60, 1380, 60, 960, 52, [{ x: 1420, y: 504, r: 260 }]).map((p) => ({ ...p, zone: "forest", grown: true, regrow: 0, claimed: null }));
  c.rocks = scatter(55, 60, 1380, 60, 960, 62, [{ x: 720, y: 1000, r: 260 }]).map((p) => ({ ...p, zone: "mine", left: 3, regrow: 0, claimed: null }));

  // ---------- reading the colony ----------

  const pl = c.player;
  c.idle = () => c.villagers.filter((v) => !v.job);
  c.openSlots = () => c.buildings.filter((b) => BUILDINGS[b.key].job && b.workers.length < BUILDINGS[b.key].slots);
  c.villager = (id) => c.villagers.find((v) => v.id === id);
  c.hireCost = () => ({ log: K.hireBase + K.hireStep * c.villagers.length });
  c.soldiers = () => c.villagers.filter((v) => v.job === "soldier");
  c.readySoldiers = () => c.soldiers().filter((v) => !v.wounded);
  c.wounded = () => c.villagers.filter((v) => v.wounded);
  c.tomatoes = () => countOf(c.hall.tomatoes);
  c.meals = () => c.all("kitchen").reduce((n, b) => n + countOf(b.stock.tomatoes), 0);
  c.farmerLevel = () => Math.max(1, ...c.villagers.filter((v) => v.job === "farmer").map((v) => v.level || 1));

  // Paying: from your bag first, then the Hall
  const have = (k) => pl.bag[k] + c.hall[k];
  c.have = have;
  c.canPay = (cost) => Object.entries(cost).every(([k, n]) => have(k) >= n);
  function pay(cost) {
    for (const [k, n] of Object.entries(cost)) {
      const fromBag = Math.min(pl.bag[k], n);
      pl.bag[k] -= fromBag;
      c.hall[k] -= n - fromBag;
    }
  }
  c.pay = pay;
  const hallPays = (cost) => Object.entries(cost).every(([k, n]) => c.hall[k] >= n);
  const hallPay = (cost) => Object.entries(cost).forEach(([k, n]) => (c.hall[k] -= n));
  const scaled = (cost, f) => Object.fromEntries(Object.entries(cost).map(([k, n]) => [k, Math.ceil(n * f)]));

  // ---------- what you're next to ----------

  function interactables() {
    const z = pl.zone;
    const list = [];
    for (const b of c.buildings) if (b.zone === z) list.push({ kind: b.key === "plot" ? "plot" : "building", obj: b, x: b.x, y: b.y, reach: Math.max(b.w, b.h) / 2 + 22 });
    if (z === "forest") for (const t of c.trees) if (t.grown) list.push({ kind: "tree", obj: t, x: t.x, y: t.y - 12, reach: 30 });
    if (z === "mine") for (const k of c.rocks) if (k.left > 0) list.push({ kind: "rock", obj: k, x: k.x, y: k.y - 8, reach: 32 });
    return list;
  }
  c.targetAt = () => {
    let best = null;
    for (const it of interactables()) {
      const d = Math.hypot(it.x - pl.x, it.y - pl.y) - it.reach;
      if (d <= 0 && (!best || d < best.d)) best = { ...it, d };
    }
    return best;
  };

  // What Space does here — shown above your head
  c.promptFor = (it) => {
    if (!it) return null;
    const { kind, obj } = it;
    if (kind === "tree") return `Space: chop (+${K.tiers[pl.axe].yield} wood)`;
    if (kind === "rock") return `Space: mine (+${K.tiers[pl.pickaxe].yield} stone)`;
    if (kind === "plot") {
      if (!obj.seed) return "Space: plant a seed";
      if (obj.grow >= 1) return `Space: harvest ${seedKey(obj.seed)} tomatoes`;
      return `Growing ${seedKey(obj.seed)} — ${Math.floor(obj.grow * 100)}% (Space to replant)`;
    }
    const def = BUILDINGS[obj.key];
    if (obj.key === "hall") {
      const n = pl.bag.log + pl.bag.stone + countOf(pl.bag.tomatoes);
      return n ? `Space: store your bag at the Hall (${n})` : "The Hall: everything your couriers bring";
    }
    if (obj.key === "tavern") {
      if (c.idle().length >= c.openSlots().length) return "Tavern: build a workplace with an empty job first";
      return `Space: hire a villager (${costText(c.hireCost())})`;
    }
    if (obj.key === "sculpture") {
      if (c.trophies.resource) return "The Resource Master sculpture — trophy won";
      return c.hall.log >= K.sculpture.log && c.hall.stone >= K.sculpture.stone ? "Space: build the sculpture!" : `Sculpture: ${K.sculpture.log} wood + ${K.sculpture.stone} stone in the Hall`;
    }
    if (obj.key === "bench") return "Space: the seed bench (cross or throw away seeds)";
    if (obj.key === "gate") {
      if (c.trophies.raid) return "The raid room is cleared";
      return `Space: start the raid (${c.readySoldiers().length} soldiers ready)`;
    }
    if (def.job && obj.workers.length < def.slots && c.idle().length) return `Space: put an idle villager to work as ${JOBS[def.job].name}`;
    if (obj.key === "smithy") return obj.workers.length ? "Space: the forge" : "Space: the forge (empty job — hire at the Tavern for a Blacksmith)";
    if (def.store) {
      const n = def.store === "tomato" ? countOf(obj.stock.tomatoes) : obj.stock[def.store];
      if (n) return `Space: pick up ${n} ${def.store === "log" ? "wood" : def.store === "stone" ? "stone" : "tomatoes"}`;
    }
    if (def.job && obj.workers.length < def.slots) return `${def.name}: empty job — hire at the Tavern`;
    return def.name;
  };

  // ---------- your actions ----------

  function act() {
    const it = c.targetAt();
    if (!it) return;
    const { kind, obj } = it;
    if (kind === "tree" || kind === "rock") {
      c.mg = { kind, target: obj, phase: 0, dir: 1, cool: 0, zoneC: rand(0.25, 0.75), zoneW: 0.3 };
      return;
    }
    if (kind === "plot") return actPlot(obj);
    const def = BUILDINGS[obj.key];
    // An empty job and someone idle: put them to work first (the Smithy's forge comes after)
    if (def.job && obj.workers.length < def.slots && c.idle().length) return assign(obj);
    if (obj.key === "hall") return storeBag();
    if (obj.key === "tavern") return hire();
    if (obj.key === "sculpture") return buildSculpture();
    if (obj.key === "bench") return openBench();
    if (obj.key === "smithy") return openForge();
    if (obj.key === "gate") return beginRaid();
    if (def.store) return pickUp(obj);
    if (def.job && obj.workers.length < def.slots) return say("Empty job here — hire a villager at the Tavern");
    say(def.name);
  }

  function storeBag() {
    const n = pl.bag.log + pl.bag.stone + countOf(pl.bag.tomatoes);
    if (!n) return say("The Hall: everything your couriers bring");
    c.hall.log += pl.bag.log;
    c.hall.stone += pl.bag.stone;
    for (const [k, v] of Object.entries(pl.bag.tomatoes)) addTo(c.hall.tomatoes, k, v);
    pl.bag = { log: 0, stone: 0, tomatoes: {} };
    sfx("place");
    say(`Stored ${n} at the Hall`);
  }

  function pickUp(b) {
    const def = BUILDINGS[b.key];
    if (def.store === "tomato") {
      const n = countOf(b.stock.tomatoes);
      for (const [k, v] of Object.entries(b.stock.tomatoes)) addTo(pl.bag.tomatoes, k, v);
      b.stock.tomatoes = {};
      if (n) sfx("pickup");
      return say(n ? `Picked up ${n} tomatoes` : "Nothing here yet");
    }
    const room = K.bagLimit - pl.bag[def.store];
    const n = Math.min(room, b.stock[def.store]);
    if (!n) return say(room ? "Nothing here yet" : "Your bag is full — store it at the Hall");
    b.stock[def.store] -= n;
    pl.bag[def.store] += n;
    sfx("pickup");
    say(`Picked up ${n} ${def.store === "log" ? "wood" : "stone"}`);
  }

  function hire() {
    if (c.idle().length >= c.openSlots().length) return fail("Build a workplace with an empty job first (Shift to build)");
    const cost = c.hireCost();
    if (!c.canPay(cost)) return fail(`Hiring costs ${costText(cost)}`);
    pay(cost);
    const t = c.find("tavern");
    c.villagers.push({
      id: c.nextId++, zone: "village", x: t.x + rand(-20, 20), y: t.y + 40, job: null, building: null,
      tool: 0, task: [], carry: null, buff: null, mealT: rand(10, K.mealEvery), wounded: false, healT: 0, level: 1, xp: 0, walk: 0,
    });
    sfx("coin");
    say("Hired a villager — put them to work at an empty job (Space at the building)");
  }

  function assign(b) {
    const v = c.idle()[0];
    if (!v) return;
    v.job = BUILDINGS[b.key].job;
    v.building = b.id;
    v.task = [];
    b.workers.push(v.id);
    sfx("place");
    say(`Your villager is now a ${JOBS[v.job].name}`);
  }

  function fail(text) {
    sfx("error");
    say(text);
  }

  function buildSculpture() {
    if (c.trophies.resource) return say("The Resource Master trophy is yours");
    if (c.hall.log < K.sculpture.log || c.hall.stone < K.sculpture.stone) {
      return fail(`The sculpture needs ${K.sculpture.log} wood and ${K.sculpture.stone} stone in the Hall (you have ${c.hall.log} and ${c.hall.stone})`);
    }
    hallPay(K.sculpture);
    trophy("resource", "Resource Master! The sculpture stands.");
  }

  function trophy(key, text) {
    if (c.trophies[key]) return;
    c.trophies[key] = true;
    sfx("win");
    say(text, 4);
  }
  c.trophy = trophy;

  // ---------- farming and breeding ----------

  function actPlot(p) {
    if (p.seed && p.grow >= 1) return harvest(p, pl.bag.tomatoes, 1);
    openMenu(
      p.seed ? "Replant with" : "Plant a seed",
      Object.entries(c.seeds)
        .filter(([, n]) => n > 0)
        .sort((a, b) => seedTotal(b[0].split("/").map(Number)) - seedTotal(a[0].split("/").map(Number)))
        .map(([k, n]) => ({
          label: k,
          detail: `${n} seed${n > 1 ? "s" : ""}`,
          seed: k.split("/").map(Number),
          run: () => {
            c.seeds[k]--;
            p.seed = k.split("/").map(Number);
            p.grow = 0;
            sfx("place");
            say(`Planted ${k}`);
          },
        })),
      "No seeds — harvest a plant or cross seeds at the bench"
    );
  }

  // A ripe plant gives tomatoes (more with a skilled farmer) and its own seeds, then regrows
  function harvest(p, into, level) {
    const key = seedKey(p.seed);
    const n = 1 + Math.floor(level / 2);
    addTo(into, key, n);
    addTo(c.seeds, key, K.seedsPerHarvest);
    p.grow = 0;
    if (into === pl.bag.tomatoes) {
      sfx("pickup");
      say(`+${n} tomatoes and ${K.seedsPerHarvest} ${key} seeds`);
    }
    return n;
  }

  // The bench: cross two seeds, or throw away varieties you don't want cluttering the bank
  function openBench() {
    if (!seedList().length) return fail("No seeds — harvest a plant first");
    openMenu("Seed Bench", [
      { label: "Cross two seeds", detail: "each stat comes from a parent, then one moves up or down by 1", run: openCross },
      { label: "Throw away seeds", detail: "clear out varieties you don't need", run: () => openDiscard(0) },
    ]);
  }

  // Varieties in the bank, best first (or worst first)
  const seedList = (worstFirst = false) =>
    Object.entries(c.seeds)
      .filter(([, n]) => n > 0)
      .sort((a, b) => (worstFirst ? -1 : 1) * (seedTotal(b[0].split("/").map(Number)) - seedTotal(a[0].split("/").map(Number))));

  function openCross() {
    const pick = (title, exclude, then) =>
      openMenu(
        title,
        seedList()
          .filter(([k, n]) => k !== exclude || n > 1)
          .map(([k, n]) => ({ label: k, detail: `${n} seed${n > 1 ? "s" : ""}`, seed: k.split("/").map(Number), run: () => then(k) })),
        "Not enough seeds"
      );
    pick("Cross seeds: first parent", null, (a) => pick(`Cross ${a} with…`, a, (b) => cross(a, b)));
  }

  // Worst first, since those are the ones you'll want gone; the menu stays open for more
  function openDiscard(sel) {
    const list = seedList(true);
    if (!list.length) return say("Your seed bank is empty");
    openMenu(
      "Throw away seeds (worst first)",
      list.map(([k, n]) => ({
        label: k,
        detail: `${n} seed${n > 1 ? "s" : ""} — Space throws ${n > 1 ? "them all" : "it"} away`,
        seed: k.split("/").map(Number),
        run: () => {
          delete c.seeds[k];
          sfx("thud", { volume: 0.5 });
          say(`Threw away the ${k} seeds`);
          openDiscard(list.findIndex(([key]) => key === k));
        },
      }))
    );
    if (c.menu) c.menu.sel = Math.min(sel, c.menu.items.length - 1);
  }

  // Each stat comes from one parent; then one random stat shifts by one, up or down
  function cross(a, b) {
    const pa = a.split("/").map(Number);
    const pb = b.split("/").map(Number);
    if ((c.seeds[a] || 0) < 1 || (c.seeds[b] || 0) < (a === b ? 2 : 1)) return fail("Not enough seeds");
    c.seeds[a]--;
    c.seeds[b]--;
    const child = pa.map((v, i) => (Math.random() < 0.5 ? v : pb[i]));
    const i = Math.floor(Math.random() * 4);
    child[i] = clamp(child[i] + (Math.random() < 0.5 ? 1 : -1), 1, 10);
    const key = seedKey(child);
    addTo(c.seeds, key, 1);
    if (seedTotal(child) > seedTotal(c.bestSeed)) c.bestSeed = child;
    sfx("score");
    say(`New seed: ${key} (${STAT_NAMES[STATS[i]]} ${child[i] > Math.max(pa[i], pb[i]) ? "went up" : "changed"}) — plant it to get more`, 3.5);
    if (child.every((v) => v >= K.perfectSeed)) trophy("farm", "Perfect Tomato! 10/10/10/10 — Farming trophy won");
  }
  c.cross = cross;

  // ---------- the forge ----------

  function openForge() {
    const items = [];
    for (const tool of ["axe", "pickaxe", "sword"]) {
      const tier = pl[tool];
      const next = K.tiers[tier + 1];
      const label = tool === "axe" ? "Your axe" : tool === "pickaxe" ? "Your pickaxe" : "Your sword";
      items.push(
        next
          ? {
              label: `${label} → ${next.name}`,
              detail: `${costText(scaled(next.cost, K.playerCraftMarkup))} · ${tool === "sword" ? `×${next.sword} damage` : `${next.yield} per ${tool === "axe" ? "tree" : "rock"}`}`,
              ok: c.canPay(scaled(next.cost, K.playerCraftMarkup)),
              run: () => {
                pay(scaled(next.cost, K.playerCraftMarkup));
                pl[tool]++;
                sfx("brick");
                say(`${label} is now ${next.name}`);
              },
            }
          : { label: `${label}: ${K.tiers[tier].name} (best)`, detail: "", ok: false, run: () => {} }
      );
    }
    // Villagers' tools: make one yourself, or set what the Blacksmith works toward
    const needy = toolUsers().sort((a, b) => a.tool - b.tool)[0];
    if (needy && K.tiers[needy.tool + 1]) {
      const next = K.tiers[needy.tool + 1];
      const cost = scaled(next.cost, K.playerCraftMarkup);
      items.push({
        label: `Make a ${next.name} ${JOBS[needy.job].tool} for your ${JOBS[needy.job].name}`,
        detail: costText(cost),
        ok: c.canPay(cost),
        run: () => {
          pay(cost);
          needy.tool++;
          sfx("brick");
          say(`Your ${JOBS[needy.job].name} now has a ${next.name} ${JOBS[needy.job].tool}`);
        },
      });
    }
    for (let t = 1; t < K.tiers.length; t++) {
      items.push({
        label: `Blacksmith target: ${K.tiers[t].name} tools${c.smithTarget === t ? "  (set)" : ""}`,
        detail: `${costText(K.tiers[t].cost)} each, from the Hall`,
        ok: true,
        run: () => {
          c.smithTarget = t;
          say(`Your Blacksmith will upgrade everyone to ${K.tiers[t].name} tools`);
        },
      });
    }
    openMenu("The forge", items);
  }

  const toolUsers = () => c.villagers.filter((v) => v.job && JOBS[v.job].tool);

  // ---------- menus ----------

  function openMenu(title, items, empty = "Nothing here") {
    if (!items.length) return fail(empty);
    c.menu = { title, items: items.map((it) => ({ ok: true, ...it })), sel: 0 };
    sfx("blip");
  }

  function openBuildMenu() {
    const items = BUILDABLE.filter((k) => BUILDINGS[k].zone === pl.zone).map((k) => {
      const def = BUILDINGS[k];
      return {
        label: def.name,
        detail: `${costText(def.cost)}${def.job ? ` · ${def.slots} ${JOBS[def.job].name}${def.slots > 1 ? "s" : ""}` : ""}`,
        ok: c.canPay(def.cost),
        run: () => (c.placing = { key: k }),
      };
    });
    const where = { village: "village", forest: "forest", mine: "mine", farm: "farm", raid: "raid room" }[pl.zone];
    openMenu(`Build in the ${where}`, items, "Nothing to build here — try the village, forest, mine or farm");
  }

  function runMenu(input) {
    const m = c.menu;
    if (input.pressed.up) m.sel = (m.sel + m.items.length - 1) % m.items.length;
    if (input.pressed.down) m.sel = (m.sel + 1) % m.items.length;
    if (input.pressed.action2) {
      c.menu = null;
      return;
    }
    if (input.pressed.action) {
      const it = m.items[m.sel];
      if (!it.ok) return fail("You can't afford that yet");
      c.menu = null;
      it.run();
    }
  }

  // ---------- placing a building ----------

  c.ghost = () => {
    if (!c.placing) return null;
    const def = BUILDINGS[c.placing.key];
    const x = pl.x + pl.face.x * (def.w / 2 + 26);
    const y = pl.y + pl.face.y * (def.h / 2 + 26) - (pl.face.y < 0 ? 10 : 0);
    return { x, y, w: def.w, h: def.h, ok: placeOk(x, y, def), def };
  };

  function placeOk(x, y, def) {
    const z = ZONES[pl.zone];
    if (x - def.w / 2 < 30 || x + def.w / 2 > z.w - 30 || y - def.h / 2 < 40 || y + def.h / 2 > z.h - 30) return false;
    for (const b of c.buildings) {
      if (b.zone !== pl.zone) continue;
      if (Math.abs(b.x - x) < (b.w + def.w) / 2 + 8 && Math.abs(b.y - y) < (b.h + def.h) / 2 + 8) return false;
    }
    const nodes = pl.zone === "forest" ? c.trees : pl.zone === "mine" ? c.rocks : [];
    for (const n of nodes) if (Math.abs(n.x - x) < def.w / 2 + 14 && Math.abs(n.y - y) < def.h / 2 + 18) return false;
    for (const e of EXITS) if (e.zone === pl.zone && x + def.w / 2 > e.x - 40 && x - def.w / 2 < e.x + e.w + 40 && y + def.h / 2 > e.y - 40 && y - def.h / 2 < e.y + e.h + 40) return false;
    return true;
  }

  function runPlacing(input) {
    if (input.pressed.action2) {
      c.placing = null;
      return say("Cancelled");
    }
    const g = c.ghost();
    if (!g.ok) return fail("Doesn't fit here — move somewhere clear");
    if (!c.canPay(g.def.cost)) return fail(`Needs ${costText(g.def.cost)}`);
    pay(g.def.cost);
    addBuilding(c.placing.key, pl.zone, g.x, g.y);
    sfx("place");
    say(`Built a ${g.def.name}${g.def.job ? " — hire someone at the Tavern to work it" : ""}`);
    c.placing = null;
  }

  // ---------- the raid ----------

  function beginRaid() {
    if (c.trophies.raid) return say("The raid room is cleared");
    c.raid = startRaid(c);
    sfx("power");
  }

  // ---------- villagers ----------
  // Each villager runs a queue of steps: walk somewhere (in any zone — they route through the
  // village) or wait and then do something. When the queue empties they decide what's next.

  const walkTo = (zone, x, y) => ({ type: "walk", zone, x, y });
  const wait = (t, done) => ({ type: "wait", t, done });
  const home = (v) => c.buildings.find((b) => b.id === v.building);
  const workMult = (v) => 1 + (v.buff ? v.buff.stats[3] * K.statBuff : 0);
  const walkMult = (v) => 1 + (v.buff ? v.buff.stats[0] * K.statBuff : 0);
  c.workMult = workMult;

  function idleAt(b) {
    return [walkTo(b.zone, b.x + rand(-30, 30), b.y + b.h / 2 + rand(14, 40)), wait(1.5)];
  }

  function release(v) {
    for (const n of [...c.trees, ...c.rocks]) if (n.claimed === v) n.claimed = null;
    for (const p of c.all("plot")) if (p.claimed === v) p.claimed = null;
    v.task = [];
  }

  function nearestFree(list, from, ok) {
    let best = null;
    for (const n of list) if (!n.claimed && ok(n) && (!best || dist(n, from) < dist(best, from))) best = n;
    return best;
  }

  const WORK = {
    woodcutter: (v, b) => gatherTask(v, b, c.trees, (n) => n.grown, (n) => { n.grown = false; n.regrow = K.treeRegrow; }, "log"),
    miner: (v, b) => gatherTask(v, b, c.rocks, (n) => n.left > 0, (n) => { if (--n.left === 0) n.regrow = K.rockRegrow; }, "stone"),
    farmer(v, b) {
      const plot = nearestFree(c.all("plot"), b, (p) => p.seed && p.grow >= 1);
      if (!plot) return null;
      plot.claimed = v;
      return [
        walkTo("farm", plot.x, plot.y + 16),
        wait(1.2 / workMult(v), () => {
          plot.claimed = null;
          if (!plot.seed || plot.grow < 1) return false;
          harvest(plot, b.stock.tomatoes, v.level);
          v.carry = "tomato";
          if (++v.xp >= K.farmerLevelEvery && v.level < K.farmerMaxLevel) {
            v.xp = 0;
            v.level++;
            if (pl.zone === "farm") say(`Your Farmer reached level ${v.level}: bigger harvests, faster growth`);
          }
        }),
        walkTo("farm", b.x, b.y + b.h / 2 + 10),
        wait(0.2, () => { v.carry = null; }),
      ];
    },
    courier(v) {
      let src = null;
      let best = 0;
      for (const b of c.buildings) {
        const def = BUILDINGS[b.key];
        if (!def.store) continue;
        const n = def.store === "tomato" ? countOf(b.stock.tomatoes) : b.stock[def.store];
        if (n > best && !c.villagers.some((o) => o !== v && o.job === "courier" && o.src === b.id)) {
          best = n;
          src = b;
        }
      }
      if (!src) return null;
      v.src = src.id;
      const hall = c.find("hall");
      const load = { log: 0, stone: 0, tomatoes: {} };
      return [
        walkTo(src.zone, src.x, src.y + src.h / 2 + 10),
        wait(0.4, () => {
          const def = BUILDINGS[src.key];
          if (def.store === "tomato") {
            for (const k of takeBest(src.stock.tomatoes, K.courierLoad)) addTo(load.tomatoes, k, 1);
          } else {
            const n = Math.min(K.courierLoad, src.stock[def.store]);
            src.stock[def.store] -= n;
            load[def.store] = n;
          }
          v.carry = def.store;
          v.src = null;
        }),
        walkTo("village", hall.x, hall.y + hall.h / 2 + 8),
        wait(0.4, () => {
          c.hall.log += load.log;
          c.hall.stone += load.stone;
          for (const [k, n] of Object.entries(load.tomatoes)) addTo(c.hall.tomatoes, k, n);
          v.carry = null;
        }),
      ];
    },
    blacksmith(v, b) {
      const target = toolUsers().filter((o) => o.tool < c.smithTarget).sort((a, o) => a.tool - o.tool)[0];
      if (!target) return null;
      const cost = K.tiers[target.tool + 1].cost;
      if (!hallPays(cost)) return null;
      return [
        walkTo("village", b.x, b.y + b.h / 2 + 8),
        wait(K.blacksmithTime / workMult(v), () => {
          if (target.tool >= c.smithTarget || !hallPays(cost)) return false;
          hallPay(cost);
          target.tool++;
        }),
      ];
    },
    cook(v, b) {
      if (countOf(b.stock.tomatoes) >= 12 || c.tomatoes() < 2) return null;
      return [
        walkTo("village", b.x, b.y + b.h / 2 + 8),
        wait(K.cookTime / workMult(v), () => {
          const used = takeBest(c.hall.tomatoes, 2);
          if (used.length < 2) return false;
          addTo(b.stock.tomatoes, used[0], K.mealsPerCook);
        }),
      ];
    },
    healer(v, b) {
      return [walkTo("village", b.x + rand(-16, 16), b.y + b.h / 2 + 12), wait(1)];
    },
    soldier(v, b) {
      return idleAt(b);
    },
  };

  function gatherTask(v, b, list, ready, take, item) {
    const node = nearestFree(list, b, ready);
    if (!node) return null;
    node.claimed = v;
    const amount = K.tiers[v.tool].yield;
    return [
      walkTo(b.zone, node.x, node.y + 6),
      wait(K.chopTime / workMult(v), () => {
        node.claimed = null;
        if (!ready(node)) return false;
        take(node);
        v.carry = item;
      }),
      walkTo(b.zone, b.x, b.y + b.h / 2 + 10),
      wait(0.2, () => {
        b.stock[item] += amount;
        v.carry = null;
      }),
    ];
  }

  // A meal from a Kitchen: optional, but it speeds a villager up (and strengthens a soldier)
  function mealTask(v) {
    const kitchen = c.all("kitchen").find((k) => countOf(k.stock.tomatoes) > 0);
    if (!kitchen) return null;
    return [
      walkTo("village", kitchen.x, kitchen.y + kitchen.h / 2 + 8),
      wait(0.8, () => {
        const [k] = takeBest(kitchen.stock.tomatoes, 1, v.job === "soldier" ? "fight" : "work");
        if (!k) return false;
        v.buff = { stats: k.split("/").map(Number), t: K.mealBuff };
        v.mealT = K.mealEvery;
      }),
    ];
  }

  // A wounded soldier goes to a Healer, who uses a tomato: the higher its heal stat, the faster
  function healTask(v) {
    const hut = c.all("healer").find((h) => h.workers.length);
    if (!hut) return idleAt(c.find("hall"));
    if (c.tomatoes() < 1) return idleAt(hut);
    return [
      walkTo("village", hut.x + rand(-12, 12), hut.y + hut.h / 2 + 14),
      wait(0.1, () => {
        const [k] = takeBest(c.hall.tomatoes, 1, "heal");
        if (!k) return false;
        const heal = Number(k.split("/")[2]);
        v.healT = (K.healTime * (11 - heal)) / 10;
      }),
    ];
  }

  function decide(v) {
    if (v.wounded) return v.healT > 0 ? [wait(0.5)] : healTask(v);
    if (!v.job) return idleAt(c.find("tavern"));
    const b = home(v);
    if (v.mealT <= 0) {
      v.mealT = K.mealEvery;
      const meal = mealTask(v);
      if (meal) return meal;
    }
    return WORK[v.job](v, b) || idleAt(b);
  }

  // Which doorway takes you one step closer to `to`: every route runs through the village
  function routeExit(from, to) {
    const next = from === "village" ? to : "village";
    return EXITS.find((e) => e.zone === from && e.to === next);
  }
  c.routeExit = routeExit;

  function moveToward(o, x, y, speed, dt) {
    const d = Math.hypot(x - o.x, y - o.y);
    const step = speed * dt;
    o.walk += dt;
    if (d <= step) {
      o.x = x;
      o.y = y;
      return true;
    }
    o.x += ((x - o.x) / d) * step;
    o.y += ((y - o.y) / d) * step;
    return false;
  }

  function runVillager(v, dt) {
    if (v.buff && (v.buff.t -= dt) <= 0) v.buff = null;
    v.mealT -= dt;
    if (v.wounded && v.healT > 0 && (v.healT -= dt) <= 0) {
      v.wounded = false;
      v.healT = 0;
      v.task = [];
    }
    if (!v.task.length) v.task = decide(v);
    const s = v.task[0];
    if (!s) return;
    if (s.type === "walk") {
      if (s.zone !== v.zone) {
        const e = routeExit(v.zone, s.zone);
        const door = exitCenter(e);
        if (moveToward(v, door.x, door.y, K.villagerSpeed * walkMult(v), dt)) {
          v.zone = e.to;
          v.x = e.arrive.x;
          v.y = e.arrive.y;
        }
      } else if (moveToward(v, s.x, s.y, K.villagerSpeed * walkMult(v), dt)) {
        v.task.shift();
      }
    } else if ((s.t -= dt) <= 0) {
      const ok = s.done ? s.done() : true;
      v.task.shift();
      if (ok === false) release(v);
    }
  }

  // ---------- hints: what to do next ----------

  function step() {
    const t = c.trophies;
    if (!c.villagers.length && !c.all("woodhut").length) {
      if (pl.zone !== "forest" && have("log") < BUILDINGS.woodhut.cost.log) return ["Head west to the Forest and chop wood (Space at a tree)", "forest"];
      if (have("log") < BUILDINGS.woodhut.cost.log) return [`Chop ${BUILDINGS.woodhut.cost.log} wood, then build a Woodchopper Hut here (Shift)`, "forest"];
      return ["Build a Woodchopper Hut: in the Forest, press Shift and pick it", "forest"];
    }
    if (c.idle().length && c.openSlots().length) return ["You have an idle villager — stand at a building with an empty job and press Space", c.openSlots()[0]];
    if (c.openSlots().length && c.idle().length < c.openSlots().length) {
      if (c.canPay(c.hireCost())) return [`Empty job waiting — hire a villager at the Tavern (${costText(c.hireCost())})`, c.find("tavern")];
      return [`Empty job waiting — hiring costs ${costText(c.hireCost())}, keep chopping`, "forest"];
    }
    if (!c.all("smithy").length && c.villagers.length >= 2) return ["Build a Smithy in the village: better tools multiply what everyone brings back", "village"];
    if (!c.all("post").length && c.villagers.length >= 3) return ["Build a Courier Post: couriers carry every hut's pile to the Hall for you", "village"];
    if (!c.all("quarry").length) return ["Build a Quarry Hut in the Mine (north) — you'll need stone for tools", "mine"];
    if (!t.farm && !c.all("farmhouse").length) return ["Down at the Farm (south): build a Farmhouse and cross seeds at the bench toward 10/10/10/10", "farm"];
    if (!t.resource) return [`Build more huts and upgrade tools — the sculpture needs ${K.sculpture.log} wood and ${K.sculpture.stone} stone`, null];
    if (!t.farm) return [`Best seed so far: ${seedKey(c.bestSeed)} — cross your best seeds at the bench`, c.find("bench")];
    if (!t.raid) return [`Build Barracks, hire soldiers and forge swords — then start the raid (east)`, "raid"];
    return ["All trophies won!", null];
  }

  c.nextStep = () => {
    const [text, at] = step();
    c.hint = at ? (typeof at === "string" ? { zone: at } : at) : null;
    return text;
  };

  // ---------- one frame ----------

  c.update = (dt) => {
    const input = c.input;
    c.time += dt;
    if (c.msg && (c.msg.t -= dt) <= 0) c.msg = null;
    if (c.fade > 0) c.fade = Math.max(0, c.fade - dt * 3);

    // The world keeps going wherever you are
    for (const t of c.trees) if (!t.grown && (t.regrow -= dt) <= 0) t.grown = true;
    for (const k of c.rocks) if (!k.left && (k.regrow -= dt) <= 0) k.left = 3;
    const growRate = (1 + K.growBonusPerLevel * (c.farmerLevel() - 1)) / K.growTime;
    for (const p of c.all("plot")) if (p.seed) p.grow = Math.min(1, p.grow + growRate * dt);
    for (const v of c.villagers) runVillager(v, dt);

    if (c.raid) {
      const result = updateRaid(c, c.raid, input, dt);
      if (result === "win") {
        c.raid = null;
        trophy("raid", "Raid won! The raid room is yours");
      } else if (result === "lose") {
        c.raid = null;
        say("The raid failed — your soldiers are wounded. A Healer and tomatoes will patch them up", 4);
        sfx("lose");
      }
      input.pendingFire = false;
      return;
    }
    input.pendingFire = false; // clicks only matter in the raid

    if (c.menu) return runMenu(input);
    if (c.placing && (input.pressed.action || input.pressed.action2)) return runPlacing(input);

    // Walking (the minigame holds you still)
    const mx = (input.held.right ? 1 : 0) - (input.held.left ? 1 : 0);
    const my = (input.held.down ? 1 : 0) - (input.held.up ? 1 : 0);
    if ((mx || my) && c.mg) c.mg = null;
    if (mx || my) {
      const len = Math.hypot(mx, my);
      const z = ZONES[pl.zone];
      pl.x = clamp(pl.x + (mx / len) * K.playerSpeed * dt, 8, z.w - 8);
      pl.y = clamp(pl.y + (my / len) * K.playerSpeed * dt, 20, z.h - 8);
      pl.face = { x: mx / len, y: my / len };
      pl.walk += dt;
      for (const e of EXITS) {
        if (e.zone === pl.zone && pl.x >= e.x && pl.x <= e.x + e.w && pl.y >= e.y && pl.y <= e.y + e.h) {
          pl.zone = e.to;
          pl.x = e.arrive.x;
          pl.y = e.arrive.y;
          c.fade = 1;
          c.placing = null;
          sfx("blip");
          break;
        }
      }
    }

    if (c.mg) {
      const mg = c.mg;
      if (mg.cool > 0) mg.cool -= dt;
      else {
        mg.phase += mg.dir * K.gatherTime * dt;
        if (mg.phase > 1) { mg.phase = 1; mg.dir = -1; }
        if (mg.phase < 0) { mg.phase = 0; mg.dir = 1; }
        if (input.pressed.action) {
          if (Math.abs(mg.phase - mg.zoneC) <= mg.zoneW / 2) finishGather();
          else {
            mg.cool = 0.4;
            mg.zoneC = rand(0.25, 0.75);
            sfx("error", { volume: 0.5 });
          }
        }
      }
      return;
    }
    if (c.placing) return;
    if (input.pressed.action2) return openBuildMenu();
    if (input.pressed.action) act();
  };

  function finishGather() {
    const { kind, target } = c.mg;
    c.mg = null;
    const item = kind === "tree" ? "log" : "stone";
    const room = K.bagLimit - pl.bag[item];
    if (kind === "tree" && target.grown) {
      target.grown = false;
      target.regrow = K.treeRegrow;
      pl.bag.log += Math.min(room, K.tiers[pl.axe].yield);
      sfx("chop");
    } else if (kind === "rock" && target.left > 0) {
      if (--target.left === 0) target.regrow = K.rockRegrow;
      pl.bag.stone += Math.min(room, K.tiers[pl.pickaxe].yield);
      sfx("thud");
    }
    if (pl.bag[item] >= K.bagLimit) say("Bag full — store it at the Hall");
  }

  // ---------- cheat codes (testing aids) ----------

  c.cheat = (code) => {
    const hallB = c.find("hall");
    const newVillager = (job, b) => {
      const at = b || hallB;
      const v = { id: c.nextId++, zone: at.zone, x: at.x + rand(-30, 30), y: at.y + 50, job: job || null, building: b ? b.id : null, tool: 0, task: [], carry: null, buff: null, mealT: K.mealEvery, wounded: false, healT: 0, level: 1, xp: 0, walk: 0 };
      if (b) b.workers.push(v.id);
      c.villagers.push(v);
      return v;
    };
    switch (code) {
      case "RICH":
        c.hall.log += 2000;
        c.hall.stone += 2000;
        addTo(c.hall.tomatoes, seedKey(c.bestSeed), 20);
        return "+2000 wood, +2000 stone, +20 tomatoes in the Hall";
      case "CROWD":
        for (let i = 0; i < 5; i++) newVillager(null, null);
        return "5 idle villagers";
      case "TOOLS":
        pl.axe = pl.pickaxe = pl.sword = K.tiers.length - 1;
        for (const v of c.villagers) v.tool = K.tiers.length - 1;
        return "Legendary tools for you and everyone";
      case "ARMY": {
        const barracks = () => c.all("barracks").find((x) => x.workers.length < BUILDINGS.barracks.slots) || addBuilding("barracks", "village", 1180, 260 + 80 * c.all("barracks").length);
        for (let i = 0; i < 4; i++) newVillager("soldier", barracks()).tool = 2;
        return "4 soldiers with iron swords";
      }
      case "BLOOM":
        addTo(c.seeds, "9/9/9/9", 4);
        c.bestSeed = [9, 9, 9, 9];
        return "+4 seeds of 9/9/9/9";
      case "HAUL":
        for (const b of c.buildings) {
          if (b.key === "kitchen") continue;
          c.hall.log += b.stock.log;
          c.hall.stone += b.stock.stone;
          for (const [k, n] of Object.entries(b.stock.tomatoes)) addTo(c.hall.tomatoes, k, n);
          b.stock.log = b.stock.stone = 0;
          b.stock.tomatoes = {};
        }
        return "Every hut's pile is in the Hall";
    }
    return null;
  };

  return c;
}

// ---------- the round: one timed run ----------

function createRound({ inputs }) {
  const c = createColony(inputs[0]);
  const r = {
    colony: c,
    winner: null,
    endReason: "",
    roundLabel: "The run",
    winTitle: "All three trophies!",
    countdown: 6,
    view: null,
    finalTime: null,
  };

  r.intro = () => [
    "Collect all three trophies as fast as you can:",
    `Resource Master — a sculpture of ${K.sculpture.log} wood + ${K.sculpture.stone} stone`,
    "Perfect Tomato — breed a 10/10/10/10 seed at the bench",
    "Raid — beat the raid room with your soldiers",
    "Villagers are faster than you: hire them, give them huts and tools.",
    "Space: act · Shift: build (and block in the raid) · click to attack",
  ];

  r.update = (dt) => {
    if (r.winner !== null) return r.winner;
    c.update(dt);
    if (c.trophies.resource && c.trophies.farm && c.trophies.raid) {
      r.winner = 0;
      r.finalTime = c.time;
      r.endReason = `All three trophies in ${formatClock(c.time)}.`;
    }
    return r.winner;
  };

  r.status = () => {
    const t = c.trophies;
    return `${formatClock(c.time)} · ${ZONES[c.player.zone].name} · Villagers ${c.villagers.length} · Trophies ${[t.resource, t.farm, t.raid].filter(Boolean).length}/3`;
  };
  r.draw = (ctx) => draw(ctx, r);
  return r;
}

export function formatClock(s) {
  const tenths = Math.floor(s * 10);
  const m = Math.floor(tenths / 600);
  const sec = (tenths % 600) / 10;
  return `${m}:${sec < 10 ? "0" : ""}${sec.toFixed(1)}`;
}

const CHEATS = {
  RICH: "+2000 wood and stone, +20 tomatoes",
  CROWD: "5 idle villagers",
  TOOLS: "legendary tools for you and everyone",
  ARMY: "4 soldiers with iron swords (and Barracks)",
  BLOOM: "four 9/9/9/9 seeds",
  HAUL: "every hut's pile straight to the Hall",
};

export default {
  id: "colony",
  title: "Life in the Colony",
  kicker: "Arcade run",
  accent: "var(--brass)",
  blurb: "Grow a village that out-works you, then race for three trophies against the clock.",
  solo: true,
  timeTrial: true,
  hiRes: true,
  howTo: [
    "Your time is your score: collect all three trophies as fast as you can — the Resource Master sculpture, a perfect 10/10/10/10 tomato, and the raid.",
    "The village is in the middle. Walk off an edge to travel: the Forest (west), the Mine (north), the Farm (south) and the Raid Room (east).",
    "Space does whatever you're next to: chop, mine, harvest, pick up, store, hire. Shift opens the build menu — build as many huts as you like.",
    "Hire villagers at the Tavern (you need a building with an empty job), then press Space at that building to put one to work. One villager per hut.",
    "The Smithy upgrades tools: Stone, Iron, Legendary. Every villager's tool multiplies what they bring back. Couriers carry hut piles to the Hall.",
    "At the Farm, cross two seeds on the bench: the child gets each stat from a parent, then one stat moves up or down by one. Plant your best to get more seeds.",
    "In the raid: arrows to move and dodge, Shift to block, click (or Space) to attack. Lose and your soldiers are wounded until a Healer treats them with tomatoes.",
  ],
  width: W,
  height: H,
  sides: [
    {
      name: "Founder",
      emoji: "🏆",
      goal: "Win all three trophies as fast as you can. Do every job yourself — or hire villagers, who are faster.",
      controls: { dirs: "walk (dodge in the raid)", action: "act / attack", action2: "build menu / block" },
      pointer: "aim",
      pointerHint: "Click to attack in the raid",
      pad: { dirs: "four", action: "Act", action2: "Build" },
    },
  ],
  cheats: Object.fromEntries(Object.entries(CHEATS).map(([code, does]) => [code, { does, run: (r) => r.colony.cheat(code) }])),
  createRound,
};
