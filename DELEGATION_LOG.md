# Delegation Log

A record of what I asked Claude (Claude Code, desktop app) to do, what it produced, and how the result was checked.

---

## 1. Build a 6×6 Minesweeper — 2026-09-23

**Asked:** Make a small static HTML/CSS/JS Minesweeper on a 6×6 board that generates the map based on where the player first clicks.

**Produced:** `index.html`, `style.css`, `script.js`. Mines are placed only after the first click, never on the clicked cell or its neighbors, so the first click always opens an area. Flood-fill reveal, right-click / long-press flags, mine counter, timer, reset button, win/lose states.

**Verified:** Claude opened the game in its built-in browser and scripted clicks. The first click opened 24 of 36 cells, exactly 6 mines were placed, a flag dropped the counter from 6 to 5, and clearing every safe cell showed the win message. *Not tested:* the lose screen.

---

## 2. Put it on GitHub — 2026-09-23

**Asked:** Make the folder a git repo and connect it to `https://github.com/ydwolf/game-bar.git`.

**Produced:** A git repo on `main` with a `.gitignore`, first commit, `origin` remote, and a push.

**Verified:** Before pushing, Claude checked that the remote was empty (`git ls-remote`) so nothing would be overwritten. After pushing, `git status` showed `main` tracking `origin/main`.

---

## 3. Fix Netlify deploys — 2026-09-23

**Asked:** "This isn't stable for Netlify to deploy."

**Produced:** `netlify.toml` setting the publish folder to the repo root and a no-op build command (the site has nothing to build), plus basic security headers.

**Verified:** The TOML was parsed to confirm it is valid. Claude removed a header rule it realized Netlify doesn't support. *Caveat:* Claude never saw the actual Netlify error, so the fix was a best guess. I need to confirm the deploy succeeded on Netlify.

---

## 4. Western "Game Bar" menu with six games, mobile-friendly — 2026-09-23

**Asked:** A western-themed game bar menu with Snake, Breakout, Flap, Asteroids, Missile, and Minesweeper (Imitation left out for now), with the whole site western-themed. Mid-task: make it work on phones too.

**Produced:**
- Menu page styled as a saloon: hanging wooden sign, parchment panel, one card per game showing controls, a tagline, and best score.
- Shared theme (`css/western.css`) and shared helpers (`js/arcade.js`: best scores, overlays, touch buttons).
- Six games in `games/`, each redrawn with western art (rattlesnake, adobe bricks, bird in a cowboy hat dodging saguaros, rocks over the mesas, meteors on frontier towns, dynamite Minesweeper).
- Touch support: swipe and a D-pad for Snake, turn/thrust/fire buttons for Asteroids, drag and tap for the mouse games, a Dig/Flag toggle for Minesweeper, and "Tap" instead of "Press Space" on phones.

**Verified:**
- The browser pane was hidden, which pauses animation, so real-time play wasn't possible. Claude loaded each game in a hidden frame and stepped its frames by hand with simulated input instead. Every game started, scored, and ended with no console errors. Missile advanced from wave 1 to wave 2, and Flap scored a cactus before crashing.
- Every page was checked at phone size (375×812) with touch emulation. The on-screen pads were pressed to confirm they drive the games.
- Testing found four bugs, which were fixed: a best score overlapping a card label on narrow screens, Minesweeper's start message not clearing, Asteroids turn icons too small, and Missile showing 0 ammo before the game starts.
- Claude cleared the test best scores out of the browser afterward.
- *Not tested:* a real phone.
- *Status:* committed locally (`a829e2a`), **not pushed yet**.

---

## 5. Brainstorm: make every game two-player — 2026-09-23

**Asked:** Every game should be two-player with different roles. The player picks one side, and the computer plays the other.

**Produced:** A design where each role is driven by a swappable "controller" (keyboard, touch, computer bot, or later a remote player), so games don't have to be rewritten to change who plays a side. Proposed role pairs with win conditions for both sides.

**Decided (with me):**
| Game | Side A | Side B |
|---|---|---|
| Snake | Snake: catch the pear | Pear: survive 60 s (short dash, cacti to hide behind) |
| Breakout | Paddle: clear the wall | Mason: rebuild bricks / drop obstacles |
| Flap / Splat | Bird: clear 15 cacti | Planter: moves the gap of a single cactus. The gap **locks** about 1 s before the bird arrives so the Planter can't dodge at the last instant |
| Asteroids | Ship: survive | Rock thrower: aims and launches rocks, limited supply |
| Missile Command | Defender: shoot down meteors | Raider: drops meteors on chosen towns |
| Game of choice | Pac-Man, western version: Prospector collects gold | Bandit chases (replaces Minesweeper) |

