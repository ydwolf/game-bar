// Missile — defend the frontier towns from falling fire with the town cannon.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const screen = canvas.parentElement;
  const W = canvas.width;
  const H = canvas.height;
  const GROUND = 440;
  const hud = Arcade.createHud("missile");
  const waveEl = document.getElementById("wave");
  const ammoEl = document.getElementById("ammo");
  Arcade.captureKeys();

  const CANNON = { x: W / 2, y: GROUND - 14 };
  const TOWN_XS = [70, 150, 230, 410, 490, 570];
  const SHOT_SPEED = 520;

  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * GROUND * 0.7,
    r: Math.random() * 1.2 + 0.3,
  }));

  let towns = TOWN_XS.map((x) => ({ x, alive: true }));
  let incoming = [], shots = [], blasts = [];
  let score = 0, wave = 0, ammo = 0, toSpawn = 0, spawnTimer = 0, interTimer = 0, time = 0, overAt = 0;
  let aim = { x: W / 2, y: H / 3 };
  let state = "ready"; // ready | playing | intermission | over

  function newGame() {
    towns = TOWN_XS.map((x) => ({ x, alive: true }));
    incoming = [];
    shots = [];
    blasts = [];
    score = 0;
    wave = 0;
    hud.setScore(0);
    startWave();
  }

  function startWave() {
    wave++;
    toSpawn = 6 + wave * 2;
    spawnTimer = 1;
    ammo = toSpawn + 8;
    waveEl.textContent = wave;
    ammoEl.textContent = ammo;
    state = "playing";
    Arcade.hideOverlay();
  }

  function spawnIncoming() {
    const targets = towns.filter((t) => t.alive).map((t) => t.x).concat(CANNON.x);
    const tx = targets[Math.floor(Math.random() * targets.length)] + (Math.random() - 0.5) * 10;
    const sx = 20 + Math.random() * (W - 40);
    const speed = 28 + wave * 7 + Math.random() * 12;
    const len = Math.hypot(tx - sx, GROUND);
    incoming.push({ sx, sy: 0, x: sx, y: 0, vx: ((tx - sx) / len) * speed, vy: (GROUND / len) * speed });
  }

  function fire(p) {
    if (state !== "playing" || ammo <= 0) return;
    const tx = clamp(p.x, 0, W);
    const ty = clamp(p.y, 10, GROUND - 30);
    const len = Math.hypot(tx - CANNON.x, ty - CANNON.y);
    ammo--;
    ammoEl.textContent = ammo;
    shots.push({
      sx: CANNON.x, sy: CANNON.y, x: CANNON.x, y: CANNON.y, tx, ty,
      vx: ((tx - CANNON.x) / len) * SHOT_SPEED,
      vy: ((ty - CANNON.y) / len) * SHOT_SPEED,
      remaining: len,
    });
  }

  function explode(x, y, max) {
    blasts.push({ x, y, t: 0, dur: 1.1, max, r: 0 });
  }

  function update(dt) {
    time += dt;

    for (const b of blasts) {
      b.t += dt;
      b.r = b.max * Math.sin(Math.PI * Math.min(b.t / b.dur, 1));
    }
    blasts = blasts.filter((b) => b.t < b.dur);

    if (state === "intermission") {
      interTimer -= dt;
      if (interTimer <= 0) startWave();
      return;
    }
    if (state !== "playing") return;

    if (toSpawn > 0) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnIncoming();
        toSpawn--;
        spawnTimer = Math.max(0.35, 1.6 - wave * 0.1) * (0.5 + Math.random());
      }
    }

    for (const s of shots) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.remaining -= SHOT_SPEED * dt;
      if (s.remaining <= 0) {
        s.done = true;
        explode(s.tx, s.ty, 40);
      }
    }
    shots = shots.filter((s) => !s.done);

    for (const m of incoming) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;

      // Caught in a blast: it explodes too, which can chain into others
      if (blasts.some((b) => Math.hypot(m.x - b.x, m.y - b.y) < b.r)) {
        m.done = true;
        score += 25;
        explode(m.x, m.y, 26);
        continue;
      }

      if (m.y >= GROUND) {
        m.done = true;
        explode(m.x, GROUND, 30);
        for (const t of towns) if (t.alive && Math.abs(t.x - m.x) < 26) t.alive = false;
      }
    }
    incoming = incoming.filter((m) => !m.done);
    hud.setScore(score);

    const standing = towns.filter((t) => t.alive).length;
    if (!standing) {
      state = "over";
      overAt = performance.now();
      const best = hud.finish(score);
      Arcade.showOverlay(
        "The Frontier Fell",
        `Held out ${wave - 1} wave${wave === 2 ? "" : "s"} · Score ${score}${best ? " · New best!" : ""}\n${Arcade.say.click} to defend again`
      );
    } else if (toSpawn === 0 && !incoming.length && !shots.length) {
      const bonus = standing * 100 + ammo * 5;
      score += bonus;
      hud.setScore(score);
      state = "intermission";
      interTimer = 2.5;
      Arcade.showOverlay(`Wave ${wave} Held!`, `${standing} town${standing === 1 ? "" : "s"} standing · Bonus +${bonus}\nNext wave comin'…`);
    }
  }

  // ---------- Input ----------

  screen.addEventListener("pointermove", (e) => {
    aim = Arcade.canvasPoint(canvas, e);
  });
  screen.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    aim = Arcade.canvasPoint(canvas, e);
    if (state === "ready") newGame();
    else if (state === "over") {
      if (performance.now() - overAt > 600) newGame();
    } else fire(aim);
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !e.repeat && (state === "ready" || state === "over")) newGame();
  });

  // ---------- Drawing ----------

  function drawTown(t) {
    const x = t.x;
    if (t.alive) {
      ctx.fillStyle = "#b07d48";
      ctx.fillRect(x - 20, GROUND - 22, 40, 22);
      ctx.fillStyle = "#9c6a3a";
      ctx.fillRect(x - 14, GROUND - 34, 28, 12);
      ctx.fillStyle = "#7a4f2a";
      ctx.fillRect(x - 22, GROUND - 23, 44, 3);
      ctx.fillStyle = "#f3c35a";
      ctx.fillRect(x - 15, GROUND - 16, 6, 6);
      ctx.fillRect(x + 9, GROUND - 16, 6, 6);
      ctx.fillStyle = "#3b2414";
      ctx.fillRect(x - 4, GROUND - 14, 8, 14);
    } else {
      ctx.fillStyle = "#3a2418";
      ctx.beginPath();
      ctx.moveTo(x - 22, GROUND);
      ctx.lineTo(x - 14, GROUND - 8);
      ctx.lineTo(x - 4, GROUND - 5);
      ctx.lineTo(x + 6, GROUND - 11);
      ctx.lineTo(x + 18, GROUND - 4);
      ctx.lineTo(x + 22, GROUND);
      ctx.fill();
      ctx.fillStyle = "rgba(120, 110, 110, 0.25)";
      for (let i = 0; i < 3; i++) {
        const rise = (time * 14 + i * 12) % 36;
        ctx.beginPath();
        ctx.arc(x + Math.sin(time + i) * 4, GROUND - 12 - rise, 5 + rise * 0.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#120a18");
    sky.addColorStop(0.6, "#3a1c2c");
    sky.addColorStop(1, "#7a3426");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND);

    ctx.fillStyle = "#f3e6c9";
    for (const s of stars) ctx.fillRect(s.x, s.y, s.r, s.r);
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(90, 70, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "#2a1520";
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    for (const [x, y] of [[0, 400], [60, 400], [80, 370], [170, 370], [190, 405], [440, 405], [460, 380], [560, 380], [580, 400], [640, 400]]) {
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, GROUND);
    ctx.fill();

    ctx.fillStyle = "#4a2e1c";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#6e4529";
    ctx.fillRect(0, GROUND, W, 3);

    towns.forEach(drawTown);

    // Cannon on a mound, barrel following the aim point
    ctx.fillStyle = "#5a3a22";
    ctx.beginPath();
    ctx.arc(CANNON.x, GROUND, 28, Math.PI, 0);
    ctx.fill();
    const a = Math.atan2(aim.y - CANNON.y, aim.x - CANNON.x);
    ctx.save();
    ctx.translate(CANNON.x, CANNON.y);
    ctx.rotate(Math.min(-0.15, Math.max(-Math.PI + 0.15, a)));
    ctx.fillStyle = "#2b2b2b";
    ctx.fillRect(0, -4, 24, 8);
    ctx.restore();
    ctx.fillStyle = "#3b2414";
    ctx.beginPath();
    ctx.arc(CANNON.x, CANNON.y + 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c9a45c";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.lineWidth = 1.5;
    for (const m of incoming) {
      ctx.strokeStyle = "rgba(224, 96, 58, 0.8)";
      ctx.beginPath();
      ctx.moveTo(m.sx, m.sy);
      ctx.lineTo(m.x, m.y);
      ctx.stroke();
      ctx.fillStyle = "#ffd27a";
      ctx.beginPath();
      ctx.arc(m.x, m.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const s of shots) {
      ctx.strokeStyle = "rgba(243, 195, 90, 0.8)";
      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();
      ctx.strokeStyle = "#f1e4c7";
      ctx.beginPath();
      ctx.moveTo(s.tx - 4, s.ty - 4);
      ctx.lineTo(s.tx + 4, s.ty + 4);
      ctx.moveTo(s.tx + 4, s.ty - 4);
      ctx.lineTo(s.tx - 4, s.ty + 4);
      ctx.stroke();
    }

    for (const b of blasts) {
      if (b.r <= 0) continue;
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, "rgba(255, 245, 210, 0.95)");
      g.addColorStop(0.4, "rgba(243, 195, 90, 0.85)");
      g.addColorStop(1, "rgba(208, 105, 47, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state === "playing" && !Arcade.isTouch) {
      ctx.strokeStyle = "#f1e4c7";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(aim.x, aim.y, 8, 0, Math.PI * 2);
      ctx.moveTo(aim.x - 13, aim.y);
      ctx.lineTo(aim.x - 4, aim.y);
      ctx.moveTo(aim.x + 4, aim.y);
      ctx.lineTo(aim.x + 13, aim.y);
      ctx.moveTo(aim.x, aim.y - 13);
      ctx.lineTo(aim.x, aim.y - 4);
      ctx.moveTo(aim.x, aim.y + 4);
      ctx.lineTo(aim.x, aim.y + 13);
      ctx.stroke();
    }
  }

  Arcade.loop((dt) => {
    update(dt);
    draw();
  });

  Arcade.showOverlay("Missile", `Fire's fallin' on the frontier.\nBurst shells in its path to save the towns.\n${Arcade.say.click} to start`);
})();
