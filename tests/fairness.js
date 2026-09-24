// Fairness check: pits the computer against itself on both sides of every game, at every
// level, using the same game and bot code the site runs. A fair game should land near 50/50
// at each level, and rounds should neither end instantly nor drag on forever.
//
//   node tests/fairness.js            all games, 200 rounds per level
//   node tests/fairness.js snake 500  one game, 500 rounds per level

import { createRoundSet, tick } from "../js/engine.js";
import { skillAt } from "../js/util.js";

const ALL = ["snake", "breakout", "splat", "asteroids", "missile", "goldrush"];
const [only, roundsArg] = process.argv.slice(2);
const ROUNDS = Number(roundsArg) || 200;
const DT = 1 / 60;
const MAX_SECONDS = 600;

for (const id of only ? [only] : ALL) {
  const game = (await import(`../js/games/${id}.js`)).default;
  console.log(`\n${game.title}: ${game.sides[0].name} vs ${game.sides[1].name}`);
  for (let level = 1; level <= 5; level++) {
    const skill = skillAt(level);
    let winsA = 0;
    let stalls = 0;
    let totalTime = 0;
    const reasons = {};
    for (let n = 0; n < ROUNDS; n++) {
      const set = createRoundSet(game, level, [skill, skill]);
      let t = 0;
      let w = null;
      while (w === null && t < MAX_SECONDS) {
        w = tick(set, DT);
        t += DT;
      }
      if (w === null) stalls++;
      if (w === 0) winsA++;
      totalTime += t;
      const why = set.round.endReason || "(no winner)";
      reasons[why] = (reasons[why] || 0) + 1;
    }
    const pct = ((100 * winsA) / ROUNDS).toFixed(0).padStart(3);
    const avg = (totalTime / ROUNDS).toFixed(1).padStart(5);
    console.log(`  level ${level}: ${game.sides[0].name} wins ${pct}%  avg round ${avg}s${stalls ? `  STALLED ${stalls}` : ""}`);
    if (process.env.REASONS) for (const [why, n] of Object.entries(reasons)) console.log(`      ${String(n).padStart(4)}  ${why}`);
  }
}
