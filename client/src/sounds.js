const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx;
const getCtx = () => {
  if (!ctx) ctx = new AudioCtx();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

const tone = (freq, type, vol, start, dur) => {
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.connect(g);
  g.connect(c.destination);
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  g.gain.setValueAtTime(vol, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur);
};

export function playCorrect() {
  tone(587, 'sine', 0.13, 0, 0.15);
  tone(784, 'sine', 0.13, 0.12, 0.3);
}

export function playTick() {
  tone(800, 'square', 0.04, 0, 0.06);
}

export function playRoundStart() {
  [523, 659, 784].forEach((f, i) => tone(f, 'sine', 0.1, i * 0.12, 0.25));
}

export function playGameOver() {
  [784, 659, 523, 392].forEach((f, i) => tone(f, 'triangle', 0.1, i * 0.18, 0.35));
}
