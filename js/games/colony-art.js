// Art for Life in the Colony, drawn as smooth vector shapes instead of image files or emoji.
// Every sprite is drawn in a small box of 16 units (icons: 16 units square), then scaled to
// size on the canvas, so it stays sharp at any zoom or screen resolution. Light comes from the
// top left: shapes get a lighter left/top and a darker right/bottom, and a soft shadow below.

const OUTLINE = "rgba(31, 19, 11, 0.75)";

// Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + (amt > 0 ? (255 - v) * amt : v * amt))));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => f(v).toString(16).padStart(2, "0")).join("")}`;
}

function lin(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function ellipse(ctx, cx, cy, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function shadow(ctx, cx, cy, rx, ry = rx * 0.28) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, "rgba(20, 12, 6, 0.32)");
  g.addColorStop(1, "rgba(20, 12, 6, 0)");
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  ctx.arc(cx, cy, rx, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function stroke(ctx, w = 0.35, color = OUTLINE) {
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

// ---------- sprites (16-unit box, feet at the bottom centre) ----------

const SPRITES = {
  tree(ctx) {
    shadow(ctx, 8.4, 15.5, 6.2);
    ctx.fillStyle = lin(ctx, 7, 0, 9.2, 0, ["#6b4426", "#8f5f34", "#4e3019"]);
    roundRect(ctx, 7.05, 10.5, 1.9, 5.3, 0.4);
    ctx.fill();
    stroke(ctx, 0.25);
    // Three tiers of boughs, each a soft-edged cone
    const tiers = [
      [0.4, 6.4, 3.4],
      [3.4, 9.8, 5.0],
      [6.6, 13.4, 6.6],
    ];
    for (let i = tiers.length - 1; i >= 0; i--) {
      const [top, base, hw] = tiers[i];
      ctx.beginPath();
      ctx.moveTo(8, top);
      ctx.quadraticCurveTo(8 + hw * 0.45, top + (base - top) * 0.55, 8 + hw, base);
      ctx.quadraticCurveTo(8 + hw * 0.5, base + 1.1, 8, base + 0.5);
      ctx.quadraticCurveTo(8 - hw * 0.5, base + 1.1, 8 - hw, base);
      ctx.quadraticCurveTo(8 - hw * 0.45, top + (base - top) * 0.55, 8, top);
      ctx.fillStyle = lin(ctx, 8 - hw, top, 8 + hw, base, ["#5c9a48", "#3f7a35", "#2b5a27"]);
      ctx.fill();
      stroke(ctx, 0.3, "rgba(22, 44, 18, 0.8)");
      // Highlight along the lit side
      ctx.beginPath();
      ctx.moveTo(8 - 0.2, top + 0.8);
      ctx.quadraticCurveTo(8 - hw * 0.35, top + (base - top) * 0.6, 8 - hw * 0.75, base - 0.2);
      stroke(ctx, 0.45, "rgba(170, 220, 120, 0.45)");
    }
  },
  stump(ctx) {
    shadow(ctx, 8.3, 15.4, 4);
    ctx.fillStyle = lin(ctx, 5.5, 0, 10.5, 0, ["#7a4f2c", "#93613a", "#5a3a20"]);
    ctx.beginPath();
    ctx.moveTo(5.6, 12.4);
    ctx.lineTo(5.4, 15.2);
    ctx.quadraticCurveTo(8, 16.2, 10.6, 15.2);
    ctx.lineTo(10.4, 12.4);
    ctx.closePath();
    ctx.fill();
    stroke(ctx);
    ellipse(ctx, 8, 12.4, 2.45, 0.9, "#d9b07a");
    ctx.beginPath();
    ctx.ellipse(8, 12.4, 2.45, 0.9, 0, 0, Math.PI * 2);
    stroke(ctx);
    ctx.beginPath();
    ctx.ellipse(8, 12.4, 1.3, 0.45, 0, 0, Math.PI * 2);
    stroke(ctx, 0.2, "rgba(120, 80, 40, 0.7)");
  },
  rock(ctx) {
    shadow(ctx, 8.4, 15.3, 7);
    ctx.beginPath();
    ctx.moveTo(1.6, 15);
    ctx.lineTo(2.4, 11.2);
    ctx.lineTo(4.6, 8.6);
    ctx.lineTo(8.2, 7.6);
    ctx.lineTo(11.6, 8.8);
    ctx.lineTo(14.2, 11.8);
    ctx.lineTo(14.6, 15);
    ctx.quadraticCurveTo(8, 16.2, 1.6, 15);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 3, 8, 13, 16, ["#b8b1a4", "#8c857a", "#5f5a52"]);
    ctx.fill();
    stroke(ctx, 0.35);
    // Facets and a crack
    ctx.beginPath();
    ctx.moveTo(4.6, 8.6);
    ctx.lineTo(6.4, 11.6);
    ctx.lineTo(11.6, 8.8);
    ctx.moveTo(6.4, 11.6);
    ctx.lineTo(6.8, 15.4);
    stroke(ctx, 0.25, "rgba(60, 55, 48, 0.55)");
    ctx.beginPath();
    ctx.moveTo(10.6, 11.4);
    ctx.lineTo(11.6, 12.8);
    ctx.lineTo(11.2, 14.2);
    stroke(ctx, 0.2, "rgba(50, 45, 40, 0.7)");
    ctx.beginPath();
    ctx.moveTo(3.2, 11);
    ctx.lineTo(4.8, 9.2);
    ctx.lineTo(7.6, 8.4);
    stroke(ctx, 0.5, "rgba(235, 230, 220, 0.6)");
  },
  rubble(ctx) {
    shadow(ctx, 8, 15.4, 5);
    for (const [x, y, r, c] of [[5.4, 14.4, 1.5, "#8c857a"], [9.8, 14.6, 1.9, "#7d776c"], [7.6, 13.6, 1.1, "#a9a296"]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.75, 0, 0, Math.PI * 2);
      ctx.fillStyle = lin(ctx, x - r, y - r, x + r, y + r, [shade(c, 0.25), c, shade(c, -0.3)]);
      ctx.fill();
      stroke(ctx, 0.25);
    }
  },
  sprout(ctx) {
    for (const dx of [-1.6, 1.6]) {
      ctx.beginPath();
      ctx.moveTo(8 + dx, 13.2);
      ctx.quadraticCurveTo(8 + dx - 1.4, 11.2, 8 + dx - 0.2, 10.2);
      ctx.quadraticCurveTo(8 + dx + 0.6, 11.6, 8 + dx, 13.2);
      ctx.fillStyle = "#6fae4a";
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(8 + dx, 13.2);
      ctx.quadraticCurveTo(8 + dx + 1.5, 11.6, 8 + dx + 0.9, 10.6);
      ctx.quadraticCurveTo(8 + dx + 0.1, 11.8, 8 + dx, 13.2);
      ctx.fillStyle = "#4f8a3a";
      ctx.fill();
    }
  },
  crop(ctx) {
    // Carrot tops: a fan of fronds over an orange shoulder
    ctx.fillStyle = lin(ctx, 6, 9, 10, 14, ["#f2a04a", "#e07a2a", "#b85a18"]);
    ctx.beginPath();
    ctx.moveTo(6.2, 10.4);
    ctx.quadraticCurveTo(8, 9.4, 9.8, 10.4);
    ctx.quadraticCurveTo(9.4, 13.6, 8, 14.6);
    ctx.quadraticCurveTo(6.6, 13.6, 6.2, 10.4);
    ctx.fill();
    stroke(ctx, 0.25, "rgba(120, 50, 10, 0.7)");
    ctx.beginPath();
    ctx.moveTo(7, 11.8);
    ctx.lineTo(7.8, 11.9);
    ctx.moveTo(8.2, 12.8);
    ctx.lineTo(9, 12.7);
    stroke(ctx, 0.2, "rgba(120, 50, 10, 0.6)");
    const fronds = [[-3.6, 4.2], [-2.2, 3.2], [-0.6, 2.6], [0.8, 2.8], [2.4, 3.4], [3.8, 4.6]];
    fronds.forEach(([dx, top], i) => {
      ctx.beginPath();
      ctx.moveTo(8, 10.2);
      ctx.quadraticCurveTo(8 + dx * 0.3, top + 3, 8 + dx, top);
      stroke(ctx, 0.55, i % 2 ? "#3f7a35" : "#5c9a48");
      ellipse(ctx, 8 + dx, top + 0.3, 0.9, 0.6, i % 2 ? "#4f8a3a" : "#6fae4a");
    });
  },
  bush(ctx) {
    shadow(ctx, 8, 14.8, 7.5);
    const blobs = [[4.4, 11.6, 3.2], [8, 9.6, 3.8], [11.6, 11.4, 3.3], [6.2, 12.8, 3], [10, 12.9, 3]];
    for (const [x, y, r] of blobs) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.2, x, y, r);
      g.addColorStop(0, "#7fb35a");
      g.addColorStop(1, "#2f5a2a");
      ctx.fillStyle = g;
      ctx.fill();
      stroke(ctx, 0.3, "rgba(22, 44, 18, 0.7)");
    }
    for (const [x, y] of [[5.2, 10.4], [9.4, 8.6], [11.8, 12], [7.4, 12.6]]) {
      ellipse(ctx, x, y, 0.55, 0.55, "#c94a3a");
      ellipse(ctx, x - 0.18, y - 0.18, 0.18, 0.18, "#ffd0c0");
    }
  },
  house(ctx) {
    cottage(ctx, false);
  },
  houseBroken(ctx) {
    cottage(ctx, true);
  },
};

