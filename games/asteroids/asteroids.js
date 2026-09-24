// Asteroids — rocks fallin' from the night sky over the mesas.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const screen = canvas.parentElement;
  const W = canvas.width;
  const H = canvas.height;
  const hud = Arcade.createHud("asteroids");
  const livesEl = document.getElementById("lives");
  Arcade.captureKeys();

  const ROCK_R = { 3: 40, 2: 22, 1: 12 };
  const ROCK_PTS = { 3: 20, 2: 50, 1: 100 };
  const keys = { left: false, right: false, up: false, fire: false };

  const stars = Array.from({ length: 80 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: Math.random() * 1.3 + 0.3,
    a: Math.random() * 0.6 + 0.2,
  }));

  let ship = null, bullets = [], rocks = [], particles = [];
  let score = 0, lives = 3, wave = 0, fireCd = 0, respawnTimer = 0, waveTimer = 0, time = 0, overAt = 0;
  let state = "ready"; // ready | playing | over

  function newShip() {
    return { x: W / 2, y: H / 2, a: -Math.PI / 2, vx: 0, vy: 0, r: 12, invuln: 2.5 };
  }

  function makeRock(x, y, size, speedMul = 1) {
    const ang = Math.random() * Math.PI * 2;
    const sp = (25 + Math.random() * 35) * (1 + (3 - size) * 0.6) * speedMul;
    return {
      x, y, size,
      r: ROCK_R[size],
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 1.2,
      shape: Array.from({ length: 10 }, () => 0.75 + Math.random() * 0.4),
    };
  }

  function spawnWave() {
    wave++;
    const center = ship || { x: W / 2, y: H / 2 };
    for (let i = 0; i < 3 + wave; i++) {
      let x, y;
      do {
        x = Math.random() * W;
        y = Math.random() * H;
      } while (Math.hypot(x - center.x, y - center.y) < 170);
      rocks.push(makeRock(x, y, 3, 1 + wave * 0.08));
    }
  }

  function newGame() {
    ship = newShip();
    bullets = [];
    rocks = [];
    particles = [];
    score = 0;
    lives = 3;
    wave = 0;
    fireCd = 0;
    waveTimer = 0;
    hud.setScore(0);
    livesEl.textContent = lives;
    spawnWave();
    state = "playing";
    Arcade.hideOverlay();
  }

  function tryStart() {
    if (state === "playing") return;
    if (state === "over" && performance.now() - overAt < 600) return;
    newGame();
  }

  function wrap(o) {
    const m = o.r || 0;
    if (o.x < -m) o.x = W + m;
    else if (o.x > W + m) o.x = -m;
    if (o.y < -m) o.y = H + m;
    else if (o.y > H + m) o.y = -m;
  }

  function burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 140;
      const life = 0.4 + Math.random() * 0.6;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, color });
    }
  }

  function hitRock(rock, spawned) {
    rock.dead = true;
    score += ROCK_PTS[rock.size];
    hud.setScore(score);
    burst(rock.x, rock.y, 6 + rock.size * 4, "#d9b98a");
    if (rock.size > 1) {
      for (let i = 0; i < 2; i++) spawned.push(makeRock(rock.x, rock.y, rock.size - 1, 1 + wave * 0.08));
    }
  }

  function killShip() {
    burst(ship.x, ship.y, 30, "#e8903a");
    ship = null;
    lives--;
    livesEl.textContent = lives;
    if (lives > 0) {
      respawnTimer = 1.2;
      return;
    }
    state = "over";
    overAt = performance.now();
    const best = hud.finish(score);
    Arcade.showOverlay("Dust Settled", `Score: ${score} · Wave ${wave}${best ? " · New best!" : ""}\n${Arcade.say.start} to saddle up again`);
  }

  function update(dt) {
    time += dt;

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const r of rocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.rot += r.spin * dt;
      wrap(r);
    }

    if (state !== "playing") return;

    if (ship) {
      if (keys.left) ship.a -= 4.2 * dt;
      if (keys.right) ship.a += 4.2 * dt;
      if (keys.up) {
        ship.vx += Math.cos(ship.a) * 280 * dt;
        ship.vy += Math.sin(ship.a) * 280 * dt;
      }
      const drag = Math.pow(0.45, dt);
      ship.vx *= drag;
      ship.vy *= drag;
      const sp = Math.hypot(ship.vx, ship.vy);
      if (sp > 340) {
        ship.vx *= 340 / sp;
        ship.vy *= 340 / sp;
      }
      ship.x += ship.vx * dt;
      ship.y += ship.vy * dt;
      wrap(ship);
      ship.invuln = Math.max(0, ship.invuln - dt);

      fireCd -= dt;
      if (keys.fire && fireCd <= 0 && bullets.length < 6) {
        const cos = Math.cos(ship.a), sin = Math.sin(ship.a);
        bullets.push({ x: ship.x + cos * 14, y: ship.y + sin * 14, vx: ship.vx + cos * 500, vy: ship.vy + sin * 500, life: 0.95 });
        fireCd = 0.22;
      }
    } else {
      respawnTimer -= dt;
      const clear = rocks.every((r) => Math.hypot(r.x - W / 2, r.y - H / 2) > r.r + 90);
      if (respawnTimer <= 0 && clear) ship = newShip();
    }

    for (const b of bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      wrap(b);
    }

    const spawned = [];
    for (const b of bullets) {
      if (b.life <= 0) continue;
      for (const r of rocks) {
        if (r.dead || Math.hypot(b.x - r.x, b.y - r.y) > r.r) continue;
        b.life = 0;
        hitRock(r, spawned);
        break;
      }
    }

    if (ship && ship.invuln <= 0) {
      for (const r of rocks) {
        if (r.dead || Math.hypot(ship.x - r.x, ship.y - r.y) > r.r + ship.r * 0.7) continue;
        hitRock(r, spawned);
        killShip();
        break;
      }
    }

    bullets = bullets.filter((b) => b.life > 0);
    rocks = rocks.filter((r) => !r.dead).concat(spawned);

    if (state === "playing" && !rocks.length) {
      waveTimer += dt;
      if (waveTimer > 1.2) {
        waveTimer = 0;
        spawnWave();
      }
    }
  }

  // ---------- Input ----------

  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "up", KeyW: "up",
    Space: "fire",
  };

  window.addEventListener("keydown", (e) => {
    const k = KEYMAP[e.code];
    if (!k) return;
    if (k === "fire" && !e.repeat) tryStart();
    keys[k] = true;
  });
  window.addEventListener("keyup", (e) => {
    const k = KEYMAP[e.code];
    if (k) keys[k] = false;
  });
  screen.addEventListener("pointerdown", tryStart);

  // ---------- Drawing ----------

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#120c16");
    g.addColorStop(1, "#2e1b22");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = "#f3e6c9";
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // Mesa silhouette along the bottom
    ctx.fillStyle = "#1c1116";
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (const [x, y] of [[0, 450], [70, 450], [95, 405], [210, 405], [230, 440], [360, 440], [380, 420], [470, 420], [490, 455], [640, 455]]) {
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.fill();

    for (const r of rocks) {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.beginPath();
      r.shape.forEach((m, i) => {
        const a = (i / r.shape.length) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r.r * m, Math.sin(a) * r.r * m);
      });
      ctx.closePath();
      ctx.fillStyle = "#4a3325";
      ctx.fill();
      ctx.strokeStyle = "#d9b98a";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = "#f3c35a";
    for (const b of bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of particles) {
      ctx.globalAlpha = p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;

    const blink = ship && ship.invuln > 0 && Math.floor(time * 10) % 2 === 0;
    if (ship && !blink) {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.a);
      if (keys.up && state === "playing") {
        ctx.fillStyle = "#e8903a";
        ctx.beginPath();
        ctx.moveTo(-8, -5);
        ctx.lineTo(-18 - Math.random() * 6, 0);
        ctx.lineTo(-8, 5);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-11, -10);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-11, 10);
      ctx.closePath();
      ctx.fillStyle = "#2a1a12";
      ctx.fill();
      ctx.strokeStyle = "#f1e4c7";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  Arcade.loop((dt) => {
    update(dt);
    draw();
  });

  // Some drifting rocks behind the title screen
  for (let i = 0; i < 5; i++) rocks.push(makeRock(Math.random() * W, Math.random() * H, 1 + (i % 3)));
  Arcade.showOverlay("Asteroids", `Rocks fallin' from the sky, partner.\nBlast 'em before they flatten you.\n${Arcade.say.start} to start`);
})();
