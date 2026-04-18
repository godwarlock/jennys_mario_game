const test = require('node:test');
const assert = require('node:assert');
const FX = require('../fx.js');

test('makeParticle returns properly shaped object', () => {
  const p = FX.makeParticle(10, 20, 1, -2, 0.5, '#ff00ff', 3);
  assert.strictEqual(p.x, 10);
  assert.strictEqual(p.y, 20);
  assert.strictEqual(p.vx, 1);
  assert.strictEqual(p.vy, -2);
  assert.strictEqual(p.life, 0.5);
  assert.strictEqual(p.maxLife, 0.5);
  assert.strictEqual(p.color, '#ff00ff');
  assert.strictEqual(p.size, 3);
});

test('updateParticles applies velocity and gravity and expires', () => {
  const particles = [FX.makeParticle(0, 0, 2, -5, 0.3, '#fff', 2)];
  FX.updateParticles(particles, 0.1);
  assert(Math.abs(particles[0].x - 0.2) < 0.001);
  assert(particles[0].vy > -5, 'gravity should increase vy');
  assert(particles[0].life < 0.3, 'life should decrease');
});

test('updateParticles removes dead particles in place', () => {
  const particles = [
    FX.makeParticle(0, 0, 0, 0, 0.05, '#fff', 2),
    FX.makeParticle(0, 0, 0, 0, 1.0,  '#fff', 2),
  ];
  FX.updateParticles(particles, 0.1);
  assert.strictEqual(particles.length, 1);
});

test('spawnBurst pushes N particles with given color', () => {
  const particles = [];
  FX.spawnBurst(particles, 100, 50, 6, '#ff3d7f');
  assert.strictEqual(particles.length, 6);
  assert(particles.every((p) => p.color === '#ff3d7f'));
  assert(particles.every((p) => Math.abs(p.x - 100) < 20));
});

test('makeShake / tickShake decays to zero', () => {
  const s = FX.makeShake(6, 0.2);
  assert.strictEqual(s.amp, 6);
  assert(s.timeLeft > 0);
  FX.tickShake(s, 0.1);
  assert(s.timeLeft < 0.2);
  FX.tickShake(s, 0.3);
  assert.strictEqual(s.timeLeft, 0);
});

test('shakeOffset returns zero when shake expired', () => {
  const s = FX.makeShake(6, 0);
  const off = FX.shakeOffset(s);
  assert.strictEqual(off.x, 0);
  assert.strictEqual(off.y, 0);
});

test('makeFlash / tickFlash decays', () => {
  const f = FX.makeFlash('#ff0000', 0.3);
  assert.strictEqual(f.color, '#ff0000');
  assert.strictEqual(f.timeLeft, 0.3);
  FX.tickFlash(f, 0.1);
  assert(f.timeLeft < 0.3 && f.timeLeft > 0);
  FX.tickFlash(f, 1);
  assert.strictEqual(f.timeLeft, 0);
});
