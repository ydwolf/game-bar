// Snake — wrangle the rattler across the desert, eating prickly pears.
(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const screen = canvas.parentElement;
  const N = 20; // grid is N x N
  const S = canvas.width / N; // cell size in px
  const hud = Arcade.createHud("snake");
  Arcade.captureKeys();

  const DIRS = {
    ArrowUp: [0, -1], KeyW: [0, -1],
    ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0],
    ArrowRight: [1, 0], KeyD: [1, 0],
  };

  let snake, dir, queue, food, score, stepTime, acc;
  let state = "ready"; // ready | playing | paused | over

  function reset() {
    snake = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
    dir = { x: 1, y: 0 };
    queue = [];
    score = 0;
    stepTime = 0.13;
    acc = 0;
    hud.setScore(0);
    placeFood();
  }

  function placeFood() {
    const free = [];
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        if (!snake.some((s) => s.x === x && s.y === y)) free.push({ x, y });
      }
    }
    food = free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function start() {
    reset();
    state = "playing";
    Arcade.hideOverlay();
  }

  function end(title) {
    state = "over";
    const best = hud.finish(score);
    Arcade.showOverlay(
      title,
      `${score} prickly pear${score === 1 ? "" : "s"}${best ? " · New best!" : ""}\n${Arcade.say.start} to ride again`
    );
  }

  function togglePause() {
    if (state === "playing") {
      state = "paused";
      Arcade.showOverlay("Paused", `${Arcade.say.start} to keep ridin'`);
    } else if (state === "paused") {
      state = "playing";
      Arcade.hideOverlay();
    }
  }

  // Buffer turns so quick key combos aren't lost, but never allow reversing into yourself
  function turn(dx, dy) {
    const last = queue.length ? queue[queue.length - 1] : dir;
    if ((dx === -last.x && dy === -last.y) || (dx === last.x && dy === last.y)) return;
    if (queue.length < 3) queue.push({ x: dx, y: dy });
  }

  function step() {
    if (queue.length) dir = queue.shift();
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    const eating = food && head.x === food.x && head.y === food.y;
    const body = eating ? snake : snake.slice(0, -1); // the tail moves out of the way unless we grow

    const hitWall = head.x < 0 || head.y < 0 || head.x >= N || head.y >= N;
    if (hitWall || body.some((s) => s.x === head.x && s.y === head.y)) {
      end("Snakebit!");
      return;
    }

    snake.unshift(head);
    if (eating) {
      score++;
      hud.setScore(score);
      stepTime = Math.max(0.06, stepTime - 0.003);
      placeFood();
      if (!food) end("Desert Tamed!");
    } else {
      snake.pop();
    }
  }

  // ---------- Input ----------

  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      if (e.repeat) return;
      if (state === "playing" || state === "paused") togglePause();
      else start();
      return;
    }
    const d = DIRS[e.code];
    if (!d) return;
    if (state === "ready") start();
    if (state === "playing") turn(d[0], d[1]);
  });

  // Swipe to steer, tap to start/pause
  let swipeStart = null;
  screen.addEventListener("pointerdown", (e) => {
    swipeStart = { x: e.clientX, y: e.clientY };
  });
  screen.addEventListener("pointerup", (e) => {
    if (!swipeStart) return;
    const dx = e.clientX - swipeStart.x;
    const dy = e.clientY - swipeStart.y;
    swipeStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) {
      if (state === "playing" || state === "paused") togglePause();
      else start();
      return;
    }
    if (state === "ready") start();
    if (state !== "playing") return;
    if (Math.abs(dx) > Math.abs(dy)) turn(Math.sign(dx), 0);
    else turn(0, Math.sign(dy));
  });

  // ---------- Drawing ----------

  function drawPear(cx, cy) {
    ctx.fillStyle = "#5f8a3c";
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, 3, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b83a52";
    ctx.beginPath();
    ctx.ellipse(cx, cy + 1, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f6dfa0";
    for (const [dx, dy] of [[-3, -2], [3, 0], [-1, 4], [4, 5], [-4, 3]]) {
      ctx.fillRect(cx + dx, cy + dy, 1.5, 1.5);
    }
  }

  function drawEyes(head) {
    const cx = head.x * S + S / 2;
    const cy = head.y * S + S / 2;
    const px = -dir.y; // perpendicular to heading
    const py = dir.x;
    for (const side of [-1, 1]) {
      const ex = cx + dir.x * 4 + px * 5 * side;
      const ey = cy + dir.y * 4 + py * 5 * side;
      ctx.fillStyle = "#f2d04a";
      ctx.beginPath();
      ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.fillRect(ex - 0.75, ey - 2, 1.5, 4);
    }
  }

  function draw() {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        ctx.fillStyle = (x + y) % 2 ? "#e6cd98" : "#ead4a3";
        ctx.fillRect(x * S, y * S, S, S);
      }
    }

    if (food) drawPear(food.x * S + S / 2, food.y * S + S / 2);

    // Rattlesnake: olive body with dark bands, rattle on the tail
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const isHead = i === 0;
      const isTail = i === snake.length - 1;
      ctx.fillStyle = isHead ? "#6b7a34" : isTail ? "#d9c795" : i % 3 === 0 ? "#4a311c" : "#9a8a4a";
      ctx.beginPath();
      ctx.roundRect(s.x * S + 1.5, s.y * S + 1.5, S - 3, S - 3, isHead ? 8 : 5);
      ctx.fill();
      if (isTail) {
        ctx.strokeStyle = "#a8966a";
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (const off of [8, 12, 16]) {
          ctx.moveTo(s.x * S + 4, s.y * S + off);
          ctx.lineTo(s.x * S + S - 4, s.y * S + off);
        }
        ctx.stroke();
      }
    }
    drawEyes(snake[0]);
  }

  Arcade.loop((dt) => {
    if (state === "playing") {
      acc += dt;
      while (acc >= stepTime && state === "playing") {
        acc -= stepTime;
        step();
      }
    }
    draw();
  });

  reset();
  Arcade.showOverlay("Snake", `Wrangle the rattler.\nEat pears, don't bite your tail.\n${Arcade.say.start} to start`);
})();
