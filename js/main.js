// The Game Bar — one page, three views: the menu (#/), a game's seat picker (#/snake) and the
// table where the match is played (#/snake/play).

import { GAMES, GAMES_BY_ID } from "./games/index.js";
import { createCabinet, describeControls, whoLabel } from "./cabinet.js";
import { ROUNDS_TO_WIN } from "./util.js";

const $ = (id) => document.getElementById(id);
const views = { menu: $("view-menu"), setup: $("view-setup"), play: $("view-play") };

// Who sits in each seat, per game: [side A is human, side B is human]
const seats = {};
const seatsFor = (id) => seats[id] ?? (seats[id] = [true, false]);

const cabinet = createCabinet({ onSwap: (id, humans) => (seats[id] = humans) });

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "style") node.setAttribute("style", v);
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function show(name) {
  for (const [key, view] of Object.entries(views)) view.hidden = key !== name;
  window.scrollTo(0, 0);
}

// ---------- Menu ----------

function renderMenu() {
  const grid = $("game-grid");
  grid.innerHTML = "";
  for (const g of GAMES) {
    grid.append(
      el(
        "a",
        { class: "game-card", href: `#/${g.id}`, style: `--accent: ${g.accent}` },
        el("span", { class: "card-kicker" }, g.kicker),
        el("span", { class: "card-title" }, g.title),
        el("span", { class: "card-blurb" }, g.blurb),
        el("span", { class: "card-roles" }, `${g.sides[0].emoji} ${g.sides[0].name} vs ${g.sides[1].emoji} ${g.sides[1].name}`)
      )
    );
  }
}

// ---------- Seat picker ----------

function renderSetup(game) {
  const humans = seatsFor(game.id);
  const root = $("setup");
  root.innerHTML = "";
  root.style.setProperty("--accent", game.accent);

  const seatCard = (side) => {
    const role = game.sides[side];
    const choose = (human) => {
      humans[side] = human;
      renderSetup(game);
    };
    return el(
      "div",
      { class: `seat-card${humans[side] ? " is-human" : ""}` },
      el("div", { class: "seat-card-head" }, el("span", { class: "seat-card-emoji" }, role.emoji), el("h2", {}, role.name)),
      el("p", { class: "seat-goal" }, role.goal),
      el(
        "div",
        { class: "seg", role: "group", "aria-label": `Who plays the ${role.name}` },
        el("button", { "aria-pressed": String(humans[side]), onclick: () => choose(true) }, "🙋 Human"),
        el("button", { "aria-pressed": String(!humans[side]), onclick: () => choose(false) }, "🤖 Computer")
      ),
      el("p", { class: "seat-who" }, whoLabel(humans, side)),
      el("p", { class: "seat-keys" }, describeControls(game, humans, side))
    );
  };

  const n = humans.filter(Boolean).length;
  const note =
    n === 0
      ? "Computer vs computer: watch the house play itself."
      : n === 2
        ? "Two players, one table. Player 1 uses WASD, Player 2 uses the arrow keys."
        : "The computer gets sharper every round.";

  root.append(
    el(
      "header",
      { class: "game-heading" },
      el("p", { class: "kicker" }, game.kicker),
      el("h1", {}, game.title),
      el("p", { class: "setup-sub" }, "Pick your seats, partner.")
    ),
    el("div", { class: "seats" }, seatCard(0), el("div", { class: "vs" }, "vs"), seatCard(1)),
    el("a", { class: "deal-btn", href: `#/${game.id}/play` }, "Deal 'em in"),
    el("p", { class: "setup-note" }, `First to ${ROUNDS_TO_WIN} rounds wins the match. ${note}`)
  );
}

// ---------- Router ----------

function route() {
  const [id, sub] = location.hash.replace(/^#\/?/, "").split("/");
  const game = GAMES_BY_ID[id];
  if (!game) {
    cabinet.stop();
    document.title = "The Game Bar";
    show("menu");
    return;
  }
  if (sub === "play") {
    document.title = `${game.title} · The Game Bar`;
    show("play");
    cabinet.start(game, seatsFor(game.id));
    return;
  }
  cabinet.stop();
  document.title = `${game.title} · The Game Bar`;
  renderSetup(game);
  show("setup");
}

renderMenu();
window.addEventListener("hashchange", route);
route();