function cottage(ctx, broken) {
  shadow(ctx, 8.4, 15.6, 8);
  // Walls: warm planks
  ctx.fillStyle = lin(ctx, 1.6, 0, 14.4, 0, ["#c9915a", "#b27a46", "#8a5a33"]);
  ctx.fillRect(1.8, 8, 12.4, 7.6);
  ctx.strokeStyle = "rgba(90, 55, 25, 0.45)";
  ctx.lineWidth = 0.2;
  for (let y = 9.4; y < 15.4; y += 1.25) {
    ctx.beginPath();
    ctx.moveTo(1.8, y);
    ctx.lineTo(14.2, y);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.rect(1.8, 8, 12.4, 7.6);
  stroke(ctx);
  // Door and a lit window
  ctx.fillStyle = lin(ctx, 6.6, 11, 9.4, 15.6, ["#6b4426", "#4e3019"]);
  roundRect(ctx, 6.7, 11, 2.6, 4.6, 0.6);
  ctx.fill();
  stroke(ctx, 0.25);
  ellipse(ctx, 8.8, 13.4, 0.22, 0.22, "#e8c45a");
  const glow = broken ? "#5a4a3a" : "#ffd27a";
  ctx.fillStyle = glow;
  ctx.fillRect(10.6, 10.2, 2.2, 2);
  ctx.beginPath();
  ctx.rect(10.6, 10.2, 2.2, 2);
  ctx.moveTo(11.7, 10.2);
  ctx.lineTo(11.7, 12.2);
  ctx.moveTo(10.6, 11.2);
  ctx.lineTo(12.8, 11.2);
  stroke(ctx, 0.25);
  // Chimney
  ctx.fillStyle = lin(ctx, 11.2, 0, 13, 0, ["#9a8f80", "#6c645a"]);
  ctx.fillRect(11.3, 2.4, 1.6, 4);
  ctx.beginPath();
  ctx.rect(11.3, 2.4, 1.6, 4);
  stroke(ctx, 0.25);
  // Roof: shingled gable
  ctx.beginPath();
  ctx.moveTo(0.4, 8.6);
  ctx.lineTo(8, 1.6);
  ctx.lineTo(15.6, 8.6);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, 2, 16, 9, ["#c95a42", "#a8402e", "#7a2a1e"]);
  ctx.fill();
  stroke(ctx, 0.35);
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(70, 20, 12, 0.45)";
  ctx.lineWidth = 0.22;
  for (let y = 3.2; y < 9; y += 1.3) {
    ctx.beginPath();
    for (let x = 0; x < 16; x += 1.4) ctx.arc(x + 0.7, y, 0.7, 0, Math.PI);
    ctx.stroke();
  }
  if (broken) {
    // The snow caved part of it in
    ctx.beginPath();
    ctx.moveTo(6.2, 4.4);
    ctx.lineTo(7.6, 5.6);
    ctx.lineTo(7, 6.8);
    ctx.lineTo(8.8, 7.6);
    ctx.lineTo(10.2, 6.2);
    ctx.lineTo(9.4, 4.8);
    ctx.lineTo(8, 4.2);
    ctx.closePath();
    ctx.fillStyle = "#2a1a10";
    ctx.fill();
    ctx.fillStyle = "#eef4fa";
    ctx.beginPath();
    ctx.ellipse(8.2, 7.4, 1.4, 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Ridge highlight
  ctx.beginPath();
  ctx.moveTo(1.4, 8.1);
  ctx.lineTo(8, 2.1);
  stroke(ctx, 0.4, "rgba(255, 210, 180, 0.4)");
}

// ---------- icons (16-unit box) ----------

const ICONS = {
  log(ctx) {
    ctx.save();
    ctx.translate(8, 8.5);
    ctx.rotate(-0.35);
    ctx.fillStyle = lin(ctx, 0, -3, 0, 3, ["#a06a3a", "#7a4f2c", "#4e3019"]);
    roundRect(ctx, -6, -2.8, 10.5, 5.6, 1.2);
    ctx.fill();
    stroke(ctx, 0.6);
    ellipse(ctx, 4.5, 0, 1.9, 2.8, "#e0bb84");
    ctx.beginPath();
    ctx.ellipse(4.5, 0, 1.9, 2.8, 0, 0, Math.PI * 2);
    stroke(ctx, 0.6);
    ctx.beginPath();
    ctx.ellipse(4.5, 0, 0.9, 1.4, 0, 0, Math.PI * 2);
    stroke(ctx, 0.4, "rgba(120, 80, 40, 0.8)");
    ctx.restore();
  },
  stone(ctx) {
    ctx.beginPath();
    ctx.moveTo(2, 13);
    ctx.lineTo(3, 7.4);
    ctx.lineTo(6.6, 4);
    ctx.lineTo(11.4, 4.6);
    ctx.lineTo(14.2, 8.4);
    ctx.lineTo(13.6, 13);
    ctx.quadraticCurveTo(8, 14.4, 2, 13);
    ctx.fillStyle = lin(ctx, 3, 4, 13, 14, ["#c4bdb0", "#8c857a", "#5f5a52"]);
    ctx.fill();
    stroke(ctx, 0.7);
    ctx.beginPath();
    ctx.moveTo(4, 7.6);
    ctx.lineTo(6.8, 5);
    ctx.lineTo(10, 5.2);
    stroke(ctx, 0.8, "rgba(240, 235, 225, 0.6)");
  },
  food(ctx) {
    ctx.save();
    ctx.translate(8, 9);
    ctx.rotate(0.5);
    ctx.fillStyle = lin(ctx, -2.6, 0, 2.6, 0, ["#f2a04a", "#e07a2a", "#b85a18"]);
    ctx.beginPath();
    ctx.moveTo(-2.6, -3);
    ctx.quadraticCurveTo(0, -4, 2.6, -3);
    ctx.quadraticCurveTo(1.6, 3.4, 0, 6);
    ctx.quadraticCurveTo(-1.6, 3.4, -2.6, -3);
    ctx.fill();
    stroke(ctx, 0.6, "rgba(110, 45, 10, 0.85)");
    ctx.beginPath();
    ctx.moveTo(-1.4, -0.6);
    ctx.lineTo(0.2, -0.4);
    ctx.moveTo(-0.6, 1.8);
    ctx.lineTo(0.8, 1.6);
    stroke(ctx, 0.4, "rgba(110, 45, 10, 0.6)");
    for (const dx of [-1.6, 0, 1.6]) {
      ctx.beginPath();
      ctx.moveTo(0, -3.4);
      ctx.quadraticCurveTo(dx * 0.6, -5.5, dx, -7);
      stroke(ctx, 1.1, "#4f8a3a");
    }
    ctx.restore();
  },
  meal(ctx) {
    for (const x of [6, 9.6]) {
      ctx.beginPath();
      ctx.moveTo(x, 6);
      ctx.quadraticCurveTo(x - 1.2, 4.4, x, 3);
      ctx.quadraticCurveTo(x + 1.2, 1.8, x, 0.6);
      stroke(ctx, 0.7, "rgba(255, 255, 255, 0.75)");
    }
    ellipse(ctx, 8, 8.6, 6.4, 1.8, "#e8a04a");
    ellipse(ctx, 6.2, 8.4, 1.1, 0.5, "#6fae4a");
    ellipse(ctx, 9.8, 8.7, 1, 0.45, "#c94a3a");
    ctx.beginPath();
    ctx.moveTo(1.6, 8.6);
    ctx.quadraticCurveTo(2.4, 14.6, 8, 14.6);
    ctx.quadraticCurveTo(13.6, 14.6, 14.4, 8.6);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 2, 0, 14, 0, ["#c9915a", "#a06a3a", "#6b4426"]);
    ctx.fill();
    stroke(ctx, 0.7);
  },
  axe(ctx) {
    ctx.beginPath();
    ctx.moveTo(4, 14.5);
    ctx.lineTo(10.8, 2.6);
    stroke(ctx, 1.8, "#8f5f34");
    ctx.beginPath();
    ctx.moveTo(4, 14.5);
    ctx.lineTo(10.8, 2.6);
    stroke(ctx, 0.5, "rgba(255, 220, 170, 0.4)");
    ctx.beginPath();
    ctx.moveTo(8.8, 3.2);
    ctx.quadraticCurveTo(13.6, 2.2, 14.6, 6.2);
    ctx.quadraticCurveTo(12.4, 6, 10.2, 6.6);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 9, 2, 14, 7, ["#eef0f2", "#a9adb2", "#6e7278"]);
    ctx.fill();
    stroke(ctx, 0.6);
  },
  pickaxe(ctx) {
    ctx.beginPath();
    ctx.moveTo(8, 15);
    ctx.lineTo(8, 4);
    stroke(ctx, 1.8, "#8f5f34");
    ctx.beginPath();
    ctx.moveTo(1.6, 6.6);
    ctx.quadraticCurveTo(8, 1.2, 14.4, 6.6);
    ctx.quadraticCurveTo(8, 3.8, 1.6, 6.6);
    ctx.fillStyle = lin(ctx, 2, 2, 14, 7, ["#eef0f2", "#a9adb2", "#6e7278"]);
    ctx.fill();
    stroke(ctx, 0.6);
  },
  hoe(ctx) {
    ctx.beginPath();
    ctx.moveTo(3, 15);
    ctx.lineTo(11.4, 2.6);
    stroke(ctx, 1.6, "#8f5f34");
    ctx.beginPath();
    ctx.moveTo(10.2, 2.4);
    ctx.lineTo(14.6, 3.6);
    ctx.lineTo(13.8, 7.2);
    ctx.lineTo(11.6, 4.8);
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 10, 2, 14, 7, ["#d8dce0", "#8f9398"]);
    ctx.fill();
    stroke(ctx, 0.6);
  },
  hammer(ctx) {
    ctx.beginPath();
    ctx.moveTo(8, 15);
    ctx.lineTo(8, 5);
    stroke(ctx, 1.8, "#8f5f34");
    ctx.fillStyle = lin(ctx, 3, 2, 13, 7, ["#c4c8cc", "#7e8288", "#55595e"]);
    roundRect(ctx, 3, 2, 10, 4.4, 0.8);
    ctx.fill();
    stroke(ctx, 0.6);
  },
  bed(ctx) {
    ctx.fillStyle = "#8f5f34";
    roundRect(ctx, 1.4, 4, 1.8, 10, 0.5);
    ctx.fill();
    roundRect(ctx, 12.8, 8, 1.8, 6, 0.5);
    ctx.fill();
    ctx.fillStyle = lin(ctx, 0, 8, 0, 12, ["#6a9ad0", "#3a6ea5"]);
    roundRect(ctx, 3, 8, 10, 4, 0.8);
    ctx.fill();
    stroke(ctx, 0.5);
    ctx.fillStyle = "#f3e6c9";
    roundRect(ctx, 3.4, 6.4, 3.6, 2.4, 1);
    ctx.fill();
    stroke(ctx, 0.5);
  },
  mug(ctx) {
    ctx.beginPath();
    ctx.arc(12.4, 9, 2.4, -Math.PI / 2, Math.PI / 2);
    stroke(ctx, 1.2, "#8f5f34");
    ctx.fillStyle = lin(ctx, 3, 0, 12, 0, ["#f2c35a", "#d99a2a"]);
    roundRect(ctx, 3, 5, 9, 9.4, 1.2);
    ctx.fill();
    stroke(ctx, 0.6);
    ctx.fillStyle = "#fff7e6";
    ctx.beginPath();
    ctx.arc(4.4, 5, 1.8, 0, Math.PI * 2);
    ctx.arc(7.4, 4.2, 2.2, 0, Math.PI * 2);
    ctx.arc(10.4, 5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  },
  anvil(ctx) {
    ctx.beginPath();
    ctx.moveTo(1.4, 4.6);
    ctx.lineTo(14.6, 4.6);
    ctx.lineTo(13.4, 7.4);
    ctx.lineTo(10.4, 8);
    ctx.lineTo(10.4, 11);
    ctx.lineTo(12.6, 13.4);
    ctx.lineTo(3.4, 13.4);
    ctx.lineTo(5.6, 11);
    ctx.lineTo(5.6, 8);
    ctx.quadraticCurveTo(2.4, 7.4, 1.4, 4.6);
    ctx.fillStyle = lin(ctx, 2, 4, 14, 13, ["#8a8f96", "#55595e", "#33363a"]);
    ctx.fill();
    stroke(ctx, 0.6);
  },
  cross(ctx) {
    ctx.fillStyle = "#c94a3a";
    roundRect(ctx, 6, 2, 4, 12, 0.8);
    ctx.fill();
    roundRect(ctx, 2, 6, 12, 4, 0.8);
    ctx.fill();
  },
  box(ctx) {
    ctx.fillStyle = lin(ctx, 2, 3, 14, 14, ["#d8a46a", "#b27a46", "#8a5a33"]);
    roundRect(ctx, 2, 3.4, 12, 10.6, 0.8);
    ctx.fill();
    stroke(ctx, 0.6);
    ctx.beginPath();
    ctx.moveTo(2, 7);
    ctx.lineTo(14, 7);
    ctx.moveTo(8, 3.4);
    ctx.lineTo(8, 7);
    stroke(ctx, 0.5);
  },
  snow(ctx) {
    ctx.save();
    ctx.translate(8, 8);
    for (let i = 0; i < 3; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, -6.4);
      ctx.lineTo(0, 6.4);
      for (const s of [-1, 1]) {
        ctx.moveTo(0, s * 3.8);
        ctx.lineTo(-1.6, s * 5.4);
        ctx.moveTo(0, s * 3.8);
        ctx.lineTo(1.6, s * 5.4);
      }
      stroke(ctx, 1.1, "#ffffff");
    }
    ctx.restore();
  },
  sick(ctx) {
    const g = ctx.createRadialGradient(6.4, 6, 1, 8, 8, 7);
    g.addColorStop(0, "#b8e08a");
    g.addColorStop(1, "#5f8a3c");
    ctx.beginPath();
    ctx.arc(8, 8, 6.4, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    stroke(ctx, 0.6);
    ellipse(ctx, 5.8, 7, 0.8, 0.8, "#1f130b");
    ellipse(ctx, 10.2, 7, 0.8, 0.8, "#1f130b");
    ctx.beginPath();
    ctx.moveTo(5, 11.2);
    ctx.quadraticCurveTo(6.5, 9.8, 8, 11.2);
    ctx.quadraticCurveTo(9.5, 12.6, 11, 11.2);
    stroke(ctx, 0.7, "#1f130b");
  },
  hungry(ctx) {
    ellipse(ctx, 8, 9, 6.6, 3.4, "#f3e6c9");
    ctx.beginPath();
    ctx.ellipse(8, 9, 6.6, 3.4, 0, 0, Math.PI * 2);
    stroke(ctx, 0.6);
    ctx.beginPath();
    ctx.ellipse(8, 9, 4, 2, 0, 0, Math.PI * 2);
    stroke(ctx, 0.4, "rgba(120, 100, 70, 0.6)");
    ctx.beginPath();
    ctx.moveTo(1.4, 2);
    ctx.lineTo(1.4, 6);
    ctx.moveTo(14.6, 2);
    ctx.lineTo(14.6, 6);
    stroke(ctx, 0.9, "#a9adb2");
  },
  alert(ctx) {
    ctx.beginPath();
    ctx.arc(8, 8, 6.6, 0, Math.PI * 2);
    ctx.fillStyle = lin(ctx, 0, 1, 0, 15, ["#ffd86a", "#e8a43a"]);
    ctx.fill();
    stroke(ctx, 0.6);
    ctx.fillStyle = "#2b1d12";
    roundRect(ctx, 7, 3.6, 2, 6, 0.9);
    ctx.fill();
    ellipse(ctx, 8, 11.8, 1.1, 1.1, "#2b1d12");
  },
  star(ctx) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 2.8 : 7;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      ctx.lineTo(8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fillStyle = lin(ctx, 0, 1, 0, 15, ["#fff2a0", "#f3c35a", "#d99a2a"]);
    ctx.fill();
    stroke(ctx, 0.6, "rgba(120, 80, 10, 0.8)");
  },
};

