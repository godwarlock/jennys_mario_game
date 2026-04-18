# Jenny 的冒险 · 第二阶段优化设计

**日期：** 2026-04-18
**作者：** brainstorm with godwarlock
**目标分支：** `claude/girl-mario-web-game-chy35`

## 背景

第一阶段已交付一个可玩的单关平台跳跃游戏（HTML/CSS/JS，单文件 `game.js` 约 627 行）。本阶段在不引入构建工具和外部资源的前提下，扩展为完整的三关游戏，并显著提升感官反馈。

## 范围

**包含：**

- 玩法扩展（A4）：3 个主题关卡 + 2 种新敌人 + 2 种新道具
- 感官体验（B1 + B3 + B4）：Web Audio 合成音效、粒子特效、屏幕震动/闪烁
- 流程升级（流程 C）：开始菜单 + 选关界面 + localStorage 存档（最高解锁关、累计爱心、每关最佳时间）
- 代码结构（结构 A）：单文件拆分为 6 个 `<script>` 顺序加载的文件，零构建工具

**不包含：**

- BGM 背景音乐（B2 留作后续，避免外部音频文件）
- 角色动画增强（B5 留作后续）
- Boss 战（A3 略过）
- 移动端触控（C 路径留作后续）
- ES Modules / 打包工具

## 总体架构

### 文件结构

```
index.html         入口；按顺序 <script> 加载下面文件
style.css          已有；新增菜单/选关样式
game.js            主循环 + 全局状态机（MENU / SELECT / PLAYING / PAUSED / WIN / LOSE）
levels.js          三关数据 + loadLevel(n)
entities.js        Player / Slime / Bee / Dasher / Heart / Shield / JumpBoot
audio.js           initAudio() + sfx.jump() / heart() / stomp() / hurt() / win()
fx.js              screenShake / flash / Particle 系统
ui.js              菜单、选关、HUD、overlay 渲染
storage.js         save() / load()
```

### 状态机

```
MENU ─[开始]──▶ SELECT ─[选关]──▶ PLAYING ◀──[Esc]──▶ PAUSED
                          ▲          │
                          │          ├─[死光命]──▶ LOSE ─[再玩]──▶ PLAYING(同关)
                          │          │
                          └──────[通关]──▶ WIN ─[下一关 / 选关 / 主菜单]
```

### 全局状态对象

```js
const gameState = {
  mode: 'MENU',          // MENU | SELECT | PLAYING | PAUSED | WIN | LOSE
  currentLevel: 1,       // 1..3
  player: null,          // 切换 mode 到 PLAYING 时由 loadLevel 创建
  entities: [],
  particles: [],
  camera: { x: 0 },
  level: null,           // 当前关卡对象（来自 levels.js）
  hearts: 0,             // 当前关已吃爱心
  lives: 3,
  startTime: 0,          // performance.now() 时刻；通关时计算耗时
  audioOn: true,
  save: null,            // 来自 storage.load()
};
```

### 模块依赖（无环）

```
game.js  →  levels.js, entities.js, audio.js, fx.js, ui.js, storage.js
ui.js    →  storage.js
entities → audio.js, fx.js
```

## 玩法机制

### 新敌人

| 名称 | 出现关 | 行为 | 击杀方式 |
|---|---|---|---|
| 飞行蜜蜂 🐝 | 第 2 关 | 在固定矩形区域内左右巡逻 + Y 轴 sin 波动（振幅 ±20px，周期 1.5s） | 从上方踩头 |
| 冲刺小魔王 👹 | 第 3 关 | 默认低速（1px/帧）巡逻；玩家进入 200px 内时进入 CHARGING 状态：红眼 + 加速 3x 冲刺 1.2 秒，然后 COOLDOWN 1 秒 | 从上方踩头（冲刺中也可踩） |

蜜蜂状态：单一巡逻态，无切换。
冲刺魔王状态：`PATROL → CHARGING → COOLDOWN → PATROL`。

### 新道具

| 名称 | 出现关 | 效果 | 同时持有上限 |
|---|---|---|---|
| 爱心护盾 💗 | 第 1、2 关 | 拾取后 player 头顶绘制粉色光环；被敌人撞到时消耗护盾代替掉血 | 1 |
| 跳跃鞋 👟 | 第 3 关 | 拾取后 10 秒内 `JUMP_V` 从 -13.5 → -20（速度 ×1.48，弹跳高度约 ×2.2） | 1 |

`Player.shield: bool`、`Player.jumpBootMs: number`（剩余毫秒，0 表示无）。

### 关卡参数

