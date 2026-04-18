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
    }
    ctx.font = '14px "Comic Sans MS", "PingFang SC", sans-serif';
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
