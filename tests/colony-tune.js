// Tuning aid for Life in the Colony (a one-player game, so it has no fairness test).
// A computer Founder plays year after year, carrying the village forward the way the game
// does, and this prints the day each year was ready for winter — or what it was missing.
//
//   node tests/colony-tune.js            10 runs at skill 0.6
//   node tests/colony-tune.js 20 0.4     20 runs at skill 0.4

import { createRoundSet, tick } from "../js/engine.js";
import colony from "../js/games/colony.js";

const [runsArg, skillArg] = process.argv.slice(2);
const RUNS = Number(runsArg) || 10;
const SKILL = Number(skillArg) || 0.6;
const DT = 1 / 60;
const YEARS = 10;

const reached = Array(YEARS).fill(0);
const readyDays = Array.from({ length: YEARS }, () => []);
for (let run = 0; run < RUNS; run++) {
  let prev = null;
  for (let year = 1; year <= YEARS; year++) {
    const set = createRoundSet(colony, year, [null, null], prev);
    const bot = colony.sides[0].bot(set.round, set.inputs[0], SKILL);
    const c = set.round.colony;
    let w = null;
    let readyAt = null;
    for (let t = 0; w === null && t < 1000; t += DT) {
      bot.update(DT * set.round.timeScale);
      w = tick(set, DT);
      if (readyAt === null && c.ready()) readyAt = c.clock / 20 + 1;
    }
    if (w !== 0) {
      if (run < 3) console.log(`  run ${run + 1}: year ${year} failed — ${set.round.endReason}`);
      break;
    }
    reached[year - 1]++;
    readyDays[year - 1].push(readyAt);
    prev = set.round;
  }
}
console.log(`\nSkill ${SKILL}, ${RUNS} runs:`);
reached.forEach((n, i) => {
  const days = readyDays[i];
  const avg = days.length ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1) : "-";
  console.log(`  year ${i + 1}: survived ${n}/${RUNS}, ready on day ${avg} of 9 (avg)`);
});
