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

  function build(n) {
    if (n === 1) return buildLevel1();
    if (n === 2) return buildLevel2();
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
