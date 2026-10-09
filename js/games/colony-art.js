// Pixel art for Life in the Colony, drawn from little character maps instead of image files or
// emoji. Each sprite is a list of rows; each character is a palette colour ("." is clear).
// Sprites are rendered once into small canvases and then drawn scaled up with smoothing off,
// so they stay crisp at any zoom.

const PAL = {
  k: "#1f130b", // outline
  g: "#2f5a2a", // dark leaf
  G: "#4f8a3a", // leaf
  L: "#7fb35a", // leaf highlight
  t: "#5a3a20", // bark dark
  T: "#7a4f2c", // bark
  o: "#4a4640", // stone dark
  O: "#7d776c", // stone
  l: "#a9a296", // stone light
  s: "#e8b48a", // skin
  S: "#c98c62", // skin shade
  h: "#9a6a2e", // straw hat
  H: "#c9953e", // straw hat light
  r: "#5a3420", // hair
  p: "#3d3a5c", // trousers
  b: "#2a1a10", // boots
  w: "#f3e6c9", // cream
  c: "#e07a2a", // carrot
  C: "#b85a18", // carrot dark
  d: "#6e4f2c", // soil
  D: "#523a20", // soil dark
  y: "#e8c45a", // grain / gold
  m: "#8a5a33", // wood plank
  M: "#b27a46", // wood plank light
  R: "#a8402e", // roof red
  e: "#d8d2c4", // steel
  E: "#8f8a80", // steel dark
  x: "#c94a3a", // red cross / berry
  n: "#4a7ab0", // blue
  z: "#ffffff", // snow
  Z: "#cfe0ee", // snow shade
};

const SPRITES = {
  tree: [
    ".......gg.......",
    "......gLGg......",
    ".....gLGGGg.....",
    "....gLGGGGGg....",
    "......gGGg......",
    "....gLGGGGGg....",
    "...gLGGGGGGGg...",
    "..gLGGGGGGGGGg..",
    ".....gGGGGg.....",
    "...gLGGGGGGGg...",
    "..gLGGGGGGGGGg..",
    ".gLGGGGGGGGGGGg.",
    "gGGGGGGGGGGGGGGg",
    ".gggggtTTtggggg.",
    "......tTTt......",
    "......tTTt......",
  ],
  stump: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    ".....kkkkkk.....",
    "....kMmMMmMk....",
    "....tTTTTTTt....",
    "....tTTTTTTt....",
    ".....tttttt.....",
  ],
  rock: [
    "................",
    "................",
    "................",
    "................",
    "......kkkk......",
    "....kkOOllkk....",
    "...kOOOOllOOk...",
    "..kOOOOOOOOOOk..",
    "..kOlOOOOOOOOok.",
    ".kOOllOOOOOOOok.",
    ".kOOOOOOOOOOooOk",
    ".kOOOOOOOOOoOOOk",
    ".kOOOOOOOooOOOok",
    "..koOOOOOOOOOok.",
    "...kooooooooook.",
    "................",
  ],
  rubble: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....ko....kok...",
    "...kOOk..kOOlk..",
    "..kooook.kooook.",
    "................",
  ],
  sprout: [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "......G..G......",
    ".....GL..LG.....",
    "......G..G......",
    "......g..g......",
    "................",
    "................",
  ],
  crop: [
    "................",
    "................",
    "....G.L...L.G...",
    "....GL.GLG.LG...",
    ".....GLGGGLG....",
    "...G..GgGgG..G..",
    "...GLGgGLGgGLG..",
    "....gGgcgGgGg...",
    "......cCc.......",
    "......cCc.......",
    ".......c........",
    "................",
    "................",
    "................",
    "................",
    "................",
  ],
  bush: [
    "................",
    "................",
    "................",
    "................",
    ".....gg...gg....",
    "...ggGLg.gGLgg..",
    "..gGLGGGgGGLGGg.",
    ".gGGGxGGGGGGxGg.",
    ".gLGGGGGLGGGGGGg",
    "gGGGGGGGGGGLGGGg",
    "gGGLGGxGGGGGGGGg",
    ".gGGGGGGGGxGGGg.",
    "..gggGGGGGGggg..",
    "....ggggggggg...",
    "................",
    "................",
  ],
  house: [
    "................",
    ".......kk.......",
    "......kRRk......",
    ".....kRRRRk..kk.",
    "....kRRRRRRk.kmk",
    "...kRRRRRRRRkkmk",
    "..kRRRRRRRRRRkmk",
    ".kRRRRRRRRRRRRk.",
    "kkkkkkkkkkkkkkkk",
    ".kMmMMkkkkMMmMk.",
    ".kMMmkyyykMmMMk.",
    ".kmMMkykykMMmMk.",
    ".kMmMkkkkkMmMMk.",
    ".kMMmkMmMkMMmMk.",
    ".kMmMkMMmkMmMMk.",
    ".kkkkkkkkkkkkkkk",
  ],
};

