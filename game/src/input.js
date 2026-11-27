// Keyboard and pointer input. Held keys give a steering direction; one-shot
// presses (jump, dash, start or restart, pause) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_JUMP = 4;
export const ACTION_DASH = 8;

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
const DASH = new Set(['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let jumpHeld = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (JUMP.has(event.code)) {
      jumpHeld = true;
      if (!event.repeat) actions |= ACTION_JUMP | ACTION_CONFIRM;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (JUMP.has(event.code)) jumpHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    jumpHeld = false;
  });
  target.addEventListener('pointerdown', () => {
    actions |= ACTION_JUMP | ACTION_CONFIRM;
  });

  return {
    /** True while the jump key is held (hold for a higher jump). */
    jumpHeld() {
      return jumpHeld;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
