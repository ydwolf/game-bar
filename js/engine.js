// Runs one round of a game. Used by the cabinet in the browser and by the fairness
// simulator in Node, so both exercise exactly the same game and bot code.

import { Input, stepCursor } from "./input.js";

// skills: [skillA, skillB] — a number (0..1) for a computer-controlled side, null for a human
export function createRoundSet(game, level, skills) {
  const inputs = [new Input(), new Input()];
  const round = game.createRound({ level, inputs });
  const bots = skills.map((s, i) => (s == null ? null : game.sides[i].bot(round, inputs[i], s)));
  return { round, inputs, bots };
}

// Advances one frame. Returns the winning side (0 or 1) or null while the round goes on.
export function tick(set, dt) {
  const { round, inputs, bots } = set;
  for (const bot of bots) if (bot) bot.update(dt);
  if (round.cursors) {
    round.cursors.forEach((c, i) => {
      if (c) stepCursor(c, inputs[i], dt);
    });
  }
  const winner = round.update(dt);
  for (const input of inputs) input.endFrame();
  return winner;
}
