THE GAME BAR — WAVE 2 IMPROVEMENT LOG

Prepared by: Yosef Wolf
Site: https://games.graydates.com
Repository: https://github.com/ydwolf/game-bar
Original game: Life in the Colony
Period covered: Monday, October 5, 2026 (Wave 1 submission) to the present
Supporting record: DELEGATION_LOG.md (every request, change and check, in date order)


1. SUMMARY

Since the Wave 1 submission the cabinet has gained an original eighth game (Life in the Colony), sound in every game, a custom domain, and two rounds of playtest-driven fixes. Every two-sided game was re-checked for balance with computer-versus-computer runs after its changes. Changes are listed game by game below; each entry names what changed, why, and how it was verified.

Balance figures are from tests/fairness.js: the computer plays both sides at equal skill, and a fair level lands near 50%. Figures are the share of rounds won by the first-named side at each of the five levels.


2. CABINET-WIDE IMPROVEMENTS

2.1 Sound in every game
- Added js/sound.js: 31 sound effects synthesized in the browser (no audio files), plus quiet background sound for the colony's zones.
- Every game plays sounds for its key events (for example, catching the pear, breaking a brick, a flap, a shot, an explosion, collecting gold) and a fanfare when a round is won.
- A mute button next to Pause, and the M key, turn sound off; the choice is remembered.
- Safeguards: repeats of the same sound are spaced out, the number playing at once is capped, and sound never runs during the automated tests.

2.2 Own domain
- The site moved from gamebarywolf.netlify.app to https://games.graydates.com (a subdomain of a domain I own), with HTTPS. The existing site on graydates.com was left untouched.
- The page footer now shows which build is live (its commit ID and build time), so a deployed version can be checked at a glance.

2.3 One-player games in the cabinet
- The cabinet now supports one-player games (needed for the original game): a single-seat setup screen, a timed-run mode where the record is the fastest time, and a saved personal best.

2.4 Testing aids
- Cheat codes: a game can list codes that are typed while playing; a banner confirms each one. The list is shown on the game's setup screen. (Life in the Colony has six; see section 4.)
- Higher-resolution drawing: a game can ask to be drawn at 2–3× resolution so text and outlines stay sharp.
- Two extra keys for one-player games (B to build, X to close) without changing any two-player controls.


3. THE EXISTING GAMES

3.1 Snake (Snake vs Pear)
Changes:
- Sound: eating, dashing, crashing, growing, and a countdown for the last five seconds.
- The computer-controlled Pear was unpredictable: it re-chose its direction on every step with added randomness, so a human Snake could not read it. It now runs in straight lines (3–6 cells at a time), turning early only when blocked or when the Snake comes within 4 cells.
- A small arrow beside the Pear shows which way it is rolling, so the Snake can head it off.
- Pear speed is now set per level (previously the Pear was faster than the Snake on level 1).
Verified: balance re-tuned with per-level sweeps; Snake wins 59 / 47 / 41 / 43 / 46% across levels 1–5.

3.2 Breakout (Paddle vs Mason)
Changes:
- Sound: launch, paddle and wall bounces, brick breaks, lost balls, brick placement (and a refusal sound), tumbleweeds.
- The Mason's supply was a single unlabeled bar. It is now a row of brick slots: full slots are bricks ready to place, and the next slot visibly fills. Labels read "MASON: 3 BRICKS READY", "next brick in 2s" and "TUMBLEWEED READY".
- The gap under the Mason's trowel lights green when a brick can be placed there now, and red when it cannot (no brick ready, or the ball is too close).
- The Paddle could not win in time against a slow ball. The ball now speeds up 3% every time the Paddle hits it, up to 1.5×, shown on screen as "BALL ×1.2".
- Both sides' goals on the setup screen explain these rules.
Verified: the speed-up first gave the computer Paddle 95–100% of rounds; after re-tuning the Mason's brick rate per level, the Paddle wins 51 / 44 / 57 / 50 / 58%.

3.3 Splat (Bird vs Planter)
Changes:
- Sound: flap, passing a cactus, the gap locking, crashing.
Verified: Bird wins 53 / 64 / 51 / 57 / 49%.

