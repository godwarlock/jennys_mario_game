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

test('makeBee initializes with base Y and phase', () => {
  const b = Entities.makeBee(100, 200, 50, 200);
  assert.strictEqual(b.type, 'bee');
  assert.strictEqual(b.baseY, 200);
  assert.strictEqual(b.leftBound, 50);
  assert.strictEqual(b.rightBound, 200);
  assert.strictEqual(b.alive, true);
});

test('updateBee oscillates Y around baseY', () => {
  const b = Entities.makeBee(100, 200, 50, 200);
  const y0 = b.y;
  Entities.updateBee(b, 0.25);
  assert.notStrictEqual(b.y, y0);
  assert(Math.abs(b.y - b.baseY) <= 20.01, 'Y should stay within amplitude ±20');
});

test('updateBee bounces at horizontal boundaries', () => {
  const b = Entities.makeBee(49, 200, 50, 200);
  b.vx = -0.8;
  Entities.updateBee(b, 0.016);
  assert(b.vx > 0);
});

test('makeDasher starts in PATROL state', () => {
  const d = Entities.makeDasher(100, 200, 50, 400);
  assert.strictEqual(d.type, 'dasher');
  assert.strictEqual(d.state, 'PATROL');
  assert.strictEqual(d.baseSpeed, 1);
});

test('updateDasher transitions PATROL → CHARGING when player nearby', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  Entities.updateDasher(d, 0.016, { x: 250, y: 200 });
  assert.strictEqual(d.state, 'CHARGING');
});

test('updateDasher stays PATROL when player far', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  Entities.updateDasher(d, 0.016, { x: 600, y: 200 });
  assert.strictEqual(d.state, 'PATROL');
});

test('updateDasher CHARGING → COOLDOWN after 1.2s', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  d.state = 'CHARGING';
  d.stateMs = 0;
  Entities.updateDasher(d, 1.3, { x: 250, y: 200 });
  assert.strictEqual(d.state, 'COOLDOWN');
});

test('updateDasher COOLDOWN → PATROL after 1s', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  d.state = 'COOLDOWN';
  d.stateMs = 0;
  Entities.updateDasher(d, 1.1, { x: 999, y: 200 });
  assert.strictEqual(d.state, 'PATROL');
});

test('updateDasher CHARGING moves at 3x baseSpeed', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  d.state = 'CHARGING';
  d.vx = 1;
  d.stateMs = 0;
  const x0 = d.x;
  Entities.updateDasher(d, 0.016, { x: 300, y: 200 });
  assert(d.x - x0 >= 2.9 && d.x - x0 <= 3.1, `expected ~3 px movement, got ${d.x - x0}`);
});

test('makeShield creates untaken pickup', () => {
  const s = Entities.makeShield(100, 200);
  assert.strictEqual(s.type, 'shield');
  assert.strictEqual(s.taken, false);
});

test('applyShield sets player.shield true', () => {
  const p = Entities.makePlayer(0, 0);
  Entities.applyShield(p);
  assert.strictEqual(p.shield, true);
});

test('consumeShield returns true when shield active and clears it', () => {
  const p = Entities.makePlayer(0, 0);
  p.shield = true;
  const consumed = Entities.consumeShield(p);
  assert.strictEqual(consumed, true);
  assert.strictEqual(p.shield, false);
});

test('consumeShield returns false when no shield', () => {
  const p = Entities.makePlayer(0, 0);
  assert.strictEqual(Entities.consumeShield(p), false);
});

test('makeJumpBoot creates untaken pickup', () => {
  const j = Entities.makeJumpBoot(100, 200);
  assert.strictEqual(j.type, 'jumpboot');
  assert.strictEqual(j.taken, false);
});

test('applyJumpBoot sets 10 seconds remaining', () => {
  const p = Entities.makePlayer(0, 0);
  Entities.applyJumpBoot(p);
  assert.strictEqual(p.jumpBootMs, 10000);
});

test('tickJumpBoot decreases jumpBootMs and clamps at 0', () => {
  const p = Entities.makePlayer(0, 0);
  p.jumpBootMs = 500;
  Entities.tickJumpBoot(p, 0.3);
  assert.strictEqual(p.jumpBootMs, 200);
  Entities.tickJumpBoot(p, 10);
  assert.strictEqual(p.jumpBootMs, 0);
});
