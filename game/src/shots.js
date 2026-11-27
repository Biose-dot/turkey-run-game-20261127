// The screenshot scenes behind ?shot=title|play|dash|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by
// a simple autopilot (hop the ovens and fences, run under the swinging blade,
// dash through trouble when the meter is full), so the frame is what a short
// game really looks like and the same seed always gives the same frame.
import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER, KIND_KNIFE_LOW, KIND_OVEN, KIND_FENCE, KIND_SWING } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 30;
const DASH_SECONDS = 19;
const END_LIMIT_SECONDS = 600;
/**
 * How far ahead, in seconds, the autopilot looks before it hops: the play and
 * dash scenes' pilot looks well ahead and keeps all its lives; the end scene's
 * looks only a moment ahead, so it is caught out once the farm speeds up, as a
 * hurried player is.
 */
const HORIZON_PLAY = 0.3;
const HORIZON_END = 0.14;

/** The nearest obstacle still ahead of Giblet, if any. */
function nextObstacle(state) {
  let best = null;
  for (let index = 0; index < state.obstacles.length; index += 1) {
    const o = state.obstacles[index];
    if (!o.active) continue;
    if (o.x + o.width < state.player.x) continue;
    if (best === null || o.x < best.x) best = o;
  }
  return best;
}

/** Jump for fences, ovens and low knives; run under the swinging blade. */
function autopilot(state, horizon) {
  const player = state.player;
  // Hold the jump while airborne: releasing early cuts the jump short.
  if (!player.onGround) return { jumpPressed: false, jumpHeld: true, jumpReleased: false, dashPressed: false };
  const o = nextObstacle(state);
  if (o === null) return { jumpPressed: false, jumpHeld: false, jumpReleased: false, dashPressed: false };
  const gap = o.x - (player.x + player.width);
  // How fast this obstacle closes in: low knives fly at the turkey, the rest
  // ride the scroll. Hop when it is ~0.3 s out: any earlier and Giblet lands
  // on it, any later and he runs into it.
  const approach = state.scrollSpeed + (o.speed || 0);
  const reach = approach * horizon;
  if (o.kind === KIND_SWING) {
    // The blade sweeps at head height: stay on the ground and run under it.
    return { jumpPressed: false, jumpHeld: false, jumpReleased: false, dashPressed: false };
  }
  const jumpable = o.kind === KIND_FENCE || o.kind === KIND_OVEN || o.kind === KIND_KNIFE_LOW;
  if (jumpable && gap < reach && gap > -20) {
    const dash = state.dash >= 0.34 && gap < 90 && o.kind === KIND_OVEN;
    return { jumpPressed: true, jumpHeld: true, jumpReleased: false, dashPressed: dash };
  }
  return { jumpPressed: false, jumpHeld: false, jumpReleased: false, dashPressed: false };
}

function runFor(world, seconds, horizon) {
  const idle = { jumpPressed: false, jumpHeld: false, jumpReleased: false, dashPressed: false };
  for (let index = 0; index < seconds / STEP; index += 1) {
    const controls = horizon === null ? idle : autopilot(world.state, horizon);
    if (world.step(STEP, controls, false) & EVENT_OVER) break;
  }
}

/**
 * Set `world` to the named scene (title, play, dash or end; any other name is
 * title) and return the screen to draw over it, the best score to show and
 * whether the run ended in an escape.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'dash' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, { jumpPressed: false, jumpHeld: false, jumpReleased: false, dashPressed: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0, escaped: false };
  }
  if (name === 'dash') {
    runFor(world, DASH_SECONDS, HORIZON_PLAY);
    // Force the money shot: a full dash meter, an oven ahead, GOBBLE DASH! on screen.
    world.state.dash = 1;
    for (let index = 0; index < 0.3 / STEP; index += 1) {
      world.step(STEP, { jumpPressed: false, jumpHeld: false, jumpReleased: false, dashPressed: index === 0 }, false);
      if (world.state.over) break;
    }
    return { screen: SCREEN_PLAY, best: world.state.score, escaped: false };
  }
  if (name === 'end') {
    runFor(world, END_LIMIT_SECONDS, HORIZON_END);
    const over = world.state.lives === 0 || world.state.over === 'caught';
    return { screen: SCREEN_OVER, best: world.state.score, escaped: world.state.over === 'escaped' && !over };
  }
  runFor(world, PLAY_SECONDS, HORIZON_PLAY);
  const over = world.state.lives === 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score, escaped: world.state.over === 'escaped' };
}