| | 第 1 关 草原 | 第 2 关 森林 | 第 3 关 城堡 |
|---|---|---|---|
| 宽度 | 3100px | 3600px | 4200px |
| 史莱姆 | 5 | 4 | 3 |
| 蜜蜂 | 0 | 4 | 3 |
| 冲刺魔王 | 0 | 0 | 3 |
| 爱心 | 14 | 18 | 22 |
| 护盾 | 1（中段） | 1（中段） | 0 |
| 跳跃鞋 | 0 | 0 | 1（关键大跳前） |
| 旗帜 | 粉旗 | 粉旗 | 城堡门（更大精灵） |
| 背景色调 | 蓝天浅绿 | 深绿 + 树影 | 紫灰 + 月亮 |

### 粒子系统（B3）

每个粒子结构：

```js
{ x, y, vx, vy, life, maxLife, color, size }
```

每帧：`x += vx; y += vy; vy += 0.2; life -= dt;` 当 `life <= 0` 移除。

触发：

- 吃爱心 → 6 个粉色小爱心向上 + 四散，0.6 秒淡出
- 踩史莱姆 → 8 个绿色小方块向上飞溅
- 踩蜜蜂 → 8 个黄色小方块
- 踩冲刺魔王 → 8 个紫色小方块
- 跳跃落地 → 3 个灰白小圆点向两侧

### 屏幕特效（B4）

- 受伤 → 红色半透明（rgba(255,0,0,0.4)）覆盖一帧并 0.3 秒淡出 + 屏震 amp=6 dur=0.2s
- 通关 → 金色半透明闪烁 3 次（每次 0.1 秒亮，0.1 秒暗）

屏震实现：在 `ctx.translate(camera.x + shakeX, shakeY)` 时叠加 `shakeX = (rand-0.5)*amp`，`shakeY = (rand-0.5)*amp`，按时间衰减。

### 音效（B1，纯 Web Audio 合成）

| 事件 | 波形 | 频率 | 时长 |
|---|---|---|---|
| 跳跃 | square 滑音 | 400 → 600 Hz | 0.1s |
| 吃爱心 | triangle 双音 | 800 + 1200 Hz | 0.15s |
| 踩敌人 | sawtooth | 200 → 100 Hz | 0.15s |
| 受伤 | square + noise | 150 Hz | 0.3s |
| 通关 | triangle 琶音 | C-E-G-C 上行 | 0.6s |

实现：每次播放新建 `OscillatorNode` + `GainNode` + `AudioContext.destination`，envelope 用 `gain.linearRampToValueAtTime`。

## UI 设计

### 主菜单（MENU）

```
        🌸 Jenny 的冒险 🌸

         [ 开 始 游 戏 ]
         [ 选 择 关 卡 ]

       累计爱心: 0   最高解锁: 第 1 关
```

- Canvas 内绘制
- 鼠标点击 + 键盘 ↑↓ Enter 都可操作
- "选择关卡" 按钮当 `unlocked > 1` 时启用，否则灰色

### 选关界面（SELECT）

```
     选择关卡

   [ 1.草原 ]  [ 2.森林 ]  [ 3.城堡 ]
    ★ 12.3s    ★ 18.7s     未通关

         [ 返回主菜单 ]
```

- 已通关：显示 `★ 最佳时间`
- 未通关已解锁：显示 "未通关"
- 未解锁：🔒 灰色不可点

### 游戏内 HUD

```
关卡: 1/3   爱心: 5   生命: 3   时间: 00:23   [💗护盾]
```

- 在 canvas 内绘制（不再用 HTML DOM）
- 道具 buff 在右侧显示图标（护盾常驻；跳跃鞋显示倒计时秒数）
- 时间为当前关计时（`performance.now() - startTime`），通关时与 `bestTimes[currentLevel-1]` 比较

### 通关界面（WIN）

```
        🎉 第 1 关通关！🎉

         本次时间: 00:23
         最佳时间: 00:21 ★

       [ 下一关 ]  [ 选关 ]  [ 主菜单 ]
```

- 第 3 关通关时按钮变为 `[ 再玩第 3 关 ] [ 选关 ] [ 主菜单 ]`，并显示"全部胜利！"
- 刷新最佳时间时在时间右侧加 ★

### 暂停界面（PAUSED）

半透明黑色遮罩 + "已暂停" 文字 + "按 Esc 或 P 继续"。

### 死亡界面（LOSE）

同现有：`再玩一次` 按钮 → 重开当前关。

### 输入

| 操作 | 键盘 | 鼠标 |
|---|---|---|
| 移动 | ← → / A D | — |
| 跳跃 | ↑ / W / 空格 | — |
| 重开 | R | — |
| 暂停 | Esc / P | — |
| 菜单导航 | ↑↓ Enter | 点击 |
| 音效开关 | M | — |

