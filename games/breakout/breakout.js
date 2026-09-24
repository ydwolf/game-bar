// Breakout — bust up the adobe wall with a gold coin.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const screen = canvas.parentElement;
  const W = canvas.width;
  const H = canvas.height;
  const hud = Arcade.createHud("breakout");
  const livesEl = document.getElementById("lives");
  Arcade.captureKeys();

  const COLS = 8, ROWS = 6, BW = 52, BH = 18, GAP = 4, TOP = 70;
  const LEFT = (W - (COLS * BW + (COLS - 1) * GAP)) / 2;
  const ROW_COLORS = ["#b8442e", "#d0692f", "#d9a23a", "#7a9a55", "#3a8f89", "#4f7aa8"];
  const ROW_POINTS = [60, 50, 40, 30, 20, 10];

  const paddle = { x: W / 2, y: H - 40, w: 86, h: 14 };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, r: 7, stuck: true };
  const keys = { left: false, right: false };
  let bricks = [];
  let score = 0, lives = 3, level = 1, speed = 340;
  let state = "ready"; // ready | playing | over

  function buildBricks() {
    bricks = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        bricks.push({
          x: LEFT + c * (BW + GAP),
          y: TOP + r * (BH + GAP),
          color: ROW_COLORS[r],
          points: ROW_POINTS[r],
          alive: true,
        });
      }
    }
  }

  function newGame() {
    score = 0;
    lives = 3;
    level = 1;
    speed = 340;
    hud.setScore(0);
    livesEl.textContent = lives;
    buildBricks();
    ball.stuck = true;
    state = "playing";
    Arcade.hideOverlay();
  }

  function launch() {
    if (!ball.stuck) return;
    const a = (Math.random() - 0.5) * 0.8;
    ball.vx = speed * Math.sin(a);
    ball.vy = -speed * Math.cos(a);
    ball.stuck = false;
  }

  function loseLife() {
    lives--;
    livesEl.textContent = lives;
    if (lives > 0) {
      ball.stuck = true;
      return;
    }
    state = "over";
    const best = hud.finish(score);
    Arcade.showOverlay("Busted!", `Final score: ${score}${best ? " · New best!" : ""}\n${Arcade.say.click} to play again`);
  }

  function nextLevel() {
    level++;
    speed += 40;
    buildBricks();
    ball.stuck = true;
  }

  // Moves the ball a small time slice. Returns false if the ball's turn is over.
  function moveBall(t) {
    ball.x += ball.vx * t;
    ball.y += ball.vy * t;

    if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
    if (ball.x > W - ball.r) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
    if (ball.y < ball.r) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }
    if (ball.y - ball.r > H) { loseLife(); return false; }

    // Paddle: bounce angle depends on where the ball hits
    const onPaddle =
      ball.vy > 0 &&
      ball.y + ball.r >= paddle.y &&
      ball.y - ball.r <= paddle.y + paddle.h &&
      Math.abs(ball.x - paddle.x) <= paddle.w / 2 + ball.r;
    if (onPaddle) {
      const hit = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
      const a = hit * 1.05;
      ball.vx = speed * Math.sin(a);
      ball.vy = -speed * Math.cos(a);
      ball.y = paddle.y - ball.r;
    }

    for (const b of bricks) {
      if (!b.alive) continue;
      const nx = clamp(ball.x, b.x, b.x + BW);
      const ny = clamp(ball.y, b.y, b.y + BH);
      if ((ball.x - nx) ** 2 + (ball.y - ny) ** 2 > ball.r ** 2) continue;

      b.alive = false;
      score += b.points;
      hud.setScore(score);

      // Bounce off whichever side we overlap least
      const ox = Math.min(ball.x + ball.r - b.x, b.x + BW - (ball.x - ball.r));
      const oy = Math.min(ball.y + ball.r - b.y, b.y + BH - (ball.y - ball.r));
      if (ox < oy) ball.vx = ball.x < b.x + BW / 2 ? -Math.abs(ball.vx) : Math.abs(ball.vx);
      else ball.vy = ball.y < b.y + BH / 2 ? -Math.abs(ball.vy) : Math.abs(ball.vy);

      if (bricks.every((br) => !br.alive)) {
        nextLevel();
        return false;
      }
      break;
    }
    return true;
  }

  function update(dt) {
    if (keys.left) paddle.x -= 560 * dt;
    if (keys.right) paddle.x += 560 * dt;
    paddle.x = clamp(paddle.x, paddle.w / 2, W - paddle.w / 2);

    if (state !== "playing") return;
    if (ball.stuck) {
      ball.x = paddle.x;
      ball.y = paddle.y - ball.r - 1;
      return;
    }
    // Sub-steps keep the fast ball from tunnelling through bricks
    const steps = Math.ceil((speed * dt) / (ball.r * 0.5));
    for (let i = 0; i < steps; i++) if (!moveBall(dt / steps)) return;
  }

  // ---------- Input ----------

  window.addEventListener("pointermove", (e) => {
    paddle.x = Arcade.canvasPoint(canvas, e).x;
  });
  screen.addEventListener("pointerdown", (e) => {
    paddle.x = Arcade.canvasPoint(canvas, e).x;
    if (state !== "playing") newGame();
    else launch();
  });
  window.addEventListener("keydown", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
    if (e.code === "Space" && !e.repeat) {
      if (state !== "playing") newGame();
      else launch();
    }
  });
  window.addEventListener("keyup", (e) => {
    if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  });

  // ---------- Drawing ----------

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2a1a12");
    g.addColorStop(1, "#41291a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    for (let x = 60; x < W; x += 60) ctx.fillRect(x, 0, 2, H);

    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, BW, BH, 3);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.fillRect(b.x + 2, b.y + 2, BW - 4, 3);
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(b.x + 2, b.y + BH - 4, BW - 4, 2);
    }

    // Wooden plank with brass caps
    const px = paddle.x - paddle.w / 2;
    ctx.fillStyle = "#8a5a33";
    ctx.beginPath();
    ctx.roundRect(px, paddle.y, paddle.w, paddle.h, 4);
    ctx.fill();
    ctx.fillStyle = "#6e4526";
    ctx.fillRect(px + 10, paddle.y + 6, paddle.w - 20, 2);
    ctx.fillStyle = "#c9a45c";
    ctx.fillRect(px, paddle.y, 7, paddle.h);
    ctx.fillRect(px + paddle.w - 7, paddle.y, 7, paddle.h);

    // Gold coin ball
    const cg = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, ball.r);
    cg.addColorStop(0, "#fbe7a4");
    cg.addColorStop(1, "#c99a3a");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#8a6420";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (state === "playing" && ball.stuck) {
      ctx.fillStyle = "#f3e6c9";
      ctx.textAlign = "center";
      ctx.font = '26px "Rye", serif';
      ctx.fillText(`Level ${level}`, W / 2, H * 0.58);
      ctx.font = '16px "Special Elite", monospace';
      ctx.fillText(`${Arcade.say.click} to launch`, W / 2, H * 0.58 + 30);
    }
  }

  Arcade.loop((dt) => {
    update(dt);
    draw();
  });

  buildBricks();
  ball.x = paddle.x;
  ball.y = paddle.y - ball.r - 1;
  Arcade.showOverlay("Breakout", `Bust up the adobe wall.\n${Arcade.say.click} to start`);
})();
