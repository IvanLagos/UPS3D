/* Animaciones simples: interpola una propiedad numérica de un objeto con aceleración suave. */
const tweens = [];

export function tween(o, k, to, dur = 0.6, delay = 0) {
  for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].o === o && tweens[i].k === k) { tweens[i].res(); tweens.splice(i, 1); }
  return new Promise(res => tweens.push({ o, k, from: o[k], to, dur, t: -delay, res }));
}

export function stepTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const w = tweens[i]; w.t += dt;
    if (w.t < 0) continue;
    const p = Math.min(w.t / w.dur, 1);
    const e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    w.o[w.k] = w.from + (w.to - w.from) * e;
    if (p >= 1) { tweens.splice(i, 1); w.res(); }
  }
}
