// Shared helpers for every game in the bar.
const Arcade = (() => {
  const PREFIX = "gamebar:best:";
  const isTouch = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  // Words for on-screen prompts, so touch players aren't told to "press Space"
  const say = {
    start: isTouch ? "Tap" : "Press Space",
    click: isTouch ? "Tap" : "Click",
  };

  function getBest(key) {
    try {
      return Number(localStorage.getItem(PREFIX + key)) || 0;
    } catch {
      return 0;
    }
  }

  function saveBest(key, value) {
    try {
      localStorage.setItem(PREFIX + key, String(value));
    } catch {
      // Storage unavailable (private mode etc.) — best scores just won't persist
    }
  }

  // Keeps the Score / Best boxes in sync. finish() returns true on a new record.
  function createHud(key) {
    const scoreEl = document.getElementById("score");
    const bestEl = document.getElementById("best");
    let best = getBest(key);
    bestEl.textContent = best;

    return {
      setScore(n) {
        scoreEl.textContent = n;
      },
      finish(n) {
        if (n <= best) return false;
        best = n;
        saveBest(key, n);
        bestEl.textContent = n;
        return true;
      },
    };
  }

  function showOverlay(title, text) {
    const el = document.getElementById("overlay");
    el.querySelector("h2").textContent = title;
    el.querySelector("p").textContent = text;
    el.classList.remove("hidden");
  }

  function hideOverlay() {
    document.getElementById("overlay").classList.add("hidden");
  }

  // Converts a pointer event to canvas pixel coordinates (the canvas is CSS-scaled)
  function canvasPoint(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.width) / r.width,
      y: ((e.clientY - r.top) * canvas.height) / r.height,
    };
  }

  // Stop arrow keys and Space from scrolling the page during play
  function captureKeys() {
    const keys = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);
    window.addEventListener("keydown", (e) => {
      if (keys.has(e.code)) e.preventDefault();
    });
  }

  // requestAnimationFrame loop with delta time in seconds (capped so tab switches don't teleport things)
  function loop(frame) {
    let last = performance.now();
    function tick(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame(dt);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // On-screen buttons with data-key="ArrowLeft" etc. act like holding that key,
  // so each game only has to handle keyboard events.
  function bindTouchPad() {
    document.querySelectorAll("[data-key]").forEach((btn) => {
      const code = btn.dataset.key;
      const send = (type) =>
        window.dispatchEvent(new KeyboardEvent(type, { code, key: code === "Space" ? " " : code }));
      let held = false;

      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        held = true;
        btn.classList.add("pressed");
        send("keydown");
      });
      const release = () => {
        if (!held) return;
        held = false;
        btn.classList.remove("pressed");
        send("keyup");
      };
      ["pointerup", "pointercancel", "pointerleave"].forEach((t) => btn.addEventListener(t, release));
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
    });
  }

  bindTouchPad();

  return { isTouch, say, getBest, saveBest, createHud, showOverlay, hideOverlay, canvasPoint, captureKeys, loop };
})();

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
