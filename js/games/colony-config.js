// Life in the Colony — Arcade Demo: every tunable number in one place.
//
// ⚠ PLACEHOLDERS. The design brief leaves exact costs, buffs and breeding numbers open, so
// these are first guesses to make the game playable. Tune them here after playtesting; nothing
// else in the game hard-codes a number that belongs in this list.

export const CONFIG = {
  // The three trophies
  sculpture: { log: 10000, stone: 10000 }, // Resource Master: the sculpture's cost
  perfectSeed: 10, // every tomato stat at this value wins the Farming trophy

  // You
  playerSpeed: 170,
  bagLimit: 200, // per item
  gatherTime: 0.9, // minigame marker speed (sweeps per second)

  // Hiring: each villager costs more than the last
  hireBase: 10, // wood
  hireStep: 5, // + wood per villager already hired

  // Tools: tier 0 is bare hands. Yield is per tree or rock, for you and for villagers.
  tiers: [
    { name: "Bare hands", yield: 1, sword: 1, cost: null },
    { name: "Stone", yield: 2, sword: 2, cost: { stone: 5 } },
    { name: "Iron", yield: 10, sword: 4, cost: { stone: 50, log: 20 } },
    { name: "Legendary", yield: 50, sword: 8, cost: { stone: 500, log: 200 } },
  ],
  playerCraftMarkup: 1.5, // making a villager's tool yourself costs more than the Blacksmith does
  blacksmithTime: 3, // seconds per tool

  // Villager work
  villagerSpeed: 90,
  chopTime: 2.2, // seconds per tree or rock for a villager
  courierLoad: 150, // most a courier carries per trip
  treeRegrow: 12,
  rockRegrow: 15,

  // Farming
  growTime: 24, // seconds for a tomato to ripen with a level-1 farmer
  farmerLevelEvery: 4, // harvests per farmer level
  farmerMaxLevel: 10,
  growBonusPerLevel: 0.08, // each farmer level ripens tomatoes 8% faster
  seedsPerHarvest: 3,
  startSeeds: [
    [5, 4, 6, 3],
    [3, 6, 4, 5],
    [6, 3, 3, 6],
    [4, 5, 5, 4],
  ],

  // Food: optional, but fed villagers are faster
  mealsPerCook: 3, // from 2 tomatoes
  cookTime: 3,
  mealEvery: 60, // a villager looks for a meal this often
  mealBuff: 60, // seconds a meal lasts
  // At stat 10 a meal adds: walk +50%, work +50%; fight adds damage and health
  statBuff: 0.05,

  // Raid
  raid: {
    playerHP: 100,
    playerDamage: 8, // × your sword tier
    swingRange: 46,
    swingCooldown: 0.4,
    blockReduction: 0.7, // share of damage a block stops
    soldierHP: 40,
    soldierDamage: 5, // × the soldier's sword tier
    soldierCooldown: 1.0,
    fightStatHP: 6, // extra soldier HP per point of fight stat in their last meal
    fightStatDamage: 0.06, // extra damage share per point of fight stat
    raiderHP: 70,
    raiderDamage: 11,
    raiderWindup: 0.55, // the red flash before a raider hits: time to block or dodge
    raiderCooldown: 1.3,
    bossHP: 1100,
    bossDamage: 24,
    waves: [5, 8, 8], // raiders per wave; the boss comes with the last wave
    soldiersPerBarracks: 4,
  },
  healTime: 20, // seconds to heal a wounded soldier with a heal-1 tomato (heal 10: ~2 s)
};
