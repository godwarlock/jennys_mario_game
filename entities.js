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

  const API = { makePlayer, makeSlime, updateSlime, makeHeart };
  if (typeof module !== 'undefined') module.exports = API;
  else global.Entities = API;
})(typeof window !== 'undefined' ? window : globalThis);
