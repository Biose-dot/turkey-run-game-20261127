// The game's rules and state, with no drawing and no browser in it: Giblet the
// turkey, the scrolling farm, the farmer closing in from behind, the ovens,
// fences and knives to jump, the corn to eat and the Gobble Dash. step()
// advances one fixed step and returns what happened as bit flags, so the caller
// can react without the world knowing about screens or sound. Nothing here
// allocates after createWorld returns.
//
// Giblet runs in place at PLAYER.x while the farm scrolls left. The farmer's
// gap shrinks a little every second and lunges closer on every hit; corn
// distracts him and pushes him back. Reach 1000 m and Giblet is free.
import {
  CORN, ESCAPE_DISTANCE_M, FARMER, FIELD, GOLDEN_CORN, LEVEL, LIVES,
  OBSTACLE, PLAYER, POOL_SIZE, PX_PER_M, SCROLL,
} from './config.js';

export const KIND_FENCE = 0;
export const KIND_OVEN = 1;
export const KIND_KNIFE_LOW = 2;
export const KIND_SWING = 3;
export const KIND_CORN = 4;
export const KIND_GOLDEN_CORN = 5;

export const EVENT_HIT = 1;
export const EVENT_CORN = 2;
export const EVENT_OVER = 4;
export const EVENT_ESCAPED = 8;
export const EVENT_DASH = 16;
export const EVENT_SMASH = 32;

