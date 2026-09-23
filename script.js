const ROWS = 6;
const COLS = 6;
const MINES = 6;

const boardEl = document.getElementById("board");
const minesLeftEl = document.getElementById("mines-left");
const timerEl = document.getElementById("timer");
const resetBtn = document.getElementById("reset");
const messageEl = document.getElementById("message");

let board = [];        // 2D array of cell objects
let minesPlaced = false;
let gameOver = false;
let revealedCount = 0;
let flagCount = 0;
let timerId = null;
let seconds = 0;

function createBoard() {
  board = [];
  boardEl.innerHTML = "";

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const el = document.createElement("button");
      el.className = "cell";
      el.setAttribute("role", "gridcell");
      el.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}`);
      el.addEventListener("click", () => reveal(r, c));
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        toggleFlag(r, c);
      });
      addLongPress(el, () => toggleFlag(r, c));

      boardEl.appendChild(el);
      row.push({ r, c, el, mine: false, adjacent: 0, revealed: false, flagged: false });
    }
    board.push(row);
  }
}

function neighbors(r, c) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) result.push(board[nr][nc]);
    }
  }
  return result;
}

// Mines are placed after the first click, avoiding the clicked cell and its
// neighbors, so the first click always opens up an area of the map.
function placeMines(safeR, safeC) {
  const safe = new Set([`${safeR},${safeC}`]);
  neighbors(safeR, safeC).forEach((n) => safe.add(`${n.r},${n.c}`));

  const candidates = board.flat().filter((cell) => !safe.has(`${cell.r},${cell.c}`));

  // Fisher–Yates shuffle, then take the first MINES cells
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  candidates.slice(0, MINES).forEach((cell) => (cell.mine = true));

  board.flat().forEach((cell) => {
    cell.adjacent = neighbors(cell.r, cell.c).filter((n) => n.mine).length;
  });

  minesPlaced = true;
  startTimer();
}

function reveal(r, c) {
  if (gameOver) return;
  const cell = board[r][c];
  if (cell.revealed || cell.flagged) return;

  if (!minesPlaced) placeMines(r, c);

  if (cell.mine) {
    cell.el.classList.add("exploded");
    endGame(false);
    return;
  }

  // Flood-fill reveal of empty regions
  const stack = [cell];
  while (stack.length) {
    const cur = stack.pop();
    if (cur.revealed || cur.flagged) continue;

    cur.revealed = true;
    revealedCount++;
    cur.el.classList.add("revealed");
    if (cur.adjacent > 0) {
      cur.el.textContent = cur.adjacent;
      cur.el.dataset.n = cur.adjacent;
    } else {
      neighbors(cur.r, cur.c).forEach((n) => {
        if (!n.revealed && !n.mine) stack.push(n);
      });
    }
  }

  if (revealedCount === ROWS * COLS - MINES) endGame(true);
}

function toggleFlag(r, c) {
  if (gameOver) return;
  const cell = board[r][c];
  if (cell.revealed) return;

  cell.flagged = !cell.flagged;
  cell.el.textContent = cell.flagged ? "🚩" : "";
  flagCount += cell.flagged ? 1 : -1;
  minesLeftEl.textContent = MINES - flagCount;
}

function endGame(won) {
  gameOver = true;
  stopTimer();

  board.flat().forEach((cell) => {
    if (cell.mine && !cell.flagged) {
      cell.el.textContent = won ? "🚩" : "💣";
      if (!won) cell.el.classList.add("mine", "revealed");
    } else if (!cell.mine && cell.flagged && !won) {
      cell.el.textContent = "❌";
      cell.el.classList.add("wrong-flag");
    }
  });

  if (won) minesLeftEl.textContent = 0;
  resetBtn.textContent = won ? "😎" : "😵";
  messageEl.textContent = won ? `You win! Cleared in ${seconds}s.` : "Boom! You hit a mine.";
  messageEl.className = `message ${won ? "win" : "lose"}`;
}

function startTimer() {
  stopTimer();
  timerId = setInterval(() => {
    seconds++;
    timerEl.textContent = seconds;
  }, 1000);
}

function stopTimer() {
  clearInterval(timerId);
  timerId = null;
}

// Long-press to flag on touch devices
function addLongPress(el, callback) {
  let pressTimer = null;
  let longPressed = false;

  el.addEventListener("touchstart", () => {
    longPressed = false;
    pressTimer = setTimeout(() => {
      longPressed = true;
      callback();
    }, 450);
  }, { passive: true });

  const cancel = () => clearTimeout(pressTimer);
  el.addEventListener("touchend", (e) => {
    cancel();
    if (longPressed) e.preventDefault(); // don't also fire a reveal click
  });
  el.addEventListener("touchmove", cancel, { passive: true });
}

function newGame() {
  stopTimer();
  minesPlaced = false;
  gameOver = false;
  revealedCount = 0;
  flagCount = 0;
  seconds = 0;
  timerEl.textContent = 0;
  minesLeftEl.textContent = MINES;
  resetBtn.textContent = "🙂";
  messageEl.textContent = "Click any cell to start.";
  messageEl.className = "message";
  createBoard();
}

resetBtn.addEventListener("click", newGame);
newGame();
