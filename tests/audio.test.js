const test = require('node:test');
const assert = require('node:assert');

function makeMockAudio() {
  const events = [];
  const mock = {
    createOscillator: () => ({
      type: '',
      frequency: { value: 0, linearRampToValueAtTime: (v, t) => events.push(['freqRamp', v, t]) },
      connect: () => {},
      start: (t) => events.push(['oscStart', t]),
      stop: (t) => events.push(['oscStop', t]),
    }),
    createGain: () => ({
      gain: {
        value: 0,
        setValueAtTime: (v, t) => events.push(['gainSet', v, t]),
        linearRampToValueAtTime: (v, t) => events.push(['gainRamp', v, t]),
      },
      connect: () => {},
    }),
    createBuffer: (ch, len, rate) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource: () => ({ buffer: null, connect: () => {}, start: () => events.push(['bufStart']) }),
    destination: {},
    currentTime: 0,
    state: 'running',
    resume: () => { events.push(['resume']); return Promise.resolve(); },
    sampleRate: 44100,
    _events: events,
  };
  return mock;
}

const Audio = require('../audio.js');

test('init creates an audio api object', () => {
  const ctx = makeMockAudio();
  const a = Audio.init(ctx);
  assert.strictEqual(typeof a.jump, 'function');
  assert.strictEqual(typeof a.heart, 'function');
  assert.strictEqual(typeof a.stomp, 'function');
  assert.strictEqual(typeof a.hurt, 'function');
  assert.strictEqual(typeof a.win, 'function');
  assert.strictEqual(typeof a.setEnabled, 'function');
  assert.strictEqual(typeof a.resume, 'function');
});

test('each sfx plays without throwing', () => {
  const ctx = makeMockAudio();
  const a = Audio.init(ctx);
  assert.doesNotThrow(() => a.jump());
  assert.doesNotThrow(() => a.heart());
  assert.doesNotThrow(() => a.stomp());
  assert.doesNotThrow(() => a.hurt());
  assert.doesNotThrow(() => a.win());
  assert(ctx._events.length > 0, 'events should be recorded');
});

test('setEnabled(false) silences sfx', () => {
  const ctx = makeMockAudio();
  const a = Audio.init(ctx);
  a.setEnabled(false);
  ctx._events.length = 0;
  a.jump();
  assert.strictEqual(ctx._events.length, 0);
});

test('init with null ctx returns no-op api', () => {
  const a = Audio.init(null);
  assert.doesNotThrow(() => a.jump());
  assert.doesNotThrow(() => a.win());
});