// ---------- public drawing functions ----------

// A sprite with its feet at (x, y), `scale` canvas units per sprite unit (16 units across)
export function sprite(ctx, name, x, y, scale = 2) {
  ctx.save();
  ctx.translate(x - 8 * scale, y - 16 * scale);
  ctx.scale(scale, scale);
  SPRITES[name](ctx);
  ctx.restore();
}

// An icon centred on (x, y), `size` canvas units across
export function icon(ctx, name, x, y, size = 16) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 16, size / 16);
  ICONS[name](ctx);
  ctx.restore();
}

// A person with feet at (x, y), 12×16 units scaled by `scale`. shirt/shirt2: the job's colours.
// hat: a straw hat (you). bob < 0 mid-stride swings the legs.
export function person(ctx, x, y, { shirt = "#3a6ea5", shirt2 = "#2c5684", hat = false, scale = 2, bob = 0 } = {}) {
  ctx.save();
  ctx.translate(x - 6 * scale, y - 16 * scale);
  ctx.scale(scale, scale);
  shadow(ctx, 6, 15.6, 4.2);
  ctx.translate(0, bob * 0.4);
  const stride = bob < 0 ? 0.9 : -0.9;
  // Legs and boots
  for (const [lx, d] of [[4.4, stride], [7.6, -stride]]) {
    ctx.fillStyle = "#3d3a5c";
    roundRect(ctx, lx - 1 + d * 0.3, 10.6, 2, 3.8, 0.6);
    ctx.fill();
    ctx.fillStyle = "#2a1a10";
    roundRect(ctx, lx - 1.2 + d * 0.5, 13.8, 2.6, 1.6, 0.6);
    ctx.fill();
  }
  // Arms behind the body
  ctx.fillStyle = shade(shirt, -0.2);
  roundRect(ctx, 1.3, 6.8 + stride * 0.3, 1.9, 4.4, 0.9);
  ctx.fill();
  roundRect(ctx, 8.8, 6.8 - stride * 0.3, 1.9, 4.4, 0.9);
  ctx.fill();
  ellipse(ctx, 2.25, 11.2 + stride * 0.3, 0.9, 0.9, "#e8b48a");
  ellipse(ctx, 9.75, 11.2 - stride * 0.3, 0.9, 0.9, "#e8b48a");
  // Body
  ctx.fillStyle = lin(ctx, 2.8, 6, 9.2, 11, [shade(shirt, 0.18), shirt, shirt2]);
  roundRect(ctx, 2.8, 6.4, 6.4, 5.2, 1.6);
  ctx.fill();
  stroke(ctx, 0.3);
  ctx.fillStyle = "#5a3a20";
  ctx.fillRect(2.9, 10.2, 6.2, 0.8); // belt
  // Head
  const g = ctx.createRadialGradient(5.2, 3.4, 0.5, 6, 4, 3.2);
  g.addColorStop(0, "#f4c8a0");
  g.addColorStop(1, "#d99a6c");
  ctx.beginPath();
  ctx.arc(6, 4.2, 2.7, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  stroke(ctx, 0.3);
  ellipse(ctx, 5, 4.4, 0.33, 0.42, "#2a1a10");
  ellipse(ctx, 7, 4.4, 0.33, 0.42, "#2a1a10");
  ellipse(ctx, 6, 5.7, 0.7, 0.25, "rgba(150, 60, 40, 0.5)");
  if (hat) {
    // Straw hat: wide brim and a banded crown
    ellipse(ctx, 6, 2.4, 4.4, 1.1, "#c9953e");
    ctx.beginPath();
    ctx.ellipse(6, 2.4, 4.4, 1.1, 0, 0, Math.PI * 2);
    stroke(ctx, 0.3);
    ctx.fillStyle = lin(ctx, 3.6, 0, 8.4, 0, ["#e8bf6a", "#c9953e", "#9a6a2e"]);
    roundRect(ctx, 3.8, -0.4, 4.4, 2.8, 1.2);
    ctx.fill();
    stroke(ctx, 0.3);
    ctx.fillStyle = "#a8402e";
    ctx.fillRect(3.8, 1.4, 4.4, 0.7);
  } else {
    ctx.beginPath();
    ctx.arc(6, 3.6, 2.75, Math.PI * 1.05, Math.PI * 1.95);
    ctx.quadraticCurveTo(8.6, 2.6, 8.4, 3.8);
    ctx.lineTo(3.6, 3.8);
    ctx.closePath();
    ctx.fillStyle = "#5a3420";
    ctx.fill();
  }
  ctx.restore();
}

// A small head-and-shoulders badge in a job's colour, centred on (x, y)
export function personIcon(ctx, x, y, size, shirt) {
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 16, size / 16);
  ctx.beginPath();
  ctx.moveTo(1.6, 16);
  ctx.quadraticCurveTo(1.6, 9.4, 8, 9.4);
  ctx.quadraticCurveTo(14.4, 9.4, 14.4, 16);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 2, 9, 14, 16, [shade(shirt, 0.2), shirt, shade(shirt, -0.25)]);
  ctx.fill();
  stroke(ctx, 0.6);
  ctx.beginPath();
  ctx.arc(8, 5.6, 3.6, 0, Math.PI * 2);
  ctx.fillStyle = "#e8b48a";
  ctx.fill();
  stroke(ctx, 0.6);
  ctx.restore();
}

