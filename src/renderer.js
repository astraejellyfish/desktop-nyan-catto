import { NYAN_FRAMES, NYAN_FRAME_MS } from './nyanFrames.mjs';
import { createPrideTrailRenderer } from './trailRenderer.mjs';

const canvas = document.getElementById('cat');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const prideTrail = createPrideTrailRenderer(NYAN_FRAMES);
const frames = NYAN_FRAMES.map(paths => paths.map(({ fill, d }) => ({ fill, path: new Path2D(d) })));
let state;
let frame = 0;
let dragging = false;
let interactive = false;
let pointer = null;

function hitTest(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((event.clientX - rect.left) * canvas.width / rect.width);
  const y = Math.floor((event.clientY - rect.top) * canvas.height / rect.height);
  return x >= 0 && y >= 0 && x < canvas.width && y < canvas.height && ctx.getImageData(x, y, 1, 1).data[3] > 20;
}

function updateInteraction() {
  const next = dragging || (pointer !== null && hitTest(pointer));
  if (next !== interactive) {
    interactive = next;
    window.pet.setInteractive(next);
  }
}

function draw() {
  if (!state) return;
  canvas.style.width = `${canvas.width * state.size / 100}px`;
  canvas.style.height = `${canvas.height * state.size / 100}px`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(3, 3);
  if (state.direction === 'left') { ctx.translate(96, 0); ctx.scale(-1, 1); }
  const preset = state.trail;
  if (preset.style !== 'classic') ctx.drawImage(prideTrail(frame, preset.colors), 0, 0, 96, 32);
  let stripe = 0;
  for (const { fill, path } of frames[frame]) {
    if (fill.startsWith('#04F601')) {
      if (preset.style !== 'classic') continue;
      ctx.fillStyle = preset.colors.length === 1 ? preset.colors[0] + fill.slice(7) : preset.colors[stripe];
      stripe += 1;
    } else ctx.fillStyle = fill;
    ctx.fill(path);
  }
  ctx.restore();
  updateInteraction();
}

window.pet.onState(next => { state = next; draw(); });
state = await window.pet.getState();
draw();
setInterval(() => {
  if (!state.paused) { frame = (frame + 1) % frames.length; draw(); }
}, NYAN_FRAME_MS);

window.addEventListener('pointermove', event => { pointer = event; updateInteraction(); });
window.addEventListener('pointerleave', () => { pointer = null; updateInteraction(); });
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !hitTest(event)) return;
  dragging = true;
  canvas.classList.add('dragging');
  canvas.setPointerCapture(event.pointerId);
  window.pet.startDrag();
});
function endDrag() {
  if (!dragging) return;
  dragging = false;
  canvas.classList.remove('dragging');
  window.pet.endDrag();
  updateInteraction();
}
window.addEventListener('pointerup', endDrag);
window.addEventListener('pointercancel', endDrag);
canvas.addEventListener('lostpointercapture', endDrag);
window.addEventListener('blur', endDrag);
canvas.addEventListener('contextmenu', event => { event.preventDefault(); window.pet.openMenu(); });
