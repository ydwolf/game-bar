# The Game Bar

A western-saloon "cocktail cabinet": one static web page with six two-sided arcade games and one original one-player game. Every side of every game can be played by a human or by the computer, so you can play a friend on the same device, play either role against the computer, or watch the computer play itself.

| Game | Side A | Side B |
|---|---|---|
| Snake | 🐍 Snake — catch the pear | 🍐 Pear — survive 30 s (with a dash) |
| Breakout | 🪵 Paddle — break through the wall | 🧱 Mason — patch holes, roll tumbleweeds |
| Splat | 🐦 Bird — clear 10 cacti | 🌵 Planter — slide the gap before it locks |
| Asteroids | 🚀 Ship — survive 45 s | ☄️ Rock thrower — aim rocks at the ship |
| Missile Command | 💣 Defender — save the towns | 🔥 Raider — flatten 4 of 6 towns |
| Gold Rush (Pac-Man) | 🤠 Prospector — collect the gold | 🦹 Bandit — catch the prospector |
| Life in the Colony (original, one player) | 🏡 Founder — get the village housed, fed and warm before the first snow | — |

Matches are first to 3 rounds. Each round is a level: the game's numbers change and the computer player gets sharper, so it starts easy and gets harder whichever side you play.

**Life in the Colony** is my original game, a one-player arcade cut of my own colony-sim design (Notion GDD). Each round is a year: before the first snow you need enough people, a bed for each, and enough food and firewood. Gather by a timing minigame, build, hire at the Tavern, and forge tools so villagers gather for you ("do it yourself, or delegate it"). Make it and the village carries into a harder year; miss and the run is over. Each year switches on more: couriers and blacksmiths, then builders, then hunger, cooking, food poisoning and a healer. All the art is pixel sprites drawn in code (`js/games/colony-art.js`).

## Controls

- **One human:** arrow keys or WASD, Space for the main action, Shift for the second action. Aiming roles also work with the mouse.
- **Two humans on one keyboard:** Player 1 uses WASD / Space / Q, Player 2 uses the arrow keys / Enter / `/`.
- **Phones:** each human gets an on-screen pad; with two players, the far player's pad is flipped to face them.
- Esc or P pauses.

## How it's built

Plain HTML, CSS and JavaScript modules — no build step, no server, no API keys.

- `js/games/*.js` — each game: its rules (`createRound`), drawing, and a computer player for each side.
- `js/input.js` — every side is driven by an `Input`. Keyboard, touch and mouse write into it, and so do the bots, so the computer plays with exactly the same controls and limits as a person (no reading the future, no skipped collisions).
- `js/engine.js` — runs one frame of a round; shared by the site and the fairness test.
- `js/cabinet.js` — the table: seats, keys, pads, rounds, scoring.
- `js/main.js` — the single page's three views: menu, seat picker, table.

## Sound

Every game has synthesized sound effects (`js/sound.js`, Web Audio, no audio files). The 🔊 button next to Pause, or the M key, mutes.

## Fairness check

```bash
node tests/fairness.js
```

Plays hundreds of computer-vs-computer rounds of every game at every level with equal skill on both sides and prints how often each side wins. The per-level numbers in each game were tuned with this until every level landed near 50/50.

For the one-player colony game, `node tests/colony-tune.js` has a computer Founder play year after year and prints how far it gets, and the setup screen can start at any year to test later levels.

## Deploying

Netlify serves the repo root as-is (see `netlify.toml`); every push to `main` deploys.