3.4 Asteroids (Ship vs Rock thrower)
Changes:
- Sound: shots, engine thrust, thrown rocks, rocks breaking (pitched by size), the ship being hit, respawning.
Verified: Ship wins 51 / 52 / 50 / 44 / 56%.

3.5 Missile Command (Defender vs Raider)
Changes:
- Sound: dropping and splitting meteors, firing the cannon (and an empty-cannon sound), bursts, meteors caught in blasts, towns destroyed.
Verified: Defender wins 39 / 41 / 50 / 48 / 46%.

3.6 Gold Rush (Prospector vs Bandit)
Changes:
- Sound: collecting gold, dynamite, spurs, jailing a scared bandit, the Prospector being caught.
Verified: Prospector wins 47 / 47 / 54 / 49 / 39%.

3.7 Imitation
Status: not built. It was on hold at Wave 1 pending clarification of how it should work, and remains outstanding.


4. ORIGINAL GAME: LIFE IN THE COLONY

What it is:
A timed one-player run, cut down from my own colony-sim design (a full game design document kept in Notion). The goal is to collect three trophies as fast as possible; the completion time is the score, and the best time is saved.
- Resource Master: build a sculpture from 10,000 wood and 10,000 stone.
- Perfect Tomato: breed a seed with all four stats (walk speed, fight, healing, work speed) at 10.
- Raid: fight through the raid room alongside your soldiers.
The core idea from the design document: the player can do every job by hand, but hired villagers are faster, and better tools multiply their output — the village becomes the engine that wins the run.

How it plays:
- Five zones joined by signposted paths: the village in the middle, the forest (west), the mine (north), the farm (south) and the raid room (east).
- Hire villagers at the Tavern, build huts anywhere (one worker each, as many as you like) and assign workers to empty jobs: woodcutter, miner, farmer, courier, blacksmith, cook, healer, soldier.
- The Smithy upgrades tools from stone to iron to legendary (2, 10 and 50 per tree or rock).
- At the seed bench, crossing two seeds gives a child that takes each stat from a parent, with one stat moving up or down by one; unwanted seeds can be thrown away.
- The raid is an action fight: move and dodge with the arrows, hold Shift to block, click or press Space to attack. Raiders flash red before striking. A lost raid leaves soldiers wounded until a Healer treats them with tomatoes; the higher a tomato's healing stat, the faster they recover.

Clear to a new player:
- A how-to list on the setup screen, a goal card before the run, a "NEXT" bar that always states the next step with an arrow to it, and a prompt above the player saying what Space will do.
- A trophy bar showing progress on all three trophies, and bottom bars showing the bag, the Hall's stores and idle villagers.

Presentation:
- All art is drawn in code as smooth vector shapes (no image files or emoji): shaded buildings with signs, trees, rocks, ripening tomato plants, villagers dressed by job, raiders, and ground that differs by zone.
- Sound: footsteps, a quiet background for each zone, birds, crickets and drips, and the sounds of nearby villagers at work.

Testing aids:
- Cheat codes, typed while playing: RICH, CROWD, TOOLS, ARMY, SEEDS, HAUL (listed on the setup screen).
- Every tunable number is gathered in one file, js/games/colony-config.js.

How it got here (development history):
- October 7: first added as a two-sided game (Founder vs Raider); three playtests made it clearer and slower.
- October 7–9: a rival-colony version was tried and removed after playtesting.
- October 9: rebuilt as a one-player game ("Ready for Winter"), with fixes from playtesting (stored resources counting, food supply, a purpose for the healer and builder), cheat codes and new art.
- October 11: redesigned to the current trophy-run design. Open design questions were decided by me before building. Playtest fixes since: controls separated (B to build, X to close, Shift only blocks), the Blacksmith assignable from the forge menu, and seeds can be thrown away.
Verified: automated checks of the economy, breeding and raid; raid balance simulated (alone and bare-handed always loses; four soldiers with stone swords win about half the time; iron-armed armies win).


5. OPEN ITEMS

- Personal playtesting of every game on both sides (human and flipped): pending.
- Imitation: not built.
- Splat, Asteroids, Missile Command and Gold Rush: further improvements beyond sound are planned.
- Deployment: production deploys on Netlify are currently paused because the account's credits for this billing cycle are used up; the most recent changes are committed and will publish when deploys resume.
