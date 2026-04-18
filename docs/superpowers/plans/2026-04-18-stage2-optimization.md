# Jenny 的冒险 · 第二阶段优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单关游戏扩展为三关 + 菜单 + 存档 + 音效 + 粒子 + 屏震，同时把 `game.js` 拆分成 7 个职责清晰的小文件。

**Architecture:** 浏览器端 `<script>` 顺序加载的多文件结构（无构建工具）。每个文件同时导出 `globalThis` 命名空间（浏览器用）和 `module.exports`（Node 测试用）。Node 内置 `node:test` 做纯逻辑单元测试；渲染/输入靠手工验收。

**Tech Stack:** HTML5 Canvas 2D、Web Audio API、localStorage、Node 内置 `node:test` / `node:assert`。

**Spec:** `docs/superpowers/specs/2026-04-18-stage2-optimization-design.md`

---

## 文件结构

```
index.html                   修改：按顺序 <script> 加载 7 个 js、移除 DOM HUD
style.css                    不变
game.js                      重写：主循环 + 状态机分发
storage.js                   新：localStorage 读写
audio.js                     新：Web Audio 合成音效
fx.js                        新：粒子 + 屏震 + 闪烁
entities.js                  新：Player / Slime / Bee / Dasher / Heart / Shield / JumpBoot
levels.js                    新：三关数据 + loadLevel
ui.js                        新：菜单/选关/HUD/overlay 绘制
tests/storage.test.js        新
tests/audio.test.js          新
tests/fx.test.js             新
tests/entities.test.js       新
tests/levels.test.js         新
package.json                 新：定义 "test" 脚本
```

## 模块导出约定

每个源文件末尾统一使用：

```js
if (typeof module !== 'undefined') module.exports = { /* 导出列表 */ };
```

并且每个源文件顶部用这个 pattern 包裹，使其在浏览器挂 `window`、在 Node 可 `require`：

```js
(function (global) {
  'use strict';

  // ... 模块实现 ...

  const API = { /* 导出列表 */ };

  if (typeof module !== 'undefined') {
    module.exports = API;
  } else {
    global.Jenny = global.Jenny || {};
    Object.assign(global.Jenny, API);
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

浏览器通过 `window.Jenny.makeSlime(...)` 访问，或每个模块直接挂自己的全局变量（更简单的做法：直接 `global.makeSlime = makeSlime`）。

**选定方案：** 每个模块挂一个自己的命名空间常量，避免名字冲突：

```js
// entities.js 末尾：
const Entities = { makePlayer, makeSlime, makeBee, makeDasher, makeHeart, makeShield, makeJumpBoot,
                   updateSlime, updateBee, updateDasher };
if (typeof module !== 'undefined') module.exports = Entities;
else window.Entities = Entities;
```

`game.js` 里用 `Entities.makeSlime(...)`。

## 命名与关键类型

```js
// Player
{ x, y, w: 26, h: 40, vx, vy, onGround, facing, invuln, walkAnim,
  shield: false, jumpBootMs: 0 }

// Slime
{ type: 'slime', x, y, w: 30, h: 30, vx, leftBound, rightBound,
  alive: true, squashTimer: 0 }

// Bee
{ type: 'bee', x, y, w: 28, h: 24, baseY, leftBound, rightBound,
  vx, phase: 0, alive: true, squashTimer: 0 }

// Dasher
{ type: 'dasher', x, y, w: 32, h: 34, vx, baseSpeed: 1, leftBound, rightBound,
  alive: true, squashTimer: 0,
  state: 'PATROL' | 'CHARGING' | 'COOLDOWN', stateMs: 0 }

// Heart
{ x, y, taken: false }

// Shield item (pickup)
{ type: 'shield', x, y, taken: false }

// JumpBoot item (pickup)
{ type: 'jumpboot', x, y, taken: false }

// Particle
{ x, y, vx, vy, life, maxLife, color, size }

// Save
{ version: 1, unlocked: 1, totalHearts: 0, bestTimes: [null, null, null] }

