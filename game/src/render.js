// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. A moonlit Thanksgiving farm at night: harvest moon,
// barn and windmill silhouettes, pumpkin patch, fireflies — then Giblet the
// turkey, the farmer closing in with his carving knife, glowing ovens, swinging
// blades and golden corn. Nothing here reads the clock: every flicker derives
// from the world's elapsed time, so a staged screenshot is repeatable.
import { FIELD, FONT, LIVES, PALETTE, ESCAPE_DISTANCE_M } from './config.js';
import { KIND_CORN, KIND_FENCE, KIND_KNIFE_LOW, KIND_OVEN, KIND_SWING } from './world.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const LIFE_SIZE = 22;
const LIFE_GAP = 8;

// Fixed night sky: the same stars every run, placed once from a fixed seed.
const skyRandom = createRandom(99);
const STARS = [];
for (let i = 0; i < 90; i += 1) {
  STARS.push({ x: skyRandom() * FIELD.width, y: skyRandom() * 300, r: 0.6 + skyRandom() * 1.6, tw: skyRandom() * Math.PI * 2 });
}
const FIREFLIES = [];
for (let i = 0; i < 14; i += 1) {
  FIREFLIES.push({ x: skyRandom() * FIELD.width, y: 380 + skyRandom() * 200, ph: skyRandom() * Math.PI * 2, sp: 0.3 + skyRandom() * 0.5 });
}
const CLOUDS = [
  { x: 120, y: 90, s: 1.1, v: 6 },
  { x: 620, y: 60, s: 0.8, v: 9 },
  { x: 1020, y: 130, s: 1.3, v: 5 },
];
const GRASS_TUFTS = [];
for (let i = 0; i < 46; i += 1) {
  GRASS_TUFTS.push({ x: skyRandom() * FIELD.width, h: 6 + skyRandom() * 10 });
}
const PUMPKINS = [
  { x: 60, y: 0, s: 1 }, { x: 1180, y: 0, s: 0.8 }, { x: 1240, y: 0, s: 1.15 }, { x: 900, y: 0, s: 0.7 },
];

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas, world) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const distanceLabel = cachedLabel('');
  const levelLabel = cachedLabel('LV ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const distLabel = cachedLabel('');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = size + (weight || '');
    if (!fonts.has(key)) fonts.set(key, `${weight || ''} ${size}px ${FONT}`.trim());
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }

  function drawSky(state) {
    const g = context.createLinearGradient(0, 0, 0, FIELD.groundY);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.55, PALETTE.skyMid);
    g.addColorStop(0.85, PALETTE.skyLow);
    g.addColorStop(1, PALETTE.horizon);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, FIELD.groundY);
    // Stars, twinkling off the world's clock.
    for (const s of STARS) {
      const a = 0.35 + 0.65 * Math.abs(Math.sin(state.elapsed * 0.8 + s.tw));
      context.globalAlpha = a;
      context.fillStyle = PALETTE.star;
      context.fillRect(s.x, s.y, s.r, s.r);
    }
    context.globalAlpha = 1;
    // Harvest moon, low and huge.
    const mx = 1050;
    const my = 150;
    const glow = context.createRadialGradient(mx, my, 20, mx, my, 130);
    glow.addColorStop(0, 'rgba(255, 223, 138, 0.55)');
    glow.addColorStop(1, 'rgba(255, 223, 138, 0)');
    context.fillStyle = glow;
    context.fillRect(mx - 130, my - 130, 260, 260);
    context.fillStyle = PALETTE.moon;
    context.beginPath();
    context.arc(mx, my, 62, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(214, 164, 90, 0.55)';
    context.beginPath(); context.arc(mx - 18, my - 12, 12, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(mx + 16, my + 18, 8, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(mx + 24, my - 22, 6, 0, Math.PI * 2); context.fill();
    // Slow clouds crossing the moon.
    context.fillStyle = 'rgba(38, 32, 66, 0.85)';
    for (const c of CLOUDS) {
      const cx = ((c.x + state.elapsed * c.v) % (FIELD.width + 320)) - 160;
      context.beginPath();
      context.ellipse(cx, c.y, 90 * c.s, 20 * c.s, 0, 0, Math.PI * 2);
      context.ellipse(cx + 60 * c.s, c.y + 8, 60 * c.s, 16 * c.s, 0, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawFarm(state) {
    // Distant barn, windmill and fence silhouettes.
    context.fillStyle = PALETTE.barn;
    context.fillRect(80, 470, 190, 148);
    context.beginPath();
    context.moveTo(60, 472); context.lineTo(175, 400); context.lineTo(290, 472);
    context.closePath();
    context.fillStyle = PALETTE.barnRoof;
    context.fill();
    context.fillStyle = PALETTE.barn;
    context.fillRect(150, 520, 40, 98);
    context.fillStyle = PALETTE.horizon;
    context.fillRect(162, 540, 16, 16);
    // Windmill.
    context.fillStyle = PALETTE.barn;
    context.beginPath();
    context.moveTo(1150, 618); context.lineTo(1170, 430); context.lineTo(1190, 618);
    context.closePath();
    context.fill();
    const wa = state.elapsed * 0.9;
    context.strokeStyle = PALETTE.barn;
    context.lineWidth = 7;
    for (let i = 0; i < 4; i += 1) {
      const a = wa + (i * Math.PI) / 2;
      context.beginPath();
      context.moveTo(1180, 440);
      context.lineTo(1180 + Math.cos(a) * 62, 440 + Math.sin(a) * 62);
      context.stroke();
    }
    // Fence line along the horizon.
    context.fillStyle = PALETTE.fence;
    for (let x = 0; x < FIELD.width; x += 64) {
      context.fillRect(x + 8, FIELD.groundY - 34, 6, 34);
    }
    context.fillRect(0, FIELD.groundY - 30, FIELD.width, 5);
    context.fillRect(0, FIELD.groundY - 16, FIELD.width, 5);
    // Pumpkins by the fence.
    for (const p of PUMPKINS) {
      const px = p.x;
      const py = FIELD.groundY - 12;
      context.fillStyle = PALETTE.pumpkin;
      context.beginPath();
      context.ellipse(px, py, 20 * p.s, 14 * p.s, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.pumpkinDark;
      context.fillRect(px - 2, py - 18 * p.s, 4, 8);
    }
  }

  function drawGround(state) {
    const g = context.createLinearGradient(0, FIELD.groundY, 0, FIELD.height);
    g.addColorStop(0, PALETTE.groundTop);
    g.addColorStop(0.12, PALETTE.ground);
    g.addColorStop(1, '#241a12');
    context.fillStyle = g;
    context.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    // Grass strip and tufts.
    context.fillStyle = PALETTE.grassDark;
    context.fillRect(0, FIELD.groundY, FIELD.width, 8);
    context.strokeStyle = PALETTE.grass;
    context.lineWidth = 2;
    const offset = (state.distancePx || 0) % 90;
    for (const t of GRASS_TUFTS) {
      const x = ((t.x - offset) % FIELD.width + FIELD.width) % FIELD.width;
      context.beginPath();
      context.moveTo(x, FIELD.groundY + 6);
      context.lineTo(x - 3, FIELD.groundY + 6 - t.h);
      context.moveTo(x + 3, FIELD.groundY + 6);
      context.lineTo(x + 6, FIELD.groundY + 6 - t.h * 0.8);
      context.stroke();
    }
    // Dirt clods scrolling past.
    context.fillStyle = PALETTE.dirt;
    for (let i = 0; i < 12; i += 1) {
      const x = ((i * 173 + 40 - (state.distancePx || 0)) % (FIELD.width + 80) + FIELD.width + 80) % (FIELD.width + 80) - 40;
      context.beginPath();
      context.ellipse(x, FIELD.groundY + 34 + (i % 3) * 18, 12, 4, 0, 0, Math.PI * 2);
      context.fill();
    }
    // Fireflies over the field.
    for (const f of FIREFLIES) {
      const a = 0.25 + 0.75 * Math.abs(Math.sin(state.elapsed * f.sp + f.ph));
      context.globalAlpha = a;
      context.fillStyle = '#ffe27a';
      context.beginPath();
      context.arc(f.x + Math.sin(state.elapsed * f.sp + f.ph) * 24, f.y + Math.cos(state.elapsed * f.sp * 0.7 + f.ph) * 10, 2.6, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  /** Giblet, mid-stride: fanned tail, plump body, red head, orange legs. */
  function drawTurkey(player, dashing) {
    const cx = player.x + player.width / 2;
    const feet = player.y + player.height;
    const airborne = !player.onGround;
    const phase = player.runPhase;
    const legSwing = airborne ? 0 : Math.sin(phase) * 14;
    // Dash speed lines.
    if (dashing) {
      context.strokeStyle = 'rgba(126, 224, 255, 0.8)';
      context.lineWidth = 3;
      for (let i = 0; i < 4; i += 1) {
        const ly = player.y + 8 + i * 14;
        context.beginPath();
        context.moveTo(player.x - 26 - i * 8, ly);
        context.lineTo(player.x - 58 - i * 10, ly);
        context.stroke();
      }
    }
    // Legs.
    context.strokeStyle = PALETTE.leg;
    context.lineWidth = 6;
    context.lineCap = 'round';
    const hipY = feet - 6;
    context.beginPath();
    context.moveTo(cx - 8, hipY);
    context.lineTo(cx - 14 + (airborne ? 10 : legSwing), feet + (airborne ? -8 : 0));
    context.moveTo(cx + 8, hipY);
    context.lineTo(cx + 14 + (airborne ? -6 : -legSwing), feet + (airborne ? -8 : 0));
    context.stroke();
    // Tail fan: five feathers with eye spots.
    for (let i = 0; i < 5; i += 1) {
      const spread = (i - 2) * 0.42;
      const len = 52 - Math.abs(i - 2) * 7;
      const tx = cx + Math.sin(spread) * len * 0.9;
      const ty = feet - 34 - Math.cos(spread) * len * 0.9;
      context.strokeStyle = PALETTE.tail[i];
      context.lineWidth = 13;
      context.beginPath();
      context.moveTo(cx - 6, feet - 30);
      context.lineTo(tx, ty);
      context.stroke();
      context.fillStyle = '#2e4a7a';
      context.beginPath();
      context.arc(tx, ty, 4.5, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.corn;
      context.beginPath();
      context.arc(tx, ty, 2, 0, Math.PI * 2);
      context.fill();
    }
    // Body.
    const bodyG = context.createLinearGradient(cx - 30, player.y, cx + 30, player.y + 50);
    bodyG.addColorStop(0, PALETTE.turkeyLight);
    bodyG.addColorStop(0.5, PALETTE.turkeyBody);
    bodyG.addColorStop(1, PALETTE.turkeyDark);
    context.fillStyle = bodyG;
    context.beginPath();
    context.ellipse(cx, feet - 26, 34, 26, 0, 0, Math.PI * 2);
    context.fill();
    // Wing, raised when airborne or dashing.
    context.fillStyle = PALETTE.turkeyDark;
    context.beginPath();
    context.ellipse(cx - 4, feet - 26, 20, 12, airborne || dashing ? -0.7 : -0.25, 0, Math.PI * 2);
    context.fill();
    // Head, beak and wattle — always facing the freedom ahead.
    const hx = cx + 22;
    const hy = feet - 52;
    context.fillStyle = PALETTE.head;
    context.beginPath();
    context.arc(hx, hy, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.beak;
    context.beginPath();
    context.moveTo(hx + 8, hy - 2);
    context.lineTo(hx + 20, hy + 3);
    context.lineTo(hx + 8, hy + 7);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.wattle;
    context.beginPath();
    context.ellipse(hx + 8, hy + 10, 4, 7, 0.3, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1a1a1a';
    context.beginPath();
    context.arc(hx + 4, hy - 3, 2.2, 0, Math.PI * 2);
    context.fill();
    // Blink while invulnerable after a hit.
    if (player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0) {
      context.globalAlpha = 0.35;
      context.fillStyle = '#ffffff';
      context.beginPath();
      context.ellipse(cx, feet - 26, 34, 26, 0, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    }
  }

  /** The farmer, closing in from the left with his carving knife. */
  function drawFarmer(state) {
    const gap = state.farmerGap;
    const fx = state.player.x - gap - 64;
    if (fx < -140) return;
    const feet = FIELD.groundY;
    const bob = Math.abs(Math.sin(state.elapsed * 7)) * 5;
    const walk = Math.sin(state.elapsed * 7);
    // Legs in overalls, mid-stride.
    context.strokeStyle = PALETTE.farmerOveralls;
    context.lineWidth = 13;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(fx + 32, feet - 62);
    context.lineTo(fx + 20 + walk * 10, feet);
    context.moveTo(fx + 32, feet - 62);
    context.lineTo(fx + 46 - walk * 10, feet);
    context.stroke();
    // Body: red shirt, blue overalls.
    context.fillStyle = PALETTE.farmerShirt;
    context.beginPath();
    context.ellipse(fx + 32, feet - 92 - bob, 30, 34, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.farmerOveralls;
    context.fillRect(fx + 10, feet - 96 - bob, 44, 40);
    // Head with straw hat.
    context.fillStyle = PALETTE.farmerSkin;
    context.beginPath();
    context.arc(fx + 38, feet - 138 - bob, 17, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.farmerHat;
    context.beginPath();
    context.ellipse(fx + 38, feet - 150 - bob, 30, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.beginPath();
    context.arc(fx + 38, feet - 152 - bob, 15, Math.PI, 0);
    context.fill();
    // Angry eyes and moustache.
    context.fillStyle = '#1a1a1a';
    context.fillRect(fx + 42, feet - 142 - bob, 5, 3);
    context.fillStyle = '#5a3a1a';
    context.fillRect(fx + 40, feet - 130 - bob, 16, 4);
    // The carving knife, raised and glinting.
    const kx = fx + 66;
    const ky = feet - 96 - bob;
    context.save();
    context.translate(kx, ky);
    context.rotate(-0.7 + Math.sin(state.elapsed * 2) * 0.08);
    context.fillStyle = PALETTE.knifeHandle;
    context.fillRect(-4, 0, 9, 26);
    context.fillStyle = PALETTE.knifeBlade;
    context.beginPath();
    context.moveTo(-6, 26); context.lineTo(6, 26); context.lineTo(0, 78);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.9)';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(-3, 30); context.lineTo(0, 66);
    context.stroke();
    context.restore();
    // "GET BACK HERE!" — only when he is close enough to be scary.
    if (gap < 130) {
      context.font = `bold 20px ${FONT}`;
      context.fillStyle = PALETTE.text;
      context.textAlign = 'left';
      context.fillText('GET BACK HERE!', fx + 10, feet - 176 - bob);
    }
  }

  function drawOven(o, state) {
    const flicker = 0.75 + 0.25 * Math.sin(state.elapsed * 9 + o.x * 0.01);
    context.fillStyle = PALETTE.ovenBody;
    roundRect(o.x, o.y, o.width, o.height, 8);
    context.fill();
    context.fillStyle = '#2a2a32';
    context.fillRect(o.x + 8, o.y - 14, 26, 16);
    // Open door: fire inside, ready for a turkey.
    context.fillStyle = `rgba(255, 122, 26, ${flicker})`;
    roundRect(o.x + 14, o.y + 18, o.width - 28, o.height - 30, 6);
    context.fill();
    context.fillStyle = PALETTE.ovenFire;
    context.beginPath();
    context.moveTo(o.x + 26, o.y + o.height - 16);
    context.quadraticCurveTo(o.x + 34, o.y + 26, o.x + 44, o.y + o.height - 16);
    context.quadraticCurveTo(o.x + 54, o.y + 30, o.x + 64, o.y + o.height - 16);
    context.closePath();
    context.fill();
    // Heat shimmer above the door.
    context.strokeStyle = 'rgba(255, 180, 90, 0.45)';
    context.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      const hx = o.x + 24 + i * 24;
      context.beginPath();
      context.moveTo(hx, o.y - 2);
      context.quadraticCurveTo(hx + 5, o.y - 10, hx, o.y - 16);
      context.stroke();
    }
    // Label last, clear of the shimmer.
    context.fillStyle = '#1a1a1a';
    context.font = `bold 15px ${FONT}`;
    context.textAlign = 'center';
    context.fillText('HOT!', o.x + o.width / 2, o.y - 24);
  }

  function drawFence(o) {
    // A hay bale with a fence rail behind it.
    context.fillStyle = PALETTE.fence;
    context.fillRect(o.x - 8, o.y - 18, o.width + 16, 7);
    context.fillRect(o.x - 8, o.y + 2, o.width + 16, 7);
    context.fillStyle = '#c9a13c';
    context.beginPath();
    context.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width / 2, o.height / 2 - 2, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#a87f22';
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(o.x + o.width / 2, o.y + o.height / 2, o.width / 2 - 8, o.height / 2 - 10, 0, 0, Math.PI * 2);
    context.stroke();
  }

  function drawKnifeLow(o, state) {
    // A carving knife skimming the dirt, thrown by a furious farmer.
    const glint = 0.5 + 0.5 * Math.sin(state.elapsed * 14 + o.x * 0.05);
    context.save();
    context.translate(o.x + o.width / 2, o.y + o.height / 2);
    context.rotate(0.12);
    context.fillStyle = PALETTE.knifeBlade;
    context.beginPath();
    context.moveTo(-38, -7); context.lineTo(18, -7); context.lineTo(38, 0); context.lineTo(18, 7); context.lineTo(-38, 7);
    context.closePath();
    context.fill();
    context.fillStyle = PALETTE.knifeHandle;
    roundRect(-52, -6, 18, 12, 4);
    context.fill();
    context.fillStyle = `rgba(255,255,255,${0.4 + glint * 0.6})`;
    context.fillRect(-30, -5, 40, 2);
    context.restore();
    context.strokeStyle = 'rgba(223, 230, 238, 0.35)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(o.x - 10, o.y + 8);
    context.lineTo(o.x - 44, o.y + 8);
    context.stroke();
  }

  function drawSwing(o, state) {
    const blade = world.swingBlade(o);
    // Rope from the branch above.
    context.strokeStyle = '#8a6a3a';
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(o.x, o.pivotY - 96);
    context.lineTo(blade.x, blade.y);
    context.stroke();
    // The branch it hangs from.
    context.strokeStyle = '#2a1e12';
    context.lineWidth = 12;
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(o.x - 60, o.pivotY - 96);
    context.lineTo(o.x + 60, o.pivotY - 96);
    context.stroke();
    // The blade itself, glinting as it sweeps.
    context.save();
    context.translate(blade.x, blade.y);
    context.rotate(blade.angle + Math.PI / 2);
    context.fillStyle = PALETTE.knifeHandle;
    context.fillRect(-5, -26, 10, 22);
    context.fillStyle = PALETTE.knifeBlade;
    context.beginPath();
    context.moveTo(-9, -4); context.lineTo(9, -4); context.lineTo(0, 44);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawCorn(c) {
    const bobY = c.y + Math.sin(c.bob) * 4;
    const cx = c.x + c.size / 2;
    const cy = bobY + c.size / 2;
    if (c.golden) {
      const glow = context.createRadialGradient(cx, cy, 4, cx, cy, 42);
      glow.addColorStop(0, 'rgba(255, 220, 90, 0.6)');
      glow.addColorStop(1, 'rgba(255, 220, 90, 0)');
      context.fillStyle = glow;
      context.fillRect(cx - 42, cy - 42, 84, 84);
    }
    context.fillStyle = PALETTE.husk;
    context.beginPath();
    context.moveTo(cx - 8, cy + 12);
    context.lineTo(cx - 20, cy + 22);
    context.lineTo(cx - 6, cy + 16);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(cx + 8, cy + 12);
    context.lineTo(cx + 20, cy + 22);
    context.lineTo(cx + 6, cy + 16);
    context.closePath();
    context.fill();
    const g = context.createLinearGradient(cx - 10, cy - 12, cx + 10, cy + 12);
    g.addColorStop(0, c.golden ? '#ffe98a' : PALETTE.corn);
    g.addColorStop(1, c.golden ? '#f2b705' : PALETTE.cornDark);
    context.fillStyle = g;
    context.beginPath();
    context.ellipse(cx, cy, c.size * 0.36, c.size * 0.5, 0, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(160, 110, 10, 0.7)';
    context.lineWidth = 1.5;
    for (let i = -1; i <= 1; i += 1) {
      context.beginPath();
      context.moveTo(cx + i * 6, cy - 10);
      context.lineTo(cx + i * 6, cy + 10);
      context.stroke();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      const a = Math.max(0, p.life / p.maxLife);
      context.globalAlpha = a;
      if (p.kind === 0) {
        context.fillStyle = '#ffe27a';
        context.beginPath();
        context.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        context.fill();
      } else if (p.kind === 1) {
        context.fillStyle = PALETTE.turkeyBody;
        context.beginPath();
        context.ellipse(p.x, p.y, p.size, p.size * 0.6, p.vx * 0.01, 0, Math.PI * 2);
        context.fill();
      } else {
        context.strokeStyle = PALETTE.dash;
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(p.x, p.y);
        context.lineTo(p.x - 18, p.y);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  function drawField(state, dim) {
    drawSky(state);
    drawFarm(state);
    drawGround(state);
    for (let i = 0; i < state.obstacles.length; i += 1) {
      const o = state.obstacles[i];
      if (!o.active) continue;
      if (o.kind === KIND_OVEN) drawOven(o, state);
      else if (o.kind === KIND_FENCE) drawFence(o);
      else if (o.kind === KIND_KNIFE_LOW) drawKnifeLow(o, state);
      else if (o.kind === KIND_SWING) drawSwing(o, state);
    }
    for (let i = 0; i < state.corns.length; i += 1) {
      const c = state.corns[i];
      if (c.active) drawCorn(c);
    }
    drawParticles(state);
    drawFarmer(state);
    drawTurkey(state.player, state.player.dashTime > 0);
    // Gobble Dash shout, floating above Giblet so it never covers him.
    if (state.gobbleText > 0) {
      context.globalAlpha = Math.min(1, state.gobbleText * 2);
      context.font = `bold 44px ${FONT}`;
      context.fillStyle = PALETTE.dash;
      context.textAlign = 'left';
      context.fillText('GOBBLE DASH!', state.player.x + 30, state.player.y - 84);
      context.globalAlpha = 1;
    }
    if (dim) {
      context.fillStyle = 'rgba(10, 8, 28, 0.55)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawHeart(x, y, filled) {
    context.fillStyle = filled ? '#ff5a6e' : 'rgba(255,255,255,0.18)';
    context.beginPath();
    context.moveTo(x, y + 8);
    context.bezierCurveTo(x - 12, y - 4, x - 6, y - 12, x, y - 5);
    context.bezierCurveTo(x + 6, y - 12, x + 12, y - 4, x, y + 8);
    context.fill();
  }

  function drawHud(state) {
    context.textBaseline = 'top';
    // Top bar.
    context.fillStyle = 'rgba(13, 16, 38, 0.9)';
    roundRect(12, 10, FIELD.width - 24, 64, 12);
    context.fill();
    text(scoreLabel(state.score), 30, 24, 30, PALETTE.text, 'left', 'bold');
    text(levelLabel(state.level), 300, 26, 24, PALETTE.muted, 'left', 'bold');
    // Distance progress: the road to freedom.
    const barX = 470;
    const barW = 380;
    const frac = Math.min(1, state.distanceM / ESCAPE_DISTANCE_M);
    context.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(barX, 30, barW, 14, 7);
    context.fill();
    context.fillStyle = PALETTE.corn;
    if (frac > 0) {
      roundRect(barX, 30, Math.max(14, barW * frac), 14, 7);
      context.fill();
    }
    text(distanceLabel(`${Math.floor(state.distanceM)}m / ${ESCAPE_DISTANCE_M}m  FREEDOM`), barX + barW / 2, 48, 15, PALETTE.muted, 'center', 'bold');
    // Lives as hearts, dash meter under them.
    const firstHeart = FIELD.width - 30 - LIVES * (LIFE_SIZE + LIFE_GAP) + LIFE_GAP;
    text('LIVES', firstHeart - 14, 22, 20, PALETTE.text, 'right', 'bold');
    for (let life = 0; life < LIVES; life += 1) {
      drawHeart(firstHeart + life * (LIFE_SIZE + LIFE_GAP) + 10, 34, life < state.lives);
    }
    const dashW = LIVES * (LIFE_SIZE + LIFE_GAP) + 40;
    const dashX = FIELD.width - 30 - dashW;
    context.fillStyle = 'rgba(255,255,255,0.16)';
    roundRect(dashX, 58, dashW, 9, 4);
    context.fill();
    context.fillStyle = state.dash >= 0.34 ? PALETTE.dash : 'rgba(126,224,255,0.45)';
    if (state.dash > 0) {
      roundRect(dashX, 58, Math.max(9, dashW * state.dash), 9, 4);
      context.fill();
    }
    text('DASH', dashX - 8, 52, 14, PALETTE.dash, 'right', 'bold');
    // Farmer proximity warning.
    if (state.farmerGap < 110) {
      context.globalAlpha = 0.6 + 0.4 * Math.sin(state.elapsed * 8);
      text('THE FARMER IS RIGHT BEHIND YOU!', FIELD.width / 2, 84, 22, PALETTE.danger, 'center', 'bold');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const width = 780;
    const lineH = 30;
    const height = 148 + lines.length * lineH + 72;
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(28, 20, 48, 0.96)';
    roundRect(x, y, width, height, 18);
    context.fill();
    context.strokeStyle = accent || PALETTE.panelEdge;
    context.lineWidth = 3;
    roundRect(x, y, width, height, 18);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 72, 46, PALETTE.text, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 124 + i * lineH, 20, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 30, 23, PALETTE.corn, 'center', 'bold');
  }

  const TITLE_LINES = [
    'Thanksgiving night. The farmer has the carving knife out.',
    'You are Giblet — the turkey. Run 1000 m to freedom.',
    'SPACE / ↑ / CLICK — jump (hold for higher)',
    'SHIFT / X — Gobble Dash: smash straight through trouble',
    'Jump the ovens, fences and flying knives. Eat corn to charge dash.',
    'Corn distracts the farmer. 3 hits — or one grab — and dinner is served.',
    '',
  ];
  const PAUSED_LINES = ['The farmer waits. The oven stays hot.', 'Giblet catches his breath.'];
  const CAUGHT_LINES = ['', '', 'The farmer is already carving. Better luck next Thanksgiving.'];
  const ESCAPED_LINES = ['', '', '1000 metres, zero stuffing. Giblet lives to gobble another day!'];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, escaped) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const shakeX = state.shake > 0 ? (Math.sin(state.elapsed * 61) * state.shake * 14) : 0;
    const shakeY = state.shake > 0 ? (Math.cos(state.elapsed * 53) * state.shake * 10) : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + shakeX * view.scale, view.y + shakeY * view.scale);
    if (screen === SCREEN_TITLE) {
      drawField(state, false);
      TITLE_LINES[6] = best > 0 ? bestLabel(best) : 'No turkey has escaped yet. Be the first.';
      drawPanel("GIBLET'S GREAT ESCAPE", TITLE_LINES, 'Press SPACE or click to run for your life');
      return;
    }
    drawField(state, screen !== SCREEN_PLAY);
    if (screen === SCREEN_PLAY) {
      drawHud(state);
      if (state.elapsed < 4) {
        context.textBaseline = 'alphabetic';
        text('SPACE to jump — SHIFT to Gobble Dash!', FIELD.width / 2, FIELD.height - 24, 22, PALETTE.text, 'center', 'bold');
      }
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to keep running');
    } else if (screen === SCREEN_OVER) {
      if (escaped) {
        // Sunrise of freedom over the field.
        const g = context.createLinearGradient(0, 0, 0, FIELD.height);
        g.addColorStop(0, 'rgba(255, 190, 90, 0.25)');
        g.addColorStop(1, 'rgba(255, 120, 60, 0.05)');
        context.fillStyle = g;
        context.fillRect(0, 0, FIELD.width, FIELD.height);
        ESCAPED_LINES[0] = finalLabel(state.score);
        ESCAPED_LINES[1] = `${distLabel(`${Math.floor(state.distanceM)}m run`)}  ·  ${bestLabel(best)}`;
        drawPanel('ESCAPED! GIBLET IS FREE!', ESCAPED_LINES, 'Press SPACE or click to run again', '#7ee0ff');
      } else {
        CAUGHT_LINES[0] = finalLabel(state.score);
        CAUGHT_LINES[1] = `${distLabel(`${Math.floor(state.distanceM)}m run`)}  ·  ${bestLabel(best)}`;
        drawPanel('CAUGHT FOR DINNER', CAUGHT_LINES, 'Press SPACE or click to run again', '#ff5a4b');
      }
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
