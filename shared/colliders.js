/* Đô Thị Ảo — shared/colliders.js
   Single source of truth for map collision data, shared by client (browser)
   and server (Node). BUILDINGS is copied EXACTLY from src/main.js (M0).
   NO Node-only code in this file: it must load via <script> in the browser
   and via require() in Node. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Colliders = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAP_W = 3200, MAP_H = 3200;
  var ROAD_BANDS = [760, 1560, 2360]; // roads start at these x/y, width 120

  function inRoad(x, y) {
    for (var i = 0; i < ROAD_BANDS.length; i++) {
      if (x >= ROAD_BANDS[i] && x <= ROAD_BANDS[i] + 120) return true;
      if (y >= ROAD_BANDS[i] && y <= ROAD_BANDS[i] + 120) return true;
    }
    return false;
  }

  // Copied EXACTLY from src/main.js BUILDINGS (id/name/x/y/w/h + colors).
  var BUILDINGS = [
    { id: 'bank',      name: 'Ngân Hàng & ATM',        x: 950,  y: 950,  w: 300, h: 220, color: 0x2e6db4, roof: 0x1d4e89 },
    { id: 'shop',      name: 'Cửa Hàng Tiện Lợi 24/7', x: 1780, y: 950,  w: 300, h: 220, color: 0xe67e22, roof: 0xb95c0e },
    { id: 'hospital',  name: 'Bệnh Viện',              x: 2560, y: 950,  w: 380, h: 280, color: 0xecf0f1, roof: 0xc0392b },
    { id: 'showroom',  name: 'Showroom Xe Máy',        x: 950,  y: 1780, w: 320, h: 240, color: 0x8e44ad, roof: 0x6c3483 },
    { id: 'motel',     name: 'Khu Nhà Trọ',            x: 1780, y: 1780, w: 320, h: 260, color: 0x16a085, roof: 0x0e6b5c },
    { id: 'warehouse', name: 'Kho Hàng Trung Tâm',     x: 2560, y: 1780, w: 420, h: 320, color: 0x7f8c8d, roof: 0x5d6d7e },
    { id: 'house1',    name: 'Nhà Dân',                x: 120,  y: 120,  w: 260, h: 200, color: 0xf1c40f, roof: 0xd4ac0d },
    { id: 'house2',    name: 'Chung Cư',               x: 950,  y: 120,  w: 320, h: 220, color: 0xecf0f1, roof: 0x95a5a6 },
    { id: 'house3',    name: 'Nhà Dân',                x: 1780, y: 120,  w: 260, h: 200, color: 0xf39c12, roof: 0xca6f1e },
    { id: 'house4',    name: 'Chung Cư',               x: 2560, y: 120,  w: 320, h: 220, color: 0xaed6f1, roof: 0x5dade2 },
    { id: 'house5',    name: 'Nhà Dân',                x: 120,  y: 950,  w: 260, h: 220, color: 0x82e0aa, roof: 0x229954 },
    { id: 'house6',    name: 'Nhà Dân',                x: 120,  y: 1780, w: 260, h: 240, color: 0xf5cba7, roof: 0xca6f1e },
    { id: 'house7',    name: 'Nhà Dân',                x: 120,  y: 2560, w: 280, h: 260, color: 0xd2b4de, roof: 0x7d3c98 },
    { id: 'house8',    name: 'Chung Cư',               x: 950,  y: 2560, w: 340, h: 260, color: 0xfadbd8, roof: 0xcd6159 },
    { id: 'house9',    name: 'Nhà Dân',                x: 1780, y: 2560, w: 280, h: 260, color: 0xa9cce3, roof: 0x2e86c1 },
    { id: 'market',    name: 'Chợ',                    x: 2560, y: 2560, w: 420, h: 300, color: 0xf9e79f, roof: 0xb7950b }
  ];

  // Player hitbox is 32x32 (SRS §7.3); r = half-size used by callers (16).
  function hitBuilding(x, y, r) {
    for (var i = 0; i < BUILDINGS.length; i++) {
      var b = BUILDINGS[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  function isOpenPoint(x, y) {
    if (x < 40 || y < 40 || x > MAP_W - 40 || y > MAP_H - 40) return false;
    if (inRoad(x, y)) return false;
    if (hitBuilding(x, y, 24)) return false;
    if (x > 1380 && x < 1820 && y > 1380 && y < 1820) return false; // plaza / fountain
    return true;
  }

  // randFn: () => [0,1). Defaults to Math.random. Tries 60 points, falls back
  // to a fixed open point near spawn so callers always get a usable point.
  function randomOpenPoint(randFn) {
    var rnd = randFn || Math.random;
    for (var i = 0; i < 60; i++) {
      var x = 60 + rnd() * (MAP_W - 120), y = 60 + rnd() * (MAP_H - 120);
      if (isOpenPoint(x, y)) return { x: x, y: y };
    }
    return { x: 1600, y: 2000 };
  }

  return {
    MAP_W: MAP_W, MAP_H: MAP_H, ROAD_BANDS: ROAD_BANDS, BUILDINGS: BUILDINGS,
    inRoad: inRoad, hitBuilding: hitBuilding, isOpenPoint: isOpenPoint,
    randomOpenPoint: randomOpenPoint
  };
});