// A building from its parts: plank or stone walls, a shingled roof, a door, a lit window and a
// hanging sign with the building's icon. Centred on (x, y), w × h canvas units.
export function building(ctx, x, y, { w = 52, h = 40, roof = "#a8402e", wall = "#b27a46", sign = null, stone = false }) {
  const left = x - w / 2;
  const top = y - h / 2;
  const roofH = h * 0.44;
  const wallTop = top + roofH - 2;
  const wallH = h - roofH + 2;
  ctx.save();
  shadow(ctx, x + 3, top + h, w * 0.62, 5);

  // Walls
  if (stone) {
    ctx.fillStyle = lin(ctx, left, 0, left + w, 0, ["#a9a296", "#8c857a", "#666058"]);
    ctx.fillRect(left, wallTop, w, wallH);
    ctx.strokeStyle = "rgba(60, 55, 48, 0.5)";
    ctx.lineWidth = 0.6;
    for (let row = 0, yy = wallTop + 4; yy < top + h; yy += 4.5, row++) {
      ctx.beginPath();
      ctx.moveTo(left, yy);
      ctx.lineTo(left + w, yy);
      for (let xx = left + (row % 2 ? 4 : 8); xx < left + w; xx += 8) {
        ctx.moveTo(xx, yy - 4.5);
        ctx.lineTo(xx, yy);
      }
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = lin(ctx, left, 0, left + w, 0, [shade(wall, 0.15), wall, shade(wall, -0.3)]);
    ctx.fillRect(left, wallTop, w, wallH);
    ctx.strokeStyle = "rgba(80, 48, 22, 0.45)";
    ctx.lineWidth = 0.6;
    for (let yy = wallTop + 4; yy < top + h; yy += 4) {
      ctx.beginPath();
      ctx.moveTo(left, yy);
      ctx.lineTo(left + w, yy);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.rect(left, wallTop, w, wallH);
  stroke(ctx, 1.1);

  // Door with a frame and a warm window
  const dw = Math.max(9, w * 0.2);
  const dh = Math.min(16, wallH - 4);
  ctx.fillStyle = lin(ctx, x - dw / 2, 0, x + dw / 2, 0, ["#7a4f2c", "#5a3a20", "#3d2616"]);
  roundRect(ctx, x - dw / 2, top + h - dh, dw, dh, 2.5);
  ctx.fill();
  stroke(ctx, 1);
  ellipse(ctx, x + dw / 2 - 2.4, top + h - dh / 2, 0.9, 0.9, "#e8c45a");
  const wx = left + 6;
  const wy = wallTop + 5;
  if (wy + 8 < top + h - 2) {
    const gl = ctx.createRadialGradient(wx + 4, wy + 3.5, 0.5, wx + 4, wy + 3.5, 6);
    gl.addColorStop(0, "#fff0b0");
    gl.addColorStop(1, "#e8a43a");
    ctx.fillStyle = gl;
    ctx.fillRect(wx, wy, 8, 7);
    ctx.beginPath();
    ctx.rect(wx, wy, 8, 7);
    ctx.moveTo(wx + 4, wy);
    ctx.lineTo(wx + 4, wy + 7);
    ctx.moveTo(wx, wy + 3.5);
    ctx.lineTo(wx + 8, wy + 3.5);
    stroke(ctx, 0.8);
  }

  // Roof: a shingled gable that overhangs the walls
  ctx.beginPath();
  ctx.moveTo(left - 4, wallTop + 2);
  ctx.lineTo(x, top);
  ctx.lineTo(left + w + 4, wallTop + 2);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, left, top, left + w, wallTop, [shade(roof, 0.2), roof, shade(roof, -0.35)]);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = "rgba(30, 15, 8, 0.35)";
  ctx.lineWidth = 0.6;
  for (let yy = top + 4; yy < wallTop + 3; yy += 3.6) {
    ctx.beginPath();
    for (let xx = left - 4; xx < left + w + 6; xx += 4) ctx.arc(xx + 2, yy, 2, 0, Math.PI);
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(left - 4, wallTop + 2);
  ctx.lineTo(x, top);
  ctx.lineTo(left + w + 4, wallTop + 2);
  ctx.closePath();
  stroke(ctx, 1.1);
  ctx.beginPath();
  ctx.moveTo(left - 2, wallTop + 1);
  ctx.lineTo(x, top + 1.2);
  stroke(ctx, 1, "rgba(255, 230, 200, 0.35)");
  ctx.fillStyle = "rgba(20, 10, 5, 0.25)";
  ctx.fillRect(left, wallTop + 2, w, 2.5); // eave shadow

  // Hanging sign with the building's icon
  if (sign) {
    const sx = left + w - 11;
    const sy = wallTop + 6;
    ctx.beginPath();
    ctx.moveTo(sx - 5, sy - 3);
    ctx.lineTo(sx - 5, sy);
    ctx.moveTo(sx + 5, sy - 3);
    ctx.lineTo(sx + 5, sy);
    stroke(ctx, 0.7, "#3d2616");
    ctx.fillStyle = lin(ctx, 0, sy, 0, sy + 13, ["#f6ecd4", "#e0cfa6"]);
    roundRect(ctx, sx - 7.5, sy, 15, 13, 2);
    ctx.fill();
    stroke(ctx, 0.9);
    icon(ctx, sign, sx, sy + 6.5, 11);
  }
  ctx.restore();
}

// Ground for one season: soft blotches and tufts of grass, built once into a tile at 4× detail
const GROUND = {
  spring: ["#7aa04e", "#6a9044", "#93b862", "#5d8a3c"],
  summer: ["#8a9c48", "#77893e", "#a3b25a", "#6c7d36"],
  autumn: ["#a08a46", "#8a7036", "#b89a52", "#7e6230"],
  winter: ["#e6eef3", "#d2dfe9", "#ffffff", "#c4d4e2"],
};
const TILE = 96; // game units per tile
const DETAIL = 4; // tile pixels per game unit
const tiles = new Map();

export function groundTile(season) {
  let cv = tiles.get(season);
  if (cv) return cv;
  cv = document.createElement("canvas");
  cv.width = TILE * DETAIL;
  cv.height = TILE * DETAIL;
  const g = cv.getContext("2d");
  g.scale(DETAIL, DETAIL);
  const [base, dark, light, blade] = GROUND[season];
  g.fillStyle = base;
  g.fillRect(0, 0, TILE, TILE);
  let seed = 11;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  // Soft patches of lighter and darker ground, wrapped so the tile repeats seamlessly
  for (let i = 0; i < 18; i++) {
    const x = rnd() * TILE;
    const y = rnd() * TILE;
    const r = 6 + rnd() * 12;
    const col = rnd() < 0.5 ? dark : light;
    for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) {
      const rg = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      rg.addColorStop(0, col + "88");
      rg.addColorStop(1, col + "00");
      g.fillStyle = rg;
      g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
  // Tufts of grass: little fans of curved blades
  g.lineCap = "round";
  for (let i = 0; i < 70; i++) {
    const x = rnd() * TILE;
    const y = rnd() * TILE;
    g.strokeStyle = rnd() < 0.5 ? blade : light;
    g.lineWidth = 0.35;
    for (let b = -1; b <= 1; b++) {
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + b * 0.6, y - 1.2, x + b * 1.1, y - 2.2 - rnd());
      g.stroke();
    }
  }
  tiles.set(season, cv);
  return cv;
}

// A ground pattern scaled back down to game units
export function groundPattern(ctx, season) {
  const p = ctx.createPattern(groundTile(season), "repeat");
  if (p.setTransform) p.setTransform(new DOMMatrix().scale(1 / DETAIL));
  return p;
}
