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
