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
    // implemented in Task 13
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
