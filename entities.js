(function (global) {
  'use strict';

  function makePlayer(x, y) {
    return {
      x, y, w: 26, h: 40,
      vx: 0, vy: 0,
      onGround: false,
      facing: 1,
      invuln: 0,
      walkAnim: 0,
      shield: false,
      jumpBootMs: 0,
    };
  }

  function makeSlime(x, y, leftBound, rightBound) {
    return {
      type: 'slime',
      x, y, w: 30, h: 30,
      vx: -1.2,
      leftBound, rightBound,
      alive: true,
      squashTimer: 0,
    };
  }

  function updateSlime(s) {
    if (!s.alive) { s.squashTimer--; return; }
    s.x += s.vx;
    if (s.x < s.leftBound)             { s.x = s.leftBound;           s.vx *= -1; }
    if (s.x + s.w > s.rightBound)      { s.x = s.rightBound - s.w;    s.vx *= -1; }
  }

  function makeHeart(x, y) {
    return { x, y, taken: false };
  }

  function makeBee(x, baseY, leftBound, rightBound) {
    return {
      type: 'bee',
      x, y: baseY, w: 28, h: 24,
      baseY,
      vx: 0.8,
      leftBound, rightBound,
      phase: Math.random() * Math.PI * 2,
      alive: true,
      squashTimer: 0,
    };
  }

  function updateBee(b, dt) {
    if (!b.alive) { b.squashTimer--; return; }
    b.x += b.vx;
    if (b.x < b.leftBound)        { b.x = b.leftBound;        b.vx *= -1; }
    if (b.x + b.w > b.rightBound) { b.x = b.rightBound - b.w; b.vx *= -1; }
    b.phase += dt * (Math.PI * 2 / 1.5);
    b.y = b.baseY + Math.sin(b.phase) * 20;
  }

  const API = { makePlayer, makeSlime, updateSlime, makeHeart, makeBee, updateBee };
  if (typeof module !== 'undefined') module.exports = API;
  else global.Entities = API;
})(typeof window !== 'undefined' ? window : globalThis);