**Verified:** Reviewed and adjusted by me. The Flap lock-zone rule came from Claude pointing out that a freely moving gap would let the Planter always win.

---

## 6. Check the plan against the assignment rubric — 2026-09-23

**Asked:** Here's the rubric. Compare it to what we're building.

**Produced:** A requirement-by-requirement comparison. Gaps found:
- Each side needs its own Human/Computer switch, so all four combinations must work, including two humans on one device and computer vs computer.
- The rubric asks for a **single page** ("cocktail cabinet"), but the site is currently a menu plus separate game pages.
- Bots must play through the same inputs as a human (no cheating), and difficulty must ramp for both sides.
- The rubric's game list says **Splat**, not Flap. Need to confirm with the teacher.
- Imitation needs two browsers and uses "Claude in your own browser" as the AI. **On hold** until I find out how the teacher wants it.
- The site must be on a domain I own, **not** a `netlify.app` address.

**Verified:** Claude's comparison was checked against the rubric text.

---

## 7. Start this log — 2026-09-23

**Asked:** Start the delegation log.

**Produced:** This file, with entries 1–6 filled in from the session so far.

**Verified:** I read through it.

---

## 8. Build the site to the rubric — 2026-09-23

**Asked:** "Build the website as specified," then push to GitHub so my CI/CD deploys it. Imitation stays on hold.

**Produced:**
- Rebuilt the site as **one page** with three views: the menu, a seat picker (Human or Computer for each side), and the game table. Matches are first to 3 rounds.
- Six two-sided games: Snake (Snake vs Pear), Breakout (Paddle vs Mason), Splat (Bird vs Planter), Asteroids (Ship vs Rock thrower), Missile Command (Defender vs Raider), and Gold Rush, a western Pac-Man (Prospector vs Bandit) as my game of choice.
- All four seat combinations work: human vs computer either way round, two humans on one device (split keyboard, or two phone pads with the far one flipped), and computer vs computer.
- Every side is driven by the same `Input` object whether a person or a bot is playing, so bots use the same controls and speed limits as a human.
- Difficulty ramps each round: game numbers change per level and the computer's skill rises from 0.3 to 0.85.
- `tests/fairness.js`, which plays hundreds of computer-vs-computer rounds of each game at each level.

**Changed from the plan along the way (found by the fairness test):**
- **Breakout:** "clear the whole wall" was nearly impossible in time (a clean clear took ~100 s even with no Mason). The goal became **break through**: the Paddle wins by getting the ball through the wall.
- **Splat:** the gap lock time has to be much shorter than 1 s (0.52 s down to 0.30 s by level), or the Bird always wins. The gap is a fixed 130 px.
- **Missile Command:** the Raider wins by flattening **4 of 6** towns. Needing all 6 made the Defender unbeatable.
- **Gold Rush:** added **spurs** (a short sprint) for the Bandit. A lone chaser in a looping maze couldn't keep up otherwise.
- Several bots were fixed after the test showed them misbehaving. The Snake and Splat bots crashed on their own, the Defender bot aimed with superhuman precision, and the Raider bot never used salvos or splits.

**Verified:**
- **Fairness:** final computer-vs-computer results (300–400 rounds per level). Every game at every level lands between 36% and 62% for side A:

  | Game | L1 | L2 | L3 | L4 | L5 |
  |---|---|---|---|---|---|
  | Snake (Snake wins) | 48% | 39% | 38% | 44% | 57% |
  | Breakout (Paddle) | 36% | 39% | 43% | 46% | 62% |
  | Splat (Bird) | 50% | 57% | 48% | 61% | 45% |
  | Asteroids (Ship) | 51% | 47% | 46% | 54% | 49% |
  | Missile (Defender) | 39% | 42% | 46% | 47% | 53% |
  | Gold Rush (Prospector) | 44% | 49% | 55% | 53% | 41% |

- **In the browser:** all six games played computer vs computer on the real page with no errors, through to a match winner. Claude screenshotted each game mid-round to check the art.
- **Human play:** Claude played Snake as a human with simulated key presses: the rounds, score, match-end screen and Swap seats all worked.
- **Phones:** phone layout was checked at 375×812 with touch emulation, including two players on one phone. Pressing the on-screen Throw button fired a rock.
- *Caveat:* the browser pane was hidden during testing, which pauses animation, so frames were stepped by hand instead of watched live.
- *Not tested:* a real phone, or two real people playing.