// Level
{ name, width, groundY, platforms, hearts, enemies, pickups, flag, clouds, flowers, theme }
// theme: 'meadow' | 'forest' | 'castle'
```

## 常量

保留在 `game.js` 头部：

```js
const GRAVITY = 0.7;
const MOVE_ACC = 0.8;
const FRICTION = 0.82;
const MAX_SPEED = 5.2;
const JUMP_V = -13.5;
const JUMP_V_BOOSTED = -20;
const TILE = 32;
const W = 800;
const H = 480;
```

---

## Task 1: 测试基础设施 + storage.js

**Files:**
- Create: `package.json`
- Create: `storage.js`
- Create: `tests/storage.test.js`

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "jennys-mario-game",
  "version": "0.2.0",
  "private": true,
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 2: 写 storage 测试 `tests/storage.test.js`**

```js
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
```

- [ ] **Step 3: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL — `Cannot find module '../storage.js'`

- [ ] **Step 4: 实现 `storage.js`**

```js
(function (global) {
  'use strict';

  const KEY = 'jenny_save';
  const VERSION = 1;

  function defaultSave() {
    return { version: VERSION, unlocked: 1, totalHearts: 0, bestTimes: [null, null, null] };
  }

  function load(storage) {
    if (!storage) return defaultSave();
    try {
      const raw = storage.getItem(KEY);
      if (!raw) return defaultSave();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return defaultSave();
      return {
        version: VERSION,
        unlocked: Number.isInteger(parsed.unlocked) ? parsed.unlocked : 1,
        totalHearts: Number.isInteger(parsed.totalHearts) ? parsed.totalHearts : 0,
        bestTimes: Array.isArray(parsed.bestTimes) && parsed.bestTimes.length === 3
          ? parsed.bestTimes.slice()
          : [null, null, null],
      };
    } catch (_) {
      return defaultSave();
    }
  }

  function save(storage, saveObj) {
    if (!storage) return;
    try {
      storage.setItem(KEY, JSON.stringify(saveObj));
    } catch (_) {
      // quota exceeded, privacy mode, etc — silently drop
    }
  }

  const API = { load, save, defaultSave, KEY, VERSION };

  if (typeof module !== 'undefined') module.exports = API;
  else global.Storage = API;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 5: 运行测试，确认全部通过**

Run: `npm test`
Expected: `# pass 6` (6 tests passing)

- [ ] **Step 6: 提交**

```bash
git add package.json storage.js tests/storage.test.js
git commit -m "feat: add storage module with node:test infrastructure"
```

---

## Task 2: audio.js（Web Audio 合成音效）

**Files:**
- Create: `audio.js`
- Create: `tests/audio.test.js`

- [ ] **Step 1: 写 audio 测试 `tests/audio.test.js`**

```js
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
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL — `Cannot find module '../audio.js'`

- [ ] **Step 3: 实现 `audio.js`**

```js
(function (global) {
  'use strict';

  function init(ctx) {
    let enabled = true;

    function beep(type, freqStart, freqEnd, duration, gainPeak = 0.15) {
      if (!ctx || !enabled) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freqStart;
      if (freqEnd !== freqStart) {
        osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);
      }
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(gainPeak, now + 0.01);
      gain.gain.linearRampToValueAtTime(0, now + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    }

    function jump()  { beep('square',   400,  600, 0.1, 0.12); }
    function heart() { beep('triangle', 800,  800, 0.1, 0.14); beep('triangle', 1200, 1200, 0.12, 0.1); }
    function stomp() { beep('sawtooth', 200,  100, 0.15, 0.18); }
    function hurt()  { beep('square',   150,  150, 0.3, 0.18); }

    function win() {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C-E-G-C
      notes.forEach((n, i) => {
        setTimeout(() => beep('triangle', n, n, 0.18, 0.15), i * 130);
      });
    }

    function setEnabled(v) { enabled = !!v; }
    function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

    return { jump, heart, stomp, hurt, win, setEnabled, resume };
  }

  const API = { init };
  if (typeof module !== 'undefined') module.exports = API;
  else global.Audio = API;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: all tests pass (10 total so far)

- [ ] **Step 5: 提交**

```bash
git add audio.js tests/audio.test.js
git commit -m "feat: add Web Audio sfx module with tests"
```

---

## Task 3: fx.js（粒子 + 屏震 + 闪烁）

**Files:**
- Create: `fx.js`
- Create: `tests/fx.test.js`

- [ ] **Step 1: 写 fx 测试 `tests/fx.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const FX = require('../fx.js');

test('makeParticle returns properly shaped object', () => {
  const p = FX.makeParticle(10, 20, 1, -2, 0.5, '#ff00ff', 3);
  assert.strictEqual(p.x, 10);
  assert.strictEqual(p.y, 20);
  assert.strictEqual(p.vx, 1);
  assert.strictEqual(p.vy, -2);
  assert.strictEqual(p.life, 0.5);
  assert.strictEqual(p.maxLife, 0.5);
  assert.strictEqual(p.color, '#ff00ff');
  assert.strictEqual(p.size, 3);
});

test('updateParticles applies velocity and gravity and expires', () => {
  const particles = [FX.makeParticle(0, 0, 2, -5, 0.3, '#fff', 2)];
  FX.updateParticles(particles, 0.1); // 0.1s
  assert(Math.abs(particles[0].x - 0.2) < 0.001);
  assert(particles[0].vy > -5, 'gravity should increase vy');
  assert(particles[0].life < 0.3, 'life should decrease');
});

test('updateParticles removes dead particles in place', () => {
  const particles = [
    FX.makeParticle(0, 0, 0, 0, 0.05, '#fff', 2),
    FX.makeParticle(0, 0, 0, 0, 1.0,  '#fff', 2),
  ];
  FX.updateParticles(particles, 0.1);
  assert.strictEqual(particles.length, 1);
});

test('spawnBurst pushes N particles with given color', () => {
  const particles = [];
  FX.spawnBurst(particles, 100, 50, 6, '#ff3d7f');
  assert.strictEqual(particles.length, 6);
  assert(particles.every((p) => p.color === '#ff3d7f'));
  assert(particles.every((p) => Math.abs(p.x - 100) < 20));
});

test('makeShake / tickShake decays to zero', () => {
  const s = FX.makeShake(6, 0.2);
  assert.strictEqual(s.amp, 6);
  assert(s.timeLeft > 0);
  FX.tickShake(s, 0.1);
  assert(s.timeLeft < 0.2);
  FX.tickShake(s, 0.3);
  assert.strictEqual(s.timeLeft, 0);
});

test('shakeOffset returns zero when shake expired', () => {
  const s = FX.makeShake(6, 0);
  const off = FX.shakeOffset(s);
  assert.strictEqual(off.x, 0);
  assert.strictEqual(off.y, 0);
});

test('makeFlash / tickFlash decays', () => {
  const f = FX.makeFlash('#ff0000', 0.3);
  assert.strictEqual(f.color, '#ff0000');
  assert.strictEqual(f.timeLeft, 0.3);
  FX.tickFlash(f, 0.1);
  assert(f.timeLeft < 0.3 && f.timeLeft > 0);
  FX.tickFlash(f, 1);
  assert.strictEqual(f.timeLeft, 0);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL — `Cannot find module '../fx.js'`

- [ ] **Step 3: 实现 `fx.js`**

```js
(function (global) {
  'use strict';

  const PARTICLE_GRAVITY = 12; // px/s^2 (scaled for dt in seconds)

  function makeParticle(x, y, vx, vy, life, color, size) {
    return { x, y, vx, vy, life, maxLife: life, color, size };
  }

  function updateParticles(particles, dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: all 17 tests pass

- [ ] **Step 5: 提交**

```bash
git add fx.js tests/fx.test.js
git commit -m "feat: add particle/shake/flash effects module"
```

---

## Task 4: entities.js — Player、Slime、Heart（从 game.js 提取）

**Files:**
- Create: `entities.js`
- Create: `tests/entities.test.js`

- [ ] **Step 1: 写 slime 行为测试 `tests/entities.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const Entities = require('../entities.js');

test('makeSlime returns slime with bounds', () => {
  const s = Entities.makeSlime(100, 200, 80, 160);
  assert.strictEqual(s.type, 'slime');
  assert.strictEqual(s.x, 100);
  assert.strictEqual(s.y, 200);
  assert.strictEqual(s.leftBound, 80);
  assert.strictEqual(s.rightBound, 160);
  assert.strictEqual(s.alive, true);
});

test('updateSlime bounces at boundaries', () => {
  const s = Entities.makeSlime(79, 0, 80, 160);
  s.vx = -1.2;
  Entities.updateSlime(s);
  assert(s.vx > 0, 'should reverse direction');
  assert.strictEqual(s.x, 80);
});

test('makePlayer returns default player', () => {
  const p = Entities.makePlayer(60, 100);
  assert.strictEqual(p.x, 60);
  assert.strictEqual(p.y, 100);
  assert.strictEqual(p.w, 26);
  assert.strictEqual(p.h, 40);
  assert.strictEqual(p.shield, false);
  assert.strictEqual(p.jumpBootMs, 0);
  assert.strictEqual(p.facing, 1);
});

test('makeHeart is not taken', () => {
  const h = Entities.makeHeart(50, 60);
  assert.strictEqual(h.x, 50);
  assert.strictEqual(h.taken, false);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL — `Cannot find module '../entities.js'`

- [ ] **Step 3: 实现 `entities.js`（先含 Player / Slime / Heart）**

```js
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
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: 提交**

```bash
git add entities.js tests/entities.test.js
git commit -m "feat: add entities module with Player/Slime/Heart"
```

---

## Task 5: entities.js — 新增 Bee（飞行蜜蜂）

**Files:**
- Modify: `entities.js`
- Modify: `tests/entities.test.js`

- [ ] **Step 1: 追加 bee 测试到 `tests/entities.test.js`**

```js
test('makeBee initializes with base Y and phase', () => {
  const b = Entities.makeBee(100, 200, 50, 200);
  assert.strictEqual(b.type, 'bee');
  assert.strictEqual(b.baseY, 200);
  assert.strictEqual(b.leftBound, 50);
  assert.strictEqual(b.rightBound, 200);
  assert.strictEqual(b.alive, true);
});

test('updateBee oscillates Y around baseY', () => {
  const b = Entities.makeBee(100, 200, 50, 200);
  const y0 = b.y;
  Entities.updateBee(b, 0.25); // 1/4 of the 1s period at 1.5s → partial wave
  assert.notStrictEqual(b.y, y0);
  assert(Math.abs(b.y - b.baseY) <= 20.01, 'Y should stay within amplitude ±20');
});

test('updateBee bounces at horizontal boundaries', () => {
  const b = Entities.makeBee(49, 200, 50, 200);
  b.vx = -0.8;
  Entities.updateBee(b, 0.016);
  assert(b.vx > 0);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL — `Entities.makeBee is not a function`

- [ ] **Step 3: 在 `entities.js` 中追加 Bee**

在 `makeHeart` 之后插入：

```js
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
    b.phase += dt * (Math.PI * 2 / 1.5); // 1.5s period
    b.y = b.baseY + Math.sin(b.phase) * 20;
  }
```

并在末尾 API 对象加入 `makeBee, updateBee`。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: all tests pass (now including 3 new bee tests)

- [ ] **Step 5: 提交**

```bash
git add entities.js tests/entities.test.js
git commit -m "feat: add Bee enemy with sine-wave flight"
```

---

## Task 6: entities.js — 新增 Dasher（冲刺小魔王）

**Files:**
- Modify: `entities.js`
- Modify: `tests/entities.test.js`

- [ ] **Step 1: 追加 dasher 测试**

```js
test('makeDasher starts in PATROL state', () => {
  const d = Entities.makeDasher(100, 200, 50, 400);
  assert.strictEqual(d.type, 'dasher');
  assert.strictEqual(d.state, 'PATROL');
  assert.strictEqual(d.baseSpeed, 1);
});

test('updateDasher transitions PATROL → CHARGING when player nearby', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  Entities.updateDasher(d, 0.016, { x: 250, y: 200 });
  assert.strictEqual(d.state, 'CHARGING');
});

test('updateDasher stays PATROL when player far', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  Entities.updateDasher(d, 0.016, { x: 600, y: 200 });
  assert.strictEqual(d.state, 'PATROL');
});

test('updateDasher CHARGING → COOLDOWN after 1.2s', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  d.state = 'CHARGING';
  d.stateMs = 0;
  Entities.updateDasher(d, 1.3, { x: 250, y: 200 });
  assert.strictEqual(d.state, 'COOLDOWN');
});

test('updateDasher COOLDOWN → PATROL after 1s', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  d.state = 'COOLDOWN';
  d.stateMs = 0;
  Entities.updateDasher(d, 1.1, { x: 999, y: 200 });
  assert.strictEqual(d.state, 'PATROL');
});

test('updateDasher CHARGING moves at 3x baseSpeed', () => {
  const d = Entities.makeDasher(200, 200, 50, 400);
  d.state = 'CHARGING';
  d.vx = 1;
  d.stateMs = 0;
  const x0 = d.x;
  Entities.updateDasher(d, 0.016, { x: 300, y: 200 });
  assert(d.x - x0 >= 2.9 && d.x - x0 <= 3.1, `expected ~3 px movement, got ${d.x - x0}`);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL — `Entities.makeDasher is not a function`

- [ ] **Step 3: 在 `entities.js` 追加 Dasher**

```js
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
    } else { // COOLDOWN
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
```

API 对象追加 `makeDasher, updateDasher`。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: 提交**

```bash
git add entities.js tests/entities.test.js
git commit -m "feat: add Dasher enemy with PATROL/CHARGING/COOLDOWN states"
```

---

## Task 7: entities.js — Shield + JumpBoot 道具

**Files:**
- Modify: `entities.js`
- Modify: `tests/entities.test.js`

- [ ] **Step 1: 追加道具测试**

```js
test('makeShield creates untaken pickup', () => {
  const s = Entities.makeShield(100, 200);
  assert.strictEqual(s.type, 'shield');
  assert.strictEqual(s.taken, false);
});

test('applyShield sets player.shield true', () => {
  const p = Entities.makePlayer(0, 0);
  Entities.applyShield(p);
  assert.strictEqual(p.shield, true);
});

test('consumeShield returns true when shield active and clears it', () => {
  const p = Entities.makePlayer(0, 0);
  p.shield = true;
  const consumed = Entities.consumeShield(p);
  assert.strictEqual(consumed, true);
  assert.strictEqual(p.shield, false);
});

test('consumeShield returns false when no shield', () => {
  const p = Entities.makePlayer(0, 0);
  assert.strictEqual(Entities.consumeShield(p), false);
});

test('makeJumpBoot creates untaken pickup', () => {
  const j = Entities.makeJumpBoot(100, 200);
  assert.strictEqual(j.type, 'jumpboot');
  assert.strictEqual(j.taken, false);
});

test('applyJumpBoot sets 10 seconds remaining', () => {
  const p = Entities.makePlayer(0, 0);
  Entities.applyJumpBoot(p);
  assert.strictEqual(p.jumpBootMs, 10000);
});

test('tickJumpBoot decreases jumpBootMs and clamps at 0', () => {
  const p = Entities.makePlayer(0, 0);
  p.jumpBootMs = 500;
  Entities.tickJumpBoot(p, 0.3); // 300 ms
  assert.strictEqual(p.jumpBootMs, 200);
  Entities.tickJumpBoot(p, 10);
  assert.strictEqual(p.jumpBootMs, 0);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: 在 `entities.js` 追加道具函数**

```js
  function makeShield(x, y)   { return { type: 'shield',   x, y, taken: false }; }
  function makeJumpBoot(x, y) { return { type: 'jumpboot', x, y, taken: false }; }

  function applyShield(p)     { p.shield = true; }
  function consumeShield(p)   { if (p.shield) { p.shield = false; return true; } return false; }

  function applyJumpBoot(p)   { p.jumpBootMs = 10000; }
  function tickJumpBoot(p, dt) { p.jumpBootMs = Math.max(0, p.jumpBootMs - dt * 1000); }
```

API 对象追加 `makeShield, makeJumpBoot, applyShield, consumeShield, applyJumpBoot, tickJumpBoot`。

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: 提交**

```bash
git add entities.js tests/entities.test.js
git commit -m "feat: add Shield and JumpBoot pickups with player effects"
```

---

## Task 8: levels.js — 第 1 关 草原（从 game.js 提取）

**Files:**
- Create: `levels.js`
- Create: `tests/levels.test.js`

- [ ] **Step 1: 写 levels 测试 `tests/levels.test.js`**

```js
const test = require('node:test');
const assert = require('node:assert');
const Levels = require('../levels.js');

test('LEVELS array has 3 entries', () => {
  assert.strictEqual(Levels.LEVELS.length, 3);
});

test('level 1 — meadow — has 5 slimes, 14 hearts, 1 shield, 0 bees, 0 dashers, 0 jumpboots', () => {
  const l = Levels.build(1);
  const enemiesByType = countByType(l.enemies);
  const pickupsByType = countByType(l.pickups);
  assert.strictEqual(l.name, '草原');
  assert.strictEqual(l.theme, 'meadow');
  assert.strictEqual(l.width, 3100);
  assert.strictEqual(l.hearts.length, 14);
  assert.strictEqual(enemiesByType.slime || 0, 5);
  assert.strictEqual(enemiesByType.bee || 0, 0);
  assert.strictEqual(enemiesByType.dasher || 0, 0);
  assert.strictEqual(pickupsByType.shield || 0, 1);
  assert.strictEqual(pickupsByType.jumpboot || 0, 0);
});

test('level 1 all entities within [0, width]', () => {
  const l = Levels.build(1);
  for (const e of l.enemies) {
    assert(e.x >= 0 && e.x + e.w <= l.width, `enemy ${e.type} out of bounds`);
  }
  for (const h of l.hearts) {
    assert(h.x >= 0 && h.x <= l.width);
  }
  for (const p of l.pickups) {
    assert(p.x >= 0 && p.x <= l.width);
  }
});

function countByType(arr) {
  const out = {};
  for (const item of arr) out[item.type] = (out[item.type] || 0) + 1;
  return out;
}
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL — `Cannot find module '../levels.js'`

- [ ] **Step 3: 实现 `levels.js`（仅第 1 关）**

```js
(function (global) {
  'use strict';

  const Entities = (typeof require !== 'undefined') ? require('./entities.js') : global.Entities;
  const H = 480;
  const TILE = 32;

  function makeClouds(worldW) {
    const arr = [];
    for (let i = 0; i < 14; i++) {
      arr.push({ x: Math.random() * worldW, y: 30 + Math.random() * 140, s: 0.6 + Math.random() * 0.6 });
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

  function buildLevel1() {
    const groundY = H - TILE * 2;
    const platforms = [
      { x: 0,    y: groundY, w: 800,  h: TILE * 2 },
      { x: 900,  y: groundY, w: 700,  h: TILE * 2 },
      { x: 1700, y: groundY, w: 1400, h: TILE * 2 },
      { x: 250,  y: groundY - 110, w: 96,  h: 24, brick: true },
      { x: 420,  y: groundY - 170, w: 96,  h: 24, brick: true },
      { x: 600,  y: groundY - 110, w: 128, h: 24, brick: true },
      { x: 1050, y: groundY - 130, w: 128, h: 24, brick: true },
      { x: 1250, y: groundY - 200, w: 96,  h: 24, brick: true },
      { x: 1450, y: groundY - 130, w: 96,  h: 24, brick: true },
      { x: 1850, y: groundY - 150, w: 160, h: 24, brick: true },
      { x: 2100, y: groundY - 220, w: 96,  h: 24, brick: true },
      { x: 2300, y: groundY - 130, w: 96,  h: 24, brick: true },
      { x: 2500, y: groundY - 170, w: 128, h: 24, brick: true },
    ];
    const hearts = [
      [280, groundY-150],[320, groundY-150],[450, groundY-210],[640, groundY-150],[680, groundY-150],
      [1080, groundY-170],[1280, groundY-240],[1480, groundY-170],[1900, groundY-190],[1960, groundY-190],
      [2130, groundY-260],[2330, groundY-170],[2540, groundY-210],[2580, groundY-210],
    ].map(([x,y]) => Entities.makeHeart(x, y));
    const enemies = [
      Entities.makeSlime(560,  groundY-30, 460,  720),
      Entities.makeSlime(1150, groundY-30, 1000, 1300),
      Entities.makeSlime(1780, groundY-30, 1720, 2000),
      Entities.makeSlime(2200, groundY-30, 2100, 2400),
      Entities.makeSlime(2700, groundY-30, 2620, 2900),
    ];
    const pickups = [ Entities.makeShield(1380, groundY - 160) ];
    return {
      name: '草原', theme: 'meadow',
      width: 3100, groundY,
      platforms, hearts, enemies, pickups,
      flag: { x: 3000, y: groundY - 160 },
      clouds: makeClouds(3100),
      flowers: makeFlowers(3100, groundY),
    };
  }

  function build(n) {
    if (n === 1) return buildLevel1();
    throw new Error(`Level ${n} not implemented yet`);
  }

  const LEVELS = [
    { n: 1, name: '草原', theme: 'meadow' },
    { n: 2, name: '森林', theme: 'forest' },
    { n: 3, name: '城堡', theme: 'castle' },
  ];

  const API = { build, LEVELS };
  if (typeof module !== 'undefined') module.exports = API;
  else global.Levels = API;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: Level 1 tests pass; level 2/3 tests don't exist yet

- [ ] **Step 5: 提交**

```bash
git add levels.js tests/levels.test.js
git commit -m "feat: add levels module with Level 1 (Meadow)"
```

---

## Task 9: levels.js — 第 2 关 森林

**Files:**
- Modify: `levels.js`
- Modify: `tests/levels.test.js`

- [ ] **Step 1: 追加 level 2 测试**

```js
test('level 2 — forest — has 4 slimes, 4 bees, 0 dashers, 18 hearts, 1 shield, 0 jumpboots', () => {
  const l = Levels.build(2);
  const enemiesByType = countByType(l.enemies);
  const pickupsByType = countByType(l.pickups);
  assert.strictEqual(l.name, '森林');
  assert.strictEqual(l.theme, 'forest');
  assert.strictEqual(l.width, 3600);
  assert.strictEqual(l.hearts.length, 18);
  assert.strictEqual(enemiesByType.slime || 0, 4);
  assert.strictEqual(enemiesByType.bee   || 0, 4);
  assert.strictEqual(enemiesByType.dasher || 0, 0);
  assert.strictEqual(pickupsByType.shield   || 0, 1);
  assert.strictEqual(pickupsByType.jumpboot || 0, 0);
});

test('level 2 all entities within [0, width]', () => {
  const l = Levels.build(2);
  for (const e of l.enemies) assert(e.x >= 0 && e.x + e.w <= l.width);
  for (const h of l.hearts) assert(h.x >= 0 && h.x <= l.width);
  for (const p of l.pickups) assert(p.x >= 0 && p.x <= l.width);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL — `Level 2 not implemented yet`

- [ ] **Step 3: 实现 level 2**

在 `levels.js` 中 `buildLevel1` 之后插入：

```js
  function buildLevel2() {
    const groundY = H - TILE * 2;
    const platforms = [
      { x: 0,    y: groundY, w: 600,  h: TILE * 2 },
      { x: 720,  y: groundY, w: 520,  h: TILE * 2 },
      { x: 1360, y: groundY, w: 500,  h: TILE * 2 },
      { x: 1980, y: groundY, w: 1620, h: TILE * 2 },
      { x: 200,  y: groundY - 120, w: 96,  h: 24, brick: true },
      { x: 380,  y: groundY - 180, w: 96,  h: 24, brick: true },
      { x: 560,  y: groundY - 120, w: 96,  h: 24, brick: true },
      { x: 800,  y: groundY - 150, w: 128, h: 24, brick: true },
      { x: 1000, y: groundY - 220, w: 96,  h: 24, brick: true },
      { x: 1200, y: groundY - 150, w: 96,  h: 24, brick: true },
      { x: 1420, y: groundY - 200, w: 160, h: 24, brick: true },
      { x: 1700, y: groundY - 250, w: 96,  h: 24, brick: true },
      { x: 2050, y: groundY - 150, w: 128, h: 24, brick: true },
      { x: 2280, y: groundY - 220, w: 96,  h: 24, brick: true },
      { x: 2500, y: groundY - 170, w: 128, h: 24, brick: true },
      { x: 2750, y: groundY - 230, w: 96,  h: 24, brick: true },
      { x: 2950, y: groundY - 160, w: 128, h: 24, brick: true },
      { x: 3200, y: groundY - 210, w: 128, h: 24, brick: true },
    ];
    const heartCoords = [
      [220, groundY-160],[400, groundY-220],[580, groundY-160],[820, groundY-190],[860, groundY-190],
      [1030, groundY-260],[1220, groundY-190],[1450, groundY-240],[1510, groundY-240],[1720, groundY-290],
      [2080, groundY-190],[2120, groundY-190],[2300, groundY-260],[2530, groundY-210],[2780, groundY-270],
      [2980, groundY-200],[3220, groundY-250],[3280, groundY-250],
    ];
    const hearts = heartCoords.map(([x,y]) => Entities.makeHeart(x, y));
    const enemies = [
      Entities.makeSlime(500,  groundY-30, 420,  600),
      Entities.makeSlime(1500, groundY-30, 1380, 1700),
      Entities.makeSlime(2200, groundY-30, 2050, 2400),
      Entities.makeSlime(3000, groundY-30, 2900, 3200),
      Entities.makeBee(700, groundY - 180, 650, 900),
      Entities.makeBee(1350, groundY - 220, 1300, 1550),
      Entities.makeBee(2000, groundY - 200, 1950, 2250),
      Entities.makeBee(2800, groundY - 210, 2700, 3050),
    ];
    const pickups = [ Entities.makeShield(1640, groundY - 280) ];
    return {
      name: '森林', theme: 'forest',
      width: 3600, groundY,
      platforms, hearts, enemies, pickups,
      flag: { x: 3500, y: groundY - 160 },
      clouds: makeClouds(3600),
      flowers: makeFlowers(3600, groundY),
    };
  }
```

并修改 `build(n)`：

```js
  function build(n) {
    if (n === 1) return buildLevel1();
    if (n === 2) return buildLevel2();
    throw new Error(`Level ${n} not implemented yet`);
  }
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: 提交**

```bash
git add levels.js tests/levels.test.js
git commit -m "feat: add Level 2 (Forest) with bees"
```

---

## Task 10: levels.js — 第 3 关 城堡

**Files:**
- Modify: `levels.js`
- Modify: `tests/levels.test.js`

- [ ] **Step 1: 追加 level 3 测试**

```js
test('level 3 — castle — has 3 slimes, 3 bees, 3 dashers, 22 hearts, 0 shields, 1 jumpboot', () => {
  const l = Levels.build(3);
  const enemiesByType = countByType(l.enemies);
  const pickupsByType = countByType(l.pickups);
  assert.strictEqual(l.name, '城堡');
  assert.strictEqual(l.theme, 'castle');
  assert.strictEqual(l.width, 4200);
  assert.strictEqual(l.hearts.length, 22);
  assert.strictEqual(enemiesByType.slime  || 0, 3);
  assert.strictEqual(enemiesByType.bee    || 0, 3);
  assert.strictEqual(enemiesByType.dasher || 0, 3);
  assert.strictEqual(pickupsByType.shield   || 0, 0);
  assert.strictEqual(pickupsByType.jumpboot || 0, 1);
});

test('level 3 all entities within [0, width]', () => {
  const l = Levels.build(3);
  for (const e of l.enemies) assert(e.x >= 0 && e.x + e.w <= l.width);
  for (const h of l.hearts) assert(h.x >= 0 && h.x <= l.width);
  for (const p of l.pickups) assert(p.x >= 0 && p.x <= l.width);
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `npm test`
Expected: FAIL

- [ ] **Step 3: 实现 level 3**

```js
  function buildLevel3() {
    const groundY = H - TILE * 2;
    const platforms = [
      { x: 0,    y: groundY, w: 500,  h: TILE * 2 },
      { x: 640,  y: groundY, w: 400,  h: TILE * 2 },
      { x: 1180, y: groundY, w: 500,  h: TILE * 2 },
      { x: 1820, y: groundY, w: 400,  h: TILE * 2 },
      { x: 2360, y: groundY, w: 1840, h: TILE * 2 },
      { x: 180,  y: groundY - 130, w: 96,  h: 24, brick: true },
      { x: 360,  y: groundY - 200, w: 96,  h: 24, brick: true },
      { x: 720,  y: groundY - 150, w: 128, h: 24, brick: true },
      { x: 900,  y: groundY - 230, w: 96,  h: 24, brick: true },
      { x: 1240, y: groundY - 160, w: 128, h: 24, brick: true },
      { x: 1440, y: groundY - 240, w: 96,  h: 24, brick: true },
      { x: 1620, y: groundY - 160, w: 96,  h: 24, brick: true },
      { x: 1900, y: groundY - 220, w: 128, h: 24, brick: true },
      { x: 2100, y: groundY - 300, w: 96,  h: 24, brick: true },
      { x: 2400, y: groundY - 160, w: 128, h: 24, brick: true },
      { x: 2620, y: groundY - 240, w: 96,  h: 24, brick: true },
      { x: 2840, y: groundY - 180, w: 128, h: 24, brick: true },
      { x: 3080, y: groundY - 260, w: 96,  h: 24, brick: true },
      { x: 3300, y: groundY - 200, w: 128, h: 24, brick: true },
      { x: 3550, y: groundY - 280, w: 96,  h: 24, brick: true },
      { x: 3800, y: groundY - 220, w: 128, h: 24, brick: true },
    ];
    const heartCoords = [
      [200, groundY-170],[380, groundY-240],[750, groundY-190],[920, groundY-270],[1270, groundY-200],
      [1460, groundY-280],[1650, groundY-200],[1930, groundY-260],[2120, groundY-340],[2430, groundY-200],
      [2470, groundY-200],[2650, groundY-280],[2870, groundY-220],[2910, groundY-220],[3100, groundY-300],
      [3330, groundY-240],[3370, groundY-240],[3570, groundY-320],[3610, groundY-320],[3820, groundY-260],
      [3860, groundY-260],[3900, groundY-260],
    ];
    const hearts = heartCoords.map(([x,y]) => Entities.makeHeart(x, y));
    const enemies = [
      Entities.makeSlime(1400, groundY-30, 1200, 1650),
      Entities.makeSlime(2500, groundY-30, 2380, 2700),
      Entities.makeSlime(3500, groundY-30, 3350, 3700),
      Entities.makeBee(800,  groundY - 200, 700,  1050),
      Entities.makeBee(2000, groundY - 230, 1900, 2200),
      Entities.makeBee(3200, groundY - 240, 3100, 3500),
      Entities.makeDasher(1300, groundY-34, 1200, 1650),
      Entities.makeDasher(2550, groundY-34, 2400, 2800),
      Entities.makeDasher(3700, groundY-34, 3500, 3900),
    ];
    const pickups = [ Entities.makeJumpBoot(2050, groundY - 340) ];
    return {
      name: '城堡', theme: 'castle',
      width: 4200, groundY,
      platforms, hearts, enemies, pickups,
      flag: { x: 4100, y: groundY - 160 },
      clouds: makeClouds(4200),
      flowers: makeFlowers(4200, groundY),
    };
  }
```

修改 `build`：

```js
  function build(n) {
    if (n === 1) return buildLevel1();
    if (n === 2) return buildLevel2();
    if (n === 3) return buildLevel3();
    throw new Error(`Invalid level ${n}`);
  }
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 5: 提交**

```bash
git add levels.js tests/levels.test.js
git commit -m "feat: add Level 3 (Castle) with dashers and jumpboot"
```

---

## Task 11: ui.js — 菜单、选关、HUD、overlay 绘制

**Files:**
- Create: `ui.js`

UI 模块是纯渲染代码，没有可单独测试的纯逻辑；用手工验收。

- [ ] **Step 1: 创建 `ui.js`**

```js
(function (global) {
  'use strict';

  const W = 800;
  const H = 480;

  function drawCenteredText(ctx, text, y, size, color, bold) {
    ctx.fillStyle = color;
    ctx.font = `${bold ? 'bold ' : ''}${size}px "Comic Sans MS", "PingFang SC", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y);
  }

  function drawButton(ctx, cx, cy, w, h, label, enabled, highlighted) {
    const x = cx - w / 2, y = cy - h / 2;
    ctx.fillStyle = enabled ? (highlighted ? '#ff5fa2' : '#ff8fc1') : '#ccc';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = enabled ? '#c43d7a' : '#888';
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px "Comic Sans MS", "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);
  }

  function drawMenu(ctx, save, highlightedIndex) {
    // Gradient background
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffd1dc'); g.addColorStop(1, '#fff0f7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawCenteredText(ctx, '🌸 Jenny 的冒险 🌸', 100, 40, '#d6336c', true);

    const levelSelectEnabled = save.unlocked > 1;
    drawButton(ctx, W/2, 230, 240, 54, '开始游戏', true,  highlightedIndex === 0);
    drawButton(ctx, W/2, 310, 240, 54, '选择关卡', levelSelectEnabled, highlightedIndex === 1);

    drawCenteredText(ctx,
      `累计爱心: ${save.totalHearts}   最高解锁: 第 ${save.unlocked} 关`,
      410, 16, '#b03060');
  }

  function menuButtonHitTest(mx, my) {
    // Returns 0 for start, 1 for select, -1 for none
    if (Math.abs(mx - W/2) < 120 && Math.abs(my - 230) < 27) return 0;
    if (Math.abs(mx - W/2) < 120 && Math.abs(my - 310) < 27) return 1;
    return -1;
  }

  function drawSelect(ctx, save, highlightedIndex) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#ffd1dc'); g.addColorStop(1, '#fff0f7');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawCenteredText(ctx, '选择关卡', 80, 36, '#d6336c', true);

    const names = ['1. 草原', '2. 森林', '3. 城堡'];
    for (let i = 0; i < 3; i++) {
      const cx = 160 + i * 240;
      const unlocked = save.unlocked >= (i + 1);
      drawButton(ctx, cx, 220, 180, 70, names[i], unlocked, highlightedIndex === i);
      let sub;
      if (!unlocked) sub = '🔒 未解锁';
      else if (save.bestTimes[i] == null) sub = '未通关';
      else sub = `★ ${save.bestTimes[i].toFixed(1)}s`;
      drawCenteredText(ctx, sub, 280, 16, unlocked ? '#6b3a5b' : '#888');
      // Adjust: this draws center of screen — fix with explicit position
    }
    // sub text fix: redraw with per-column x
    ctx.font = '14px "Comic Sans MS", "PingFang SC", sans-serif';
    ctx.fillStyle = '#6b3a5b';
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const cx = 160 + i * 240;
      const unlocked = save.unlocked >= (i + 1);
      let sub;
      if (!unlocked) sub = '🔒 未解锁';
      else if (save.bestTimes[i] == null) sub = '未通关';
      else sub = `★ ${save.bestTimes[i].toFixed(1)}s`;
      ctx.fillStyle = unlocked ? '#6b3a5b' : '#888';
      ctx.fillText(sub, cx, 280);
    }

    drawButton(ctx, W/2, 400, 200, 48, '返回主菜单', true, highlightedIndex === 3);
  }

  function selectButtonHitTest(mx, my, save) {
    for (let i = 0; i < 3; i++) {
      const cx = 160 + i * 240;
      if (Math.abs(mx - cx) < 90 && Math.abs(my - 220) < 35) {
        if (save.unlocked >= (i + 1)) return i;
        return -1;
      }
    }
    if (Math.abs(mx - W/2) < 100 && Math.abs(my - 400) < 24) return 3;
    return -1;
  }

  function drawHUD(ctx, level, hearts, lives, elapsedSec, player, levelN, audioOn) {
    // Semi-transparent backdrop
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(8, 8, W - 16, 32);
    ctx.strokeStyle = '#ffb3d1';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, W - 16, 32);

    ctx.fillStyle = '#b03060';
    ctx.font = 'bold 16px "Comic Sans MS", "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
    const ss = String(Math.floor(elapsedSec % 60)).padStart(2, '0');
    ctx.fillText(`关卡: ${levelN}/3   爱心: ${hearts}   生命: ${lives}   时间: ${mm}:${ss}`, 20, 24);

    ctx.textAlign = 'right';
    let rightX = W - 20;
    if (!audioOn) { ctx.fillText('🔇', rightX, 24); rightX -= 24; }
    if (player.shield) { ctx.fillText('💗护盾', rightX, 24); rightX -= 80; }
    if (player.jumpBootMs > 0) {
      const s = (player.jumpBootMs / 1000).toFixed(1);
      ctx.fillText(`👟${s}s`, rightX, 24);
    }
  }

  function drawOverlay(ctx, title, lines, buttons, highlightedIndex) {
    ctx.fillStyle = 'rgba(255, 192, 220, 0.55)';
    ctx.fillRect(0, 0, W, H);

    const cardW = 440, cardH = 260;
    const cx = W / 2, cy = H / 2;
    ctx.fillStyle = '#fff';
    ctx.fillRect(cx - cardW/2, cy - cardH/2, cardW, cardH);
    ctx.strokeStyle = '#ff7eb9';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - cardW/2, cy - cardH/2, cardW, cardH);

    drawCenteredText(ctx, title, cy - 80, 28, '#d6336c', true);
    for (let i = 0; i < lines.length; i++) {
      drawCenteredText(ctx, lines[i], cy - 30 + i * 22, 16, '#6b3a5b');
    }
    const btnTotalW = buttons.length * 130 + (buttons.length - 1) * 10;
    let bx = cx - btnTotalW / 2 + 65;
    for (let i = 0; i < buttons.length; i++) {
      drawButton(ctx, bx, cy + 70, 120, 40, buttons[i], true, highlightedIndex === i);
      bx += 130 + 10;
    }
  }

  function overlayButtonHitTest(mx, my, buttons) {
    const cx = W / 2, cy = H / 2;
    const btnTotalW = buttons.length * 130 + (buttons.length - 1) * 10;
    let bx = cx - btnTotalW / 2 + 65;
    for (let i = 0; i < buttons.length; i++) {
      if (Math.abs(mx - bx) < 60 && Math.abs(my - (cy + 70)) < 20) return i;
      bx += 130 + 10;
    }
    return -1;
  }

  function drawPaused(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, W, H);
    drawCenteredText(ctx, '已暂停', H/2 - 20, 40, '#fff', true);
    drawCenteredText(ctx, '按 Esc 或 P 继续', H/2 + 30, 18, '#fff');
  }

  const API = { drawMenu, menuButtonHitTest, drawSelect, selectButtonHitTest,
                drawHUD, drawOverlay, overlayButtonHitTest, drawPaused };
  if (typeof module !== 'undefined') module.exports = API;
  else global.UI = API;
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 2: 提交**

```bash
git add ui.js
git commit -m "feat: add UI module for menu/select/HUD/overlays"
```

（UI 的手工验收等到 Task 13 游戏整合后再做。）

---

## Task 12: 重写 game.js — 主循环 + 状态机骨架

**Files:**
- Modify: `game.js`（完全重写）

本任务只建骨架，让菜单/选关能显示；PLAYING 分支内部逻辑在 Task 13 填充。

- [ ] **Step 1: 用下面的内容完全替换 `game.js`**

```js
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

  // Audio init (lazy, resume on first input)
  const audioCtx = (window.AudioContext || window.webkitAudioContext)
    ? new (window.AudioContext || window.webkitAudioContext)() : null;
  const audio = Audio.init(audioCtx);

  // localStorage may throw in privacy mode
  let storage = null;
  try { storage = window.localStorage; } catch (_) {}

  const state = {
    mode: 'MENU',            // MENU | SELECT | PLAYING | PAUSED | WIN | LOSE
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
    highlightIndex: 0,       // for keyboard menu navigation
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
```

- [ ] **Step 2: 临时更新 `index.html` 以便能跑起来（完整更新在 Task 14）**

用下面内容替换 `index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Jenny 的冒险</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <div class="game-wrap">
    <canvas id="game" width="800" height="480"></canvas>
    <div class="controls">
      <p><strong>操作：</strong> ← → 或 A D 移动，↑ 或 W 或 空格 跳跃，Esc/P 暂停，M 静音，R 重开</p>
    </div>
  </div>
  <script src="storage.js"></script>
  <script src="audio.js"></script>
  <script src="fx.js"></script>
  <script src="entities.js"></script>
  <script src="levels.js"></script>
  <script src="ui.js"></script>
  <script src="game.js"></script>
</body>
</html>
```

- [ ] **Step 3: 手工验证**

在浏览器打开 `index.html`：
- 应看到主菜单界面：粉色背景、标题、两个按钮、"累计爱心: 0   最高解锁: 第 1 关"
- 点击"开始游戏" → 看到纯蓝色屏幕 + HUD（PLAYING 渲染还没实现，这是预期的）
- 不应有 JS 错误（按 F12 检查控制台）

如果控制台有错，对照错误信息修复（通常是模块未加载顺序问题）。

- [ ] **Step 4: 提交**

```bash
git add game.js index.html
git commit -m "feat: rewrite game.js as state machine, wire up new scripts"
```

---

## Task 13: 填充 PLAYING 分支 — update + world render

**Files:**
- Modify: `game.js`

本任务把 Task 12 里的两个空函数 `updatePlaying(dt)` 和 `renderWorld()` 填满，包括物理、敌人、道具、粒子、屏震、胜利判定、渲染。

- [ ] **Step 1: 实现 `updatePlaying(dt)`**

用下面这个函数替换 `game.js` 中的 `updatePlaying`：

```js
function updatePlaying(dt) {
  const lvl = state.level;
  const p = state.player;
  state.elapsedSec = (performance.now() - state.startTime) / 1000;

  // Input
  const left  = keys['arrowleft']  || keys['a'];
  const right = keys['arrowright'] || keys['d'];
  const jump  = keys['arrowup']    || keys['w'] || keys[' '];
  if (keyJustPressed['escape'] || keyJustPressed['p']) { state.mode = 'PAUSED'; return; }
  if (keyJustPressed['m']) { audio.setEnabled(!audio._enabled); audio._enabled = !audio._enabled; }
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
    // Dust burst
    FX.spawnBurst(state.particles, p.x + p.w/2, p.y + p.h, 3, '#eee', { size: 2, speed: 1.5, life: 0.3 });
  }

  p.vy += GRAVITY;
  if (p.vy > 18) p.vy = 18;

  // Horizontal collision
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

  // Vertical collision
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
    // Landing dust
    FX.spawnBurst(state.particles, p.x + p.w/2, p.y + p.h, 3, '#eee', { size: 2, speed: 1.2, life: 0.3 });
  }

  if (Math.abs(p.vx) > 0.5 && p.onGround) p.walkAnim += Math.abs(p.vx) * 0.15;

  Entities.tickJumpBoot(p, dt);

  if (p.y > H + 100) { loseLife('Jenny 掉下去啦…'); return; }

  // Enemies update
  for (const e of lvl.enemies) {
    if (!e.alive) { if (e.squashTimer > 0) e.squashTimer--; continue; }
    if (e.type === 'slime') Entities.updateSlime(e);
    else if (e.type === 'bee') Entities.updateBee(e, dt);
    else if (e.type === 'dasher') Entities.updateDasher(e, dt, p);
  }

  // Enemy collisions
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
        FX.spawnBurst(state.particles, e.x + e.w/2, e.y + e.h/2, 8, color);
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

  // Hearts
  for (const h of lvl.hearts) {
    if (h.taken) continue;
    const hb = { x: h.x - 10, y: h.y - 10, w: 20, h: 20 };
    if (rectsOverlap(p, hb)) {
      h.taken = true;
      state.hearts += 1;
      state.save.totalHearts += 1;
      audio.heart();
      FX.spawnBurst(state.particles, h.x, h.y, 6, '#ff3d7f', { size: 3, speed: 2.5, life: 0.6 });
      throttledSave();
    }
  }

  // Pickups
  for (const item of lvl.pickups) {
    if (item.taken) continue;
    const ib = { x: item.x - 14, y: item.y - 14, w: 28, h: 28 };
    if (rectsOverlap(p, ib)) {
      item.taken = true;
      if (item.type === 'shield') { Entities.applyShield(p); audio.heart(); }
      else if (item.type === 'jumpboot') { Entities.applyJumpBoot(p); audio.heart(); }
      FX.spawnBurst(state.particles, item.x, item.y, 8, '#fff', { size: 3, speed: 3, life: 0.5 });
    }
  }

  // Flag (win)
  const fb = { x: lvl.flag.x, y: lvl.flag.y, w: 16, h: 160 };
  if (rectsOverlap(p, fb)) { winLevel(); return; }

  if (p.invuln > 0) p.invuln--;

  // Camera
  state.cameraX = p.x - W / 2 + p.w / 2;
  state.cameraX = Math.max(0, Math.min(lvl.width - W, state.cameraX));

  // FX updates
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
```

并在 `game.js` 中 `audio = Audio.init(audioCtx)` 后面加一行：

```js
audio._enabled = true;
```

让 `M` 键能切换（`audio.setEnabled` 已存在，但 game.js 要记录当前开关状态用于 HUD 显示）。

- [ ] **Step 2: 实现 `renderWorld()`**

用下面这个函数替换 `game.js` 里的 `renderWorld`：

```js
function renderWorld() {
  const lvl = state.level;
  const off = FX.shakeOffset(state.shake);

  // Theme-colored sky
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

  // Parallax clouds / moon
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

  // Parallax hills (skip for castle)
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
```

- [ ] **Step 3: 把旧 `game.js` 的所有 `drawXxx` 纯绘制函数复制到新 `game.js` 中**

具体需要从**旧版 game.js**（`git show 3feba1e:game.js`）中复制的函数：
- `cloudPuff(x, y, s)` — 行 328-335
- `drawFlowers()` — 行 395-411（改为使用 `state.level.flowers` 而不是旧全局）
- `drawPlatforms()` — 行 354-393（改为使用 `state.level.platforms`、`state.cameraX`；城堡主题下把砖块颜色改成紫色、把草地改成石板灰）
- `drawHearts()` — 行 413-421（使用 `state.level.hearts`、`state.cameraX`）
- `drawHeart(cx, cy, size, color)` — 行 423-437
- `drawEnemies()` — 行 439-480（**扩展**：根据 `e.type` 分别画 slime / bee / dasher）
- `drawFlag()` — 行 482-502（根据 `state.level.theme === 'castle'` 画城堡门，其他画粉旗）
- `drawPlayer()` — 行 504-603（使用 `state.player` 和 `state.cameraX`；当 `player.shield` 为 true 时在头顶画粉色光环）

**Bee 绘制（drawEnemies 扩展部分）：**

```js
// Bee
if (e.type === 'bee') {
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.ellipse(x + e.w/2, e.y + e.h/2, e.w/2, e.h/2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Stripes
  ctx.fillStyle = '#222';
  ctx.fillRect(x + 6,  e.y + 8, 4, e.h - 12);
  ctx.fillRect(x + 16, e.y + 8, 4, e.h - 12);
  // Wings
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(x + 4,    e.y - 2, 7, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(x + e.w - 4, e.y - 2, 7, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(x + e.w/2 - 4, e.y + 6, 2, 2);
  ctx.fillRect(x + e.w/2 + 2, e.y + 6, 2, 2);
  continue;
}
```

**Dasher 绘制：**

```js
if (e.type === 'dasher') {
  const charging = e.state === 'CHARGING';
  ctx.fillStyle = charging ? '#8b2a99' : '#a05cc8';
  ctx.fillRect(x, e.y, e.w, e.h);
  // Horns
  ctx.fillStyle = '#4a1c66';
  ctx.beginPath();
  ctx.moveTo(x + 4, e.y);     ctx.lineTo(x + 8,  e.y - 8); ctx.lineTo(x + 12, e.y); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 20, e.y);    ctx.lineTo(x + 24, e.y - 8); ctx.lineTo(x + 28, e.y); ctx.fill();
  // Eyes — red when charging
  ctx.fillStyle = charging ? '#ff2030' : '#fff';
  ctx.fillRect(x + 8,  e.y + 12, 4, 4);
  ctx.fillRect(x + 20, e.y + 12, 4, 4);
  // Fangs
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 10, e.y + 24, 3, 5);
  ctx.fillRect(x + 19, e.y + 24, 3, 5);
  continue;
}
```

**Pickups 绘制函数（新增到 game.js）：**

```js
function drawPickups() {
  for (const item of state.level.pickups) {
    if (item.taken) continue;
    const x = item.x - state.cameraX;
    if (x < -30 || x > W + 30) continue;
    const wob = Math.sin(performance.now() / 300 + item.x) * 2;
    if (item.type === 'shield') {
      // Pink glowing heart with ring
      ctx.strokeStyle = 'rgba(255, 100, 180, 0.7)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, item.y + wob, 14, 0, Math.PI * 2); ctx.stroke();
      drawHeart(x, item.y + wob, 10, '#ff3d7f');
    } else if (item.type === 'jumpboot') {
      // Yellow boot icon
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x - 10, item.y + wob - 6, 20, 10);
      ctx.fillRect(x + 4,  item.y + wob - 12, 10, 8);
      ctx.fillStyle = '#c49a20';
      ctx.fillRect(x - 10, item.y + wob + 3, 20, 2);
    }
  }
}
```

**Player shield 光环（加在 drawPlayer 最后 `ctx.restore()` 之前）：**

```js
if (state.player.shield) {
  ctx.strokeStyle = 'rgba(255, 100, 180, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(13, 8 + bob, 14, 0, Math.PI * 2);
  ctx.stroke();
}
```

**Castle flag 替代（城堡门）：**

替换 `drawFlag`：

```js
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
    ctx.fillStyle = '#ffd166';
    drawHeart(x + 10, f.y + 70, 12, '#ff3d7f');
    return;
  }
  // Original pink flag
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
```

- [ ] **Step 4: 手工验收**

刷新浏览器：
1. 主菜单 → 开始游戏 → Jenny 应出现在草原，能移动跳跃
2. 踩史莱姆 → 绿色粒子 + 弹起 + 有音效
3. 吃爱心 → 粉色粒子 + 计数 + 有音效
4. 掉下洞 → 屏幕震动 + 红色闪烁 + 生命 -1
5. 到达旗帜 → 通关画面 + 金色闪烁
6. 通关后点"下一关" → 第 2 关（森林）
7. 第 2 关能看到蜜蜂，从下撞会被消耗护盾 / 掉血，从上踩会死
8. 第 3 关能看到紫色城堡门、冲刺魔王、跳跃鞋

- [ ] **Step 5: 提交**

```bash
git add game.js
git commit -m "feat: implement PLAYING update and world rendering"
```

---

## Task 14: PAUSED / 键盘菜单导航 / 音效开关 补全

**Files:**
- Modify: `game.js`

- [ ] **Step 1: 在 `loop` 函数之前新增菜单键盘导航函数**

```js
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
```

- [ ] **Step 2: 在 `loop` 函数里调用 handleMenuKeys**

修改 `loop`：

```js
function loop(now) {
  const dt = Math.min(0.05, (now - state.lastFrameMs) / 1000);
  state.lastFrameMs = now;
  handleMenuKeys();
  if (state.mode === 'PLAYING') updatePlaying(dt);
  render();
  keyJustPressed = {};
  requestAnimationFrame(loop);
}
```

- [ ] **Step 3: 手工验收**

1. 主菜单 → ↑↓ 切换按钮高亮 → Enter 开始
2. 选关 → ←→ 切换按钮高亮 → Enter 进入；Esc 返回主菜单
3. 游戏中 → Esc 暂停 → 画面变暗 + "已暂停" → 再按 Esc 继续
4. M 键切换音效，HUD 右上出现 🔇 图标

- [ ] **Step 4: 提交**

```bash
git add game.js
git commit -m "feat: add pause, keyboard menu navigation, and audio toggle"
```

---

## Task 15: 整体手工验收 + README 提示

**Files:**
- Modify: `index.html`（更新 controls 说明）

- [ ] **Step 1: 更新 index.html 的操作说明**

把 `<div class="controls">` 替换成：

```html
<div class="controls">
  <p><strong>操作：</strong> ← → 或 A D 移动 · ↑ / W / 空格 跳跃 · Esc/P 暂停 · M 静音 · R 重开当前关</p>
  <p>收集 💖 · 踩扁 👾🐝👹 · 拿 💗 护盾抵挡一次伤害 · 拿 👟 跳跃鞋跳更高 · 到达终点通关</p>
</div>
```

- [ ] **Step 2: 运行完整手工验收清单**

按 spec 的清单逐条跑：
1. ✅ 主菜单 → 选关 → 第 1 关 → 通关 → 第 2 关 → 通关 → 第 3 关 → 通关 → 全胜画面
2. ✅ 第 1 关吃护盾 → 撞史莱姆 → 护盾消耗，未掉血
3. ✅ 第 2 关蜜蜂从下方撞 → 掉血（或消耗护盾）；从上方踩 → 击杀
4. ✅ 第 3 关冲刺魔王 → 进入 200px → 红眼加速
5. ✅ 第 3 关跳跃鞋 → 跳得更高 → 10 秒后失效
6. ✅ 死亡 3 次 → 死亡画面 → 重开当前关
7. ✅ 刷新页面 → 主菜单显示已解锁第 N 关、累计爱心、最佳时间
8. ✅ 按 M → 音效切换；按 Esc → 暂停；按 R → 重开

如果某条不通过，修复对应 Task 的代码后重跑。

- [ ] **Step 3: 运行自动化测试确认没回归**

Run: `npm test`
Expected: all tests pass

- [ ] **Step 4: 提交 + 推送**

```bash
git add index.html
git commit -m "chore: update controls help text for stage 2 features"
git push -u origin claude/girl-mario-web-game-chy35
```

---

## 自检（Self-Review）

### Spec 覆盖对照

| Spec 项 | Task |
|---|---|
| storage 模块（含版本检查、错误容忍）| Task 1 |
| Web Audio 音效 5 种 | Task 2 |
| 粒子 / 屏震 / 闪烁 | Task 3 |
| Player / Slime / Heart 抽离 | Task 4 |
| Bee 飞行蜜蜂（正弦轨迹）| Task 5 |
| Dasher 冲刺魔王（PATROL/CHARGING/COOLDOWN）| Task 6 |
| Shield 护盾 + JumpBoot 跳跃鞋 | Task 7 |
| Level 1（草原）| Task 8 |
| Level 2（森林）| Task 9 |
| Level 3（城堡）| Task 10 |
| 菜单 / 选关 / HUD / overlay UI | Task 11 |
| 状态机骨架 MENU/SELECT/PLAYING/PAUSED/WIN/LOSE | Task 12 |
| PLAYING 物理 + 敌人 + 粒子 + 屏震 + 胜利判定 | Task 13 |
| 暂停 / 键盘菜单导航 / 音效开关 | Task 14 |
| 手工验收 + 操作提示更新 | Task 15 |

所有 spec 项已覆盖。

### 类型/命名一致性

- Player 属性 `shield`、`jumpBootMs` — 在 Task 4/7 定义，在 Task 13/14 使用，一致 ✅
- Enemy `type` 字段值 `'slime' | 'bee' | 'dasher'` — 在 Task 4/5/6 定义，在 Task 13 `updatePlaying` 的 switch 中使用，一致 ✅
- Pickup `type` 字段值 `'shield' | 'jumpboot'` — 在 Task 7 定义，在 Task 13 中使用，一致 ✅
- `Entities.consumeShield` 返回 bool — 在 Task 7 定义，在 Task 13 按 bool 使用 ✅
- Save 结构 `{ version, unlocked, totalHearts, bestTimes }` — 在 Task 1 定义，在 Task 11（UI）、Task 13（winLevel）中使用，一致 ✅
- FX API `makeShake/tickShake/shakeOffset` + `makeFlash/tickFlash/drawFlash` — 在 Task 3 定义，在 Task 13 使用，一致 ✅

### 占位符扫描

无 TBD / TODO / 未填代码块。每个步骤都带完整代码或命令。

---

## Execution Handoff

计划完成，已提交到 `docs/superpowers/plans/2026-04-18-stage2-optimization.md`。

两种执行方式：

**1. Subagent-Driven（推荐）** — 每个 Task 派一个全新 subagent 实现 + 两阶段 code review
**2. Inline Execution** — 本会话中用 executing-plans skill 按任务批量执行，关键节点停下让你检查

你选哪种？
