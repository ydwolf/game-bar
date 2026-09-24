// Flap — a little bird in a big hat, dodging saguaros at sundown.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const screen = canvas.parentElement;
  const W = canvas.width;
  const H = canvas.height;
  const GROUND = H - 64;
  const hud = Arcade.createHud("flap");
  Arcade.captureKeys();

  const GRAVITY = 1500;
  const FLAP_V = -440;
  const SPEED = 165;
  const GAP = 150;
  const CACTUS_W = 64;
  const SPACING = 230;

  const bird = { x: 120, y: H / 2 - 40, vy: 0, r: 14 };
  let cacti = [];
  let score = 0;
  let distance = 0; // for scrolling scenery
  let time = 0;
  let overAt = 0;
  let state = "ready"; // ready | playing | over

  function reset() {
    bird.y = H / 2 - 40;
    bird.vy = 0;
    cacti = [];
    score = 0;
    hud.setScore(0);
  }

  function flap() {
    if (state === "over") {
      if (performance.now() - overAt < 450) return; // don't restart from a panicked extra tap
      reset();
    }
    if (state !== "playing") {
      state = "playing";
      Arcade.hideOverlay();
    }
    bird.vy = FLAP_V;
  }

  function crash() {
    state = "over";
    overAt = performance.now();
    const best = hud.finish(score);
    Arcade.showOverlay(
      "Pricked!",
      `${score} cact${score === 1 ? "us" : "i"} cleared${best ? " · New best!" : ""}\n${Arcade.say.start} to fly again`
    );
  }

  function hitsRect(x, y, w, h) {
    const nx = clamp(bird.x, x, x + w);
    const ny = clamp(bird.y, y, y + h);
    const r = bird.r - 2; // a little forgiveness
    return (bird.x - nx) ** 2 + (bird.y - ny) ** 2 < r * r;
  }

  function update(dt) {
    time += dt;

    if (state === "ready") {
      bird.y = H / 2 - 40 + Math.sin(time * 3) * 8;
      distance += SPEED * dt * 0.5;
      return;
    }

    if (state === "over") {
      // Tumble to the ground
      if (bird.y + bird.r < GROUND) {
        bird.vy += GRAVITY * dt;
        bird.y = Math.min(GROUND - bird.r, bird.y + bird.vy * dt);
      }
      return;
    }

    distance += SPEED * dt;
    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;
    if (bird.y - bird.r < 0) {
      bird.y = bird.r;
      bird.vy = 0;
    }

    for (const c of cacti) c.x -= SPEED * dt;
    if (!cacti.length || cacti[cacti.length - 1].x < W - SPACING) {
      const min = GAP / 2 + 50;
      const max = GROUND - GAP / 2 - 50;
      cacti.push({ x: W + 10, gapY: min + Math.random() * (max - min), passed: false });
    }
    cacti = cacti.filter((c) => c.x + CACTUS_W > -10);

    for (const c of cacti) {
      if (!c.passed && c.x + CACTUS_W < bird.x) {
        c.passed = true;
        score++;
        hud.setScore(score);
      }
      const topH = c.gapY - GAP / 2;
      const bottomY = c.gapY + GAP / 2;
      if (hitsRect(c.x, 0, CACTUS_W, topH) || hitsRect(c.x, bottomY, CACTUS_W, GROUND - bottomY)) {
        crash();
        return;
      }
    }

    if (bird.y + bird.r >= GROUND) {
      bird.y = GROUND - bird.r;
      crash();
    }
  }

  // ---------- Input ----------

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") flap();
  });
  screen.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    flap();
  });

  // ---------- Drawing ----------

  function drawRidge(factor, period, color, profile) {
    const off = (distance * factor) % period;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-off, GROUND);
    for (let base = -off; base < W + period; base += period) {
      for (const [px, py] of profile) ctx.lineTo(base + px, GROUND - py);
    }
    ctx.lineTo(W + period, GROUND);
    ctx.closePath();
    ctx.fill();
  }

  function drawCactus(x, y, h, capAtBottom) {
    if (h <= 0) return;
    ctx.fillStyle = "#5c8a3a";
    ctx.fillRect(x + 4, y, CACTUS_W - 8, h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(x + 10, y, 6, h);
    ctx.strokeStyle = "rgba(30, 60, 20, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const rx of [22, 34, 46]) {
      ctx.moveTo(x + rx, y);
      ctx.lineTo(x + rx, y + h);
    }
    ctx.stroke();
    ctx.fillStyle = "#efe2b0";
    for (let sy = y + 10; sy < y + h - 6; sy += 18) {
      for (const rx of [22, 34, 46]) ctx.fillRect(x + rx - 3, sy + (rx % 4), 2, 2);
    }
    ctx.fillStyle = "#4f7a31";
    ctx.beginPath();
    ctx.roundRect(x, capAtBottom ? y + h - 18 : y, CACTUS_W, 18, 8);
    ctx.fill();
  }

  function drawBird() {
    ctx.save();
    ctx.translate(bird.x, bird.y);
    ctx.rotate(clamp(bird.vy / 600, -0.5, 1.1));

    ctx.fillStyle = "#8b5a2b";
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8c890";
    ctx.beginPath();
    ctx.ellipse(3, 5, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    const wing = Math.sin(time * (state === "playing" ? 22 : 8)) * 3;
    ctx.fillStyle = "#6b4220";
    ctx.beginPath();
    ctx.ellipse(-5, 1 + wing, 8, 5, -0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(7, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(8, -4, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#e0922f";
    ctx.beginPath();
    ctx.moveTo(13, -1);
    ctx.lineTo(22, 2);
    ctx.lineTo(13, 5);
    ctx.fill();

    // Cowboy hat
    ctx.fillStyle = "#3b2414";
    ctx.beginPath();
    ctx.ellipse(0, -12, 15, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a2d18";
    ctx.beginPath();
    ctx.roundRect(-8, -23, 16, 11, 4);
    ctx.fill();
    ctx.fillStyle = "#c9a45c";
    ctx.fillRect(-8, -15, 16, 2);

    ctx.restore();
  }

  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#2d1e3f");
    sky.addColorStop(0.45, "#9c4a3c");
    sky.addColorStop(0.8, "#e9894a");
    sky.addColorStop(1, "#f6c46e");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND);

    ctx.fillStyle = "rgba(255, 214, 120, 0.9)";
    ctx.beginPath();
    ctx.arc(W * 0.7, GROUND - 90, 46, 0, Math.PI * 2);
    ctx.fill();

    drawRidge(0.15, 300, "#6e3328", [[0, 40], [40, 40], [60, 110], [150, 110], [170, 55], [230, 55], [245, 80], [290, 80], [300, 40]]);
    drawRidge(0.35, 260, "#4d2420", [[0, 20], [50, 20], [70, 70], [120, 70], [135, 30], [260, 30]]);

    for (const c of cacti) {
      drawCactus(c.x, 0, c.gapY - GAP / 2, true);
      const bottomY = c.gapY + GAP / 2;
      drawCactus(c.x, bottomY, GROUND - bottomY, false);
    }

    ctx.fillStyle = "#d2a865";
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = "#b98a4c";
    ctx.fillRect(0, GROUND, W, 6);
    ctx.fillStyle = "#a87a42";
    for (let i = 0; i < 14; i++) {
      const x = (((i * 53 - distance) % W) + W) % W;
      ctx.fillRect(x, GROUND + 18 + ((i * 17) % 30), 4, 3);
    }

    drawBird();
  }

  Arcade.loop((dt) => {
    update(dt);
    draw();
  });

  Arcade.showOverlay("Flap", `Keep that bird clear of the saguaros.\n${Arcade.say.start} to fly`);
})();
