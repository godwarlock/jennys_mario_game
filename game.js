(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const hudScore = document.getElementById('hud-score');
  const hudLives = document.getElementById('hud-lives');
  const hudLevel = document.getElementById('hud-level');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const overlayBtn = document.getElementById('overlay-btn');

  const GRAVITY = 0.7;
  const MOVE_ACC = 0.8;
  const FRICTION = 0.82;
  const MAX_SPEED = 5.2;
  const JUMP_V = -13.5;
  const TILE = 32;

  const keys = {};
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if ([' ', 'arrowup', 'arrowleft', 'arrowright', 'arrowdown'].includes(e.key.toLowerCase()))
      e.preventDefault();
    if (e.key.toLowerCase() === 'r') resetGame();
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // Level definition. Each level has: width, platforms, hearts, enemies, flag, clouds
  function buildLevel1() {
    const groundY = H - TILE * 2;
    const platforms = [];
    // Ground (with one gap)
    platforms.push({ x: 0,    y: groundY, w: 800,  h: TILE * 2 });
    platforms.push({ x: 900,  y: groundY, w: 700,  h: TILE * 2 });
    platforms.push({ x: 1700, y: groundY, w: 1400, h: TILE * 2 });
    // Floating bricks
    platforms.push({ x: 250,  y: groundY - 110, w: 96, h: 24, brick: true });
    platforms.push({ x: 420,  y: groundY - 170, w: 96, h: 24, brick: true });
    platforms.push({ x: 600,  y: groundY - 110, w: 128, h: 24, brick: true });
    platforms.push({ x: 1050, y: groundY - 130, w: 128, h: 24, brick: true });
    platforms.push({ x: 1250, y: groundY - 200, w: 96, h: 24, brick: true });
    platforms.push({ x: 1450, y: groundY - 130, w: 96, h: 24, brick: true });
    platforms.push({ x: 1850, y: groundY - 150, w: 160, h: 24, brick: true });
    platforms.push({ x: 2100, y: groundY - 220, w: 96, h: 24, brick: true });
    platforms.push({ x: 2300, y: groundY - 130, w: 96, h: 24, brick: true });
    platforms.push({ x: 2500, y: groundY - 170, w: 128, h: 24, brick: true });

    return {
      width: 3100,
      groundY,
      platforms,
      hearts: [
        { x: 280,  y: groundY - 150, taken: false },
        { x: 320,  y: groundY - 150, taken: false },
        { x: 450,  y: groundY - 210, taken: false },
        { x: 640,  y: groundY - 150, taken: false },
        { x: 680,  y: groundY - 150, taken: false },
        { x: 1080, y: groundY - 170, taken: false },
        { x: 1280, y: groundY - 240, taken: false },
        { x: 1480, y: groundY - 170, taken: false },
        { x: 1900, y: groundY - 190, taken: false },
        { x: 1960, y: groundY - 190, taken: false },
        { x: 2130, y: groundY - 260, taken: false },
        { x: 2330, y: groundY - 170, taken: false },
        { x: 2540, y: groundY - 210, taken: false },
        { x: 2580, y: groundY - 210, taken: false },
      ],
      enemies: [
        makeEnemy(560,  groundY - 30, 460,  720),
        makeEnemy(1150, groundY - 30, 1000, 1300),
        makeEnemy(1780, groundY - 30, 1720, 2000),
        makeEnemy(2200, groundY - 30, 2100, 2400),
        makeEnemy(2700, groundY - 30, 2620, 2900),
      ],
      flag: { x: 3000, y: groundY - 160 },
      clouds: makeClouds(3100),
      flowers: makeFlowers(3100, groundY),
    };
  }

  function makeEnemy(x, y, leftBound, rightBound) {
    return {
      x, y, w: 30, h: 30,
      vx: -1.2,
      leftBound, rightBound,
      alive: true,
      squashTimer: 0,
    };
  }

  function makeClouds(worldW) {
    const arr = [];
    for (let i = 0; i < 14; i++) {
      arr.push({
        x: Math.random() * worldW,
        y: 30 + Math.random() * 140,
        s: 0.6 + Math.random() * 0.6,
      });
    }
    return arr;
  }

  function makeFlowers(worldW, groundY) {
    const arr = [];
    for (let i = 0; i < 40; i++) {
      arr.push({
        x: Math.random() * worldW,
        y: groundY - 6,
        c: ['#ff7eb9', '#ffd166', '#fff', '#a0e7e5'][Math.floor(Math.random() * 4)],
      });
    }
    return arr;
  }

  // Player
  const player = {
    x: 60, y: 0, w: 26, h: 40,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    invuln: 0,
    walkAnim: 0,
  };

  const state = {
    score: 0,
    lives: 3,
    levelIndex: 1,
    cameraX: 0,
    level: null,
    paused: false,
    won: false,
    dead: false,
  };

  function resetGame() {
    state.score = 0;
    state.lives = 3;
    state.levelIndex = 1;
    state.won = false;
    state.dead = false;
    overlay.classList.add('hidden');
    loadLevel();
  }

  function loadLevel() {
    state.level = buildLevel1();
    player.x = 60;
    player.y = state.level.groundY - player.h;
    player.vx = 0;
    player.vy = 0;
    player.invuln = 60;
    state.cameraX = 0;
    updateHUD();
  }

  function updateHUD() {
    hudScore.textContent = `爱心: ${state.score}`;
    hudLives.textContent = `生命: ${state.lives}`;
    hudLevel.textContent = `关卡: ${state.levelIndex}`;
  }

  function showOverlay(title, text, btnText) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    overlayBtn.textContent = btnText;
    overlay.classList.remove('hidden');
  }

  overlayBtn.addEventListener('click', resetGame);

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update() {
    if (state.paused || state.won || state.dead) return;
    const lvl = state.level;

    // Input
    const left = keys['arrowleft'] || keys['a'];
    const right = keys['arrowright'] || keys['d'];
    const jump = keys['arrowup'] || keys['w'] || keys[' '];

    if (left)  { player.vx -= MOVE_ACC; player.facing = -1; }
    if (right) { player.vx += MOVE_ACC; player.facing = 1; }
    if (!left && !right) player.vx *= FRICTION;
    player.vx = Math.max(-MAX_SPEED, Math.min(MAX_SPEED, player.vx));
    if (Math.abs(player.vx) < 0.05) player.vx = 0;

    if (jump && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
    }

    // Gravity
    player.vy += GRAVITY;
    if (player.vy > 18) player.vy = 18;

    // Horizontal collisions
    player.x += player.vx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > lvl.width) player.x = lvl.width - player.w;
    for (const p of lvl.platforms) {
      if (rectsOverlap(player, p)) {
        if (player.vx > 0) player.x = p.x - player.w;
        else if (player.vx < 0) player.x = p.x + p.w;
        player.vx = 0;
      }
    }

    // Vertical collisions
    player.y += player.vy;
    player.onGround = false;
    for (const p of lvl.platforms) {
      if (rectsOverlap(player, p)) {
        if (player.vy > 0) {
          player.y = p.y - player.h;
          player.vy = 0;
          player.onGround = true;
        } else if (player.vy < 0) {
          player.y = p.y + p.h;
          player.vy = 0;
        }
      }
    }

    // Walk animation
    if (Math.abs(player.vx) > 0.5 && player.onGround) player.walkAnim += Math.abs(player.vx) * 0.15;

    // Fall off screen
    if (player.y > H + 100) {
      loseLife('Jenny 掉下去啦…');
      return;
    }

    // Enemies
    for (const e of lvl.enemies) {
      if (!e.alive) {
        e.squashTimer--;
        continue;
      }
      e.x += e.vx;
      if (e.x < e.leftBound) { e.x = e.leftBound; e.vx *= -1; }
      if (e.x + e.w > e.rightBound) { e.x = e.rightBound - e.w; e.vx *= -1; }

      if (rectsOverlap(player, e)) {
        // Stomp from above?
        const playerBottom = player.y + player.h;
        if (player.vy > 0 && playerBottom - e.y < 18) {
          e.alive = false;
          e.squashTimer = 30;
          player.vy = JUMP_V * 0.6;
          state.score += 2;
          updateHUD();
        } else if (player.invuln <= 0) {
          loseLife('被史莱姆撞到啦！');
          return;
        }
      }
    }

    // Hearts
    for (const h of lvl.hearts) {
      if (h.taken) continue;
      const hb = { x: h.x - 10, y: h.y - 10, w: 20, h: 20 };
      if (rectsOverlap(player, hb)) {
        h.taken = true;
        state.score += 1;
        updateHUD();
      }
    }

    // Flag (win)
    const fb = { x: lvl.flag.x, y: lvl.flag.y, w: 16, h: 160 };
    if (rectsOverlap(player, fb)) {
      state.won = true;
      showOverlay('🎉 通关啦！', `Jenny 成功到达终点！收集了 ${state.score} 颗爱心。`, '再玩一次');
      return;
    }

    if (player.invuln > 0) player.invuln--;

    // Camera follows player
    state.cameraX = player.x - W / 2 + player.w / 2;
    state.cameraX = Math.max(0, Math.min(lvl.width - W, state.cameraX));
  }

  function loseLife(reason) {
    state.lives--;
    updateHUD();
    if (state.lives <= 0) {
      state.dead = true;
      showOverlay('💔 游戏结束', `${reason}\n最终爱心数：${state.score}`, '再来一局');
    } else {
      // Respawn
      player.x = 60;
      player.y = state.level.groundY - player.h;
      player.vx = 0;
      player.vy = 0;
      player.invuln = 90;
      state.cameraX = 0;
    }
  }

  // ---------- DRAWING ----------
  function drawSky() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#a3d8ff');
    grad.addColorStop(0.6, '#cdebff');
    grad.addColorStop(1, '#ffe4f0');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawClouds() {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const c of state.level.clouds) {
      const sx = c.x - state.cameraX * 0.4;
      const x = ((sx % (state.level.width + 200)) + state.level.width + 200) % (state.level.width + 200);
      cloudPuff(x, c.y, c.s);
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

  function drawHillsBackground() {
    ctx.fillStyle = '#bde7a3';
    for (let i = 0; i < 8; i++) {
      const cx = i * 480 - (state.cameraX * 0.5) % 480;
      ctx.beginPath();
      ctx.arc(cx, state.level.groundY + 20, 180, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = '#9ed68a';
    for (let i = 0; i < 8; i++) {
      const cx = i * 360 - (state.cameraX * 0.7) % 360 + 120;
      ctx.beginPath();
      ctx.arc(cx, state.level.groundY + 30, 140, Math.PI, 0);
      ctx.fill();
    }
  }

  function drawPlatforms() {
    for (const p of state.level.platforms) {
      const x = p.x - state.cameraX;
      if (x + p.w < 0 || x > W) continue;
      if (p.brick) {
        // Pink brick
        ctx.fillStyle = '#ff8fc1';
        ctx.fillRect(x, p.y, p.w, p.h);
        ctx.strokeStyle = '#c43d7a';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, p.y + 1, p.w - 2, p.h - 2);
        // Brick lines
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
        // Grass top
        ctx.fillStyle = '#7ec850';
        ctx.fillRect(x, p.y, p.w, 10);
        // Dirt
        ctx.fillStyle = '#c08c5a';
        ctx.fillRect(x, p.y + 10, p.w, p.h - 10);
        // Dirt texture
        ctx.fillStyle = '#a07040';
        for (let i = 0; i < p.w; i += 32) {
          ctx.fillRect(x + i + 6, p.y + 18, 4, 4);
          ctx.fillRect(x + i + 18, p.y + 30, 4, 4);
        }
      }
    }
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

  function drawHearts() {
    for (const h of state.level.hearts) {
      if (h.taken) continue;
      const x = h.x - state.cameraX;
      if (x < -20 || x > W + 20) continue;
      const wob = Math.sin(performance.now() / 300 + h.x) * 2;
      drawHeart(x, h.y + wob, 9, '#ff3d7f');
    }
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

  function drawEnemies() {
    for (const e of state.level.enemies) {
      const x = e.x - state.cameraX;
      if (x < -50 || x > W + 50) continue;
      if (!e.alive) {
        if (e.squashTimer > 0) {
          // Squashed sprite
          ctx.fillStyle = '#7a3d99';
          ctx.fillRect(x - 2, e.y + e.h - 8, e.w + 4, 8);
        }
        continue;
      }
      // Slime body
      ctx.fillStyle = '#a05cc8';
      ctx.beginPath();
      ctx.ellipse(x + e.w/2, e.y + e.h/2 + 2, e.w/2, e.h/2, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.ellipse(x + e.w/2 - 5, e.y + e.h/2 - 4, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes
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
      // Mouth
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
    // Pole
    ctx.fillStyle = '#dcdcdc';
    ctx.fillRect(x, f.y, 4, 160);
    // Ball top
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(x + 2, f.y - 2, 6, 0, Math.PI * 2);
    ctx.fill();
    // Pink flag with heart
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath();
    ctx.moveTo(x + 4, f.y + 6);
    ctx.lineTo(x + 60, f.y + 18);
    ctx.lineTo(x + 4, f.y + 30);
    ctx.closePath();
    ctx.fill();
    drawHeart(x + 28, f.y + 18, 6, '#fff');
  }

  function drawPlayer() {
    const px = player.x - state.cameraX;
    const py = player.y;
    // Blink when invulnerable
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
    // Top hair
    ctx.beginPath();
    ctx.arc(13, 8 + bob, 8, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(5, 8 + bob, 16, 4);
    // Pigtails
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

    ctx.restore();
  }

  function render() {
    drawSky();
    drawClouds();
    drawHillsBackground();
    drawFlowers();
    drawPlatforms();
    drawHearts();
    drawEnemies();
    drawFlag();
    drawPlayer();
  }

  function loop() {
    update();
    render();
    requestAnimationFrame(loop);
  }

  // Boot
  resetGame();
  loop();
})();
