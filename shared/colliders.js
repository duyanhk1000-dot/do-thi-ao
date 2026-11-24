/* Cuộc Sống Ảo — shared/colliders.js
   Single source of truth for map collision data, shared by client (browser)
   and server (Node). Map v2 (2026-11-25, assets/v3/MAP_V3_DESIGN.md):
   4800x4800, roads 180px wide at 1140/2340/3540 with 40px sidewalks,
   22 buildings, central plaza (2070,2070,660,660) with a blocking fountain
   circle r=90, spawn (2400,2625), and 2 fenced flower gardens whose
   perimeters block movement EXCEPT at the listed corner gaps (future
   Shipper / thief missions use the gaps — never fence them shut).
   NO Node-only code in this file: it must load via <script> in the browser
   and via require() in Node. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Colliders = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MAP_W = 4800, MAP_H = 4800;
  var ROAD_BANDS = [1140, 2340, 3540]; // roads start at these x/y, width 180
  var ROAD_W = 180, SIDEWALK_W = 40;

  var PLAZA = { x: 2070, y: 2070, w: 660, h: 660 }; // Quảng Trường Trung Tâm
  var FOUNTAIN = { x: 2400, y: 2400, r: 90 };       // blocking circle, not a rect
  var SPAWN = { x: 2400, y: 2625 };                  // plaza south edge
  var GUIDE_POS = { x: 2400, y: 2520 };              // NPC Hướng Dẫn (clear of fountain)

  function inRoad(x, y) {
    for (var i = 0; i < ROAD_BANDS.length; i++) {
      if (x >= ROAD_BANDS[i] && x <= ROAD_BANDS[i] + ROAD_W) return true;
      if (y >= ROAD_BANDS[i] && y <= ROAD_BANDS[i] + ROAD_W) return true;
    }
    return false;
  }

  // Map v2 §3: 7 original POIs kept (v2.1 coords x1.5) + police / school /
  // cafe / pavilion / market / 3 extra houses. Sprite column is in
  // src/main.js BUILDING_TEX (roof crops for bank/shop/showroom/house-b/c).
  var BUILDINGS = [
    { id: 'bank',      name: 'Ngân Hàng & ATM',        x: 1425, y: 1425, w: 450, h: 330, color: 0x2e6db4, roof: 0x1d4e89 },
    { id: 'shop',      name: 'Cửa Hàng Tiện Lợi 24/7', x: 2670, y: 1425, w: 450, h: 330, color: 0xe67e22, roof: 0xb95c0e },
    { id: 'hospital',  name: 'Bệnh Viện',              x: 3840, y: 1425, w: 570, h: 420, color: 0xecf0f1, roof: 0xc0392b },
    { id: 'showroom',  name: 'Showroom Xe Máy',        x: 1425, y: 2670, w: 480, h: 360, color: 0x8e44ad, roof: 0x6c3483 },
    { id: 'motel',     name: 'Khu Nhà Trọ',            x: 2670, y: 2670, w: 480, h: 390, color: 0x16a085, roof: 0x0e6b5c },
    { id: 'warehouse', name: 'Kho Hàng Trung Tâm',     x: 3840, y: 2670, w: 630, h: 480, color: 0x7f8c8d, roof: 0x5d6d7e },
    { id: 'house1',    name: 'Nhà Dân',                x: 180,  y: 180,  w: 390, h: 300, color: 0xf1c40f, roof: 0xd4ac0d },
    { id: 'house2',    name: 'Chung Cư',               x: 1425, y: 180,  w: 480, h: 330, color: 0xecf0f1, roof: 0x95a5a6 },
    { id: 'house3',    name: 'Nhà Dân',                x: 2670, y: 180,  w: 390, h: 300, color: 0xf39c12, roof: 0xca6f1e },
    { id: 'house4',    name: 'Chung Cư',               x: 3840, y: 180,  w: 480, h: 330, color: 0xaed6f1, roof: 0x5dade2 },
    { id: 'house5',    name: 'Nhà Dân',                x: 180,  y: 1425, w: 390, h: 330, color: 0x82e0aa, roof: 0x229954 },
    { id: 'house6',    name: 'Nhà Dân',                x: 180,  y: 2670, w: 390, h: 360, color: 0xf5cba7, roof: 0xca6f1e },
    { id: 'house7',    name: 'Nhà Dân',                x: 180,  y: 3840, w: 420, h: 390, color: 0xd2b4de, roof: 0x7d3c98 },
    { id: 'house8',    name: 'Chung Cư',               x: 1425, y: 3840, w: 510, h: 390, color: 0xfadbd8, roof: 0xcd6159 },
    { id: 'house9',    name: 'Nhà Dân',                x: 2670, y: 3840, w: 420, h: 390, color: 0xa9cce3, roof: 0x2e86c1 },
    { id: 'market',    name: 'Chợ',                    x: 3840, y: 3840, w: 630, h: 450, color: 0xf9e79f, roof: 0xb7950b },
    { id: 'police',    name: 'Đồn Công An',            x: 3720, y: 600,  w: 480, h: 360, color: 0x2c3e50, roof: 0x1a252f },
    { id: 'school',    name: 'Trường Học',             x: 900,  y: 4200, w: 600, h: 420, color: 0xf5b7b1, roof: 0xec7063 },
    { id: 'cafe',      name: 'Quán Cà Phê',            x: 2520, y: 4200, w: 360, h: 300, color: 0xa67c52, roof: 0x6e4b2a },
    { id: 'pavilion',  name: 'Nhà Vọng Cảnh',          x: 3600, y: 600,  w: 300, h: 300, color: 0x7dcea0, roof: 0x2e86c1 },
    { id: 'house10',   name: 'Nhà Dân',                x: 4200, y: 1425, w: 390, h: 300, color: 0xf1c40f, roof: 0xd4ac0d },
    { id: 'house11',   name: 'Nhà Dân',                x: 4200, y: 2670, w: 390, h: 300, color: 0x82e0aa, roof: 0x229954 },
    { id: 'house12',   name: 'Chung Cư',               x: 1500, y: 4200, w: 480, h: 360, color: 0xaed6f1, roof: 0x5dade2 }
  ];

  // Map v2 §4: garden fences, 12px thick, blocking EXCEPT at the corner
  // gaps. Garden A (600,2400,600,420): gaps NW (600-680, 2400-2480) and SE
  // (1120-1200, 2740-2820). Garden B (3000,600,600,420): gaps NE
  // (3420-3600, 600-680) and SW (3000-3080, 940-1020). The gaps are the
  // shortcuts for future missions — the rects below deliberately STOP
  // short of them; do not "complete" the perimeter.
  var FENCES = [
    // Garden A
    { id: 'A-north', x: 680,  y: 2400, w: 520, h: 12 },
    { id: 'A-south', x: 600,  y: 2808, w: 520, h: 12 },
    { id: 'A-west',  x: 600,  y: 2480, w: 12,  h: 340 },
    { id: 'A-east',  x: 1188, y: 2400, w: 12,  h: 340 },
    // Garden B
    { id: 'B-north', x: 3000, y: 600,  w: 420, h: 12 },
    { id: 'B-south', x: 3080, y: 1008, w: 520, h: 12 },
    { id: 'B-west',  x: 3000, y: 600,  w: 12,  h: 340 },
    { id: 'B-east',  x: 3588, y: 680,  w: 12,  h: 340 }
  ];
  var GARDENS = [
    { id: 'A', x: 600,  y: 2400, w: 600, h: 420,
      entries: [{ x: 600, y: 2400, w: 80, h: 80 }, { x: 1120, y: 2740, w: 80, h: 80 }] },
    { id: 'B', x: 3000, y: 600,  w: 600, h: 420,
      entries: [{ x: 3420, y: 600, w: 180, h: 80 }, { x: 3000, y: 940, w: 80, h: 80 }] }
  ];
  // Map v2 §7: animal spawns (visual only for now — no gameplay yet).
  var ANIMALS = {
    dogs: [{ x: 900, y: 3000 }, { x: 3300, y: 1500 }],
    cats: [{ x: 1500, y: 900 }, { x: 4000, y: 3000 }]
  };

  // Player hitbox is 32x32 (SRS §7.3); r = half-size used by callers (16).
  function hitBuilding(x, y, r) {
    for (var i = 0; i < BUILDINGS.length; i++) {
      var b = BUILDINGS[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }

  function hitFence(x, y, r) {
    for (var i = 0; i < FENCES.length; i++) {
      var f = FENCES[i];
      if (x + r > f.x && x - r < f.x + f.w && y + r > f.y && y - r < f.y + f.h) return true;
    }
    return false;
  }

  function inFountain(x, y, r) {
    var dx = x - FOUNTAIN.x, dy = y - FOUNTAIN.y;
    return dx * dx + dy * dy < (FOUNTAIN.r + (r || 0)) * (FOUNTAIN.r + (r || 0));
  }

  function inPlaza(x, y) {
    return x >= PLAZA.x && x <= PLAZA.x + PLAZA.w && y >= PLAZA.y && y <= PLAZA.y + PLAZA.h;
  }

  // Open point for NPC walk targets / delivery points / spawns: sidewalks,
  // grass and the plaza are open; road centres, buildings, fences and the
  // fountain are not. Garden interiors ARE open (enter through the gaps).
  // Garden A's two gaps sit where the roads cross the garden's corner, so
  // the entry rects below are open even though they overlap a road band —
  // the gaps are passages, and movement (blocked()) never treats roads as
  // walls, so point-picking must agree with movement here.
  function isOpenPoint(x, y) {
    if (x < 40 || y < 40 || x > MAP_W - 40 || y > MAP_H - 40) return false;
    if (inFountain(x, y, 24)) return false;
    if (inPlaza(x, y)) return true; // paving covers the road crossing here
    for (var g = 0; g < GARDENS.length; g++) {
      var es = GARDENS[g].entries;
      for (var e = 0; e < es.length; e++) {
        if (x >= es[e].x && x <= es[e].x + es[e].w && y >= es[e].y && y <= es[e].y + es[e].h) return true;
      }
    }
    if (inRoad(x, y)) return false;
    if (hitBuilding(x, y, 24)) return false;
    if (hitFence(x, y, 24)) return false;
    return true;
  }

  // randFn: () => [0,1). Defaults to Math.random. Tries 60 points, falls back
  // to the spawn plaza so callers always get a usable point.
  function randomOpenPoint(randFn) {
    var rnd = randFn || Math.random;
    for (var i = 0; i < 60; i++) {
      var x = 60 + rnd() * (MAP_W - 120), y = 60 + rnd() * (MAP_H - 120);
      if (isOpenPoint(x, y)) return { x: x, y: y };
    }
    return { x: SPAWN.x, y: SPAWN.y };
  }

  return {
    MAP_W: MAP_W, MAP_H: MAP_H, ROAD_BANDS: ROAD_BANDS, ROAD_W: ROAD_W,
    SIDEWALK_W: SIDEWALK_W, BUILDINGS: BUILDINGS, FENCES: FENCES,
    GARDENS: GARDENS, PLAZA: PLAZA, FOUNTAIN: FOUNTAIN, SPAWN: SPAWN,
    GUIDE_POS: GUIDE_POS, ANIMALS: ANIMALS,
    inRoad: inRoad, hitBuilding: hitBuilding, hitFence: hitFence,
    inFountain: inFountain, inPlaza: inPlaza,
    isOpenPoint: isOpenPoint, randomOpenPoint: randomOpenPoint
  };
});