// A villager, tinted by job: the shirt and hat say who they are
function personRows(hat) {
  return [
    hat ? "....hhhh...." : "............",
    hat ? "..hhHHHHhh.." : "....rrrr....",
    hat ? ".hhhhhhhhhh." : "...rrrrrr...",
    "...ssssss...",
    "...skssks...",
    "...ssssss...",
    "....sSSs....",
    "..aaaaaaaa..",
    ".saaaAAaaas.",
    ".saaaaaaaas.",
    "..aaaaaaaa..",
    "..pppppppp..",
    "..ppp..ppp..",
    "..ppp..ppp..",
    "..bbb..bbb..",
  ];
}

// 8×8 icons for the HUD, prompts and signs
const ICONS = {
  log: [
    "........",
    "..kkkkk.",
    ".kMmMmMk",
    "kTMmMmMk",
    "kTTtTTtk",
    ".kttttk.",
    "..kkkk..",
    "........",
  ],
  stone: [
    "........",
    "...kkk..",
    "..kOllk.",
    ".kOOOlOk",
    ".kOOOOOk",
    ".koOOOok",
    "..kkkkk.",
    "........",
  ],
  food: [
    "...G.G..",
    "...GLG..",
    "....G...",
    "...kck..",
    "..kccCk.",
    "..kcCk..",
    "...kck..",
    "....k...",
  ],
  meal: [
    "..w..w..",
    "...w..w.",
    "........",
    "kkkkkkkk",
    "kyccyGyk",
    ".kMMMMk.",
    "..kmmk..",
    "........",
  ],
  axe: [
    ".kkk....",
    "keeEk...",
    "keEETk..",
    ".kkkT...",
    "....T...",
    ".....T..",
    "......T.",
    "........",
  ],
  pickaxe: [
    ".kkkkk..",
    "keeeeek.",
    "k..T..k.",
    "...T....",
    "...T....",
    "...T....",
    "...T....",
    "........",
  ],
  hoe: [
    "....kkk.",
    "....keek",
    "....T.k.",
    "...T....",
    "..T.....",
    ".T......",
    "T.......",
    "........",
  ],
  hammer: [
    "..kkkk..",
    ".keeEEk.",
    ".kkTkk..",
    "...T....",
    "...T....",
    "...T....",
    "...T....",
    "........",
  ],
  person: [
    "...kk...",
    "..kssk..",
    "..kssk..",
    "...kk...",
    ".kaaaak.",
    "kaaaaaak",
    "kaaaaaak",
    "........",
  ],
  bed: [
    "........",
    "k.......",
    "kww.....",
    "kwwnnnnk",
    "knnnnnnk",
    "kkkkkkkk",
    "k......k",
    "........",
  ],
  mug: [
    "........",
    ".wwwww..",
    ".kyyyykk",
    ".kyyyyk.k",
    ".kyyyykk",
    ".kyyyyk.",
    ".kkkkkk.",
    "........",
  ],
  anvil: [
    "........",
    "kkkkkkk.",
    "kEeeeeEk",
    ".kkEEkk.",
    "...EE...",
    "..kEEk..",
    ".kEEEEk.",
    "........",
  ],
  cross: [
    "........",
    "...xx...",
    "...xx...",
    ".xxxxxx.",
    ".xxxxxx.",
    "...xx...",
    "...xx...",
    "........",
  ],
  box: [
    "........",
    ".kkkkkk.",
    "kMMmMMmk",
    "kmkkkkmk",
    "kMMmMMmk",
    "kMmMMmMk",
    ".kkkkkk.",
    "........",
  ],
  snow: [
    "...z....",
    ".z.z.z..",
    "..zzz...",
    "zzzZzzz.",
    "..zzz...",
    ".z.z.z..",
    "...z....",
    "........",
  ],
  sick: [
    "..GGGG..",
    ".GkGGkG.",
    ".GGGGGG.",
    ".GgggGG.",
    "..GGGG..",
    "........",
    "........",
    "........",
  ],
  hungry: [
    "........",
    "..kkkk..",
    ".kwwwwk.",
    ".kw..wk.",
    ".kwwwwk.",
    "..kkkk..",
    "........",
    "........",
  ],
  alert: [
    "...yy...",
    "...yy...",
    "...yy...",
    "...yy...",
    "........",
    "...yy...",
    "........",
    "........",
  ],
};

const cache = new Map();

function render(rows, pal) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      g.fillStyle = pal[ch] || PAL[ch] || "#f0f";
      g.fillRect(x, y, 1, 1);
    }
  });
  return cv;
}

function get(key, rows, pal = PAL) {
  let cv = cache.get(key);
  if (!cv) {
    cv = render(rows, pal);
    cache.set(key, cv);
  }
  return cv;
}

// Draw a sprite centred on (x, y) with its bottom resting on y + h/2, scaled by `scale` pixels per pixel
export function sprite(ctx, name, x, y, scale = 2) {
  const cv = get(name, SPRITES[name]);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, Math.round(x - (cv.width * scale) / 2), Math.round(y - cv.height * scale), cv.width * scale, cv.height * scale);
}

