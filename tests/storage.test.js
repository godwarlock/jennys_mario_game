const test = require('node:test');
const assert = require('node:assert');
const Storage = require('../storage.js');

function makeFakeStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    removeItem: (k) => { delete data[k]; },
    _data: data,
  };
}

test('load returns default save when storage empty', () => {
  const s = Storage.load(makeFakeStorage());
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.unlocked, 1);
  assert.strictEqual(s.totalHearts, 0);
  assert.deepStrictEqual(s.bestTimes, [null, null, null]);
});

test('save/load round-trip preserves data', () => {
  const fake = makeFakeStorage();
  Storage.save(fake, { version: 1, unlocked: 2, totalHearts: 17, bestTimes: [12.5, null, null] });
  const s = Storage.load(fake);
  assert.strictEqual(s.unlocked, 2);
  assert.strictEqual(s.totalHearts, 17);
  assert.deepStrictEqual(s.bestTimes, [12.5, null, null]);
});

test('load ignores mismatched version', () => {
  const fake = makeFakeStorage();
  fake.setItem('jenny_save', JSON.stringify({ version: 99, unlocked: 3, totalHearts: 100, bestTimes: [1,2,3] }));
  const s = Storage.load(fake);
  assert.strictEqual(s.unlocked, 1);
  assert.strictEqual(s.totalHearts, 0);
});

test('load recovers from corrupt JSON', () => {
  const fake = makeFakeStorage();
  fake.setItem('jenny_save', '{not-json');
  const s = Storage.load(fake);
  assert.strictEqual(s.unlocked, 1);
});

test('save swallows errors and does not throw', () => {
  const broken = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceeded'); },
  };
  assert.doesNotThrow(() => Storage.save(broken, { version: 1, unlocked: 1, totalHearts: 0, bestTimes: [null,null,null] }));
});

test('load handles missing localStorage (returns default)', () => {
  const s = Storage.load(null);
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.unlocked, 1);
});
