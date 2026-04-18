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
