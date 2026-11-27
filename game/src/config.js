// Giblet's Great Escape — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size. Giblet auto-runs to the
// right while the farm scrolls past; the farmer chases from the left edge.

export const FIELD = { width: 1280, height: 720, groundY: 618 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Giblet's escape: 1000 metres of farm, fence and flying cutlery to freedom. */
export const ESCAPE_DISTANCE_M = 1000;
export const PX_PER_M = 50;

export const PLAYER = {
  x: 250,
  width: 64,
  height: 58,
  jumpVelocity: 1000,
  gravity: 2400,
  /** Dash: a burst of speed + brief invulnerability, smashed through one obstacle. */
  dashSpeed: 620,
  dashTime: 0.55,
  dashInvulnerable: 0.7,
  invulnerable: 1.4,
};

export const LIVES = 3;

/** The farmer: every hit lets him lunge this many pixels closer to Giblet. */
export const FARMER = {
  startGap: 210,
  lunge: 48,
  catchGap: 58,
};

export const SCROLL = {
  start: 340,
  perLevel: 24,
  max: 560,
};

export const OBSTACLE = {
  interval: 1.3,
  intervalScale: 0.9,
  minInterval: 0.6,
  intervalJitter: 0.55,
  ovenPoints: 5,
  knifePoints: 8,
  fencePoints: 5,
};

export const CORN = {
  size: 30,
  points: 10,
  dashFill: 0.34,
  interval: 1.15,
  intervalJitter: 0.7,
};

export const GOLDEN_CORN = {
  points: 50,
  every: 5,
};

/** Seconds of play per level, and the last level: speeds and spawn rates stop growing there. */
export const LEVEL = { seconds: 15, max: 10 };

/** How many world objects can exist at once; the pools are allocated once, at boot. */
export const POOL_SIZE = 72;

export const PALETTE = {
  backdrop: '#0d1026',
  skyTop: '#141a3d',
  skyMid: '#2c2350',
  skyLow: '#7a3b4f',
  horizon: '#e07840',
  moon: '#ffe9b0',
  moonGlow: '#ffdf8a',
  ground: '#3a2a1c',
  groundTop: '#5d4a2f',
  dirt: '#6b4e2e',
  grass: '#4d6b2f',
  grassDark: '#33501f',
  barn: '#241a30',
  barnRoof: '#1a1226',
  fence: '#4a3421',
  pumpkin: '#e07820',
  pumpkinDark: '#b85a10',
  turkeyBody: '#8a5230',
  turkeyDark: '#6b3d20',
  turkeyLight: '#b5773f',
  tail: ['#a0522d', '#d2691e', '#e8a33c', '#7a3b1e', '#c97b2e'],
  head: '#d94f3d',
  wattle: '#e5534b',
  beak: '#f2a93c',
  leg: '#e8912d',
  farmerShirt: '#7a2e2e',
  farmerOveralls: '#2e4a7a',
  farmerHat: '#d8b25e',
  farmerSkin: '#e8b98a',
  ovenBody: '#3d3d46',
  ovenDoor: '#ff7a1a',
  ovenFire: '#ffc93c',
  knifeBlade: '#dfe6ee',
  knifeEdge: '#ffffff',
  knifeHandle: '#5a2e12',
  corn: '#f2c94c',
  cornDark: '#d8a92e',
  husk: '#5da83c',
  panel: '#1c1430',
  panelEdge: '#e8a33c',
  text: '#fff3d6',
  muted: '#c9b8a3',
  danger: '#ff5a4b',
  dash: '#7ee0ff',
  star: '#fff8d6',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'giblet-escape.best';
