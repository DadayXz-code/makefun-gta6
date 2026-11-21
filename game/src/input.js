// Keyboard + mouse input. Keys are tracked by code so layouts do not matter.
export const keys = {};
export const mouse = { x: 0, y: 0, down: false };

const PREVENT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export function initInput(canvas) {
  addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (PREVENT.has(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  addEventListener('blur', () => {
    for (const k of Object.keys(keys)) keys[k] = false;
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * canvas.width;
    mouse.y = ((e.clientY - r.top) / r.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true;
  });
  addEventListener('mouseup', () => {
    mouse.down = false;
  });
}

export function pressed(code) {
  return !!keys[code];
}

export function axis(neg, pos) {
  return (pressed(pos) ? 1 : 0) - (pressed(neg) ? 1 : 0);
}