// An 8×8 icon centred on (x, y), `size` pixels across
export function icon(ctx, name, x, y, size = 16) {
  const cv = get(`i:${name}`, ICONS[name]);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}

// A person with feet at (x, y). shirt/shirt2: job colours. hat: a straw hat (the Founder).
export function person(ctx, x, y, { shirt = "#3a6ea5", shirt2 = "#2c5684", hat = false, scale = 2, bob = 0 } = {}) {
  const key = `p:${shirt}:${shirt2}:${hat}`;
  const cv = get(key, personRows(hat), { ...PAL, a: shirt, A: shirt2 });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, Math.round(x - (cv.width * scale) / 2), Math.round(y - cv.height * scale + bob), cv.width * scale, cv.height * scale);
}

export function personIcon(ctx, x, y, size, shirt) {
  const cv = get(`pi:${shirt}`, ICONS.person, { ...PAL, a: shirt });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(cv, Math.round(x - size / 2), Math.round(y - size / 2), size, size);
}

// A building drawn from blocks: plank walls, a pitched roof, a door and a sign with its icon
export function building(ctx, x, y, { w = 52, h = 40, roof = "#a8402e", wall = "#b27a46", sign = null, stone = false }) {
  const px = 2;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - h / 2);
  const roofH = Math.round(h * 0.42);
  const wallTop = top + roofH;
  const wallH = h - roofH;
  // Shadow
  ctx.fillStyle = "rgba(20, 12, 6, 0.25)";
  ctx.fillRect(left + 3, top + h - 2, w, 5);
  // Walls
  ctx.fillStyle = PAL.k;
  ctx.fillRect(left, wallTop, w, wallH);
  ctx.fillStyle = stone ? PAL.O : wall;
  ctx.fillRect(left + px, wallTop, w - 2 * px, wallH - px);
  ctx.fillStyle = stone ? PAL.o : "rgba(60, 35, 15, 0.35)";
  for (let yy = wallTop + 6; yy < wallTop + wallH - 2; yy += 6) ctx.fillRect(left + px, yy, w - 2 * px, 1);
  if (stone) for (let yy = wallTop + 3, i = 0; yy < wallTop + wallH - 2; yy += 6, i++) for (let xx = left + 4 + (i % 2) * 5; xx < left + w - 4; xx += 10) ctx.fillRect(xx, yy, 1, 6);
  // Roof: stepped pixel triangle
  for (let i = 0; i < roofH; i += px) {
    const inset = Math.round(((roofH - i) / roofH) * (w / 2 - 4));
    ctx.fillStyle = PAL.k;
    ctx.fillRect(left - 3 + inset, top + i, w + 6 - inset * 2, px);
    ctx.fillStyle = i % 6 < 2 ? shade(roof, -0.18) : roof;
    ctx.fillRect(left - 1 + inset, top + i, w + 2 - inset * 2, px);
  }
  ctx.fillStyle = PAL.k;
  ctx.fillRect(left - 4, wallTop - 1, w + 8, px);
  // Door
  const dw = Math.max(8, Math.round(w * 0.2));
  ctx.fillStyle = PAL.k;
  ctx.fillRect(Math.round(x - dw / 2) - 1, top + h - 15, dw + 2, 15);
  ctx.fillStyle = PAL.t;
  ctx.fillRect(Math.round(x - dw / 2), top + h - 14, dw, 13);
  ctx.fillStyle = PAL.y;
  ctx.fillRect(Math.round(x + dw / 2) - 3, top + h - 8, 2, 2);
  // Sign
  if (sign) {
    const sx = Math.round(x + w / 2 - 12);
    const sy = wallTop + 3;
    ctx.fillStyle = PAL.k;
    ctx.fillRect(sx - 9, sy - 1, 18, 16);
    ctx.fillStyle = PAL.w;
    ctx.fillRect(sx - 8, sy, 16, 14);
    icon(ctx, sign, sx, sy + 7, 12);
  }
}

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}

// Ground for one season: a base colour with a fixed scatter of darker and lighter flecks
const GROUND = {
  spring: ["#7aa04e", "#6a9044", "#8db35c"],
  summer: ["#8a9c48", "#78893e", "#a0ae58"],
  autumn: ["#a08a46", "#8c6e38", "#b89a52"],
  winter: ["#e6eef3", "#cfdde8", "#ffffff"],
};
export function groundTile(season) {
  const key = `ground:${season}`;
  let cv = cache.get(key);
  if (cv) return cv;
  cv = document.createElement("canvas");
  cv.width = 72;
  cv.height = 72;
  const g = cv.getContext("2d");
  const [base, dark, light] = GROUND[season];
  g.fillStyle = base;
  g.fillRect(0, 0, 72, 72);
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 60; i++) {
    g.fillStyle = rnd() < 0.5 ? dark : light;
    const x = Math.floor(rnd() * 36) * 2;
    const y = Math.floor(rnd() * 36) * 2;
    g.fillRect(x, y, 2, rnd() < 0.3 ? 4 : 2);
  }
  cache.set(key, cv);
  return cv;
}

export { PAL };
