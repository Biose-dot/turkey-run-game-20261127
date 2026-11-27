// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between four screens: title, play,
// paused and game over (caught, or escaped at 1000 m).
//
// ?seed=N fixes the farm's pattern. ?shot=title|play|dash|end (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CORN, EVENT_DASH, EVENT_ESCAPED, EVENT_HIT, EVENT_OVER, EVENT_SMASH } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_JUMP, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { createAudio } from './audio.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas, world);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shotState = {
    screen: scene.screen,
    score: world.state.score,
    lives: world.state.lives,
    distanceM: Math.floor(world.state.distanceM),
    dash: world.state.dash,
    farmerGap: Math.floor(world.state.farmerGap),
    over: world.state.over,
    escaped: scene.escaped,
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, scene.escaped);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let escaped = false;
  let accumulator = 0;
  let last = performance.now();
  let jumpWasHeld = false;
  // One-shot presses, read once per frame and shared by the screen handler and
  // the first fixed step: reading them twice would eat a jump before step() sees it.
  let pendingActions = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    escaped = false;
    accumulator = 0;
    pendingActions = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. ${LIVES} lives. Run 1000 metres to freedom.`);
  }

  function endGame(wasEscape) {
    escaped = wasEscape;
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (wasEscape) {
      audio.escape();
      announce(`Escaped! Giblet is free. Score ${world.state.score}. Best ${best}.`);
    } else {
      audio.caught();
      announce(`Caught for dinner. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions() {
    const actions = pendingActions;
    // Screen keys are consumed here, once: leaving the pause bit set would
    // make the next frame's handler instantly un-pause again.
    pendingActions &= ~(ACTION_CONFIRM | ACTION_PAUSE);
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { jumpPressed: false, jumpHeld: false, jumpReleased: false, dashPressed: false }, true);
      return;
    }
    const actions = pendingActions;
    pendingActions = 0;
    const jumpHeld = input.jumpHeld();
    const controls = {
      jumpPressed: Boolean(actions & ACTION_JUMP),
      jumpHeld,
      jumpReleased: jumpWasHeld && !jumpHeld,
      dashPressed: Boolean(actions & ACTION_DASH),
    };
    jumpWasHeld = jumpHeld;
    if (controls.jumpPressed) audio.jump();
    const events = world.step(STEP, controls, false);
    if (events & EVENT_CORN) audio.corn();
    if (events & EVENT_DASH) audio.dash();
    if (events & EVENT_SMASH) audio.smash();
    if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.lives === 1 ? 'Hit. 1 life left. The farmer is close!' : `Hit. ${world.state.lives} lives left.`);
    }
    if (events & EVENT_OVER) endGame(Boolean(events & EVENT_ESCAPED));
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    pendingActions |= input.takeActions();
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, escaped);
  }

  // Leaving the tab pauses a running game rather than letting the farmer catch Giblet unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM') {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
  });

  // For play-testing and screenshots: the live state, read-only.
  window.__world = {
    get screen() { return screen; },
    get score() { return world.state.score; },
    get lives() { return world.state.lives; },
    get distanceM() { return world.state.distanceM; },
    get dash() { return world.state.dash; },
    get farmerGap() { return world.state.farmerGap; },
    get over() { return world.state.over; },
  };

  announce("Giblet's Great Escape. Press Space or click to run for your life.");
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
