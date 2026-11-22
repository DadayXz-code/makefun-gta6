// Puerto Luna — keyboard and mouse. One small object the loop polls;
// the game never reads the DOM directly for input anywhere else.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouse: { x: 0, y: 0, down: false, clicked: false },
    pressed: new Set(), // keys pressed since the last poll, for edge triggers
  };

  function keyName(e) {
    return e.key.length === 1 ? e.key.toLowerCase() : e.key;
  }

  window.addEventListener('keydown', (e) => {
    const k = keyName(e);
    if (!input.keys.has(k)) input.pressed.add(k);
    input.keys.add(k);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(keyName(e));
  });
  window.addEventListener('blur', () => {
    input.keys.clear();
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = e.clientX - rect.left;
    input.mouse.y = e.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (e) => {
    input.mouse.down = true;
    input.mouse.clicked = true;
    if (e.button === 0) e.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    input.mouse.down = false;
  });

  return input;
}

export function isDown(input, ...names) {
  for (const n of names) if (input.keys.has(n)) return true;
  return false;
}

// Was this key pressed since the last frame? Call once per frame per key.
export function wasPressed(input, name) {
  if (input.pressed.has(name)) {
    input.pressed.delete(name);
    return true;
  }
  return false;
}

export function endFrame(input) {
  input.pressed.clear();
  input.mouse.clicked = false;
}