## 数据流

### 存档

localStorage 键 `jenny_save`：

```js
{
  version: 1,
  unlocked: 1,                     // 1..3
  totalHearts: 0,
  bestTimes: [null, null, null]    // 每关秒数；null = 未通关
}
```

调用时机：

- 启动时 `load()`，写入 `gameState.save`
- 通关时更新 `unlocked = max(unlocked, currentLevel + 1)`、若新时间更短则更新 `bestTimes[currentLevel-1]`，调 `save()`
- 吃爱心时 `totalHearts += 1`，调 `save()`（节流 1 秒）
- 死亡损失生命不写存档

### 关卡加载流程

```
loadLevel(n):
  level = LEVELS[n-1]                  // levels.js 导出的数组
  gameState.level = level
  gameState.player = makePlayer(level.spawn)
  gameState.entities = level.spawnEntities()  // 工厂函数返回新数组
  gameState.particles = []
  gameState.camera.x = 0
  gameState.hearts = 0
  gameState.startTime = performance.now()
  gameState.mode = 'PLAYING'
```

## 错误处理

- **AudioContext 自动播放限制** → 首次用户输入（按键 / 点击）后调 `audioCtx.resume()`；之前调用的音效静默
- **localStorage 不可用 / 配额满** → try/catch；失败设 `saveDisabled = true`；HUD 不显示存档信息
- **存档版本不匹配** → 忽略旧档，按新结构重置（不弹窗）
- **存档 JSON 损坏** → catch parse 错误，按未存档处理
- **canvas 上下文丢失** → 不处理（极罕见）

## 测试策略

游戏没有现成测试框架。新增 `tests/` 目录用 **Node 内置 `node:test` + `node:assert`**，零外部依赖。

| 测试文件 | 覆盖 |
|---|---|
| `tests/storage.test.js` | save/load 往返；版本不匹配重置；坏 JSON 容错；localStorage 不可用降级 |
| `tests/levels.test.js` | 三关数据合法性（所有 entity 在 [0, level.width] 内、爱心数与关卡声明一致、史莱姆/蜜蜂/魔王数量与设计表一致） |
| `tests/entities.test.js` | 蜜蜂正弦轨迹；冲刺魔王 PATROL→CHARGING→COOLDOWN 状态切换；护盾消耗逻辑；跳跃鞋倒计时归零 |
| `tests/audio.test.js` | sfx.* 调用不抛错（mock AudioContext） |

运行：`node --test tests/`

测试代码用 CommonJS 写，源文件用浏览器全局 `<script>` 暴露的对象。为复用，每个被测模块在文件末尾加：

```js
if (typeof module !== 'undefined') module.exports = { ... };
```

不自动化测试：渲染、输入、主循环、粒子（视觉效果难自动化，靠手工验收）。

### 手工验收清单

每次完成任务后跑一遍：

1. 主菜单 → 选关 → 第 1 关 → 通关 → 第 2 关 → 通关 → 第 3 关 → 通关 → 全胜画面
2. 第 1 关吃护盾 → 撞史莱姆 → 护盾消耗，未掉血
3. 第 2 关蜜蜂从下方撞 → 掉血；从上方踩 → 击杀
4. 第 3 关冲刺魔王 → 进入 200px → 红眼加速
5. 第 3 关跳跃鞋 → 跳得更高 → 10 秒后失效
6. 死亡 3 次 → 死亡画面 → 重开当前关
7. 刷新页面 → 主菜单显示已解锁第 N 关、累计爱心、最佳时间
8. 按 M → 音效切换；按 Esc → 暂停；按 R → 重开

## 部署

无需调整。GitHub Pages 直接服务静态文件。新增的 `<script>` 顺序加载即可。

## 开放问题

无（所有决策已在 brainstorm 中确认）。

## 附：与现有代码的对应关系

| 现有 | 新位置 |
|---|---|
| `game.js` GRAVITY/MOVE_ACC 等常量 | `game.js` 头部保留 |
| `game.js` `buildLevel1()` | 拆到 `levels.js` 作为 `LEVELS[0]` |
| `game.js` `makeEnemy` | 拆到 `entities.js` 重命名 `makeSlime` |
| `game.js` Player 对象 | 拆到 `entities.js` `makePlayer` |
| `game.js` 主循环 | 留在 `game.js` 但加状态机分发 |
| `index.html` `.hud` DOM | 删除；HUD 改为 canvas 绘制 |
| `index.html` `.overlay` DOM | 保留作为 LOSE 的 fallback；其他模式的 overlay 改为 canvas 绘制 |
