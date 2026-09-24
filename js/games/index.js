import snake from "./snake.js";
import breakout from "./breakout.js";
import splat from "./splat.js";
import asteroids from "./asteroids.js";
import missile from "./missile.js";
import goldrush from "./goldrush.js";

export const GAMES = [snake, breakout, splat, asteroids, missile, goldrush];
export const GAMES_BY_ID = Object.fromEntries(GAMES.map((g) => [g.id, g]));
