// Keyboard and mouse for Puerto Luna.
//
// `keys` is the live table of held keys, indexed by KeyboardEvent.code
// ('KeyW', 'ArrowUp', 'Space', ...). `pressed(code)` answers whether a key
// is held right now. `mouse` tracks the pointer over the canvas and
// whether its button is down. Call `initInput(canvas)` once, before the
// game loop starts, and the listeners below keep the state current.
//
// Keys the game uses are captured so the page never scrolls under them
// (arrows, space); every other key behaves normally.
export const keys = {};
export const mouse = { x: 0, y: 0, down: false };

const CAPTURED = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyM', 'KeyP', 'Enter', 'Escape',
]);

export function pressed(code) {
  return !!keys[code];
}

// True when any of the given codes is held — for keys that share a job,
// like P and Escape both pausing the game.
export function anyPressed(...codes) {
  return codes.some((code) => !!keys[code]);
}

function canvasPosition(canvas, event) {
  const box = canvas.getBoundingClientRect();
  const scaleX = canvas.width / box.width;
  const scaleY = canvas.height / box.height;
  return {
    x: (event.clientX - box.left) * scaleX,
    y: (event.clientY - box.top) * scaleY,
  };
}

export function initInput(canvas) {
  window.addEventListener('keydown', (event) => {
    if (CAPTURED.has(event.code)) event.preventDefault();
    keys[event.code] = true;
  });
  window.addEventListener('keyup', (event) => {
    keys[event.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const code of Object.keys(keys)) keys[code] = false;
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const at = canvasPosition(canvas, event);
    mouse.x = at.x;
    mouse.y = at.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const at = canvasPosition(canvas, event);
    mouse.x = at.x;
    mouse.y = at.y;
    mouse.down = true;
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}
