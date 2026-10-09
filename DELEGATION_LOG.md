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

---

## 9. Turn my own game into the seventh cabinet game — 2026-10-07

**Asked:** Read my Notion project docs for *Life in the Colony* (Game Design Document, Dev Documentation, Folder Structure, Brainstorming Log) and make a dumbed-down version as a seventh game. When Claude first proposed using only the decided parts, I said to take everything, including the undecided ideas.

**Produced:** `js/games/colony.js`, a two-sided pocket version of the game, added to the cabinet as a seventh card (Gold Rush is untouched).
- **Founder:** your soft win ("Ikur"), meaning every required profession working on its own. Gather wood, ore and crops with a timing minigame, clear overgrown lots, build, hire visitors at the Tavern, forge tools that wear out, and cook. Anything a villager does, the Founder can do by hand until someone is hired for it.
- **Raider:** the GDD's "prosperity attracts raids." Notoriety is earned faster as the colony grows and spent on small or big bandit raids that damage buildings and wound villagers. Raids are a setback, never a reset.
- **From the docs (decided):**
  - the 4-slot bag with stacks of 20
  - the Tavern and its hiring fee
  - the Player Hall as the stockpile
  - villager tools that wear out, plus the player forging the first one
  - Couriers ferrying from the huts
  - the Builder repairing after raids and building houses
  - the Healer cutting recovery time
  - soldiers fighting raids
  - player tool levels upgraded at the Smithy (it needs ore *and* a working Blacksmith)
  - overgrown starting lots
  - villager AI built as "decide with an ordered provider list, execute with a task queue" (the Dev Documentation's two layers)
- **From the brainstorm (undecided):**
  - the eight soft-win professions
  - the sibling villages (Forager, Mechanic, Warrior, Magician), whose origin filters which jobs a villager can take
  - your workforce shaping who visits
  - visitors who leave if ignored
  - combat as a minigame through the colony ("Shields up!" when a bandit winds up)
  - minigames that get easier with better tools
  - the Cook holding meals that villagers walk over to eat
- **Levels switch systems on:** tools first, then hunger, then housing, then sickness, ending with all eight professions required.

**Verified:**
- **Founder bot alone:** with no Raider, it reached the soft win at every level. The first version took 3–11 minutes, so the economy was sped up until it took 1¼–2½ minutes.
- **Raid balance:** the first balance run had the Raider launching 12–35 raids per round and winning almost every time. Raids were made rarer and costlier, then notoriety was tuned per level.
- **Fairness:** computer-vs-computer over 120–200 rounds per level gives the Founder **46–59%** at every level.
- **In the browser:** computer-vs-computer ran on the real page with no errors, and the art was checked by screenshot. Claude then played the Founder as a human with simulated key presses: walk to the forest, chop with the minigame (+2 logs per success), walk back, and store them at the Hall.
- **Bug found and fixed:** the Founder started just outside the Hall's reach. Buildings now have a larger reach than trees.
- *Not tested:* a real person playing a whole round, or phones for this game specifically.
- *Rubric note:* with Imitation still to come, there would be 8 games. The rubric allows one "game of your choice," so Colony may need to replace Gold Rush.

---

## 10. Playtest feedback on Life in the Colony — 2026-10-07

**Asked:** "Too fast and I don't really understand how to play and what's happening," then "I can't see anything, it's too far zoomed out."

**Produced:**
- **Slower:**
  - The minigame marker moves about 35% slower, and the green zone is wider.
  - Raids can't start in the first 25 seconds, with a "RAIDS IN 25s" countdown on screen.
- **Explained in the game itself:**
  - A **NEXT bar** at the top always says the single most useful thing to do, worked out from the colony's real state (what's built, who's hired, who's missing a tool, who's hungry).
  - A **prompt above the Founder** says what Space will do right there.
  - **Alerts** when bandits are heading for a building, and labels on every lot.
  - A short **"How to play"** list on the setup screen.
- **Zoomed in:** when a human plays the Founder against the computer, the camera zooms in about 1.8× and follows them, with a **minimap** in the corner. A human Raider still sees the full map, since they need to aim anywhere. To support this, rounds are now told which seats are human (`engine.js`), and the cabinet draws crosshairs through the game's camera.
- **Local server:** it now sends no-cache headers, because the old one let the browser keep serving outdated files after every change.

**Verified:**
- **Balance:** the slowdown shifted the game toward the Founder (74–93%), so the Raider's notoriety rate was retuned per level. It's back to 45–62%.
- **In the browser:**
  - The how-to list renders on the setup screen.
  - The zoomed view, minimap, NEXT bar, raid countdown and the "Space: clear the vines" prompt were all checked by screenshot.
  - The first version of the prompt was drawn inside the zoomed camera and came out huge. It now draws at normal size over the Founder.
- *Not yet:* the user's own playtest of these changes.

---

## 11. Second playtest: "still too fast," "I don't know how to win," "I don't understand how to build" — 2026-10-07

**Asked:** "Still too fast and I don't know how to win," then (mid-change) "the zoom is good, I just don't understand how to build infrastructure."

**Produced:**
- **Slower:**
  - The whole colony runs at 75% speed. The engine supports a per-game time scale, so the bots and the clock slow down too, and the balance is unchanged.
  - The Founder walks slower.
- **The goal, stated up front:** a 6-second goal card at the start of each round, for example "Founder wins by getting these jobs working: Lumberjack and Miner, all at once for 5 seconds, within 1:40." The bottom bar now reads "TO WIN:" with each job's name and ✓ or ✗, then "HOLD 4.2s" once they're all green.
- **Building simplified:**
  - Building, hiring, repairing, forging and cooking pay from the Founder's **bag first**, so there's no required trip to the Hall.
  - Vines clear with one press of Space.
  - A lot glows yellow when you can afford it.
- **Where to go:** a bouncing 👇 arrow over whatever the NEXT bar is talking about, plus an arrow at the screen edge when it's off screen.
- **Gentler ramp:** level 1 needs only 2 jobs (Lumberjack, Miner), then 4, 6, 7, and all 8 by level 5.

**Verified:**
- **Bug found and fixed:** the Founder bot never built a Smithy at the new level 1, because no required job lives there, so its workers never got tools. Found by a no-Raider timing run; the bot now builds a Smithy whenever any required job needs a tool.
- **Balance:** rebalanced with per-level sweeps of the clock and the Raider's rate, ending at 43–58% for the Founder at every level. A Snake run confirmed the engine change doesn't affect other games.
- **In the browser:** checked by screenshot. The first version of the goal card spilled past its box, so it was shortened and the text now shrinks to fit.
- *Not yet:* the user's playtest of these changes.

## 12. Third playtest: "the first minute should be stress free" — 2026-10-07

**Asked:** "Still too much to focus on at once. Make it so that the first minute is stress free, then the raiders can come."

**Produced:**
- **A peaceful first minute when a person plays the Founder:** for 60 real seconds:
  - there are no raids and the Raider earns no notoriety
  - the Raider's crosshair is hidden
  - the round clock doesn't start until the peace is over
- **The peace is visible:** the top-right bar reads "PEACEFUL 42s" and drains in green; it then switches to the Raider's notoriety bar, with a "The peace is over — raiders are coming!" message. The goal card and the how-to list say the first minute is peaceful.
- **The computer Founder keeps the old 25-second grace.** In a sweep, the computer Founder finished level 1 *inside* the peaceful minute almost every time (88–99% wins whatever the clock length), so peace for everyone would have made computer-vs-computer games one-sided. The peace is a learning aid for a person.

**Verified:**
- **Balance:** the fairness run is unchanged for computer vs computer (Founder 46–52% at every level).
- **Timing:** a scripted human-Founder round with a sharp Raider showed the clock and notoriety frozen for 60 real seconds, the crosshair hidden, and the first raid at about 70 seconds.
- *Not yet:* the user's playtest.

## 13. Colony redesign: rival colonies, first to 1000 — 2026-10-07

**Asked:** "I like the game but don't like the raids. I don't understand the point of the game, and when it gets satisfying the round ends. Explain how the game works." I explained the loop and proposed options. The user chose: "rival colony, first to 1000 of each resource."

**Produced:**
- **Raider removed:** raids, bandits, soldiers, the Training Grounds, shields, notoriety and the peaceful minute are all gone.
- **The new game:** two colonies race on identical land (the same trees, rocks and fields). The first to own 1000 of each resource in play wins: wood and stone on levels 1–2, plus crops from level 3. Everything owned counts: the Hall, the huts' piles and the bag.
- **Growth is the satisfying part:** after every required job is filled, the Tavern keeps offering extra gatherers (up to 3 lumberjacks, miners and farmers). Workers bring back 40 a trip against 20 per gather by hand, so the village out-gathers you. Every log spent on buildings, tools and hiring has to be earned back.
- **Numbers rescaled ×10** to fit a 1000 goal (for example, the Tavern costs 40 🪵, a tool 10 🪨 + 10 🪵 and hiring 30 🪵).
- **Screens:**
  - One player: full-screen zoomed view of their colony. The top strip shows YOU and RIVAL progress bars for each resource. The bottom strip shows the bag, spare tools and a WORKING count per job.
  - Two players, or the computer vs itself: split screen, one colony per half.
- **Hints:** the NEXT hints were rewritten for the race. Once the village is running, they say to hire more gatherers, or which resource you're lowest on and where to get it.
- Both sides use the same bot, and there is a 10-minute safety clock (the colony closer to the goal wins).

**Verified:**
- **Balance:** the fairness run gives the Founder 45–52% at every level. A symmetric race should land near 50/50, and it does.
- **Pacing:** the first version took about 4.5 minutes at level 1, so worker trips were raised from 20 to 40, bringing it to about 3 minutes (5.5 at level 5). A trace of one colony shows roughly 90 seconds of setup, then about 15 resources a second once 6 workers are in.
- **In the browser:** both the one-player view and the split screen were drawn from a mid-round state and checked by screenshot. There were no console errors.
- *Not yet:* the user's playtest. The split-screen NEXT text is small at half width.

## 14. Life in the Colony removed — 2026-10-09

**Asked:** "I don't like Colony, just take it out. We'll find another game."

**Produced:**
- Deleted `js/games/colony.js` (it stays in git history if it's ever wanted back).
- Removed it from the menu (`js/games/index.js`), the fairness test and the README. The README now says six games.
- Kept the small, game-agnostic cabinet features added while building it, since any future game can use them:
  - a per-game time scale
  - a longer countdown with a goal card (`intro`)
  - a zoomed camera for cursors (`view`)
  - an optional how-to list on the setup screen

**Verified:**
- The menu shows the six remaining games, with no console errors.
- *Open:* the cabinet needs a seventh game (plus Imitation) to meet the rubric. That's for the user to choose.

## 15. Wave 2: Life in the Colony returns as the original one-player game, plus sound — 2026-10-09

**Asked:** The user pasted the Wave 2 assignment, which asks for:
- an original eighth game, played by a human only
- sound in every game
- testing on both sides
- an improvement log

The user said: "keep it single player and make it better… look at the rest of the game on the Notion documents and pick better pieces." I re-read the GDD and Brainstorming Log and proposed pieces and objectives. The user decided:
- no raiders or defenders
- a healer only for food poisoning from raw food, kept as a simple first version
- no lore
- "a basic arcade-type game"
- "upgrade the graphics so you're not using emojis"
- the objective is "Ready for winter"
- also: "add a subagent to go through the other games and add sounds"

**Delegated (subagent): sound for the six existing games.**
- New `js/sound.js`: 22 sounds synthesized with Web Audio, with no audio files. It does nothing in Node, so the fairness tests still run, and it throttles repeats and caps how many sounds play at once.
- Sounds are wired into every game's events, plus a 🔊 mute button and the M key.
- I re-ran each game's fairness test before committing.

**Produced: Life in the Colony, "Ready for winter."**
- **The goal:** each round is a year of 9 days (spring, summer, autumn). Before the first snow you need enough people, a bed for each, and enough food and firewood. Four WINTER boxes at the top turn green as you get there.
- **Carrying on:** make it and the village continues into a harder year after winter uses up its share. Miss and the run ends with "winters survived" and a saved best.
- **One thing at a time:** each year switches on one more layer.
  - Year 1: gatherers, plus tools you forge yourself.
  - Year 2: Courier and Blacksmith.
  - Year 3: Builder.
  - Year 4: hunger. Raw food can cause food poisoning, so a Cook makes safe meals and a Healer cures.
  - Year 5 and later: harsher winters.
- **Easier to play:** you can end the year early at the Hall once ready, and evenings get dusky at the end of each day so you can feel the days pass. Snow flurries start before the first snow.
- **Pixel art instead of emoji:** `js/games/colony-art.js` draws every sprite from character maps: trees, rocks, crops, bushes, houses, villagers coloured by job, 8×8 icons for the HUD, buildings built from blocks with signs, and seasonal ground tiles that turn white in winter.
- **The cabinet now supports one-player games:**
  - `solo` in a game's definition.
  - The world carries over from one level to the next through `prev`.
  - A game-over screen with a best score.
  - A level select on the setup screen as a testing aid.

**Verified:**
- `tests/colony-tune.js` has a computer Founder play year after year.
  - It is ready around day 6 of 9 in year 1 and early in years 2–3, gets tighter in years 4–6, and fails around year 7–8.
  - Without harsher winters it never lost, so I added them.
  - Its skill barely matters, which means the village's growth is the limit, not reflexes.
- In the browser, I drew real game states from mid-spring, mid-summer and the year-4 snow, and checked them by screenshot. Bugs fixed:
  - "a axe" now reads "an axe".
  - A minigame now cancels if you're away from its target.
  - The year picker's text was unreadable.
- *Not yet:* a real-time playthrough in this browser (the page is marked hidden there, so it stays paused). The user's playtest is the next step.

## 16. Colony playtest: stored items, food, and giving year 4 a purpose — 2026-10-09

**Asked:**
- "When I drop my inventory at the Hall it doesn't contribute to the total."
- Then, from playing to year 4:
  - "we're bottlenecked on food, it doesn't spawn quickly enough"
  - "the healer has no purpose"
  - "the food has no purpose, I don't see any effect"
  - "I built all the houses in the first year"
  - "the Builder's Yard has no purpose"

**Produced:**
- **Only stored things count.** The winter totals had already included the bag, so storing didn't move the number. Now only what's in the village counts: the Hall, the huts' piles and the Kitchen.
  - Food or wood in your bag shows as a yellow "+N" in its WINTER box.
  - Storing at the Hall says "Stored 16 — winter food 54/60, wood 59/60".
  - Near the snow, the NEXT bar tells you to drop your bag off.
- **More food:**
  - Each harvest gives 3 food instead of 2, and fields regrow faster (7 s with the Farm, down from 9).
  - 8 more fields can be planted for 3 wood each, by you or by the Builder.
- **A reason for the Healer:**
  - Food poisoning now lasts 2 days on its own.
  - Sick people don't count toward the People you need for winter.
  - A Healer cures them in seconds.
- **A reason for meals:**
  - Starving villagers stop working, and the worker count shows it.
  - A cooked meal makes a villager "well fed" for a day: they move 35% faster and gather twice as fast, shown by a gold star over their head. Raw food only stops the hunger, and can poison.
  - Hunger now comes every 2 days instead of 1.5.
- **A reason for houses and the Builder:**
  - Only as many house plots appear as the year needs, plus one, so houses get built as the village grows.
  - Each winter, the snow caves in one roof for every three houses, and those houses give no beds until repaired (3 wood + 1 stone).
  - The Builder repairs roofs first, then builds houses, then plants fields when food is behind.

**Verified:**
- The tuning script, run after each change, now shows year 1 ready on day 6, years 2–3 comfortable, and year 4 the hardest step (7/8 bot runs survive, ready on day 7.9). It gets tighter from year 6 and runs end around years 9–10.
  - Bigger harvests made the late game too easy, so the harsher-winter ramp went back to +2 per person per year after year 4.
- In the browser I drew year 4 after a real year 3. Fields to plant, the "well fed" stars, the store message, and the Builder having repaired both caved-in roofs all appear.
- The browser had cached the old art file, which caused a missing-sprite error. Reloading fixed it, but the user should hard-refresh.

## 17. Colony: sharper picture, cheat codes, and the "free stone" mystery — 2026-10-09

**Asked:** "Can you make it a little higher resolution? It seems very pixely." "Are there any cheats, the way the professor explained cheat codes?" "I don't have any stone in my inventory and the building costs stone, but I can still build it."

**Produced:**
- **The stone wasn't free.** Building pays from your bag first, then from the Hall's stockpile, and the Hall starts with 2 stone. Nothing on screen showed the Hall's stock, though. The bottom bar now has a HALL readout (wood, stone, food, meals from year 4, and spare tools), and the build message says "paid from your bag, then the Hall".
- **Higher resolution.** A game can now set `hiRes` and the cabinet draws it at 2–3× (from the screen's pixel density) while the game still thinks in 720×504. Text, outlines and the HUD are crisp; the sprites stay deliberately blocky pixel art. The cabinet's countdown card, cursors and pointer mapping now use the game's logical size, so other games are unaffected.
- **Cheat codes** (a testing aid the rubric suggests). Type one while playing and a purple banner confirms it:
  - Resources: WOOD, STONE, FOOD, RICH.
  - Shortcuts: BUILD (every building and house for the year), CREW (hire up to the year's goal, with tools), TOOLS, HEAL.
  - Time: SNOW (jump to the last half-day), NEXT (win the year).
  - All at once: READY.
  - The list is on the setup screen, under "Cheat codes".
  - It was going to be SKIP, but P is the pause key, so it's NEXT.
- The level select now goes up to Year 10.

**Verified:**
- Every cheat was run in Node against a real round.
- The tuning script and all six fairness runs still pass.
- In the browser, the cheat list shows on the setup screen and a year-4 frame drawn at 3× has crisp text.
