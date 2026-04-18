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

  function renderWorld() {
    // implemented in Task 13
    ctx.fillStyle = '#87ceeb';
    ctx.fillRect(0, 0, W, H);
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - state.lastFrameMs) / 1000);
    state.lastFrameMs = now;

    if (state.mode === 'PLAYING') updatePlaying(dt);

    render();
    keyJustPressed = {};
    requestAnimationFrame(loop);
  }

  requestAnimationFrame((t) => { state.lastFrameMs = t; loop(t); });
})();
