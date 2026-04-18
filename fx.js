(function (global) {
  'use strict';

  const PARTICLE_GRAVITY = 12;

  function makeParticle(x, y, vx, vy, life, color, size) {
    return { x, y, vx, vy, life, maxLife: life, color, size };
  }

  function updateParticles(particles, dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += PARTICLE_GRAVITY * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function spawnBurst(particles, x, y, count, color, opts = {}) {
    const size = opts.size || 3;
    const speed = opts.speed || 3;
    const life = opts.life || 0.6;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
      const v = speed * (0.5 + Math.random() * 0.7);
      const vx = Math.cos(angle) * v;
      const vy = Math.sin(angle) * v - 1.5;
      particles.push(makeParticle(x + (Math.random() - 0.5) * 6, y + (Math.random() - 0.5) * 6, vx, vy, life, color, size));
    }
  }

  function drawParticles(ctx, particles, cameraX) {
    for (const p of particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cameraX - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function makeShake(amp, duration) {
    return { amp, duration, timeLeft: duration };
  }

  function tickShake(s, dt) {
    s.timeLeft = Math.max(0, s.timeLeft - dt);
  }

  function shakeOffset(s) {
    if (!s || s.timeLeft <= 0) return { x: 0, y: 0 };
    const k = s.timeLeft / s.duration;
    return {
      x: (Math.random() - 0.5) * s.amp * k * 2,
      y: (Math.random() - 0.5) * s.amp * k * 2,
    };
  }

  function makeFlash(color, duration) {
    return { color, duration, timeLeft: duration };
  }

  function tickFlash(f, dt) {
    f.timeLeft = Math.max(0, f.timeLeft - dt);
  }

  function drawFlash(ctx, f, W, H) {
    if (!f || f.timeLeft <= 0) return;
    const alpha = (f.timeLeft / f.duration) * 0.5;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = f.color;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  const API = { makeParticle, updateParticles, spawnBurst, drawParticles,
                makeShake, tickShake, shakeOffset,
                makeFlash, tickFlash, drawFlash };

  if (typeof module !== 'undefined') module.exports = API;
  else global.FX = API;
})(typeof window !== 'undefined' ? window : globalThis);
