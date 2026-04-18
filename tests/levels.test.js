const test = require('node:test');
const assert = require('node:assert');
const Levels = require('../levels.js');

test('LEVELS array has 3 entries', () => {
  assert.strictEqual(Levels.LEVELS.length, 3);
});

test('level 1 — meadow — has 5 slimes, 14 hearts, 1 shield, 0 bees, 0 dashers, 0 jumpboots', () => {
  const l = Levels.build(1);
  const enemiesByType = countByType(l.enemies);
  const pickupsByType = countByType(l.pickups);
  assert.strictEqual(l.name, '草原');
  assert.strictEqual(l.theme, 'meadow');
  assert.strictEqual(l.width, 3100);
  assert.strictEqual(l.hearts.length, 14);
  assert.strictEqual(enemiesByType.slime || 0, 5);
  assert.strictEqual(enemiesByType.bee || 0, 0);
  assert.strictEqual(enemiesByType.dasher || 0, 0);
  assert.strictEqual(pickupsByType.shield || 0, 1);
  assert.strictEqual(pickupsByType.jumpboot || 0, 0);
});

test('level 1 all entities within [0, width]', () => {
  const l = Levels.build(1);
  for (const e of l.enemies) {
    assert(e.x >= 0 && e.x + e.w <= l.width, `enemy ${e.type} out of bounds`);
  }
  for (const h of l.hearts) {
    assert(h.x >= 0 && h.x <= l.width);
  }
  for (const p of l.pickups) {
    assert(p.x >= 0 && p.x <= l.width);
  }
});

function countByType(arr) {
  const out = {};
  for (const item of arr) out[item.type] = (out[item.type] || 0) + 1;
  return out;
}