function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function createWorld(random) {
  const player = {
    x: PLAYER.x, y: FIELD.groundY - PLAYER.height, width: PLAYER.width, height: PLAYER.height,
    vy: 0, onGround: true, invulnerable: 0, dashTime: 0, runPhase: 0,
  };
  const obstacles = [];
  const corns = [];
  const particles = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    obstacles.push({ active: false, kind: KIND_FENCE, x: 0, y: 0, width: 0, height: 0, speed: 0, scored: false, angle: 0, swingSpeed: 0, pivotY: 0, rope: 0 });
    corns.push({ active: false, golden: false, x: 0, y: 0, size: 0, bob: 0 });
  }
  for (let i = 0; i < 48; i += 1) {
    particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, kind: 0, size: 0 });
  }
  const state = {
    player, obstacles, corns, particles,
    score: 0, lives: LIVES, level: 1, elapsed: 0,
    distanceM: 0, distancePx: 0, dash: 1, farmerGap: FARMER.startGap,
    scrollSpeed: SCROLL.start, obstacleTimer: 0.9, cornTimer: 0.6,
    cornStreak: 0, over: null, shake: 0, gobbleText: 0,
  };

  function reset() {
    player.y = FIELD.groundY - player.height;
    player.vy = 0;
    player.onGround = true;
    player.invulnerable = 0;
    player.dashTime = 0;
    player.runPhase = 0;
    for (const o of obstacles) o.active = false;
    for (const c of corns) c.active = false;
    for (const p of particles) p.active = false;
    state.score = 0;
    state.lives = LIVES;
    state.level = 1;
    state.elapsed = 0;
    state.distanceM = 0;
    state.distancePx = 0;
    state.dash = 1;
    state.farmerGap = FARMER.startGap;
    state.scrollSpeed = SCROLL.start;
    state.obstacleTimer = 0.9;
    state.cornTimer = 0.6;
    state.cornStreak = 0;
    state.over = null;
    state.shake = 0;
    state.gobbleText = 0;
  }

  function freeObstacle() {
    for (let i = 0; i < obstacles.length; i += 1) if (!obstacles[i].active) return obstacles[i];
    return null;
  }

  function freeCorn() {
    for (let i = 0; i < corns.length; i += 1) if (!corns[i].active) return corns[i];
    return null;
  }

  function burst(x, y, kind, count) {
    let made = 0;
    for (let i = 0; i < particles.length && made < count; i += 1) {
      const p = particles[i];
      if (p.active) continue;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = (random() - 0.5) * 320;
      p.vy = -random() * 260 - 40;
      p.life = 0.5 + random() * 0.5;
      p.maxLife = p.life;
      p.kind = kind;
      p.size = 3 + random() * 5;
      made += 1;
    }
  }

  function spawnObstacle() {
    const o = freeObstacle();
    if (o === null) return;
    const roll = random();
    const x = FIELD.width + 40;
    o.active = true;
    o.scored = false;
    o.speed = 0;
    if (roll < 0.3) {
      o.kind = KIND_FENCE;
      o.width = 60 + random() * 14;
      o.height = 50;
      o.y = FIELD.groundY - o.height;
    } else if (roll < 0.58) {
      o.kind = KIND_OVEN;
      o.width = 80;
      o.height = 78;
      o.y = FIELD.groundY - o.height;
    } else if (roll < 0.8) {
      o.kind = KIND_KNIFE_LOW;
      o.width = 78;
      o.height = 16;
      o.y = FIELD.groundY - 20;
      o.speed = 90 + random() * 60;
    } else {
      o.kind = KIND_SWING;
      o.width = 52;
      o.height = 52;
      o.pivotY = 96;
      o.rope = 380;
      o.angle = -0.45 + random() * 0.3;
      o.swingSpeed = 1.5 + random() * 0.7 + state.level * 0.06;
      o.y = 0;
    }
    o.x = x;
  }

  function spawnCornArc(overX, overY) {
    // Three cobs in a jump arc over an obstacle: the reward for a clean hop.
    for (let i = -1; i <= 1; i += 1) {
      const c = freeCorn();
      if (c === null) return;
      c.active = true;
      c.golden = false;
      c.x = overX + i * 46;
      c.y = overY - 96 - (i === 0 ? 34 : 0);
      c.size = CORN.size;
      c.bob = random() * Math.PI * 2;
    }
  }

  function spawnCorn() {
    const c = freeCorn();
    if (c === null) return;
    state.cornStreak += 1;
    const golden = state.cornStreak % GOLDEN_CORN.every === 0;
    c.active = true;
    c.golden = golden;
    c.x = FIELD.width + 30;
    c.y = FIELD.groundY - 150 - random() * 130;
    c.size = golden ? CORN.size + 8 : CORN.size;
    c.bob = random() * Math.PI * 2;
  }

  function scrollSpeed() {
    return Math.min(SCROLL.max, SCROLL.start + SCROLL.perLevel * (state.level - 1));
  }

  function obstacleInterval() {
    return Math.max(OBSTACLE.minInterval, OBSTACLE.interval * OBSTACLE.intervalScale ** (state.level - 1));
  }

  function swingBlade(o) {
    const a = Math.sin(state.elapsed * o.swingSpeed) * 0.55 + o.angle * 0.2;
    return {
      x: o.x + Math.sin(a) * o.rope,
      y: o.pivotY + Math.cos(a) * o.rope,
      angle: a,
    };
  }

  /**
   * One fixed step. `controls` is { jumpPressed, jumpHeld, jumpReleased, dashPressed }.
   * With `harmless` set (the title screen's backdrop) things scroll and Giblet
   * auto-hops, but nothing hurts and nothing scores.
   */
  function step(dt, controls, harmless) {
    let events = 0;
    if (state.over) return events;
    state.elapsed += dt;
    state.level = Math.min(LEVEL.max, 1 + Math.floor(state.elapsed / LEVEL.seconds));
    state.scrollSpeed = scrollSpeed();
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.gobbleText > 0) state.gobbleText = Math.max(0, state.gobbleText - dt);

    // The farmer never stops walking: every second costs a little ground.
    state.farmerGap = Math.max(FARMER.catchGap, state.farmerGap - 0.35 * dt);

    const dashing = player.dashTime > 0;
    const speed = state.scrollSpeed + (dashing ? PLAYER.dashSpeed : 0);
    state.distancePx += speed * dt;
    state.distanceM = state.distancePx / PX_PER_M;

    // Jump: press to leave the ground, release early to cut the jump short.
    if (controls.jumpPressed && player.onGround) {
      player.vy = -PLAYER.jumpVelocity;
      player.onGround = false;
    }
    if (controls.jumpReleased && !player.onGround && player.vy < 0) player.vy *= 0.45;
    if (!player.onGround) {
      player.vy += PLAYER.gravity * dt;
      player.y += player.vy * dt;
      if (player.y >= FIELD.groundY - player.height) {
        player.y = FIELD.groundY - player.height;
        player.vy = 0;
        player.onGround = true;
      }
    }
    player.runPhase += dt * (player.onGround ? speed / 34 : 6);

    // Gobble Dash: a burst that smashes one obstacle and shrugs off the rest.
    if (controls.dashPressed && state.dash >= 0.34 && player.dashTime <= 0) {
      state.dash -= 0.34;
      player.dashTime = PLAYER.dashTime;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashInvulnerable);
      state.gobbleText = 0.8;
      burst(player.x + 10, player.y + 30, 2, 8);
      events |= EVENT_DASH;
    }
    if (player.dashTime > 0) player.dashTime = Math.max(0, player.dashTime - dt);
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    // Spawning.
    state.obstacleTimer -= dt;
    if (state.obstacleTimer <= 0) {
      spawnObstacle();
      if (random() < 0.45) spawnCornArc(FIELD.width + 120, FIELD.groundY);
      state.obstacleTimer += obstacleInterval() + random() * OBSTACLE.intervalJitter;
    }
    state.cornTimer -= dt;
    if (state.cornTimer <= 0) {
      spawnCorn();
      state.cornTimer += CORN.interval + random() * CORN.intervalJitter;
    }

    // Move and collide with obstacles.
    for (let i = 0; i < obstacles.length; i += 1) {
      const o = obstacles[i];
      if (!o.active) continue;
      o.x -= (speed + o.speed) * dt;
      if (o.x + o.width < -80) {
        o.active = false;
        continue;
      }
      if (o.kind === KIND_SWING) {
        // The blade sweeps above head height when Giblet stays on the ground
        // (rope 380: lowest point y 476, head top 556) but a jump runs into it.
        // Circle (blade, r 24) against the turkey's box, shrunk a little: fair.
        const blade = swingBlade(o);
        const px = player.x + 8;
        const py = player.y + 6;
        const pw = player.width - 16;
        const ph = player.height - 6;
        const nx = Math.max(px, Math.min(blade.x, px + pw));
        const ny = Math.max(py, Math.min(blade.y, py + ph));
        const dx = blade.x - nx;
        const dy = blade.y - ny;
        const hit = dx * dx + dy * dy < 24 * 24;
        if (hit && !harmless && player.invulnerable === 0) {
          if (dashing) {
            o.active = false;
            state.score += 25;
            burst(blade.x, blade.y, 1, 10);
            events |= EVENT_SMASH;
          } else {
            events |= hitPlayer();
          }
        }
        if (!o.scored && o.x + o.width < player.x) {
          o.scored = true;
          if (!harmless) state.score += OBSTACLE.knifePoints;
        }
        continue;
      }
      // The hitbox is inset from the drawn sprite: a graze is not a hit.
      const box = { x: o.x + 10, y: o.y + 6, width: o.width - 20, height: o.height - 6 };
      if (!harmless && overlaps(box, player)) {
        if (dashing || player.invulnerable > 0) {
          if (dashing) {
            o.active = false;
            state.score += 25;
            burst(o.x + o.width / 2, o.y + 10, 1, 10);
            events |= EVENT_SMASH;
          }
        } else {
          o.active = false;
          events |= hitPlayer();
        }
        continue;
      }
      if (!o.scored && o.x + o.width < player.x) {
        o.scored = true;
        if (!harmless) {
          state.score += o.kind === KIND_OVEN ? OBSTACLE.ovenPoints : o.kind === KIND_KNIFE_LOW ? OBSTACLE.knifePoints : OBSTACLE.fencePoints;
        }
      }
    }

    // Corn: eat it, fill the dash, push the farmer back a step.
    for (let i = 0; i < corns.length; i += 1) {
      const c = corns[i];
      if (!c.active) continue;
      c.x -= speed * dt;
      c.bob += dt * 3;
      if (c.x + c.size < -40) {
        c.active = false;
        continue;
      }
      const box = { x: c.x, y: c.y + Math.sin(c.bob) * 4, width: c.size, height: c.size };
      if (!harmless && overlaps(box, player)) {
        c.active = false;
        state.score += c.golden ? GOLDEN_CORN.points : CORN.points;
        state.dash = Math.min(1, state.dash + (c.golden ? 1 : CORN.dashFill));
        state.farmerGap = Math.min(FARMER.startGap, state.farmerGap + 6);
        burst(c.x + c.size / 2, c.y + c.size / 2, 0, 6);
        events |= EVENT_CORN;
      }
    }

    // Particles drift and fade.
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
    }

    // Title backdrop: Giblet hops the fences on his own.
    if (harmless) {
      for (let i = 0; i < obstacles.length; i += 1) {
        const o = obstacles[i];
        if (!o.active || o.kind === KIND_SWING) continue;
        if (o.x - player.x < 150 && o.x > player.x && player.onGround) {
          player.vy = -PLAYER.jumpVelocity;
          player.onGround = false;
        }
      }
    }

    // Escape: 1000 m of farm behind him, and Giblet is free.
    if (!harmless && state.distanceM >= ESCAPE_DISTANCE_M) {
      state.score += 500;
      state.over = 'escaped';
      events |= EVENT_OVER | EVENT_ESCAPED;
    }
    return events;
  }

  function hitPlayer() {
    state.lives -= 1;
    state.farmerGap = Math.max(FARMER.catchGap, state.farmerGap - FARMER.lunge);
    player.invulnerable = PLAYER.invulnerable;
    state.shake = 0.45;
    burst(player.x + player.width / 2, player.y + player.height / 2, 1, 12);
    if (state.lives <= 0 || state.farmerGap <= FARMER.catchGap) {
      state.over = 'caught';
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  reset();
  return { state, reset, step, swingBlade };
}
