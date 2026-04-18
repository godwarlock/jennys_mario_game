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

  const DASHER_DETECT_DIST = 200;
  const DASHER_CHARGE_DURATION = 1.2;
  const DASHER_COOLDOWN_DURATION = 1.0;

  function makeDasher(x, y, leftBound, rightBound) {
    return {
      type: 'dasher',
      x, y, w: 32, h: 34,
      vx: 1,
      baseSpeed: 1,
      leftBound, rightBound,
      alive: true,
      squashTimer: 0,
      state: 'PATROL',
      stateMs: 0,
    };
  }

  function updateDasher(d, dt, player) {
    if (!d.alive) { d.squashTimer--; return; }
    d.stateMs += dt;
    const dx = (player.x + 13) - (d.x + d.w / 2);
    const dist = Math.abs(dx);
    let speed;
    if (d.state === 'PATROL') {
      speed = d.baseSpeed;
      if (dist < DASHER_DETECT_DIST) {
        d.state = 'CHARGING';
        d.stateMs = 0;
        d.vx = Math.sign(dx) * d.baseSpeed * 3 || d.baseSpeed * 3;
      }
    } else if (d.state === 'CHARGING') {
      speed = d.baseSpeed * 3;
      if (d.stateMs >= DASHER_CHARGE_DURATION) {
        d.state = 'COOLDOWN';
        d.stateMs = 0;
        d.vx = Math.sign(d.vx) * d.baseSpeed;
      }
    } else {
      speed = d.baseSpeed * 0.5;
      if (d.stateMs >= DASHER_COOLDOWN_DURATION) {
        d.state = 'PATROL';
        d.stateMs = 0;
      }
    }
    const sign = d.vx >= 0 ? 1 : -1;
    d.x += sign * speed;
    if (d.x < d.leftBound)         { d.x = d.leftBound;        d.vx = Math.abs(d.vx); }
    if (d.x + d.w > d.rightBound)  { d.x = d.rightBound - d.w; d.vx = -Math.abs(d.vx); }
  }

  function makeShield(x, y)   { return { type: 'shield',   x, y, taken: false }; }
  function makeJumpBoot(x, y) { return { type: 'jumpboot', x, y, taken: false }; }

  function applyShield(p)     { p.shield = true; }
  function consumeShield(p)   { if (p.shield) { p.shield = false; return true; } return false; }

  function applyJumpBoot(p)   { p.jumpBootMs = 10000; }
  function tickJumpBoot(p, dt) { p.jumpBootMs = Math.max(0, p.jumpBootMs - dt * 1000); }

  const API = { makePlayer, makeSlime, updateSlime, makeHeart, makeBee, updateBee, makeDasher, updateDasher, makeShield, makeJumpBoot, applyShield, consumeShield, applyJumpBoot, tickJumpBoot };
  if (typeof module !== 'undefined') module.exports = API;
  else global.Entities = API;
})(typeof window !== 'undefined' ? window : globalThis);
