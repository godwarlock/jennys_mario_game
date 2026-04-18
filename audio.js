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
