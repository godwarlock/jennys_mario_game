const test = require('node:test');
const assert = require('node:assert');
const Entities = require('../entities.js');

test('makeSlime returns slime with bounds', () => {
  const s = Entities.makeSlime(100, 200, 80, 160);
  assert.strictEqual(s.type, 'slime');
  assert.strictEqual(s.x, 100);
  assert.strictEqual(s.y, 200);
  assert.strictEqual(s.leftBound, 80);
  assert.strictEqual(s.rightBound, 160);
  assert.strictEqual(s.alive, true);
});

test('updateSlime bounces at boundaries', () => {
  const s = Entities.makeSlime(79, 0, 80, 160);
  s.vx = -1.2;
  Entities.updateSlime(s);
  assert(s.vx > 0, 'should reverse direction');
  assert.strictEqual(s.x, 80);
});

test('makePlayer returns default player', () => {
  const p = Entities.makePlayer(60, 100);
  assert.strictEqual(p.x, 60);
  assert.strictEqual(p.y, 100);
  assert.strictEqual(p.w, 26);
  assert.strictEqual(p.h, 40);
  assert.strictEqual(p.shield, false);
  assert.strictEqual(p.jumpBootMs, 0);
  assert.strictEqual(p.facing, 1);
});

test('makeHeart is not taken', () => {
  const h = Entities.makeHeart(50, 60);
  assert.strictEqual(h.x, 50);
  assert.strictEqual(h.taken, false);
});
