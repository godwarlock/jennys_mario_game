(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const GRAVITY = 0.7;
  const MOVE_ACC = 0.8;
  const FRICTION = 0.82;
  const MAX_SPEED = 5.2;
  const JUMP_V = -13.5;
  const JUMP_V_BOOSTED = -20;

  const audioCtx = (window.AudioContext || window.webkitAudioContext)
    ? new (window.AudioContext || window.webkitAudioContext)() : null;
  const audio = Audio.init(audioCtx);
  audio._enabled = true;

  let storage = null;
  try { storage = window.localStorage; } catch (_) {}

  const state = {
    mode: 'MENU',
    save: Storage.load(storage),
    currentLevel: 1,
    level: null,
    player: null,
    hearts: 0,
    lives: 3,
    cameraX: 0,
    startTime: 0,
    elapsedSec: 0,
    lastFrameMs: performance.now(),
    particles: [],
    shake: { amp: 0, duration: 0, timeLeft: 0 },
    flash: { color: '#f00', duration: 0, timeLeft: 0 },
    highlightIndex: 0,
    saveThrottleMs: 0,
    justWon: false,
    winTime: 0,
    newBest: false,
  };

  const keys = {};
  let keyJustPressed = {};

  function onFirstInput() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  window.addEventListener('keydown', (e) => {
    onFirstInput();
    const k = e.key.toLowerCase();
    if (!keys[k]) keyJustPressed[k] = true;
    keys[k] = true;
    if ([' ', 'arrowup', 'arrowleft', 'arrowright', 'arrowdown'].includes(k)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  canvas.addEventListener('click', (e) => {
    onFirstInput();
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top)  * (H / rect.height);
    handleClick(mx, my);
  });

  function handleClick(mx, my) {
    if (state.mode === 'MENU') {
      const b = UI.menuButtonHitTest(mx, my);
      if (b === 0) startLevel(1);
      else if (b === 1 && state.save.unlocked > 1) state.mode = 'SELECT';
    } else if (state.mode === 'SELECT') {
      const b = UI.selectButtonHitTest(mx, my, state.save);
      if (b >= 0 && b < 3) startLevel(b + 1);
      else if (b === 3) state.mode = 'MENU';
    } else if (state.mode === 'WIN') {
      const buttons = state.currentLevel < 3
        ? ['下一关', '选关', '主菜单']
        : ['再玩第 3 关', '选关', '主菜单'];
      const idx = UI.overlayButtonHitTest(mx, my, buttons);
      if (idx === 0) startLevel(state.currentLevel < 3 ? state.currentLevel + 1 : 3);
      else if (idx === 1) state.mode = 'SELECT';
      else if (idx === 2) state.mode = 'MENU';
    } else if (state.mode === 'LOSE') {
      const idx = UI.overlayButtonHitTest(mx, my, ['再玩一次', '主菜单']);
      if (idx === 0) startLevel(state.currentLevel);
      else if (idx === 1) state.mode = 'MENU';
    }
  }

  function startLevel(n) {
    state.currentLevel = n;
    state.level = Levels.build(n);
    state.player = Entities.makePlayer(60, state.level.groundY - 40);
    state.hearts = 0;
    state.lives = 3;
    state.cameraX = 0;
    state.particles = [];
    state.shake.timeLeft = 0;
    state.flash.timeLeft = 0;
    state.startTime = performance.now();
    state.elapsedSec = 0;
    state.mode = 'PLAYING';
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function updatePlaying(dt) {
    const lvl = state.level;
    const p = state.player;
    state.elapsedSec = (performance.now() - state.startTime) / 1000;

    const left  = keys['arrowleft']  || keys['a'];
    const right = keys['arrowright'] || keys['d'];
    const jump  = keys['arrowup']    || keys['w'] || keys[' '];
    if (keyJustPressed['escape'] || keyJustPressed['p']) { state.mode = 'PAUSED'; return; }
    if (keyJustPressed['m']) { audio._enabled = !audio._enabled; audio.setEnabled(audio._enabled); }
    if (keyJustPressed['r']) { startLevel(state.currentLevel); return; }

    if (left)  { p.vx -= MOVE_ACC; p.facing = -1; }
    if (right) { p.vx += MOVE_ACC; p.facing = 1; }
    if (!left && !right) p.vx *= FRICTION;
    p.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, p.vx));
    if (Math.abs(p.vx) < 0.05) p.vx = 0;

    if (jump && p.onGround) {
      p.vy = p.jumpBootMs > 0 ? JUMP_V_BOOSTED : JUMP_V;
      p.onGround = false;
      audio.jump();
      FX.spawnBurst(state.particles, p.x + p.w/2, p.y + p.h, 3, '#eee', { size: 2, speed: 15, life: 0.3 });
    }

    p.vy += GRAVITY;
    if (p.vy > 18) p.vy = 18;

    p.x += p.vx;
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > lvl.width) p.x = lvl.width - p.w;
    for (const plat of lvl.platforms) {
      if (rectsOverlap(p, plat)) {
        if (p.vx > 0) p.x = plat.x - p.w;
        else if (p.vx < 0) p.x = plat.x + plat.w;
        p.vx = 0;
      }
    }

    p.y += p.vy;
    const wasOnGround = p.onGround;
    p.onGround = false;
    for (const plat of lvl.platforms) {
      if (rectsOverlap(p, plat)) {
        if (p.vy > 0) { p.y = plat.y - p.h; p.vy = 0; p.onGround = true; }
        else if (p.vy < 0) { p.y = plat.y + plat.h; p.vy = 0; }
      }
    }
    if (!wasOnGround && p.onGround) {
      FX.spawnBurst(state.particles, p.x + p.w/2, p.y + p.h, 3, '#eee', { size: 2, speed: 15, life: 0.3 });
    }

    if (Math.abs(p.vx) > 0.5 && p.onGround) p.walkAnim += Math.abs(p.vx) * 0.15;

    Entities.tickJumpBoot(p, dt);

    if (p.y > H + 100) { loseLife('Jenny 掉下去啦…'); return; }

    for (const e of lvl.enemies) {
      if (!e.alive) { if (e.squashTimer > 0) e.squashTimer--; continue; }
      if (e.type === 'slime') Entities.updateSlime(e);
      else if (e.type === 'bee') Entities.updateBee(e, dt);
      else if (e.type === 'dasher') Entities.updateDasher(e, dt, p);
    }

    for (const e of lvl.enemies) {
      if (!e.alive) continue;
      if (rectsOverlap(p, e)) {
        const playerBottom = p.y + p.h;
        const stompable = p.vy > 0 && playerBottom - e.y < 18;
        if (stompable) {
          e.alive = false; e.squashTimer = 30;
          p.vy = JUMP_V * 0.6;
          state.hearts += 2;
          audio.stomp();
          const color = e.type === 'bee' ? '#ffd166' : (e.type === 'dasher' ? '#a05cff' : '#8ee36e');
          FX.spawnBurst(state.particles, e.x + e.w/2, e.y + e.h/2, 8, color, { size: 3, speed: 30, life: 0.6 });
        } else if (p.invuln <= 0) {
          if (Entities.consumeShield(p)) {
            p.invuln = 60;
            audio.hurt();
            state.shake = FX.makeShake(4, 0.15);
          } else {
            loseLife(e.type === 'bee' ? '被蜜蜂撞到啦！' : e.type === 'dasher' ? '被魔王撞到啦！' : '被史莱姆撞到啦！');
            return;
          }
        }
      }
    }

    for (const h of lvl.hearts) {
      if (h.taken) continue;
      const hb = { x: h.x - 10, y: h.y - 10, w: 20, h: 20 };
      if (rectsOverlap(p, hb)) {
        h.taken = true;
        state.hearts += 1;
        state.save.totalHearts += 1;
        audio.heart();
        FX.spawnBurst(state.particles, h.x, h.y, 6, '#ff3d7f', { size: 3, speed: 30, life: 0.6 });
        throttledSave();
      }
    }

    for (const item of lvl.pickups) {
      if (item.taken) continue;
      const ib = { x: item.x - 14, y: item.y - 14, w: 28, h: 28 };
      if (rectsOverlap(p, ib)) {
        item.taken = true;
        if (item.type === 'shield') { Entities.applyShield(p); audio.heart(); }
        else if (item.type === 'jumpboot') { Entities.applyJumpBoot(p); audio.heart(); }
        FX.spawnBurst(state.particles, item.x, item.y, 8, '#fff', { size: 3, speed: 30, life: 0.5 });
      }
    }

    const fb = { x: lvl.flag.x, y: lvl.flag.y, w: 16, h: 160 };
    if (rectsOverlap(p, fb)) { winLevel(); return; }

    if (p.invuln > 0) p.invuln--;

    state.cameraX = p.x - W / 2 + p.w / 2;
    state.cameraX = Math.max(0, Math.min(lvl.width - W, state.cameraX));

    FX.updateParticles(state.particles, dt);
    FX.tickShake(state.shake, dt);
    FX.tickFlash(state.flash, dt);
  }

  function throttledSave() {
    if (state.saveThrottleMs > 0) return;
    state.saveThrottleMs = 1000;
    Storage.save(storage, state.save);
    setTimeout(() => { state.saveThrottleMs = 0; }, 1000);
  }

  function loseLife(reason) {
    state.lives--;
    audio.hurt();
    state.shake = FX.makeShake(6, 0.2);
    state.flash = FX.makeFlash('#ff0000', 0.3);
    if (state.lives <= 0) {
      state.mode = 'LOSE';
      state.highlightIndex = 0;
    } else {
      const p = state.player;
      p.x = 60;
      p.y = state.level.groundY - p.h;
      p.vx = 0; p.vy = 0;
      p.invuln = 90;
      p.shield = false;
      p.jumpBootMs = 0;
      state.cameraX = 0;
    }
  }

  function winLevel() {
    const t = (performance.now() - state.startTime) / 1000;
    state.winTime = t;
    state.justWon = true;
    const idx = state.currentLevel - 1;
    const prev = state.save.bestTimes[idx];
    state.newBest = prev == null || t < prev;
    if (state.newBest) state.save.bestTimes[idx] = t;
    if (state.save.unlocked <= state.currentLevel) {
      state.save.unlocked = Math.min(3, state.currentLevel + 1);
    }
    Storage.save(storage, state.save);
    audio.win();
    state.flash = FX.makeFlash('#ffd166', 0.6);
    state.mode = 'WIN';
    state.highlightIndex = 0;
  }

  function render() {
    if (state.mode === 'MENU') UI.drawMenu(ctx, state.save, state.highlightIndex);
    else if (state.mode === 'SELECT') UI.drawSelect(ctx, state.save, state.highlightIndex);
    else if (state.mode === 'PLAYING' || state.mode === 'PAUSED') {
      renderWorld();
      UI.drawHUD(ctx, state.level, state.hearts, state.lives, state.elapsedSec, state.player, state.currentLevel, audioCtx && audio._enabled !== false);
      if (state.mode === 'PAUSED') UI.drawPaused(ctx);
    } else if (state.mode === 'WIN') {
      renderWorld();
      const mm = String(Math.floor(state.winTime / 60)).padStart(2, '0');
      const ss = (state.winTime % 60).toFixed(1).padStart(4, '0');
      const best = state.save.bestTimes[state.currentLevel - 1];
      const lines = [
        `本次时间: ${mm}:${ss}${state.newBest ? ' ★' : ''}`,
        best != null ? `最佳时间: ${best.toFixed(1)}s` : '最佳时间: —',
      ];
      const title = state.currentLevel === 3 ? '🎉 全部胜利！🎉' : `🎉 第 ${state.currentLevel} 关通关！🎉`;
      const buttons = state.currentLevel < 3
        ? ['下一关', '选关', '主菜单']
        : ['再玩第 3 关', '选关', '主菜单'];
      UI.drawOverlay(ctx, title, lines, buttons, state.highlightIndex);
    } else if (state.mode === 'LOSE') {
      renderWorld();
      UI.drawOverlay(ctx, '💔 游戏结束',
        [`最终爱心数：${state.hearts}`, '按 Enter 或点击再玩一次'],
        ['再玩一次', '主菜单'], state.highlightIndex);
    }
  }

  function cloudPuff(x, y, s) {
    ctx.beginPath();
    ctx.arc(x,        y,        18 * s, 0, Math.PI * 2);
    ctx.arc(x + 18*s, y - 6*s,  20 * s, 0, Math.PI * 2);
    ctx.arc(x + 36*s, y,        16 * s, 0, Math.PI * 2);
    ctx.arc(x + 18*s, y + 6*s,  16 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHeart(cx, cy, size, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, size * 0.4);
    ctx.bezierCurveTo(size, -size * 0.3, size * 0.6, -size * 1.1, 0, -size * 0.3);
    ctx.bezierCurveTo(-size * 0.6, -size * 1.1, -size, -size * 0.3, 0, size * 0.4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(-size * 0.3, -size * 0.4, size * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFlowers() {
    for (const f of state.level.flowers) {
      const x = f.x - state.cameraX;
      if (x < -10 || x > W + 10) continue;
      ctx.fillStyle = f.c;
      ctx.beginPath();
      ctx.arc(x,     f.y - 2, 3, 0, Math.PI * 2);
      ctx.arc(x - 3, f.y,     3, 0, Math.PI * 2);
      ctx.arc(x + 3, f.y,     3, 0, Math.PI * 2);
      ctx.arc(x,     f.y + 2, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(x, f.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPlatforms() {
    for (const p of state.level.platforms) {
      const x = p.x - state.cameraX;
      if (x + p.w < 0 || x > W) continue;
      if (p.brick) {
        ctx.fillStyle = '#ff8fc1';
        ctx.fillRect(x, p.y, p.w, p.h);
        ctx.strokeStyle = '#c43d7a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, p.y + 1, p.w - 2, p.h - 2);
        ctx.beginPath();
        ctx.moveTo(x, p.y + p.h / 2);
        ctx.lineTo(x + p.w, p.y + p.h / 2);
        ctx.stroke();
        for (let i = 0; i < p.w; i += 32) {
          ctx.beginPath();
          ctx.moveTo(x + i + 16, p.y);
          ctx.lineTo(x + i + 16, p.y + p.h / 2);
          ctx.moveTo(x + i, p.y + p.h / 2);
          ctx.lineTo(x + i, p.y + p.h);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#7ec850';
        ctx.fillRect(x, p.y, p.w, 10);
        ctx.fillStyle = '#c08c5a';
        ctx.fillRect(x, p.y + 10, p.w, p.h - 10);
        ctx.fillStyle = '#a07040';
        for (let i = 0; i < p.w; i += 32) {
          ctx.fillRect(x + i + 6, p.y + 18, 4, 4);
          ctx.fillRect(x + i + 18, p.y + 30, 4, 4);
        }
      }
    }
  }

  function drawHearts() {
    for (const h of state.level.hearts) {
      if (h.taken) continue;
      const x = h.x - state.cameraX;
      if (x < -20 || x > W + 20) continue;
      const wob = Math.sin(performance.now() / 300 + h.x) * 2;
      drawHeart(x, h.y + wob, 9, '#ff3d7f');
    }
  }

  function drawPickups() {
    for (const item of state.level.pickups) {
      if (item.taken) continue;
      const x = item.x - state.cameraX;
      if (x < -30 || x > W + 30) continue;
      const wob = Math.sin(performance.now() / 300 + item.x) * 2;
      if (item.type === 'shield') {
        ctx.strokeStyle = 'rgba(255, 100, 180, 0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, item.y + wob, 14, 0, Math.PI * 2); ctx.stroke();
        drawHeart(x, item.y + wob, 10, '#ff3d7f');
      } else if (item.type === 'jumpboot') {
        ctx.fillStyle = '#ffd166';
        ctx.fillRect(x - 10, item.y + wob - 6, 20, 10);
        ctx.fillRect(x + 4,  item.y + wob - 12, 10, 8);
        ctx.fillStyle = '#c49a20';
        ctx.fillRect(x - 10, item.y + wob + 3, 20, 2);
      }
    }
  }

  function drawEnemies() {
    for (const e of state.level.enemies) {
      const x = e.x - state.cameraX;
      if (x < -50 || x > W + 50) continue;
      if (!e.alive) {
        if (e.squashTimer > 0) {
          ctx.fillStyle = '#7a3d99';
          ctx.fillRect(x - 2, e.y + e.h - 8, e.w + 4, 8);
        }
        continue;
      }
      if (e.type === 'bee') {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.ellipse(x + e.w/2, e.y + e.h/2, e.w/2, e.h/2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(x + 6,  e.y + 8, 4, e.h - 12);
        ctx.fillRect(x + 16, e.y + 8, 4, e.h - 12);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(x + 4,    e.y - 2, 7, 4, 0, 0, Math.PI * 2);
        ctx.ellipse(x + e.w - 4, e.y - 2, 7, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#222';
        ctx.fillRect(x + e.w/2 - 4, e.y + 6, 2, 2);
        ctx.fillRect(x + e.w/2 + 2, e.y + 6, 2, 2);
        continue;
      }
      if (e.type === 'dasher') {
        const charging = e.state === 'CHARGING';
        ctx.fillStyle = charging ? '#8b2a99' : '#a05cc8';
        ctx.fillRect(x, e.y, e.w, e.h);
        ctx.fillStyle = '#4a1c66';
        ctx.beginPath();
        ctx.moveTo(x + 4, e.y);     ctx.lineTo(x + 8,  e.y - 8); ctx.lineTo(x + 12, e.y); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 20, e.y);    ctx.lineTo(x + 24, e.y - 8); ctx.lineTo(x + 28, e.y); ctx.fill();
        ctx.fillStyle = charging ? '#ff2030' : '#fff';
        ctx.fillRect(x + 8,  e.y + 12, 4, 4);
        ctx.fillRect(x + 20, e.y + 12, 4, 4);
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + 10, e.y + 24, 3, 5);
        ctx.fillRect(x + 19, e.y + 24, 3, 5);
        continue;
      }
      // Slime (default)
      ctx.fillStyle = '#a05cc8';
      ctx.beginPath();
      ctx.ellipse(x + e.w/2, e.y + e.h/2 + 2, e.w/2, e.h/2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(x + e.w/2 - 5, e.y + e.h/2 - 4, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + 9,  e.y + 14, 4, 0, Math.PI * 2);
      ctx.arc(x + 21, e.y + 14, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      const pupOffset = e.vx > 0 ? 1 : -1;
      ctx.beginPath();
      ctx.arc(x + 9 + pupOffset,  e.y + 14, 2, 0, Math.PI * 2);
      ctx.arc(x + 21 + pupOffset, e.y + 14, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a1c66';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x + e.w/2, e.y + 22, 4, 0, Math.PI);
      ctx.stroke();
    }
  }

  function drawFlag() {
    const f = state.level.flag;
    const x = f.x - state.cameraX;
    if (state.level.theme === 'castle') {
      ctx.fillStyle = '#3b2a55';
      ctx.fillRect(x - 20, f.y - 20, 60, 180);
      ctx.fillStyle = '#6a4b8c';
      ctx.beginPath();
      ctx.moveTo(x - 20, f.y - 20); ctx.lineTo(x + 10, f.y - 60); ctx.lineTo(x + 40, f.y - 20);
      ctx.closePath(); ctx.fill();
      drawHeart(x + 10, f.y + 70, 12, '#ff3d7f');
      return;
    }
    ctx.fillStyle = '#dcdcdc';
    ctx.fillRect(x, f.y, 4, 160);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(x + 2, f.y - 2, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath();
    ctx.moveTo(x + 4, f.y + 6); ctx.lineTo(x + 60, f.y + 18); ctx.lineTo(x + 4, f.y + 30);
    ctx.closePath(); ctx.fill();
    drawHeart(x + 28, f.y + 18, 6, '#fff');
  }

  function drawPlayer() {
    const player = state.player;
    const px = player.x - state.cameraX;
    const py = player.y;
    if (player.invuln > 0 && Math.floor(player.invuln / 5) % 2 === 0) return;

    const bob = player.onGround ? Math.sin(player.walkAnim) * 1.5 : 0;
    const facing = player.facing;

    ctx.save();
    ctx.translate(px + player.w / 2, py);
    ctx.scale(facing, 1);
    ctx.translate(-player.w / 2, 0);

    // Legs
    ctx.fillStyle = '#ffd9b3';
    const legSwing = player.onGround ? Math.sin(player.walkAnim) * 3 : 2;
    ctx.fillRect(6,  32, 5, 8 - Math.abs(legSwing));
    ctx.fillRect(15, 32, 5, 8 - Math.abs(legSwing) * 0.5);
    // Shoes
    ctx.fillStyle = '#8b3a62';
    ctx.fillRect(5,  38 - Math.abs(legSwing), 7, 3);
    ctx.fillRect(14, 38 - Math.abs(legSwing) * 0.5, 7, 3);

    // Pink dress (skirt)
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath();
    ctx.moveTo(2, 34);
    ctx.lineTo(24, 34);
    ctx.lineTo(20, 22);
    ctx.lineTo(6, 22);
    ctx.closePath();
    ctx.fill();
    // Dress highlight
    ctx.fillStyle = '#ff8fc1';
    ctx.fillRect(8, 26, 10, 2);

    // Body / torso
    ctx.fillStyle = '#fff';
    ctx.fillRect(7, 18 + bob, 12, 8);
    // Heart on chest
    drawHeart(13, 22 + bob, 2.6, '#ff3d7f');

    // Arms
    ctx.fillStyle = '#ffd9b3';
    const armSwing = player.onGround ? Math.sin(player.walkAnim + Math.PI) * 2 : -2;
    ctx.fillRect(2,  18 + bob + armSwing, 5, 8);
    ctx.fillRect(19, 18 + bob - armSwing, 5, 8);

    // Head
    ctx.fillStyle = '#ffd9b3';
    ctx.beginPath();
    ctx.arc(13, 12 + bob, 8, 0, Math.PI * 2);
    ctx.fill();

    // Hair (brown, pigtails)
    ctx.fillStyle = '#7a4a2a';
    ctx.beginPath();
    ctx.arc(13, 8 + bob, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(5, 8 + bob, 16, 4);
    ctx.beginPath();
    ctx.arc(3,  14 + bob, 4, 0, Math.PI * 2);
    ctx.arc(23, 14 + bob, 4, 0, Math.PI * 2);
    ctx.fill();
    // Pink bow
    ctx.fillStyle = '#ff3d7f';
    ctx.fillRect(9, 4 + bob, 8, 4);
    ctx.beginPath();
    ctx.moveTo(9, 6 + bob);
    ctx.lineTo(5, 4 + bob);
    ctx.lineTo(5, 8 + bob);
    ctx.closePath();
    ctx.moveTo(17, 6 + bob);
    ctx.lineTo(21, 4 + bob);
    ctx.lineTo(21, 8 + bob);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#222';
    ctx.fillRect(10, 12 + bob, 2, 2);
    ctx.fillRect(15, 12 + bob, 2, 2);
    // Cheeks
    ctx.fillStyle = 'rgba(255, 100, 150, 0.5)';
    ctx.beginPath();
    ctx.arc(9,  15 + bob, 1.5, 0, Math.PI * 2);
    ctx.arc(17, 15 + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Smile
    ctx.strokeStyle = '#a64080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(13, 15 + bob, 2, 0.1, Math.PI - 0.1);
    ctx.stroke();

    if (state.player.shield) {
      ctx.strokeStyle = 'rgba(255, 100, 180, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(13, 8 + bob, 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function renderWorld() {
    const lvl = state.level;
    const off = FX.shakeOffset(state.shake);

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (lvl.theme === 'forest') {
      grad.addColorStop(0, '#7fb07a'); grad.addColorStop(0.6, '#b8d8a0'); grad.addColorStop(1, '#ffe4f0');
    } else if (lvl.theme === 'castle') {
      grad.addColorStop(0, '#3b2a55'); grad.addColorStop(0.6, '#6a4b8c'); grad.addColorStop(1, '#d9b3e0');
    } else {
      grad.addColorStop(0, '#a3d8ff'); grad.addColorStop(0.6, '#cdebff'); grad.addColorStop(1, '#ffe4f0');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(off.x, off.y);

    if (lvl.theme === 'castle') {
      ctx.fillStyle = '#fff7cc';
      ctx.beginPath(); ctx.arc(660, 80, 34, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3b2a55';
      ctx.beginPath(); ctx.arc(672, 72, 30, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const c of lvl.clouds) {
        const sx = c.x - state.cameraX * 0.4;
        const x = ((sx % (lvl.width + 200)) + lvl.width + 200) % (lvl.width + 200);
        cloudPuff(x, c.y, c.s);
      }
    }

    if (lvl.theme !== 'castle') {
      const hue1 = lvl.theme === 'forest' ? '#5a9e6a' : '#bde7a3';
      const hue2 = lvl.theme === 'forest' ? '#3d7a4d' : '#9ed68a';
      ctx.fillStyle = hue1;
      for (let i = 0; i < 10; i++) {
        const cx = i * 480 - (state.cameraX * 0.5) % 480;
        ctx.beginPath(); ctx.arc(cx, lvl.groundY + 20, 180, Math.PI, 0); ctx.fill();
      }
      ctx.fillStyle = hue2;
      for (let i = 0; i < 10; i++) {
        const cx = i * 360 - (state.cameraX * 0.7) % 360 + 120;
        ctx.beginPath(); ctx.arc(cx, lvl.groundY + 30, 140, Math.PI, 0); ctx.fill();
      }
    }

    drawFlowers();
    drawPlatforms();
    drawHearts();
    drawPickups();
    drawEnemies();
    drawFlag();
    drawPlayer();
    FX.drawParticles(ctx, state.particles, state.cameraX);

    ctx.restore();
    FX.drawFlash(ctx, state.flash, W, H);
  }

  function handleMenuKeys() {
    if (state.mode === 'MENU') {
      if (keyJustPressed['arrowdown'] || keyJustPressed['s']) state.highlightIndex = Math.min(1, state.highlightIndex + 1);
      if (keyJustPressed['arrowup']   || keyJustPressed['w']) state.highlightIndex = Math.max(0, state.highlightIndex - 1);
      if (keyJustPressed['enter'] || keyJustPressed[' ']) {
        if (state.highlightIndex === 0) startLevel(1);
        else if (state.highlightIndex === 1 && state.save.unlocked > 1) {
          state.mode = 'SELECT'; state.highlightIndex = 0;
        }
      }
    } else if (state.mode === 'SELECT') {
      if (keyJustPressed['arrowright'] || keyJustPressed['d']) state.highlightIndex = Math.min(3, state.highlightIndex + 1);
      if (keyJustPressed['arrowleft']  || keyJustPressed['a']) state.highlightIndex = Math.max(0, state.highlightIndex - 1);
      if (keyJustPressed['escape']) { state.mode = 'MENU'; state.highlightIndex = 0; }
      if (keyJustPressed['enter'] || keyJustPressed[' ']) {
        if (state.highlightIndex < 3) {
          if (state.save.unlocked >= state.highlightIndex + 1) startLevel(state.highlightIndex + 1);
        } else {
          state.mode = 'MENU'; state.highlightIndex = 0;
        }
      }
    } else if (state.mode === 'PAUSED') {
      if (keyJustPressed['escape'] || keyJustPressed['p']) { state.mode = 'PLAYING'; state.lastFrameMs = performance.now(); }
    } else if (state.mode === 'WIN' || state.mode === 'LOSE') {
      const n = (state.mode === 'WIN') ? 3 : 2;
      if (keyJustPressed['arrowright'] || keyJustPressed['d']) state.highlightIndex = Math.min(n-1, state.highlightIndex + 1);
      if (keyJustPressed['arrowleft']  || keyJustPressed['a']) state.highlightIndex = Math.max(0, state.highlightIndex - 1);
      if (keyJustPressed['enter'] || keyJustPressed[' '] || keyJustPressed['r']) {
        if (state.mode === 'WIN') {
          if (state.highlightIndex === 0) startLevel(state.currentLevel < 3 ? state.currentLevel + 1 : 3);
          else if (state.highlightIndex === 1) { state.mode = 'SELECT'; state.highlightIndex = 0; }
          else state.mode = 'MENU';
        } else {
          if (state.highlightIndex === 0) startLevel(state.currentLevel);
          else state.mode = 'MENU';
        }
      }
    }
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - state.lastFrameMs) / 1000);
    state.lastFrameMs = now;
    handleMenuKeys();
    if (state.mode === 'PLAYING') updatePlaying(dt);
    render();
    keyJustPressed = {};
    requestAnimationFrame(loop);
  }

  requestAnimationFrame((t) => { state.lastFrameMs = t; loop(t); });
})();
