/* Cuộc Sống Ảo — M0 Prototype (PixiJS v8, local single-player, no server)
   PlayerState shape is kept ready for future Colyseus (see playerState below).
   All gameplay HUD is drawn on Canvas/WebGL (Pixi). No DOM overlay in M0. */
(function () {
  'use strict';

  // Map v2 (2026-11-25, assets/v3/MAP_V3_DESIGN.md): 4800x4800, roads
  // 180px at 1140/2340/3540 + 40px sidewalks. Collision data lives in
  // shared/colliders.js — the local copies below are ONLY the fallback
  // when Colliders failed to load; they must match it exactly.
  var MAP_W = 4800, MAP_H = 4800;
  var WALK_SPEED = 180, SPRINT_SPEED = 300;
  var DAY_MINUTES = 1440; // 24 real minutes = 24 game hours -> 1 game min / 1 real sec

  // ---------- seeded random (stable map every load) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  var rand = mulberry32(20261124);
  function randRange(a, b) { return a + rand() * (b - a); }
  function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }

  // ---------- map data (Map v2 — see shared/colliders.js, the source of truth) ----------
  var ROAD_BANDS = [1140, 2340, 3540]; // roads start at these x/y, width 180
  var ROAD_W = 180, SIDEWALK_W = 40;
  function inRoad(x, y) {
    if (typeof Colliders !== 'undefined' && Colliders.inRoad) return Colliders.inRoad(x, y);
    for (var i = 0; i < ROAD_BANDS.length; i++) {
      if (x >= ROAD_BANDS[i] && x <= ROAD_BANDS[i] + ROAD_W) return true;
      if (y >= ROAD_BANDS[i] && y <= ROAD_BANDS[i] + ROAD_W) return true;
    }
    return false;
  }

  var BUILDINGS = (typeof Colliders !== 'undefined' && Colliders.BUILDINGS) ? Colliders.BUILDINGS : [
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
  // NOTE: BUILDINGS above is the shared/colliders.js copy when available
  // (verified identical — 22 rects). Collision rects must NEVER change here;
  // the server is authoritative and uses the same data.

  // POI marker points (Map v2 building centres; spawn = plaza south edge).
  var POIS = [
    { id: 'spawn',     name: 'Điểm Hồi Sinh / NPC Hướng Dẫn', x: 2400, y: 2625, color: 0x2ecc71 },
    { id: 'bank',      name: 'Ngân Hàng & ATM',        x: 1650, y: 1590, color: 0x3498db },
    { id: 'shop',      name: 'Cửa Hàng Tiện Lợi 24/7', x: 2895, y: 1590, color: 0xe67e22 },
    { id: 'hospital',  name: 'Bệnh Viện',              x: 4125, y: 1635, color: 0xe74c3c },
    { id: 'showroom',  name: 'Showroom Xe Máy',        x: 1665, y: 2850, color: 0x9b59b6 },
    { id: 'motel',     name: 'Khu Nhà Trọ',            x: 2910, y: 2865, color: 0x1abc9c },
    { id: 'warehouse', name: 'Kho Hàng Trung Tâm',     x: 4155, y: 2910, color: 0x95a5a6 },
    { id: 'police',    name: 'Đồn Công An',            x: 3960, y: 780,  color: 0x2c3e50 },
    { id: 'school',    name: 'Trường Học',             x: 1200, y: 4410, color: 0xec7063 },
    { id: 'cafe',      name: 'Quán Cà Phê',            x: 2700, y: 4350, color: 0xa67c52 },
    { id: 'market',    name: 'Chợ',                    x: 4155, y: 4065, color: 0xf1c40f },
    { id: 'pavilion',  name: 'Nhà Vọng Cảnh',          x: 3750, y: 750,  color: 0x7dcea0 }
  ];

  function hitBuilding(x, y, r) {
    if (typeof Colliders !== 'undefined' && Colliders.hitBuilding) return Colliders.hitBuilding(x, y, r);
    for (var i = 0; i < BUILDINGS.length; i++) {
      var b = BUILDINGS[i];
      if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    }
    return false;
  }
  // Map v2: fences block except at the corner gaps; the fountain is a circle.
  function hitFence(x, y, r) {
    if (typeof Colliders !== 'undefined' && Colliders.hitFence) return Colliders.hitFence(x, y, r);
    return false;
  }
  function inFountain(x, y, r) {
    if (typeof Colliders !== 'undefined' && Colliders.inFountain) return Colliders.inFountain(x, y, r);
    var dx = x - 2400, dy = y - 2400;
    return dx * dx + dy * dy < (90 + (r || 0)) * (90 + (r || 0));
  }
  // One blocked() test for all movement code (player, NPCs, offline bots):
  // buildings + fences + fountain. Roads do NOT block walking.
  function blocked(x, y, r) {
    return hitBuilding(x, y, r) || hitFence(x, y, r) || inFountain(x, y, r);
  }
  function isOpenPoint(x, y) {
    if (typeof Colliders !== 'undefined' && Colliders.isOpenPoint) return Colliders.isOpenPoint(x, y);
    if (x < 40 || y < 40 || x > MAP_W - 40 || y > MAP_H - 40) return false;
    if (inFountain(x, y, 24)) return false;
    if (x >= 2070 && x <= 2730 && y >= 2070 && y <= 2730) return true; // plaza
    // garden entry gaps (Map v2 §4) stay open even where they overlap a road
    if ((x >= 600 && x <= 680 && y >= 2400 && y <= 2480) || (x >= 1120 && x <= 1200 && y >= 2740 && y <= 2820) ||
        (x >= 3420 && x <= 3600 && y >= 600 && y <= 680) || (x >= 3000 && x <= 3080 && y >= 940 && y <= 1020)) return true;
    if (inRoad(x, y)) return false;
    if (hitBuilding(x, y, 24)) return false;
    if (hitFence(x, y, 24)) return false;
    return true;
  }
  function randomOpenPoint() {
    if (typeof Colliders !== 'undefined' && Colliders.randomOpenPoint) return Colliders.randomOpenPoint();
    for (var i = 0; i < 60; i++) {
      var x = randRange(60, MAP_W - 60), y = randRange(60, MAP_H - 60);
      if (isOpenPoint(x, y)) return { x: x, y: y };
    }
    return { x: 2400, y: 2625 };
  }

  // ---------- player state (Colyseus-ready shape) ----------
  var playerState = {
    id: 'local-1', name: 'CongDan', x: 2400, y: 2625, vx: 0, vy: 0,
    anim: 'idle', job: 'unemployed', hp: 100, hunger: 100, stamina: 100,
    // M2 (SRS §4.5/§5.1): profile is created with Cash = 0. The 50.000đ
    // starter grant comes from Economy.starterGrant() — ONE transaction,
    // logged as starter_grant, never a hardcoded default.
    cash: 0, bank: 0, isFainted: false, vehicleId: null,
    // M3 (§6): active order mirrored from the server (online) or the local
    // engine in jobs.js (offline). {status, id, x, y, deadline, reward} | null.
    order: null
  };
  var worldTime = 480; // 08:00, minutes 0..1440

  // ---------- M2: zoom / camera ----------
  // M0 used clamp(W/1100, 0.35, 1) — at 390px wide that is 0.35x and the
  // character rendered ~15px tall. M1 used mobile 2.0x / desktop 1.3x — user
  // said zoom was NOT good (too close on portrait, disorienting) and text
  // overflowed its frames. M2: mobile portrait 1.6x, desktop 1.2x,
  // adjustable 1.0x–2.2x (step 0.2). Full-body sprite is 42 world px tall,
  // so on 390x844 portrait it renders ~67px tall on screen: readable, not
  // giant, map still visible around the player.
  var HUD_BIG = (typeof window !== 'undefined' && window.innerWidth < 600);
  var zoom = HUD_BIG ? 1.6 : 1.2;
  var ZOOM_MIN = 1.0, ZOOM_MAX = 2.2, ZOOM_STEP = 0.2;
  var zoomInBtn = null, zoomOutBtn = null, zoomLabel = null;
  var pinchPointers = {}, pinchActive = false, pinchStartDist = 0, pinchStartZoom = 0;

  // ---------- M1: assets (PIXI.Assets, per-file fallback to M0 Graphics) ----------
  var TEX = {}; // key -> PIXI.Texture | null
  var ASSET_FILES = {
    // Map v2 texture: ONLY the plaza ground + minimap + start backdrop.
    // NEVER stretched over the whole 4800 map (1024px would blur badly) —
    // roads / grass are drawn from the layout data in buildWorld().
    plaza: 'assets/v3/map-city-v3.png',
    // Map v2 buildings: flat-roof crops for the 3/4-front ones (FLUX cannot
    // draw a pure flat roof — bank/shop/showroom/house-b/house-c are crops),
    // full images for the already-flat ones.
    bank: 'assets/v3/building-bank-roof.png', hospital: 'assets/v3/building-hospital.png',
    warehouse: 'assets/v3/building-warehouse.png', shop: 'assets/v3/building-shop-roof.png',
    showroom: 'assets/v3/building-showroom-roof.png', motel: 'assets/v3/building-motel.png',
    police: 'assets/v3/building-police.png', market: 'assets/v3/building-market.png',
    school: 'assets/v3/building-school.png', cafe: 'assets/v3/building-cafe.png',
    pavilion: 'assets/v3/building-pavilion.png',
    houseA: 'assets/v3/house-a.png', houseB: 'assets/v3/house-b-roof.png', houseC: 'assets/v3/house-c-roof.png',
    // Map v2 props (transparent *-full.png, re-keyed in assets/v3/).
    treeA: 'assets/v3/prop-tree-a-full.png', treeB: 'assets/v3/prop-tree-b-full.png',
    bushFlower: 'assets/v3/prop-bush-flower-full.png', lamp: 'assets/v3/prop-lamp-full.png',
    bench: 'assets/v3/prop-bench-full.png', bin: 'assets/v3/prop-bin-full.png',
    box: 'assets/v3/prop-box-full.png', dog: 'assets/v3/prop-dog-full.png',
    cat: 'assets/v3/prop-cat-full.png', car: 'assets/v3/prop-car-full.png',
    motorbike: 'assets/v3/prop-motorbike-full.png',
    fenceSeg: 'assets/v3/prop-fence-segment-full.png', fenceCorner: 'assets/v3/prop-fence-corner-full.png',
    // M2: *-full.png = transparent full-body sprites for IN-WORLD characters.
    // *-crop.png (portrait crops) are ONLY for the small HUD avatar — never
    // as a moving character (user complaint M1: "sao lại là avatar hình tròn?").
    // v3 characters are high-angle overhead figures (MAP_V3_DESIGN.md §6).
    hero: 'assets/hero-citizen-crop.png', shipper: 'assets/npc-shipper-crop.png',
    bread: 'assets/npc-bread-crop.png', taxi: 'assets/npc-taxi-crop.png',
    police: 'assets/npc-police-crop.png', thug: 'assets/npc-thug-crop.png',
    student: 'assets/npc-student-crop.png',
    heroFull: 'assets/v3/hero-citizen-full.png', shipperFull: 'assets/v3/npc-shipper-full.png',
    breadFull: 'assets/v3/npc-bread-full.png', taxiFull: 'assets/v3/npc-taxi-full.png',
    policeFull: 'assets/v3/npc-police-full.png', thugFull: 'assets/v3/npc-thug-full.png',
    studentFull: 'assets/v3/npc-student-full.png'
  };
  var FULL_TEX = { hero: 'heroFull', citizen: 'heroFull', guide: 'taxiFull', shipper: 'shipperFull', bread: 'breadFull', taxi: 'taxiFull', police: 'policeFull', thug: 'thugFull', student: 'studentFull' };
  // Building sprite per id (Map v2 §6): roof crops where FLUX drew a 3/4
  // facade, full images where the building is already flat. Houses share
  // the 3 variants (a = full, b/c = roof crops).
  var POI_TEX = { bank: 'bank', hospital: 'hospital', warehouse: 'warehouse', shop: 'shop', showroom: 'showroom', motel: 'motel', police: 'police', market: 'market', school: 'school', cafe: 'cafe', pavilion: 'pavilion' };
  var HOUSE_TEX = { house1: 'houseA', house2: 'houseC', house3: 'houseA', house4: 'houseC', house5: 'houseB', house6: 'houseB', house7: 'houseA', house8: 'houseC', house9: 'houseB', house10: 'houseA', house11: 'houseB', house12: 'houseC' };
  var AVATAR_TEX = { hero: 'hero', citizen: 'hero', guide: 'hero', shipper: 'shipper', bread: 'bread', taxi: 'taxi', police: 'police', thug: 'thug', student: 'student' };
  var AVATAR_COLOR = { hero: 0x2980b9, citizen: 0x2980b9, guide: 0x27ae60, shipper: 0xf39c12, bread: 0xe67e22, taxi: 0x3498db, police: 0x2c3e50, thug: 0xc0392b, student: 0x9b59b6 };

  // ---------- M1: multiplayer / chat ----------
  var netMode = 'offline'; // 'offline' | 'online' | 'reconnecting'
  var myName = 'CongDan';
  var mySessionId = null;
  var firstSelfSync = true;
  var lastSelfBubbleText = '';
  var lastHumanCount = -1;
  var remotePlayers = {}; // id -> remote entry (humans + bots, online & offline)
  var offlineBotsSpawned = false;
  var moveSeq = 0, moveAccumMs = 0, lastMoveSentAt = 0;
  var lastInput = { dx: 0, dy: 0, sprint: false, len: 0 };
  var lastSentMove = { dx: 0, dy: 0, sprint: false, len: 0 };
  var chatChannel = 'nearby'; // default: Gần
  var chatOpen = false;
  var chatInputFocused = false;
  var chatTargetId = null; // radial-selected player id (for private chat)
  var chatEls = {};

  // ---------- app ----------
  var app, world, hud, nightOverlay, startOverlay;
  var player, playerGfx;
  var npcs = [], tutorialNpc = null;
  var animals = []; // Map v2 §7: dogs + cats, visual-only wanderers (no gameplay)
  var cullables = []; // {obj, x, y, w, h}
  var lampGlows = [];
  var keys = {};
  var joy = { active: false, id: null, dx: 0, dy: 0 };
  var sprintTouch = false;
  var started = false;
  var scale = 1;
  var longPressTimer = null, longPressPos = null;
  var radialTarget = null; // {kind, name, x, y, npc}
  var bubbleTimer = null;
  var minimapTimer = 0, fpsTimer = 0, fpsCount = 0, fpsValue = 60;

  var hudRefs = {}; // graphics/text refs created in buildHUD
  var radialMenu, radialButtons = [];
  var bubble, bubbleText;
  var minimapG, minimapMask;

  // ---------- M3: survival / faint / shipper (offline mirror of the server) ----------
  var faintInfo = null; // {at, until} — set when isFainted flips true
  var faintAlerts = []; // {x, y, until} — fainted players doctors must see (§3.4.3)
  var localSurv = { hungerAcc: 0, hpLossAcc: 0, regenAcc: 0 }; // offline 1s accumulators
  var orderArrow = null; // world-space arrow pointing at the delivery target
  var faintPanelEl = null, faintTextEl = null, hospitalBtnEl = null;
  var JOB_LABELS = { unemployed: 'Chưa có', shipper: 'Shipper', doctor: 'Bác sĩ', taxi_driver: 'Tài xế' };

  // SFX (M3 skills revision, audio-gen tier a): safe wrapper — audio must
  // never crash the game, and sounds only play for events involving me.
  function sfx(name) {
    try { if (typeof DTA_SFX !== 'undefined' && DTA_SFX[name]) DTA_SFX[name](); } catch (e) { /* ignore */ }
  }

  // VFX (rename+VFX, Godot-VFX principles adapted to Pixi): safe wrapper —
  // visuals must never crash the game. Same call sites as sfx() above, so
  // sight + sound fire together for the same event.
  function vfx(name, a, b, c) {
    try { if (typeof DTA_VFX !== 'undefined' && DTA_VFX[name]) DTA_VFX[name](a, b, c); } catch (e) { /* ignore */ }
  }

  // M2: random walkers use full-body persona sprites (cycling the 6 NPC
  // looks) instead of the M0 code-drawn person — no more SVG-looking NPCs.
  // Map v2: v3 taxiFull is Chú Ba STANDING with a helmet (verified by
  // viewing the sprite), so it is no longer a "man on a motorbike" — but
  // it stays reserved for the parked Guide and bot Chú Ba, and the walker
  // list must stay index-aligned with the persona list or a walker talks
  // in the wrong voice (e.g. bread sprite speaking as Chú Ba). Walkers
  // therefore cycle only the 5 on-foot personas.
  var WALKER_FULL = ['shipperFull', 'breadFull', 'policeFull', 'thugFull', 'studentFull'];
  var WALKER_PERSONAS = ['tung', 'lan', 'cong', 'ty', 'mai'];
  var NPC_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Thu', 'Tuấn'];
  var NPC_COLORS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xfd79a8, 0x00b894, 0x6c5ce7, 0xd63031, 0x0984e3, 0xe17055];
  var TALK_LINES = [
    'Chào bạn! Thành phố hôm nay đông vui lắm.',
    'Đi làm Shipper kiếm tiền nhanh lắm, thử đi.',
    'Đói thì ghé Cửa Hàng Tiện Lợi mua bánh mì nhé.',
    'Ban đêm đi xe ôm được thêm phụ cấp 30% đó.',
    'Muốn mua xe máy thì qua Showroom ở phía Tây Nam.',
    'Ngân hàng ở phía Tây Bắc, nhớ gửi tiền cho an toàn.'
  ];

  function text(str, size, fill, bold) {
    return new PIXI.Text({
      text: str,
      style: {
        fontFamily: 'Arial, sans-serif', fontSize: size || 14,
        fill: fill !== undefined ? fill : 0xffffff,
        fontWeight: bold ? 'bold' : 'normal', align: 'center'
      }
    });
  }
  function barLabel(str, x, y, parent, size) {
    var t = text(str, size || 12, 0xffffff, true);
    t.anchor.set(0, 0.5); t.position.set(x, y); parent.addChild(t); return t;
  }

  function makePerson(color, withDir) {
    var c = new PIXI.Container();
    var g = new PIXI.Graphics();
    // shadow
    g.ellipse(0, 14, 14, 6).fill({ color: 0x000000, alpha: 0.25 });
    // body
    g.roundRect(-11, -6, 22, 24, 8).fill(color);
    g.roundRect(-11, -6, 22, 24, 8).stroke({ width: 2, color: 0x000000, alpha: 0.25 });
    // head
    g.circle(0, -16, 10).fill(0xffd9b3);
    g.circle(0, -16, 10).stroke({ width: 2, color: 0x000000, alpha: 0.2 });
    // eyes
    g.circle(-3.5, -17, 1.4).fill(0x222222);
    g.circle(3.5, -17, 1.4).fill(0x222222);
    if (withDir) {
      g.moveTo(0, -30); g.lineTo(-5, -38); g.lineTo(5, -38); g.closePath().fill(0xffffff);
    }
    c.addChild(g);
    return c;
  }

  // M2 full-body character (REPLACES the M1 circular badge — user complaint:
  // "người chơi sao lại là avatar hình tròn?"). A transparent full-body
  // sprite (head + body + legs) standing on the map with a soft shadow
  // ellipse under the feet + name label above. The inner `face` container
  // holds the sprite only (flips for direction, bobs while walking) — the
  // shadow and the name label never mirror. Falls back to the M0 code-drawn
  // person when no texture is available. Map v2: v3 figures are high-angle
  // overhead (MAP_V3_DESIGN.md §6) — 40 world px tall, so at mobile zoom
  // 1.6x they render ~64px on a 390px portrait screen.
  var CHAR_H = 40;
  function makeFullBody(tex, nameText) {
    var c = new PIXI.Container();
    var face = new PIXI.Container();
    var shadow = new PIXI.Graphics();
    shadow.ellipse(0, 18, 13, 5).fill({ color: 0x000000, alpha: 0.25 });
    c.addChild(shadow);
    if (tex) {
      var spr = new PIXI.Sprite(tex);
      spr.anchor.set(0.5, 0.5);
      spr.height = CHAR_H;
      spr.width = CHAR_H * tex.width / tex.height;
      spr.position.set(0, -3);
      face.addChild(spr);
    } else {
      // fallback: M0 code-drawn person (same shapes as makePerson)
      var g = new PIXI.Graphics();
      g.roundRect(-11, -6, 22, 24, 8).fill(0x2980b9);
      g.roundRect(-11, -6, 22, 24, 8).stroke({ width: 2, color: 0x000000, alpha: 0.25 });
      g.circle(0, -16, 10).fill(0xffd9b3);
      g.circle(0, -16, 10).stroke({ width: 2, color: 0x000000, alpha: 0.2 });
      g.circle(-3.5, -17, 1.4).fill(0x222222);
      g.circle(3.5, -17, 1.4).fill(0x222222);
      face.addChild(g);
    }
    c.addChild(face);
    c.userData = c.userData || {};
    c.userData.face = face;
    if (nameText) {
      var label = text(nameText, 12, 0xffffff, true);
      label.anchor.set(0.5, 0.5);
      label.position.set(0, -32);
      label.style.stroke = { color: 0x000000, width: 3 };
      c.addChild(label);
      c.userData.label = label;
    }
    return c;
  }

  function avatarTexFor(avatarKey) {
    var k = AVATAR_TEX[avatarKey] || 'hero';
    return TEX[k] || null;
  }
  // Map v2 prop helper: a transparent v3 *-full.png at a world size.
  // `w` = width in world px; height follows the texture aspect. Returns
  // null (caller draws nothing) when the texture failed to load.
  function propSprite(texKey, x, y, w) {
    var tex = TEX[texKey];
    if (!tex) return null;
    var spr = new PIXI.Sprite(tex);
    spr.anchor.set(0.5, 0.5);
    spr.width = w;
    spr.height = w * tex.height / tex.width;
    spr.position.set(x, y);
    if (world) world.addChild(spr);
    cullables.push({ obj: spr, x: x - w / 2, y: y - spr.height / 2, w: w, h: spr.height });
    return spr;
  }
  // Bush spots inside the two flower gardens (Map v2 §4: A x3, B x2).
  function gdBushSpots() {
    return [{ x: 750, y: 2550 }, { x: 1050, y: 2700 }, { x: 900, y: 2650 },
            { x: 3150, y: 750 }, { x: 3450, y: 900 }];
  }
  // Map v2 §7: one wandering animal (dog/cat). Visual only — no NPC id, no
  // radial menu, no chat. Sprite drawn by width (dog 30px, cat 22px).
  function spawnAnimal(kind, x, y, speed, w) {
    var tex = TEX[kind];
    if (!tex) return;
    var spr = new PIXI.Sprite(tex);
    spr.anchor.set(0.5, 0.5);
    spr.width = w;
    spr.height = w * tex.height / tex.width;
    spr.position.set(x, y);
    world.addChild(spr);
    var tgt = randomOpenPoint();
    var a = { kind: kind, container: spr, x: x, y: y, targetX: tgt.x, targetY: tgt.y, speed: speed, pauseUntil: 0 };
    spr.userData = a; // lets updateCulling follow the animal (same as NPCs)
    animals.push(a);
    cullables.push({ obj: spr, x: x - 20, y: y - 20, w: 40, h: 40 });
  }
  // Animals wander locally (client-side only — the server never sees them).
  // Same pattern as the offline NPC walk: pick a new open target on arrival
  // or when blocked, pause 3-8 s, flip by horizontal movement.
  function updateAnimals(dt) {
    var now = Date.now();
    animals.forEach(function (a) {
      if (now < a.pauseUntil) return;
      var dx = a.targetX - a.x, dy = a.targetY - a.y;
      var d = Math.hypot(dx, dy);
      if (d < 10) {
        a.pauseUntil = now + 3000 + Math.random() * 5000;
        var p = randomOpenPoint();
        a.targetX = p.x; a.targetY = p.y;
        return;
      }
      var nx = a.x + dx / d * a.speed * dt, ny = a.y + dy / d * a.speed * dt;
      if (blocked(nx, a.y, 10) || blocked(a.x, ny, 10)) {
        var p2 = randomOpenPoint();
        a.targetX = p2.x; a.targetY = p2.y;
        return;
      }
      a.x = nx; a.y = ny;
      a.container.position.set(a.x, a.y);
      if (dx < -0.1) a.container.scale.x = -1;
      else if (dx > 0.1) a.container.scale.x = 1;
    });
  }
  // Full-body texture for the in-world character (transparent *-full.png).
  function fullTexFor(avatarKey) {
    var k = FULL_TEX[avatarKey] || 'heroFull';
    return TEX[k] || null;
  }
  function avatarColorFor(avatarKey) {
    return AVATAR_COLOR[avatarKey] !== undefined ? AVATAR_COLOR[avatarKey] : 0x2980b9;
  }

  function buildWorld() {
    world = new PIXI.Container();
    app.stage.addChild(world);

    // ground: grass
    var ground = new PIXI.Graphics();
    ground.rect(0, 0, MAP_W, MAP_H).fill(0x5da24a);
    // grass patches (deterministic)
    for (var i = 0; i < 500; i++) {
      var gx = randRange(0, MAP_W), gy = randRange(0, MAP_H);
      if (inRoad(gx, gy)) continue;
      ground.circle(gx, gy, randRange(6, 18)).fill({ color: 0x4c8a3d, alpha: 0.5 });
    }
    ground.eventMode = 'static';
    ground.on('pointerdown', onWorldPointerDown);
    world.addChild(ground);

    // Map v2 §2: roads 180px asphalt + 40px beige sidewalks on BOTH sides
    // of every road (pedestrians on sidewalks/grass, vehicles on the road),
    // double yellow centre line + white dashed lane markings.
    var roads = new PIXI.Graphics();
    for (var r = 0; r < ROAD_BANDS.length; r++) {
      var p = ROAD_BANDS[r];
      // sidewalks first (under the asphalt edges)
      roads.rect(0, p - SIDEWALK_W, MAP_W, SIDEWALK_W).fill(0xd8cfae);
      roads.rect(0, p + ROAD_W, MAP_W, SIDEWALK_W).fill(0xd8cfae);
      roads.rect(p - SIDEWALK_W, 0, SIDEWALK_W, MAP_H).fill(0xd8cfae);
      roads.rect(p + ROAD_W, 0, SIDEWALK_W, MAP_H).fill(0xd8cfae);
      // asphalt
      roads.rect(0, p, MAP_W, ROAD_W).fill(0x3d3d3d);
      roads.rect(p, 0, ROAD_W, MAP_H).fill(0x3d3d3d);
      // lane dashes (yellow centre + white edge dashes)
      for (var d = 0; d < MAP_W; d += 80) {
        roads.rect(d, p + ROAD_W / 2 - 3, 40, 6).fill(0xf7dc6f);
        roads.rect(p + ROAD_W / 2 - 3, d, 6, 40).fill(0xf7dc6f);
      }
    }
    world.addChild(roads);

    // central plaza (2070,2070,660,660) — the v3 map texture is used ONLY
    // here as the plaza ground (1024px stretched over 660px stays sharp)
    // and for the minimap/start backdrop; the rest of the map is drawn
    // from the layout data above. Fountain is a blocking circle r=90.
    if (TEX.plaza) {
      var plazaSpr = new PIXI.Sprite(TEX.plaza);
      plazaSpr.width = 660; plazaSpr.height = 660;
      plazaSpr.position.set(2070, 2070);
      world.addChild(plazaSpr);
      cullables.push({ obj: plazaSpr, x: 2070, y: 2070, w: 660, h: 660 });
    }
    var plaza = new PIXI.Graphics();
    if (!TEX.plaza) {
      plaza.rect(2070, 2070, 660, 660).fill(0xd6c9a8);
      plaza.rect(2070, 2070, 660, 660).stroke({ width: 4, color: 0xb8a888 });
    }
    plaza.circle(2400, 2400, 90).fill(0x5dade2);
    plaza.circle(2400, 2400, 90).stroke({ width: 4, color: 0x2e86c1 });
    plaza.circle(2400, 2400, 36).fill(0x85c1e9);
    var plazaLabel = text('Quảng Trường Trung Tâm', 22, 0x5d4037, true);
    if (TEX.plaza) plazaLabel.style.stroke = { color: 0xffffff, width: 4 };
    plazaLabel.anchor.set(0.5, 0.5); plazaLabel.position.set(2400, 2145);
    world.addChild(plaza, plazaLabel);
    cullables.push({ obj: plaza, x: 2070, y: 2070, w: 660, h: 660 });
    cullables.push({ obj: plazaLabel, x: 2070, y: 2070, w: 660, h: 60 });

    // Map v2 §4: flower gardens — light-green beds inside, fence sprites
    // along the blocking rects (gaps stay open, see Colliders.FENCES),
    // bushes + benches inside (decorative only, no collision).
    var gardens = (typeof Colliders !== 'undefined' && Colliders.GARDENS) ? Colliders.GARDENS : [];
    gardens.forEach(function (gd) {
      var bed = new PIXI.Graphics();
      bed.rect(gd.x, gd.y, gd.w, gd.h).fill(0x7fbf5a);
      world.addChild(bed);
      cullables.push({ obj: bed, x: gd.x, y: gd.y, w: gd.w, h: gd.h });
    });
    // bushes: Garden A x3, Garden B x2 (design §4)
    var bushSpots = gdBushSpots();
    bushSpots.forEach(function (s) {
      propSprite('bushFlower', s.x, s.y, 56);
    });
    // benches: plaza x4 + gardens (A x2, B x1)
    var benchSpots = [[2150, 2150], [2650, 2150], [2150, 2650], [2650, 2650], [700, 2750], [1100, 2480], [3200, 950]];
    benchSpots.forEach(function (s) {
      propSprite('bench', s[0], s[1], 56);
    });

    // buildings (Map v2): the M0 coloured rect stays as backing; the v3
    // sprite is drawn over it, sized exactly to the collider rect (roof
    // crops for the 3/4-front buildings, full images for the flat ones).
    // No rounded mask — v3 images are full-bleed, no white corners to hide.
    BUILDINGS.forEach(function (b) {
      var c = new PIXI.Container();
      var g = new PIXI.Graphics();
      g.rect(b.x, b.y, b.w, b.h).fill(b.color);
      g.rect(b.x, b.y, b.w, b.h).stroke({ width: 3, color: 0x000000, alpha: 0.3 });
      // roof strip + door + windows (fallback detail when no texture)
      g.rect(b.x, b.y, b.w, 26).fill(b.roof);
      g.rect(b.x + b.w / 2 - 16, b.y + b.h - 34, 32, 34).fill(0x5d4037);
      for (var wx = b.x + 22; wx < b.x + b.w - 30; wx += 52) {
        g.rect(wx, b.y + 44, 28, 26).fill(0xbfe3ff);
      }
      c.addChild(g);
      var bTexKey = POI_TEX[b.id] || HOUSE_TEX[b.id];
      if (bTexKey && TEX[bTexKey]) {
        var bspr = new PIXI.Sprite(TEX[bTexKey]);
        bspr.width = b.w; bspr.height = b.h;
        bspr.position.set(b.x, b.y);
        c.addChild(bspr);
      }
      var label = text(b.name, 20, 0xffffff, true);
      label.anchor.set(0.5, 0.5);
      label.position.set(b.x + b.w / 2, b.y + b.h / 2 + 12);
      // dark backing behind label so it stays readable
      var back = new PIXI.Graphics();
      back.roundRect(b.x + 8, b.y + b.h / 2 - 2, b.w - 16, 30, 6).fill({ color: 0x000000, alpha: 0.45 });
      c.addChild(back, label);
      c.eventMode = 'static';
      c.on('pointerdown', onWorldPointerDown);
      world.addChild(c);
      cullables.push({ obj: c, x: b.x, y: b.y, w: b.w, h: b.h });
    });

    // Map v2 §4: fences — segment sprites tiled along each blocking rect
    // (horizontal runs as-is, vertical runs rotated 90°), corner sprites
    // where two runs meet. The corner GAPS have no fence rects, so nothing
    // is drawn over them: the shortcuts stay open.
    var fences = (typeof Colliders !== 'undefined' && Colliders.FENCES) ? Colliders.FENCES : [];
    fences.forEach(function (f) {
      if (f.w >= f.h) {
        var nH = Math.max(1, Math.ceil(f.w / 55));
        for (var i = 0; i < nH; i++) {
          var s = propSprite('fenceSeg', f.x + i * 55 + 27, f.y + f.h / 2, 55);
          if (s) s.height = 20;
        }
      } else {
        var nV = Math.max(1, Math.ceil(f.h / 55));
        for (var j = 0; j < nV; j++) {
          var tex = TEX.fenceSeg;
          if (!tex) break;
          var sv = new PIXI.Sprite(tex);
          sv.anchor.set(0.5, 0.5);
          sv.width = 55; sv.height = 20;
          sv.rotation = Math.PI / 2;
          sv.position.set(f.x + f.w / 2, f.y + j * 55 + 27);
          world.addChild(sv);
          cullables.push({ obj: sv, x: f.x - 10, y: f.y + j * 55, w: 32, h: 55 });
        }
      }
    });
    // fence corners where two runs meet (the other two corners of each
    // garden are the open gaps — no corner sprite there).
    [[1200, 2400], [600, 2820], [3000, 600], [3600, 1020]].forEach(function (pt) {
      propSprite('fenceCorner', pt[0], pt[1], 56);
    });

    // POI markers (coloured dot + pin at building front / spawn)
    POIS.forEach(function (p) {
      var m = new PIXI.Graphics();
      m.circle(p.x, p.y, 12).fill(p.color);
      m.circle(p.x, p.y, 12).stroke({ width: 3, color: 0xffffff });
      m.circle(p.x, p.y, 4).fill(0xffffff);
      world.addChild(m);
      cullables.push({ obj: m, x: p.x - 14, y: p.y - 14, w: 28, h: 28 });
    });

    // trees (Map v2 §5): v3 tree sprites scattered on grass blocks,
    // never on roads/sidewalks/plaza. Decorative only (no collision),
    // same as the M0 code-drawn trees — the design leaves that choice to
    // code, and blocking trees would need a shared tree list.
    for (var t = 0; t < 60; t++) {
      var tp = randomOpenPoint();
      var tree = propSprite(t % 2 === 0 ? 'treeA' : 'treeB', tp.x, tp.y, randRange(56, 90));
      if (!tree) {
        var tf = new PIXI.Graphics();
        tf.rect(-3, 0, 6, 14).fill(0x6e4b2a);
        tf.circle(0, -10, 16).fill(0x2e7d32);
        tf.circle(-8, -4, 10).fill(0x388e3c);
        tf.circle(8, -4, 10).fill(0x388e3c);
        tf.position.set(tp.x, tp.y);
        world.addChild(tf);
        cullables.push({ obj: tf, x: tp.x - 18, y: tp.y - 28, w: 36, h: 46 });
      }
    }

    // lamps along roads (glow at night) — v3 lamp sprite at road
    // intersections; the glow Graphics feed DTA_VFX.init() in boot().
    for (var lx = 200; lx < MAP_W; lx += 400) {
      for (var ly = 200; ly < MAP_H; ly += 400) {
        if (!inRoad(lx, ly)) continue;
        var lampX = lx + 70, lampY = ly - 20;
        var lamp = propSprite('lamp', lampX, lampY, 26);
        if (!lamp) {
          lamp = new PIXI.Graphics();
          lamp.rect(-2, -22, 4, 22).fill(0x333333);
          lamp.circle(0, -24, 6).fill(0xffe082);
          world.addChild(lamp);
          lamp.position.set(lampX, lampY);
          cullables.push({ obj: lamp, x: lampX - 20, y: lampY - 50, w: 40, h: 50 });
        }
        var glow = new PIXI.Graphics();
        glow.circle(0, 0, 34).fill({ color: 0xffe082, alpha: 0.18 });
        glow.position.set(lampX, lampY - 24);
        glow.visible = false;
        world.addChild(glow);
        lampGlows.push(glow);
        cullables.push({ obj: glow, x: lampX - 40, y: lampY - 60, w: 80, h: 80 });
      }
    }

    // parked vehicles (Map v2 §5, decorative): 5 motorbikes in a row at the
    // showroom, cars at the hospital bay, police car park and motel car park.
    [1500, 1600, 1700, 1800, 1900].forEach(function (bx) {
      propSprite('motorbike', bx, 3080, 34);
    });
    propSprite('car', 4000, 1920, 90);
    propSprite('car', 3900, 1010, 90);
    propSprite('car', 2850, 3130, 90);
    // delivery boxes + bins (decorative): boxes at the warehouse dock,
    // bins near the shop, market, plaza and gardens.
    propSprite('box', 3900, 3200, 40);
    propSprite('box', 3980, 3200, 40);
    [[2900, 1800], [4100, 3800], [2700, 2400], [900, 2400], [3400, 600]].forEach(function (bp) {
      propSprite('bin', bp[0], bp[1], 30);
    });

    // NPCs (M2: full-body persona sprites, not code-drawn persons)
    for (var n = 0; n < 10; n++) {
      var sp = randomOpenPoint();
      var npc = makeFullBody(TEX[WALKER_FULL[n % WALKER_FULL.length]], null);
      npc.position.set(sp.x, sp.y);
      npc.eventMode = 'static';
      npc.cursor = 'pointer';
      npc.on('pointerdown', onWorldPointerDown);
      var tgt = randomOpenPoint();
      // M3 (§10.2): server id 'npc-walker-i' + a BotBrain persona (cycles
      // the 5 on-foot personas, index-aligned with WALKER_FULL) so
      // "Nói chuyện" gets a persona line in the matching voice, online & offline.
      var personaId = WALKER_PERSONAS[n % WALKER_PERSONAS.length];
      var obj = {
        id: 'npc-walker-' + n, personaId: personaId, lastTalkLine: null,
        container: npc, x: sp.x, y: sp.y, targetX: tgt.x, targetY: tgt.y,
        speed: 90, name: NPC_NAMES[n % NPC_NAMES.length],
        color: NPC_COLORS[n % NPC_COLORS.length], isTutorial: false
      };
      npc.userData = obj;
      world.addChild(npc);
      npcs.push(obj);
      cullables.push({ obj: npc, x: sp.x - 20, y: sp.y - 30, w: 40, h: 60 });
    }

    // Map v2 §7: dogs + cats — visual-only wanderers (no gameplay yet, no
    // talk/radial: they are NOT in npcs[]). Sidewalks/grass only, never on
    // roads; dogs ~60 px/s, cats ~40 px/s, pause 3-8 s like walkers.
    var animalSpawns = (typeof Colliders !== 'undefined' && Colliders.ANIMALS) ? Colliders.ANIMALS : { dogs: [], cats: [] };
    animalSpawns.dogs.forEach(function (s) { spawnAnimal('dog', s.x, s.y, 60, 30); });
    animalSpawns.cats.forEach(function (s) { spawnAnimal('cat', s.x, s.y, 40, 22); });

    // tutorial NPC (fixed at spawn) — Map v2: v3 taxiFull is Chú Ba STANDING
    // holding a helmet (verified by viewing the sprite), so the Guide reads
    // as a friendly driver, not a man sitting on a motorbike (the v2 look).
    tutorialNpc = makeFullBody(TEX.taxiFull, null);
    tutorialNpc.position.set(2400, 2520);
    tutorialNpc.eventMode = 'static';
    tutorialNpc.cursor = 'pointer';
    tutorialNpc.on('pointerdown', onWorldPointerDown);
    var tutObj = {
      id: 'npc-guide', personaId: null, lastTalkLine: null,
      container: tutorialNpc, x: 2400, y: 2520, targetX: 2400, targetY: 2520,
      speed: 0, name: 'NPC Hướng Dẫn', color: 0x27ae60, isTutorial: true
    };
    tutorialNpc.userData = tutObj;
    world.addChild(tutorialNpc);
    npcs.push(tutObj);
    cullables.push({ obj: tutorialNpc, x: 2380, y: 2490, w: 40, h: 60 });
    var tutLabel = text('NPC Hướng Dẫn', 18, 0xffff00, true);
    tutLabel.anchor.set(0.5, 0.5); tutLabel.position.set(2400, 2478);
    world.addChild(tutLabel);
    cullables.push({ obj: tutLabel, x: 2300, y: 2460, w: 200, h: 36 });

    // player (M2: full-body hero sprite + shadow; M0 code-drawn person as fallback)
    player = makeFullBody(TEX.heroFull, playerState.name);
    player.position.set(playerState.x, playerState.y);
    world.addChild(player);
    playerGfx = player;

    // M3 (§6.2): delivery arrow — a world-space line + triangle from the
    // player toward the active order's target, redrawn every frame.
    orderArrow = new PIXI.Graphics();
    orderArrow.visible = false;
    world.addChild(orderArrow);

    // radial menu + speech bubble (world-space, hidden by default)
    buildRadialMenu();
    buildBubble();
  }

  function buildRadialMenu() {
    radialMenu = new PIXI.Container();
    radialMenu.visible = false;
    world.addChild(radialMenu);
    var defs = [
      { label: 'Nói chuyện', action: 'talk' },
      { label: 'Thông tin', action: 'info' },
      { label: 'Cấp cứu', action: 'revive' },
      { label: 'Đóng', action: 'close' }
    ];
    var angles = [-90, 0, 90, 180];
    defs.forEach(function (d, i) {
      var a = angles[i] * Math.PI / 180;
      var btn = new PIXI.Container();
      btn.position.set(Math.cos(a) * 78, Math.sin(a) * 78);
      var g = new PIXI.Graphics();
      var col = d.action === 'close' ? 0x7f8c8d : (d.action === 'revive' ? 0xe74c3c : 0x2980b9);
      g.circle(0, 0, 32).fill(col);
      g.circle(0, 0, 32).stroke({ width: 3, color: 0xffffff });
      btn.addChild(g);
      var t = text(d.label, 10, 0xffffff, true);
      t.anchor.set(0.5, 0.5);
      btn.addChild(t);
      btn.eventMode = 'static';
      btn.cursor = 'pointer';
      btn._radialAction = d.action; // changed by openRadial (revive <-> report)
      btn.on('pointerdown', function (e) { e.stopPropagation(); onRadialAction(btn._radialAction); });
      radialMenu.addChild(btn);
      radialButtons.push({ btn: btn, gfx: g, label: t, action: d.action, baseColor: col });
    });
    var hub = new PIXI.Graphics();
    hub.circle(0, 0, 20).fill({ color: 0x000000, alpha: 0.55 });
    hub.circle(0, 0, 20).stroke({ width: 2, color: 0xffffff });
    radialMenu.addChild(hub);
  }

  function buildBubble() {
    bubble = new PIXI.Container();
    bubble.visible = false;
    var bg = new PIXI.Graphics();
    // M2: smaller bubble (200x48, was 260x56) — at zoom 1.6x the old bubble
    // was 416px wide on a 390px screen and overflowed the frame.
    bg.roundRect(-100, -66, 200, 48, 12).fill(0xffffff);
    bg.roundRect(-100, -66, 200, 48, 12).stroke({ width: 2, color: 0x333333 });
    bg.moveTo(-10, -18); bg.lineTo(10, -18); bg.lineTo(0, -6); bg.closePath().fill(0xffffff);
    bubble.addChild(bg);
    bubbleText = text('', 15, 0x222222, false);
    bubbleText.anchor.set(0.5, 0.5);
    bubbleText.position.set(0, -42);
    bubble.addChild(bubbleText);
    world.addChild(bubble);
  }

  function showBubble(x, y, str, ms) {
    bubbleText.text = str;
    // wrap: split long lines manually (Pixi Text wordWrap)
    bubbleText.style.wordWrap = true;
    bubbleText.style.wordWrapWidth = 180;
    bubble.position.set(x, y);
    bubble.visible = true;
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () { bubble.visible = false; }, ms || 3000);
  }

  // M1: relabel/recolour one radial button (index 2 swaps Cấp cứu <-> Báo cáo)
  function setRadialButton(idx, label, action, color, enabled) {
    var b = radialButtons[idx];
    if (!b) return;
    b.action = action;
    b.label.text = label;
    b.btn._radialAction = action;
    b.btn.alpha = enabled ? 1 : 0.45;
    b.gfx.clear();
    b.gfx.circle(0, 0, 32).fill(color);
    b.gfx.circle(0, 0, 32).stroke({ width: 3, color: 0xffffff });
  }

  function nearestTarget(wx, wy) {
    var best = null, bestD = 150;
    npcs.forEach(function (n) {
      var d = Math.hypot(n.x - wx, n.y - wy);
      if (d < bestD) { bestD = d; best = { kind: 'npc', name: n.name, x: n.x, y: n.y, npc: n }; }
    });
    POIS.forEach(function (p) {
      var d = Math.hypot(p.x - wx, p.y - wy);
      if (d < bestD) { bestD = d; best = { kind: 'poi', id: p.id, name: p.name, x: p.x, y: p.y, npc: null }; }
    });
    // M1: remote players (humans + bots, online & offline) are targets too
    Object.keys(remotePlayers).forEach(function (id) {
      var r = remotePlayers[id];
      var d = Math.hypot(r.rx - wx, r.ry - wy);
      if (d < bestD) {
        bestD = d;
        best = { kind: 'player', name: r.name, x: r.rx, y: r.ry, npc: null, id: id, remote: r, isBot: r.isBot, isFainted: r.isFainted, personaId: r.personaId };
      }
    });
    return best;
  }

  function openRadial(target) {
    radialTarget = target;
    radialMenu.position.set(target.x, target.y - 10);
    radialMenu.visible = true;
    // M2: button 0 becomes context action for POIs — Cửa hàng at the shop,
    // ATM at the bank (SRS §11 Radial Menu, max 4 buttons).
    if (target.kind === 'poi') {
      if (target.id === 'shop' || target.name.indexOf('Cửa Hàng') === 0) {
        setRadialButton(0, 'Cửa hàng', 'shop', 0xe67e22, true);
      } else if (target.id === 'bank' || target.name.indexOf('Ngân Hàng') === 0) {
        setRadialButton(0, 'ATM', 'atm', 0x2980b9, true);
      } else {
        setRadialButton(0, 'Nói chuyện', 'talk', 0x2980b9, true);
      }
    } else {
      setRadialButton(0, 'Nói chuyện', 'talk', 0x2980b9, true);
    }
    // M1: 4th button is Báo cáo for a (non-fainted) player, Cấp cứu for a
    // fainted player; for NPC/POI it stays Cấp cứu, disabled as in M0.
    if (target.kind === 'player') {
      if (target.isFainted) setRadialButton(2, 'Cấp cứu', 'revive', 0xe74c3c, true);
      else setRadialButton(2, 'Báo cáo', 'report', 0xe67e22, true);
      chatTargetId = target.id; // private chat goes to this player
    } else {
      setRadialButton(2, 'Cấp cứu', 'revive', 0xe74c3c, false);
      chatTargetId = null; // private chat needs a player target
    }
  }
  function closeRadial() { radialMenu.visible = false; radialTarget = null; }

  function onRadialAction(action) {
    if (!radialTarget) { closeRadial(); return; }
    var t = radialTarget;
    if (action === 'close') { closeRadial(); return; }
    // M2: shop / ATM open the DOM panels (Hybrid UI: money input is DOM).
    if (action === 'shop') {
      closeRadial();
      if (typeof window.openShopPanel === 'function') window.openShopPanel();
      return;
    }
    if (action === 'atm') {
      closeRadial();
      if (typeof window.openAtmPanel === 'function') window.openAtmPanel();
      return;
    }
    if (action === 'report') {
      // M1: report only logs (no server endpoint yet)
      console.log('[report] player reported', t.id || t.name, 'by', playerState.name);
      showBubble(t.x, t.y, 'Đã gửi báo cáo\n(M1: chỉ ghi log)', 3000);
      return;
    }
    if (action === 'revive') {
      if (t.kind === 'player' && t.isFainted && netMode === 'online' && typeof NetClient !== 'undefined' && NetClient.connected) {
        NetClient.sendInteract(t.id, 'revive');
        sfx('click');
        showBubble(t.x, t.y, 'Đang cấp cứu ' + t.name + '…', 3000);
      } else if (t.kind === 'player' && t.isFainted) {
        showBubble(t.x, t.y, 'Không cấp cứu được khi\noffline (cần máy chủ).', 3000);
      } else if (t.kind === 'player') {
        showBubble(t.x, t.y, t.name + ' không cần cấp cứu.', 3000);
      } else {
        showBubble(t.x, t.y, 'M0: chưa có ai ngất xỉu\nnên chưa cấp cứu được.', 3000);
      }
      return;
    }
    if (action === 'talk') {
      var line;
      if (t.kind === 'player' && t.isBot) {
        // bot persona line from shared/botBrain.js (same lines server uses)
        line = botPersonaLine(t.personaId);
        showRemoteBubble(t.id, line, 4000);
        sfx('talk');
        vfx('talk', t.x, t.y);
      } else if (t.kind === 'player') {
        // human player: show a line, send nothing extra (per M1 brief)
        showRemoteBubble(t.id, 'Đây là ' + t.name + '.', 3000);
      } else if (t.npc && t.npc.isTutorial) {
        // M3 (§10.2): guide shows the 5-step tutorial quest. Online the
        // server answers (npc_talk); offline the same text is local.
        if (netMode === 'online' && typeof NetClient !== 'undefined' && NetClient.connected) {
          NetClient.sendInteract(t.npc.id, 'talk');
          showBubble(t.x, t.y, 'NPC Hướng Dẫn đang nói…', 2000);
        } else {
          showTutorialQuest(t);
          sfx('talk');
          vfx('talk', t.x, t.y);
        }
      } else if (t.npc) {
        // M3 (§10.2): walking NPC — one random persona line. Online the
        // server answers (npc_talk, same BotBrain personas); offline local.
        if (netMode === 'online' && typeof NetClient !== 'undefined' && NetClient.connected) {
          NetClient.sendInteract(t.npc.id, 'talk');
          showBubble(t.x, t.y, t.name + ' đang nói…', 2000);
        } else {
          line = npcPersonaLine(t.npc);
          showBubble(t.x, t.y, line, 4000);
          sfx('talk');
          vfx('talk', t.x, t.y);
        }
      } else {
        line = 'Đây là ' + t.name + '.\n(M0 chỉ xem thông tin, chưa mua bán)';
        showBubble(t.x, t.y, line, 3000);
      }
      return;
    }
    if (action === 'info') {
      var info;
      if (t.kind === 'player') {
        info = t.name + (t.isBot ? ' — Bot dân cư' : ' — Người chơi') +
          (t.isFainted ? '\nĐang ngất xỉu.' : '\nĐang ở trong thành phố.');
        showRemoteBubble(t.id, info, 3000);
      } else {
        info = t.kind === 'npc'
          ? t.name + ' — Dân cư thành phố\nĐang đi dạo quanh thành phố.'
          : t.name + '\nĐịa điểm quan trọng (M0: chỉ xem).';
        showBubble(t.x, t.y, info, 3000);
      }
      return;
    }
  }

  function screenToWorld(e) {
    var gx = (typeof e.globalX === 'number') ? e.globalX : e.global.x;
    var gy = (typeof e.globalY === 'number') ? e.globalY : e.global.y;
    return { x: (gx - world.x) / scale, y: (gy - world.y) / scale };
  }

  function onWorldPointerDown(e) {
    if (!started) return;
    var w = screenToWorld(e);
    // right-click -> radial immediately
    if (e.button === 2) {
      var target = nearestTarget(w.x, w.y);
      if (target) openRadial(target); else closeRadial();
      return;
    }
    // left click / touch: close menu if clicked elsewhere, else arm long-press
    if (radialMenu.visible) {
      var rt = radialTarget;
      if (!rt || Math.hypot(w.x - rt.x, w.y - rt.y) > 130) closeRadial();
    }
    // long-press for touch (500ms, hold still)
    if (e.pointerType === 'touch' || e.data.pointerType === 'touch') {
      clearLongPress();
      longPressPos = { x: w.x, y: w.y, sx: e.global.x, sy: e.global.y };
      longPressTimer = setTimeout(function () {
        var t2 = nearestTarget(longPressPos.x, longPressPos.y);
        if (t2) openRadial(t2);
        longPressTimer = null;
      }, 500);
    }
  }
  function clearLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
    longPressPos = null;
  }

  // ---------- HUD (Canvas only) ----------
  function buildHUD() {
    hud = new PIXI.Container();
    app.stage.addChild(hud);

    // top-left panel — M2 (user: "chữ không đúng trong khung, thu nhỏ chữ và
    // các nút vòng tròn 1 chút"): name 15px, bar labels 13px, money/clock
    // 14px, panel 300px wide so "Tiền mặt: 50.000đ • Ngân hàng: 0đ" fits on
    // ONE line (with a fit-shrink fallback in updateHUD).
    // BUG FIX (M2 browser test): desktop panel was 108px tall but the money
    // line sits at y=122 (+~18px text height = bottom ~140), while the panel
    // bottom was 10+108=118 — the money line overflowed onto the grass.
    // Panel height must cover money bottom + padding: 122+18+12 = 152 abs,
    // i.e. height 148 (bottom 158, money bottom ~140 < 158-8). Mobile (BIG)
    // was already 158 (bottom 168, money bottom ~152) and is unchanged.
    var panelW = HUD_BIG ? 300 : 300, panelH = HUD_BIG ? 158 : 148;
    var panel = new PIXI.Graphics();
    panel.roundRect(10, 10, panelW, panelH, 12).fill({ color: 0x000000, alpha: 0.55 });
    hud.addChild(panel);
    // HUD avatar: hero crop in a circular mask (M0 drawn circle as fallback).
    // NOTE: the circle is ONLY for this small HUD portrait — the in-world
    // character is full-body (makeFullBody), never a badge.
    if (TEX.hero) {
      var avSpr = new PIXI.Sprite(TEX.hero);
      var avR = HUD_BIG ? 22 : 22, avCx = HUD_BIG ? 40 : 38, avCy = HUD_BIG ? 40 : 38;
      avSpr.anchor.set(0.5, 0.5);
      avSpr.width = avR * 2; avSpr.height = avR * 2;
      avSpr.position.set(avCx, avCy);
      var avMask = new PIXI.Graphics();
      avMask.circle(avCx, avCy, avR).fill(0xffffff);
      hud.addChild(avMask);
      hud.addChild(avSpr);
      avSpr.mask = avMask;
      var avRing = new PIXI.Graphics();
      avRing.circle(avCx, avCy, avR).stroke({ width: 3, color: 0xffffff });
      hud.addChild(avRing);
    } else {
      var avatar = new PIXI.Graphics();
      avatar.circle(38, 38, 22).fill(0x2980b9);
      avatar.circle(38, 38, 22).stroke({ width: 3, color: 0xffffff });
      avatar.circle(38, 34, 8).fill(0xffd9b3);
      avatar.roundRect(28, 42, 20, 12, 5).fill(0xffffff);
      hud.addChild(avatar);
    }
    var nameT = text(playerState.name, HUD_BIG ? 15 : 15, 0xffffff, true);
    nameT.anchor.set(0, 0.5); nameT.position.set(HUD_BIG ? 70 : 68, HUD_BIG ? 26 : 26); hud.addChild(nameT);
    var jobT = text('Nghề: Chưa có', HUD_BIG ? 12 : 12, 0xdddddd);
    jobT.anchor.set(0, 0.5); jobT.position.set(HUD_BIG ? 70 : 68, HUD_BIG ? 46 : 46); hud.addChild(jobT);

    hudRefs.hpG = new PIXI.Graphics(); hud.addChild(hudRefs.hpG);
    hudRefs.hungerG = new PIXI.Graphics(); hud.addChild(hudRefs.hungerG);
    hudRefs.staminaG = new PIXI.Graphics(); hud.addChild(hudRefs.staminaG);
    // bar geometry (shared with updateHUD): M2 bars 16px tall (was 20)
    hudRefs.barGeom = HUD_BIG
      ? { x: 74, w: 212, h: 16, ys: [68, 90, 112], labelX: 14, labelYs: [76, 98, 120], labelSize: 13 }
      : { x: 52, w: 190, h: 14, ys: [61, 79, 97], labelX: 14, labelYs: [68, 86, 104], labelSize: 12 };
    var bg = hudRefs.barGeom;
    barLabel('HP', bg.labelX, bg.labelYs[0], hud, bg.labelSize);
    barLabel('Đói', bg.labelX, bg.labelYs[1], hud, bg.labelSize);
    barLabel('Thể lực', bg.labelX, bg.labelYs[2], hud, bg.labelSize);
    hudRefs.moneyT = text('', HUD_BIG ? 14 : 14, 0xffe082, true);
    hudRefs.moneyT.anchor.set(0, 0); hudRefs.moneyT.position.set(14, HUD_BIG ? 134 : 122); hud.addChild(hudRefs.moneyT);

    // top-right: minimap + clock
    hudRefs.minimapWrap = new PIXI.Container(); hud.addChild(hudRefs.minimapWrap);
    minimapMask = new PIXI.Graphics();
    minimapMask.circle(0, 0, 65).fill(0xffffff);
    hudRefs.minimapWrap.addChild(minimapMask);
    minimapG = new PIXI.Graphics();
    minimapG.mask = minimapMask;
    hudRefs.minimapWrap.addChild(minimapG);
    var ring = new PIXI.Graphics();
    ring.circle(0, 0, 65).stroke({ width: 4, color: 0xffffff });
    hudRefs.minimapWrap.addChild(ring);
    hudRefs.clockT = text('08:00', HUD_BIG ? 14 : 16, 0xffffff, true);
    hudRefs.clockT.anchor.set(0.5, 0);
    hud.addChild(hudRefs.clockT);

    // bottom hint bar — M2: shortened on mobile + smaller font so it fits
    // 390px wide (the M1 hint overflowed the screen width).
    hudRefs.hintT = text(HUD_BIG
      ? 'Joystick: di chuyển  •  CHẠY: chạy nhanh  •  Giữ: mở menu'
      : 'WASD / Mũi tên: di chuyển  •  Shift: chạy nhanh  •  Chuột phải / chạm giữ: mở menu', HUD_BIG ? 12 : 14, 0xffffff, false);
    hudRefs.hintT.anchor.set(0.5, 0.5);
    hudRefs.hintT.style.stroke = { color: 0x000000, width: 4 };
    hud.addChild(hudRefs.hintT);

    hudRefs.fpsT = text('60 FPS', 12, 0xdddddd);
    hudRefs.fpsT.anchor.set(1, 1);
    hud.addChild(hudRefs.fpsT);

    // M3 (§6.2): order status line — countdown + distance + reward, shown
    // top-centre under the netStatus pill while an order is active.
    hudRefs.orderT = text('', 14, 0xffe082, true);
    hudRefs.orderT.anchor.set(0.5, 0);
    hudRefs.orderT.style.stroke = { color: 0x000000, width: 4 };
    hud.addChild(hudRefs.orderT);
    // M3: keep the HUD job label in sync (buildHUD only set the initial text).
    hudRefs.jobT = jobT;

    buildJoystick();
    buildZoomControls();
    layoutHUD();
  }

  // ---------- zoom controls (Canvas +/- buttons under the minimap) ----------
  function buildZoomControls() {
    function mkZoomBtn(label) {
      var b = new PIXI.Container();
      var g = new PIXI.Graphics();
      g.circle(0, 0, 20).fill({ color: 0x000000, alpha: 0.55 });
      g.circle(0, 0, 20).stroke({ width: 2, color: 0xffffff });
      b.addChild(g);
      var t = text(label, 22, 0xffffff, true);
      t.anchor.set(0.5, 0.5);
      b.addChild(t);
      b.eventMode = 'static';
      b.cursor = 'pointer';
      hud.addChild(b);
      return b;
    }
    zoomOutBtn = mkZoomBtn('-');
    zoomOutBtn.on('pointerdown', function (e) { e.stopPropagation(); setZoom(zoom - ZOOM_STEP); });
    zoomInBtn = mkZoomBtn('+');
    zoomInBtn.on('pointerdown', function (e) { e.stopPropagation(); setZoom(zoom + ZOOM_STEP); });
    zoomLabel = text('Zoom ' + zoom.toFixed(2) + 'x', 12, 0xffffff, true);
    zoomLabel.anchor.set(0.5, 0.5);
    zoomLabel.style.stroke = { color: 0x000000, width: 4 };
    hud.addChild(zoomLabel);
  }

  function setZoom(z) {
    zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z * 100) / 100));
    if (zoomLabel) zoomLabel.text = 'Zoom ' + zoom.toFixed(2) + 'x';
    updateCamera();
  }

  function drawBar(g, x, y, w, h, value, color) {
    g.clear();
    g.roundRect(x, y, w, h, h / 2).fill({ color: 0x000000, alpha: 0.6 });
    if (value > 0) {
      g.roundRect(x, y, Math.max(h, w * Math.max(0, Math.min(1, value / 100))), h, h / 2).fill(color);
    }
    g.roundRect(x, y, w, h, h / 2).stroke({ width: 1, color: 0xffffff, alpha: 0.6 });
  }

  function updateHUD() {
    var bg = hudRefs.barGeom || { x: 52, w: 190, h: 14, ys: [61, 79, 97] };
    drawBar(hudRefs.hpG, bg.x, bg.ys[0], bg.w, bg.h, playerState.hp, 0xe74c3c);
    drawBar(hudRefs.hungerG, bg.x, bg.ys[1], bg.w, bg.h, playerState.hunger, 0xe67e22);
    drawBar(hudRefs.staminaG, bg.x, bg.ys[2], bg.w, bg.h, playerState.stamina, 0x2ecc71);
    // M3: job label follows the chosen job (Shipper / Bác sĩ / Tài xế).
    if (hudRefs.jobT) hudRefs.jobT.text = 'Nghề: ' + (JOB_LABELS[playerState.job] || 'Chưa có');
    // M3 (§6.2): active order — countdown + distance + reward.
    if (hudRefs.orderT) {
      var order = currentOrder();
      if (order) {
        var secLeft = Math.max(0, Math.ceil((order.deadlineAt - Date.now()) / 1000));
        var d = Math.round(Math.hypot(order.targetX - playerState.x, order.targetY - playerState.y));
        hudRefs.orderT.text = 'Giao hàng: còn ' + secLeft + 's • cách ' + d + 'm • thưởng ' +
          Math.floor(order.reward).toLocaleString('vi-VN') + 'đ';
      } else hudRefs.orderT.text = '';
    }
    var cashStr = 'Tiền mặt: ' + Math.floor(playerState.cash).toLocaleString('vi-VN') + 'đ';
    var bankStr = 'Ngân hàng: ' + Math.floor(playerState.bank).toLocaleString('vi-VN') + 'đ';
    // M2: ONE line, panel is 300px wide; shrink the font if a big balance
    // would overflow the panel (user: "chữ không đúng trong khung").
    var moneySize = 14;
    hudRefs.moneyT.style.fontSize = moneySize;
    hudRefs.moneyT.text = cashStr + '  •  ' + bankStr;
    while (hudRefs.moneyT.width > 272 && moneySize > 11) {
      moneySize -= 1;
      hudRefs.moneyT.style.fontSize = moneySize;
    }
    var hh = Math.floor(worldTime / 60) % 24, mm = Math.floor(worldTime % 60);
    var clockStr = (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm;
    var isNight = hh >= 18 || hh < 6;
    hudRefs.clockT.text = clockStr + (isNight ? '  •  Đêm' : '  •  Ngày');
  }

  // M3: the active Shipper order, from the server state (online, synced
  // into playerState.order by syncSelf) or the local engine (offline).
  function currentOrder() {
    if (netMode === 'online') {
      var o = playerState.order;
      return (o && o.status === 'accepted') ? o : null;
    }
    if (typeof Jobs !== 'undefined' && Jobs.getOrder) return Jobs.getOrder();
    return null;
  }

  // M3 (§6.2): redraw the delivery arrow — a yellow line from the player
  // toward the target with a triangle head 90 px out, so the player always
  // knows which way to run. Hidden when there is no active order.
  function updateOrderArrow() {
    if (!orderArrow) return;
    var order = currentOrder();
    if (!order) { orderArrow.visible = false; return; }
    var dx = order.targetX - playerState.x, dy = order.targetY - playerState.y;
    var d = Math.hypot(dx, dy);
    if (d < 30) { orderArrow.visible = false; return; }
    var ux = dx / d, uy = dy / d;
    var hx = playerState.x + ux * 90, hy = playerState.y + uy * 90;
    orderArrow.clear();
    orderArrow.moveTo(playerState.x, playerState.y);
    orderArrow.lineTo(hx, hy);
    orderArrow.stroke({ width: 4, color: 0xf1c40f, alpha: 0.9 });
    // triangle head at (hx, hy), pointing along (ux, uy)
    var px = -uy, py = ux; // perpendicular
    orderArrow.moveTo(hx + ux * 18, hy + uy * 18);
    orderArrow.lineTo(hx - ux * 6 + px * 12, hy - uy * 6 + py * 12);
    orderArrow.lineTo(hx - ux * 6 - px * 12, hy - uy * 6 - py * 12);
    orderArrow.closePath().fill(0xf1c40f);
    orderArrow.visible = true;
  }

  // M3 (§3.2.4): faint panel — countdown + "Về Bệnh viện" button, which
  // only enables 10 s after fainting (so a doctor has time to arrive).
  function updateFaintPanel() {
    if (!faintPanelEl) return;
    if (!playerState.isFainted) { faintPanelEl.classList.remove('open'); return; }
    faintPanelEl.classList.add('open');
    var now = Date.now();
    var until = faintInfo ? faintInfo.until : now + 60000;
    var at = faintInfo ? faintInfo.at : now;
    var left = Math.max(0, Math.ceil((until - now) / 1000));
    var elapsed = Math.floor((now - at) / 1000);
    if (faintTextEl) {
      faintTextEl.textContent = 'Tự về Bệnh viện sau ' + left + 's — hoặc gọi bác sĩ trong chat (kênh Gần / Thế giới).';
    }
    if (hospitalBtnEl) hospitalBtnEl.disabled = elapsed < 10;
  }

  function drawMinimap() {
    var s = 130 / MAP_W;
    minimapG.clear();
    minimapG.circle(0, 0, 65).fill(0x5da24a);
    // roads (Map v2: 180px bands)
    ROAD_BANDS.forEach(function (p) {
      minimapG.rect(-65, (p + ROAD_W / 2) * s - 65, 130, ROAD_W * s).fill(0x3d3d3d);
      minimapG.rect((p + ROAD_W / 2) * s - 65, -65, ROAD_W * s, 130).fill(0x3d3d3d);
    });
    BUILDINGS.forEach(function (b) {
      minimapG.rect(b.x * s - 65, b.y * s - 65, b.w * s, b.h * s).fill(0x888888);
    });
    POIS.forEach(function (p) {
      minimapG.circle(p.x * s - 65, p.y * s - 65, 3.5).fill(p.color);
    });
    npcs.forEach(function (n) {
      minimapG.circle(n.x * s - 65, n.y * s - 65, 3).fill(0xdddddd);
    });
    // Map v2 §7: animals as small brown dots on the minimap.
    animals.forEach(function (a) {
      minimapG.circle(a.x * s - 65, a.y * s - 65, 2).fill(0x8d6e63);
    });
    // M1: remote players (humans white, bots yellow) — dots big enough to tell apart
    Object.keys(remotePlayers).forEach(function (id) {
      var r = remotePlayers[id];
      minimapG.circle(r.rx * s - 65, r.ry * s - 65, r.isBot ? 3.5 : 4).fill(r.isBot ? 0xf1c40f : 0xffffff);
      // M3 (§3.2.3): a fainted remote player shows a red ring so a doctor
      // can spot them on the minimap.
      if (r.isFainted) minimapG.circle(r.rx * s - 65, r.ry * s - 65, 6).stroke({ width: 2, color: 0xe74c3c });
    });
    // M3 (§3.4.3): faint alerts from the server — red X where someone fainted.
    var now = Date.now();
    faintAlerts = faintAlerts.filter(function (a) { return now < a.until; });
    faintAlerts.forEach(function (a) {
      var ax = a.x * s - 65, ay = a.y * s - 65;
      minimapG.moveTo(ax - 5, ay - 5); minimapG.lineTo(ax + 5, ay + 5);
      minimapG.moveTo(ax + 5, ay - 5); minimapG.lineTo(ax - 5, ay + 5);
      minimapG.stroke({ width: 2.5, color: 0xe74c3c });
    });
    // M3 (§6.2): delivery target — green diamond on the minimap.
    var order = currentOrder();
    if (order) {
      var ox = order.targetX * s - 65, oy = order.targetY * s - 65;
      minimapG.moveTo(ox, oy - 6); minimapG.lineTo(ox + 6, oy);
      minimapG.lineTo(ox, oy + 6); minimapG.lineTo(ox - 6, oy);
      minimapG.closePath().fill(0x2ecc71);
    }
    minimapG.circle(playerState.x * s - 65, playerState.y * s - 65, 5.5).fill(0xffffff);
    minimapG.circle(playerState.x * s - 65, playerState.y * s - 65, 5.5).stroke({ width: 1.5, color: 0x2980b9 });
  }

  // ---------- virtual joystick + sprint (Canvas) ----------
  var joyBase, joyKnob, sprintBtn;
  function buildJoystick() {
    joyBase = new PIXI.Container();
    var baseG = new PIXI.Graphics();
    // M2: joystick base 100px diameter (r=50, was 104), knob r=20 (was 22).
    baseG.circle(0, 0, 50).fill({ color: 0xffffff, alpha: 0.18 });
    baseG.circle(0, 0, 50).stroke({ width: 2, color: 0xffffff, alpha: 0.6 });
    joyBase.addChild(baseG);
    joyKnob = new PIXI.Graphics();
    joyKnob.circle(0, 0, 20).fill({ color: 0xffffff, alpha: 0.55 });
    joyBase.addChild(joyKnob);
    joyBase.eventMode = 'static';
    joyBase.on('pointerdown', function (e) { if (pinchActive) return; joy.active = true; joy.id = e.pointerId; updateJoy(e); });
    joyBase.on('pointermove', function (e) { if (joy.active && e.pointerId === joy.id) updateJoy(e); });
    joyBase.on('pointerup', endJoy);
    joyBase.on('pointerupoutside', endJoy);
    hud.addChild(joyBase);

    sprintBtn = new PIXI.Container();
    var sg = new PIXI.Graphics();
    // M2: CHẠY button 56px diameter (r=28, was 80px) — user asked smaller.
    sg.circle(0, 0, 28).fill({ color: 0xe67e22, alpha: 0.85 });
    sg.circle(0, 0, 28).stroke({ width: 3, color: 0xffffff });
    sprintBtn.addChild(sg);
    var st = text('CHẠY', 13, 0xffffff, true);
    st.anchor.set(0.5, 0.5);
    sprintBtn.addChild(st);
    sprintBtn.eventMode = 'static';
    sprintBtn.cursor = 'pointer';
    sprintBtn.on('pointerdown', function () { sprintTouch = true; });
    sprintBtn.on('pointerup', function () { sprintTouch = false; });
    sprintBtn.on('pointerupoutside', function () { sprintTouch = false; });
    hud.addChild(sprintBtn);
  }
  function updateJoy(e) {
    var cx = joyBase.x, cy = joyBase.y;
    var gx = e.global ? e.global.x : e.clientX;
    var gy = e.global ? e.global.y : e.clientY;
    var dx = gx - cx, dy = gy - cy;
    var len = Math.hypot(dx, dy), max = 46;
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    joyKnob.position.set(dx, dy);
    joy.dx = dx / max; joy.dy = dy / max;
  }
  function endJoy() {
    joy.active = false; joy.id = null; joy.dx = 0; joy.dy = 0;
    joyKnob.position.set(0, 0);
  }

  function layoutHUD() {
    var W = app.renderer.width, H = app.renderer.height;
    if (hudRefs.minimapWrap) {
      hudRefs.minimapWrap.position.set(W - 82, 82);
      minimapMask.position.set(0, 0);
    }
    if (hudRefs.clockT) hudRefs.clockT.position.set(W - 82, 152);
    if (hudRefs.orderT) hudRefs.orderT.position.set(W / 2, 36);
    if (hudRefs.hintT) hudRefs.hintT.position.set(W / 2, H - 18);
    if (hudRefs.fpsT) hudRefs.fpsT.position.set(W - 10, H - 8);
    if (joyBase) joyBase.position.set(78, H - 84);
    if (sprintBtn) sprintBtn.position.set(W - 78, H - 84);
    if (zoomOutBtn) zoomOutBtn.position.set(W - 122, 202);
    if (zoomInBtn) zoomInBtn.position.set(W - 42, 202);
    if (zoomLabel) zoomLabel.position.set(W - 82, 236);
    if (nightOverlay) {
      nightOverlay.clear();
      nightOverlay.rect(0, 0, W, H).fill(0x0a1a3a);
    }
    if (startOverlay) layoutStart();
  }

  // ---------- night overlay ----------
  function buildNightOverlay() {
    nightOverlay = new PIXI.Graphics();
    nightOverlay.eventMode = 'none';
    nightOverlay.alpha = 0;
    app.stage.addChild(nightOverlay);
    // keep HUD above it: re-add hud on top if it already exists
    if (hud) app.stage.addChild(hud);
    if (startOverlay) app.stage.addChild(startOverlay);
  }
  function darknessFor(hour) {
    if (hour >= 18 || hour < 6) return 0.38;
    if (hour >= 17 && hour < 18) return 0.38 * (hour - 17);
    if (hour >= 6 && hour < 7) return 0.38 * (7 - hour);
    return 0;
  }

  // ---------- start screen (Canvas) ----------
  function buildStart() {
    startOverlay = new PIXI.Container();
    // start-screen backdrop: the aerial city image, dimmed behind the title
    var backdrop = null;
    if (TEX.plaza) {
      backdrop = new PIXI.Sprite(TEX.plaza);
      backdrop.alpha = 0.5;
      startOverlay.addChild(backdrop);
    }
    var bg = new PIXI.Graphics();
    bg.rect(0, 0, 10, 10).fill({ color: 0x0d1b2a, alpha: 0.88 });
    startOverlay.addChild(bg);
    startOverlay.userData = { bg: bg, backdrop: backdrop };
    var title = text('CUỘC SỐNG ẢO', 44, 0xffe082, true);
    title.anchor.set(0.5, 0.5);
    var sub = text('M3  •  PixiJS v8  •  Colyseus  •  Shipper + Sinh tồn + NPC', 16, 0xffffff);
    sub.anchor.set(0.5, 0.5);
    var statusT = text('Đang kiểm tra máy chủ…', 14, 0xffe082, true);
    statusT.anchor.set(0.5, 0.5);
    // M2: guide is word-wrapped to the screen width — the M1 guide lines
    // overflowed a 390px phone screen ("chữ không đúng trong khung").
    var guide = text(
      'Joystick: di chuyển  •  Nút CHẠY: chạy nhanh\n' +
      'Chạm giữ vào NPC / địa điểm: mở menu tròn\n' +
      'Bấm NGHỀ để chọn Shipper / Bác sĩ, nhận đơn ở Kho Hàng.\n' +
      'Tới Cửa Hàng mua bánh mì, tới Ngân Hàng gửi tiền.', 14, 0xdddddd);
    guide.anchor.set(0.5, 0.5);
    guide.style.wordWrap = true;
    guide.style.wordWrapWidth = 340;
    var btn = new PIXI.Container();
    var btnG = new PIXI.Graphics();
    btnG.roundRect(-110, -28, 220, 56, 14).fill(0x27ae60);
    btnG.roundRect(-110, -28, 220, 56, 14).stroke({ width: 3, color: 0xffffff });
    btn.addChild(btnG);
    var btnT = text('BẮT ĐẦU', 22, 0xffffff, true);
    btnT.anchor.set(0.5, 0.5);
    btn.addChild(btnT);
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerdown', function () {
      started = true;
      startOverlay.visible = false;
    });
    startOverlay.addChild(title, sub, guide, btn, statusT);
    startOverlay.userData.title = title;
    startOverlay.userData.sub = sub;
    startOverlay.userData.guide = guide;
    startOverlay.userData.btn = btn;
    startOverlay.userData.statusT = statusT;
    app.stage.addChild(startOverlay);
    layoutStart();
  }
  function layoutStart() {
    if (!startOverlay) return;
    var W = app.renderer.width, H = app.renderer.height;
    var bg = startOverlay.userData.bg;
    bg.clear();
    // dimmer is lighter when the aerial backdrop is showing through
    bg.rect(0, 0, W, H).fill({ color: 0x0d1b2a, alpha: startOverlay.userData.backdrop ? 0.55 : 0.88 });
    var bd = startOverlay.userData.backdrop;
    if (bd) {
      var s = Math.max(W / 1024, H / 1024);
      bd.width = 1024 * s; bd.height = 1024 * s;
      bd.position.set((W - bd.width) / 2, (H - bd.height) / 2);
    }
    startOverlay.userData.title.position.set(W / 2, H / 2 - 90);
    startOverlay.userData.sub.position.set(W / 2, H / 2 - 46);
    startOverlay.userData.guide.style.wordWrapWidth = Math.min(560, W - 40);
    startOverlay.userData.guide.position.set(W / 2, H / 2 + 6);
    startOverlay.userData.btn.position.set(W / 2, H / 2 + 78);
    if (startOverlay.userData.statusT) startOverlay.userData.statusT.position.set(W / 2, H / 2 + 136);
  }

  // ---------- movement / collision ----------
  function tryMove(x, y, r) {
    // axis-separated: caller moves one axis at a time
    return !blocked(x, y, r);
  }

  // Current movement input, shared by updatePlayer (local prediction) and
  // moveTick (20 Hz network send). Same shape the server expects.
  function readInput() {
    var ix = 0, iy = 0;
    if (keys['KeyW'] || keys['ArrowUp']) iy -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) iy += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) ix -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) ix += 1;
    if (joy.active) { ix += joy.dx; iy += joy.dy; }
    var len = Math.hypot(ix, iy);
    if (len > 1) { ix /= len; iy /= len; }
    return { dx: ix, dy: iy, len: len, wantSprint: !!(keys['ShiftLeft'] || keys['ShiftRight'] || sprintTouch) };
  }

  function updatePlayer(dt) {
    var inp = readInput();
    var ix = inp.dx, iy = inp.dy, len = inp.len;

    // M3 (§3.2.3): a fainted player cannot move, work or buy — but CAN
    // still chat (sendChatFromInput does not check isFainted).
    if (playerState.isFainted) {
      playerState.vx = 0; playerState.vy = 0; playerState.anim = 'fainted';
      lastInput = { dx: 0, dy: 0, sprint: false, len: 0 };
      if (netMode !== 'online') offlineSurvival(dt);
      var face = (player.userData && player.userData.face) || player;
      face.scale.y = 1;
      return;
    }

    // input shape (Colyseus-ready): {dx, dy, sprint}
    // M3 (§7.4 step 3, same as server): sprint is blocked below 10 stamina.
    var sprinting = inp.wantSprint && len > 0.1 && playerState.stamina >= 10;
    var speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (playerState.hunger < 20) speed *= 0.7;
    var input = { dx: ix, dy: iy, sprint: sprinting };
    lastInput = { dx: ix, dy: iy, sprint: sprinting, len: len };

    var nx = playerState.x + input.dx * speed * dt;
    var ny = playerState.y + input.dy * speed * dt;
    if (tryMove(nx, playerState.y, 14)) playerState.x = nx;
    if (tryMove(playerState.x, ny, 14)) playerState.y = ny;
    playerState.x = Math.max(20, Math.min(MAP_W - 20, playerState.x));
    playerState.y = Math.max(20, Math.min(MAP_H - 20, playerState.y));
    playerState.vx = input.dx * speed;
    playerState.vy = input.dy * speed;
    playerState.anim = len > 0.1 ? (sprinting ? 'run' : 'walk') : 'idle';

    // stamina / hunger are server-authoritative when online — never apply
    // them locally there, or the client and server will fight each other.
    if (netMode !== 'online') {
      if (sprinting) playerState.stamina = Math.max(0, playerState.stamina - 5 * dt);
      else playerState.stamina = Math.min(100, playerState.stamina + 3 * dt);
      offlineSurvival(dt);
    }

    player.position.set(playerState.x, playerState.y);
    // flip/bob the badge face (not the whole container — the name label
    // must not mirror); for the M0 fallback person the face IS the container.
    var face2 = (player.userData && player.userData.face) || player;
    face2.scale.y = playerState.anim === 'idle' ? 1 : 1 + Math.sin(performance.now() / 90) * 0.03;
    // direction indicator: flip by horizontal movement
    if (input.dx < -0.1) face2.scale.x = -1;
    else if (input.dx > 0.1) face2.scale.x = 1;
  }

  // M3 (§3.2, offline mirror of the server _secondTick): Hunger -1/15s,
  // Hunger=0 -> -2 HP/10s, Hunger>50 -> +1 HP/10s, HP=0 -> faint (lose 50%
  // Cash immediately), fainted 60s -> hospital auto-revive with fee.
  // Called every frame while offline; accumulators make it frame-rate
  // independent. Online the server does all of this — never call it there.
  function offlineSurvival(dt) {
    if (playerState.isFainted) {
      if (faintInfo && Date.now() >= faintInfo.until) offlineHospitalRevive('auto');
      return;
    }
    localSurv.hungerAcc += dt;
    if (localSurv.hungerAcc >= 15) {
      localSurv.hungerAcc -= 15;
      playerState.hunger = Math.max(0, playerState.hunger - 1);
    }
    if (playerState.hunger === 0) {
      localSurv.hpLossAcc += dt;
      if (localSurv.hpLossAcc >= 10) {
        localSurv.hpLossAcc -= 10;
        playerState.hp = Math.max(0, playerState.hp - 2);
        localSurv.regenAcc = 0;
      }
    } else {
      localSurv.hpLossAcc = 0;
      if (playerState.hunger > 50) {
        localSurv.regenAcc += dt;
        if (localSurv.regenAcc >= 10) {
          localSurv.regenAcc -= 10;
          playerState.hp = Math.min(100, playerState.hp + 1);
        }
      } else localSurv.regenAcc = 0;
    }
    if (playerState.hp <= 0) offlineFaint();
  }

  function offlineFaint() {
    playerState.hp = 0;
    playerState.isFainted = true;
    playerState.anim = 'fainted';
    playerState.vx = 0; playerState.vy = 0;
    var now = Date.now();
    faintInfo = { at: now, until: now + 60000 };
    var lost = 0;
    if (typeof Economy !== 'undefined' && Economy.faintLoss) {
      lost = Economy.faintLoss().lost || 0;
    } else {
      lost = Math.floor(playerState.cash / 2);
      playerState.cash -= lost;
    }
    if (typeof Jobs !== 'undefined' && Jobs.onLocalFaint) Jobs.onLocalFaint();
    sfx('faint');
    vfx('faint', playerState.x, playerState.y, player);
    appendChatLog('', '', 'Bạn đã ngất xỉu! Mất ' + Math.floor(lost).toLocaleString('vi-VN') +
      'đ tiền mặt. Gọi bác sĩ trong chat, hoặc bấm "Về Bệnh viện" sau 10s.', true);
    showBubble(playerState.x, playerState.y, 'Cứu tôi với! Tôi ngất rồi…', 4000);
  }

  // M3 (§3.2.4/§3.2.5): hospital revive — 50 HP, 50 stamina, teleport to
  // the hospital, fee = 10.000 + 50% of remaining Cash (Cash first, then Bank).
  function offlineHospitalRevive(how) {
    var res = { fee: 0, paid: 0 };
    if (typeof Economy !== 'undefined' && Economy.hospitalFee) {
      res = Economy.hospitalFee();
    } else {
      var fee = 10000 + Math.floor(playerState.cash / 2);
      var fromCash = Math.min(playerState.cash, fee);
      playerState.cash -= fromCash;
      var fromBank = Math.min(playerState.bank, fee - fromCash);
      playerState.bank -= fromBank;
      res = { fee: fee, paid: fromCash + fromBank };
    }
    playerState.x = 4125; playerState.y = 1635; // Bệnh Viện POI (Map v2)
    playerState.hp = 50; playerState.stamina = 50;
    playerState.isFainted = false; playerState.anim = 'idle';
    faintInfo = null;
    localSurv.hungerAcc = 0; localSurv.hpLossAcc = 0; localSurv.regenAcc = 0;
    if (player) player.position.set(playerState.x, playerState.y);
    sfx('hospital');
    vfx('revive', playerState.x, playerState.y);
    vfx('unfaint', player);
    appendChatLog('', '', 'Bạn đã hồi sinh tại Bệnh viện (50 HP). Phí ' +
      Math.floor(res.paid).toLocaleString('vi-VN') + 'đ' +
      (how === 'auto' ? ' (hết 60s ngất).' : ' (tự về bệnh viện).'), true);
  }

  // M1: send local input to the server at 20 Hz (every 50 ms) with an
  // incrementing seq — when input changes, or at least every 100 ms while moving.
  function moveTick(dt) {
    if (netMode !== 'online' || !started) return;
    if (typeof NetClient === 'undefined' || !NetClient.connected) return;
    moveAccumMs += dt * 1000;
    if (moveAccumMs < 50) return;
    moveAccumMs = 0;
    var inp = lastInput;
    var now = performance.now();
    var changed = Math.abs(inp.dx - lastSentMove.dx) > 0.01 ||
      Math.abs(inp.dy - lastSentMove.dy) > 0.01 ||
      inp.sprint !== lastSentMove.sprint;
    var moving = inp.len > 0.1;
    if (changed || (moving && now - lastMoveSentAt >= 100) || (!moving && lastSentMove.len > 0.1)) {
      moveSeq += 1;
      if (NetClient.sendMove(moveSeq, Math.round(inp.dx * 1000) / 1000, Math.round(inp.dy * 1000) / 1000, inp.sprint)) {
        lastSentMove = { dx: inp.dx, dy: inp.dy, sprint: inp.sprint, len: inp.len };
        lastMoveSentAt = now;
      }
    }
  }

  function updateNPCs(dt) {
    npcs.forEach(function (n) {
      if (n.speed === 0 && netMode !== 'online') return; // tutorial NPC stays put (offline)
      if (netMode === 'online') {
        // server-driven: interpolate toward the server target (n.tx/n.ty,
        // set from state.npcs patches; guide target never moves)
        var tdx = (n.tx !== undefined ? n.tx : n.x) - n.x;
        var tdy = (n.ty !== undefined ? n.ty : n.y) - n.y;
        var td = Math.hypot(tdx, tdy);
        if (td > 1) {
          var k = Math.min(1, dt * 10);
          n.x += tdx * k; n.y += tdy * k;
          n.container.position.set(n.x, n.y);
          if (tdx < -0.5) n.container.scale.x = -1;
          else if (tdx > 0.5) n.container.scale.x = 1;
        }
        return;
      }
      var dx = n.targetX - n.x, dy = n.targetY - n.y;
      var d = Math.hypot(dx, dy);
      if (d < 12) {
        var p = randomOpenPoint();
        n.targetX = p.x; n.targetY = p.y;
        return;
      }
      var stepX = dx / d * n.speed * dt;
      var stepY = dy / d * n.speed * dt;
      var nx = n.x + stepX, ny = n.y + stepY;
      if (blocked(nx, n.y, 14)) { var p2 = randomOpenPoint(); n.targetX = p2.x; n.targetY = p2.y; return; }
      if (blocked(n.x, ny, 14)) { var p3 = randomOpenPoint(); n.targetX = p3.x; n.targetY = p3.y; return; }
      n.x = nx; n.y = ny;
      n.container.position.set(n.x, n.y);
      if (stepX < -0.1) n.container.scale.x = -1;
      else if (stepX > 0.1) n.container.scale.x = 1;
    });
  }

  function updateCamera() {
    var W = app.renderer.width, H = app.renderer.height;
    // M2 zoom: mobile portrait 1.6x, desktop 1.2x, user-adjustable 1.0x–2.2x.
    // screenToWorld / culling divide by this same `scale`, so hit-testing
    // and culling stay correct at any zoom.
    scale = zoom;
    world.scale.set(scale);
    var vw = MAP_W * scale, vh = MAP_H * scale;
    var cx = playerState.x * scale, cy = playerState.y * scale;
    var wx = W / 2 - cx, wy = H / 2 - cy;
    if (vw <= W) wx = (W - vw) / 2; else wx = Math.max(W - vw, Math.min(0, wx));
    if (vh <= H) wy = (H - vh) / 2; else wy = Math.max(H - vh, Math.min(0, wy));
    world.x = wx; world.y = wy;
  }

  function updateCulling() {
    var left = -world.x / scale, top = -world.y / scale;
    var right = left + app.renderer.width / scale, bottom = top + app.renderer.height / scale;
    var pad = 80;
    for (var i = 0; i < cullables.length; i++) {
      var c = cullables[i];
      c.obj.visible = !(c.x + c.w < left - pad || c.x > right + pad || c.y + c.h < top - pad || c.y > bottom + pad);
      // keep cull rect in sync for NPCs (they move)
      if (c.obj === player) continue;
    }
    // NPC cull rects follow their containers
    for (var j = 0; j < cullables.length; j++) {
      var cc = cullables[j];
      if (cc.obj && cc.obj.userData) {
        cc.x = cc.obj.userData.x - 20; cc.y = cc.obj.userData.y - 30;
      }
    }
    player.visible = true;
    radialMenu.visible = radialMenu.visible; // menu is world-space, stays with target
    bubble.visible = bubble.visible;
  }

  // ---------- M1: asset loading (async, per-file fallback) ----------
  async function loadTextures() {
    var keys = Object.keys(ASSET_FILES);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      try { TEX[k] = await PIXI.Assets.load(ASSET_FILES[k]); }
      catch (e) { console.warn('[assets] failed to load ' + ASSET_FILES[k] + ', using M0 drawing:', e); TEX[k] = null; }
    }
  }

  // ---------- M1: remote players (humans + bots, online & offline) ----------
  function makeEntityBubble() {
    var b = new PIXI.Container();
    b.visible = false;
    b.position.set(0, -66);
    var bg = new PIXI.Graphics();
    bg.roundRect(-95, -58, 190, 48, 12).fill(0xffffff);
    bg.roundRect(-95, -58, 190, 48, 12).stroke({ width: 2, color: 0x333333 });
    bg.moveTo(-10, -10); bg.lineTo(10, -10); bg.lineTo(0, 2); bg.closePath().fill(0xffffff);
    b.addChild(bg);
    var t = text('', 15, 0x222222, false);
    t.anchor.set(0.5, 0.5);
    t.position.set(0, -34);
    t.style.wordWrap = true;
    t.style.wordWrapWidth = 170;
    b.addChild(t);
    return { container: b, text: t, timer: null };
  }

  function createRemotePlayer(p, opts) {
    opts = opts || {};
    // M2: remote players/bots are full-body characters, never circular badges.
    var container = makeFullBody(fullTexFor(p.avatar), p.name);
    container.position.set(p.x, p.y);
    var bub = makeEntityBubble();
    container.addChild(bub.container);
    world.addChild(container);
    var entry = {
      id: p.id, name: p.name, avatar: p.avatar || 'hero',
      container: container, face: (container.userData && container.userData.face) || container,
      label: (container.userData && container.userData.label) || null,
      bubble: bub.container, bubbleText: bub.text, bubbleTimer: null,
      rx: p.x, ry: p.y, tx: p.x, ty: p.y, x: p.x, y: p.y,
      isBot: !!opts.isBot, personaId: opts.personaId || null,
      isFainted: !!p.isFainted, lastBubbleText: '',
      wander: opts.wander || null, brain: opts.brain || null,
      nextProactiveAt: opts.nextProactiveAt || 0
    };
    container.userData = container.userData || {};
    container.userData.x = p.x; container.userData.y = p.y;
    // keep the entry itself reachable from the container for culling
    container.userData.entry = entry;
    remotePlayers[p.id] = entry;
    cullables.push({ obj: container, x: p.x - 20, y: p.y - 30, w: 40, h: 60 });
    return entry;
  }

  function removeRemotePlayer(id) {
    var entry = remotePlayers[id];
    if (!entry) return;
    if (entry.bubbleTimer) clearTimeout(entry.bubbleTimer);
    if (entry.container.parent) entry.container.parent.removeChild(entry.container);
    for (var i = cullables.length - 1; i >= 0; i--) {
      if (cullables[i].obj === entry.container) cullables.splice(i, 1);
    }
    delete remotePlayers[id];
  }

  function clearRemotePlayers() {
    Object.keys(remotePlayers).forEach(function (id) { removeRemotePlayer(id); });
    offlineBotsSpawned = false;
  }

  function showRemoteBubble(id, str, ms) {
    var entry = remotePlayers[id];
    if (!entry) return;
    entry.bubbleText.text = str;
    entry.bubble.visible = true;
    entry.lastBubbleText = str;
    if (entry.bubbleTimer) clearTimeout(entry.bubbleTimer);
    entry.bubbleTimer = setTimeout(function () { entry.bubble.visible = false; }, ms || 4000);
  }

  // Interpolate remote players between patches; offline bots wander locally.
  function updateRemotePlayers(dt) {
    var now = Date.now();
    Object.keys(remotePlayers).forEach(function (id) {
      var r = remotePlayers[id];
      if (netMode === 'offline' && r.wander) {
        // local wander (same rules as M0 NPCs / server bots)
        if (now < r.wander.pauseUntil) { /* paused */ }
        else {
          var dx = r.wander.targetX - r.rx, dy = r.wander.targetY - r.ry;
          var d = Math.hypot(dx, dy);
          if (d < 8) {
            r.wander.pauseUntil = now + 3000 + Math.random() * 5000;
            var p = randomOpenPoint();
            r.wander.targetX = p.x; r.wander.targetY = p.y;
          } else {
            var step = r.wander.speed * dt;
            var nx = r.rx + dx / d * step, ny = r.ry + dy / d * step;
            if (!blocked(nx, ny, 16)) { r.rx = nx; r.ry = ny; }
            else { var p2 = randomOpenPoint(); r.wander.targetX = p2.x; r.wander.targetY = p2.y; }
          }
        }
        // proactive chat: every 20-40 s, only when the player is within 600px
        if (now >= r.nextProactiveAt) {
          r.nextProactiveAt = now + 20000 + Math.random() * 20000;
          if (Math.hypot(r.rx - playerState.x, r.ry - playerState.y) <= 600) {
            var line = botPersonaLine(r.personaId);
            if (line) deliverChat({ fromId: r.id, fromName: r.name, channel: 'nearby', text: line, targetId: null, at: now });
          }
        }
      } else if (netMode === 'online') {
        var k = Math.min(1, dt * 10);
        var odx = r.tx - r.rx, ody = r.ty - r.ry;
        r.rx += odx * k; r.ry += ody * k;
        if (odx < -0.5) r.face.scale.x = -1;
        else if (odx > 0.5) r.face.scale.x = 1;
      }
      r.x = r.rx; r.y = r.ry;
      if (r.container.userData) { r.container.userData.x = r.rx; r.container.userData.y = r.ry; }
      r.container.position.set(r.rx, r.ry);
    });
  }

  // ---------- M1: offline bots (shared/botBrain.js, same rules as server) ----------
  function spawnOfflineBots() {
    if (offlineBotsSpawned) return;
    if (typeof BotBrain === 'undefined') { console.warn('[bots] BotBrain not loaded, offline bots disabled'); return; }
    BotBrain.PERSONAS.forEach(function (persona) {
      var sp = randomOpenPoint();
      var tgt = randomOpenPoint();
      createRemotePlayer(
        { id: 'bot-' + persona.id, name: persona.name, x: sp.x, y: sp.y, avatar: persona.avatar, isFainted: false },
        {
          isBot: true, personaId: persona.id,
          wander: { targetX: tgt.x, targetY: tgt.y, pauseUntil: 0, speed: 45 + Math.random() * 30 },
          brain: BotBrain.createBotState(persona.id),
          nextProactiveAt: Date.now() + 20000 + Math.random() * 20000
        }
      );
    });
    offlineBotsSpawned = true;
  }

  function botPersonaLine(personaId) {
    if (typeof BotBrain === 'undefined') return pick(TALK_LINES);
    var persona = null;
    BotBrain.PERSONAS.forEach(function (p) { if (p.id === personaId) persona = p; });
    if (!persona) return pick(TALK_LINES);
    var pool = persona.lines.filter(function (l) { return l !== (persona._lastLine || null); });
    var line = pool.length ? pick(pool) : pick(persona.lines);
    persona._lastLine = line;
    return line;
  }

  // M3 (§10.2): one random line from a walking NPC's persona (same
  // BotBrain personas the server uses — never the generic TALK_LINES).
  function npcPersonaLine(npc) {
    if (typeof BotBrain === 'undefined' || !npc || !npc.personaId) return pick(TALK_LINES);
    var persona = null;
    BotBrain.PERSONAS.forEach(function (p) { if (p.id === npc.personaId) persona = p; });
    if (!persona) return pick(TALK_LINES);
    var pool = persona.lines.filter(function (l) { return l !== npc.lastTalkLine; });
    var line = pool.length ? pick(pool) : pick(persona.lines);
    npc.lastTalkLine = line;
    return line;
  }

  // M3 (§3.5): the 5-step tutorial quest from the guide NPC.
  var TUTORIAL_QUEST = [
    '1. Nói chuyện với NPC Hướng Dẫn — nhận 50.000đ vốn khởi nghiệp',
    '2. Mua 1 Bánh mì ở Cửa Hàng Tiện Lợi và ăn (+40 Độ no)',
    '3. Làm Shipper: nhận 1 đơn ở Kho Hàng và giao thành công',
    '4. Gửi 20.000đ vào Bank tại ATM',
    '5. Hoàn thành cả 4 bước — thưởng 30.000đ + danh hiệu "Công dân chính thức"'
  ];
  function showTutorialQuest(t) {
    showBubble(t.x, t.y, 'Chào Công Dân mới! Xem nhiệm vụ tân thủ trong khung chat nhé.', 4000);
    appendChatLog('', '', '— Nhiệm vụ tân thủ —', true);
    TUTORIAL_QUEST.forEach(function (step) { appendChatLog('', '', step, true); });
  }

  function findCalledBotId(text) {
    if (typeof BotBrain === 'undefined') return null;
    var norm = BotBrain.stripDiacritics(text);
    for (var i = 0; i < BotBrain.PERSONAS.length; i++) {
      var persona = BotBrain.PERSONAS[i];
      for (var j = 0; j < persona.callNames.length; j++) {
        if (norm.indexOf(persona.callNames[j]) !== -1) return 'bot-' + persona.id;
      }
    }
    return null;
  }

  // Offline bot replies to a local chat message (mirrors the server:
  // 1-3 s delay, at most one bot answers, prefers the bot called by name).
  function offlineBotReplies(channel, text, targetId) {
    if (typeof BotBrain === 'undefined') return;
    var candidates = [];
    Object.keys(remotePlayers).forEach(function (id) {
      var r = remotePlayers[id];
      if (!r.isBot) return;
      if (channel === 'nearby' && Math.hypot(r.rx - playerState.x, r.ry - playerState.y) > 600) return;
      candidates.push(r);
    });
    if (!candidates.length) return;
    var chosen = null;
    if (targetId && remotePlayers[targetId] && remotePlayers[targetId].isBot) {
      chosen = remotePlayers[targetId];
    } else {
      var called = findCalledBotId(text);
      if (called && remotePlayers[called]) chosen = remotePlayers[called];
      else chosen = candidates[Math.floor(Math.random() * candidates.length)];
    }
    if (!chosen) return;
    var delay = 1000 + Math.random() * 2000;
    setTimeout(function () {
      if (netMode !== 'offline' || !remotePlayers[chosen.id]) return;
      var reply = BotBrain.respond(chosen.personaId, text, playerState.name, chosen.brain);
      if (!reply) return; // bot stays silent sometimes, same as server
      deliverChat({ fromId: chosen.id, fromName: chosen.name, channel: channel, text: reply, targetId: targetId || null, at: Date.now() });
    }, delay);
  }

  // ---------- M1: chat DOM ----------
  function channelLabel(ch) {
    return ch === 'world' ? 'Thế giới' : ch === 'private' ? 'Riêng' : 'Gần';
  }

  function buildChat() {
    chatEls.panel = document.getElementById('chatPanel');
    chatEls.log = document.getElementById('chatLog');
    chatEls.input = document.getElementById('chatInput');
    chatEls.btn = document.getElementById('chatBtn');
    chatEls.status = document.getElementById('netStatus');
    if (!chatEls.panel || !chatEls.log || !chatEls.input) return;
    var tabs = chatEls.panel.querySelectorAll('#chatTabs button[data-channel]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { setChatChannel(tab.getAttribute('data-channel')); });
    });
    var closeBtn = document.getElementById('chatClose');
    if (closeBtn) closeBtn.addEventListener('click', closeChat);
    if (chatEls.btn) chatEls.btn.addEventListener('click', function () { if (chatOpen) closeChat(); else openChat(); });
    var sendBtn = document.getElementById('chatSend');
    if (sendBtn) sendBtn.addEventListener('click', sendChatFromInput);
    chatEls.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); sendChatFromInput(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeChat(); }
      e.stopPropagation();
    });
    chatEls.input.addEventListener('focus', function () { chatInputFocused = true; });
    chatEls.input.addEventListener('blur', function () { chatInputFocused = false; });
  }

  function openChat() {
    if (!chatEls.panel) return;
    chatOpen = true;
    chatEls.panel.classList.add('open');
    if (chatEls.input) chatEls.input.focus();
  }
  function closeChat() {
    chatOpen = false;
    if (chatEls.panel) chatEls.panel.classList.remove('open');
    if (chatEls.input) chatEls.input.blur();
  }

  function setChatChannel(ch) {
    chatChannel = ch;
    if (!chatEls.panel) return;
    var tabs = chatEls.panel.querySelectorAll('#chatTabs button[data-channel]');
    tabs.forEach(function (tab) {
      if (tab.getAttribute('data-channel') === ch) tab.classList.add('active');
      else tab.classList.remove('active');
    });
    if (chatEls.input) {
      chatEls.input.placeholder = ch === 'private' ? 'Nhắn riêng… (chọn người qua menu tròn)' : ch === 'world' ? 'Nhắn thế giới…' : 'Nhắn gần…';
    }
  }

  function appendChatLog(fromName, channel, text, isSys) {
    if (!chatEls.log) return;
    var div = document.createElement('div');
    div.className = 'line' + (isSys ? ' sys' : '');
    if (isSys) {
      div.textContent = text;
    } else {
      var color = channel === 'world' ? '#82cfff' : channel === 'private' ? '#f0a6ff' : '#a5e08a';
      var tag = document.createElement('span');
      tag.style.color = color;
      tag.textContent = '[' + channelLabel(channel) + '] ' + fromName + ': ';
      div.appendChild(tag);
      div.appendChild(document.createTextNode(text));
    }
    chatEls.log.appendChild(div);
    while (chatEls.log.children.length > 20) chatEls.log.removeChild(chatEls.log.firstChild);
    chatEls.log.scrollTop = chatEls.log.scrollHeight;
  }

  // Single delivery path for every chat message (online via server, offline
  // local): append to the log + show a bubble above the sender for 4 s.
  function deliverChat(msg) {
    if (!msg || !msg.text) return;
    appendChatLog(msg.fromName, msg.channel, msg.text, false);
    var fromId = msg.fromId;
    if (fromId === 'local-1' || (mySessionId && fromId === mySessionId)) {
      if (msg.text !== lastSelfBubbleText) {
        lastSelfBubbleText = msg.text;
        showBubble(playerState.x, playerState.y, msg.text, 4000);
      }
    } else if (remotePlayers[fromId]) {
      showRemoteBubble(fromId, msg.text, 4000);
    }
  }

  function nearestRemotePlayerId() {
    var best = null, bestD = 600;
    Object.keys(remotePlayers).forEach(function (id) {
      var r = remotePlayers[id];
      var d = Math.hypot(r.rx - playerState.x, r.ry - playerState.y);
      if (d < bestD) { bestD = d; best = id; }
    });
    return best;
  }

  function sendChatFromInput() {
    if (!chatEls.input) return;
    var textVal = chatEls.input.value.trim();
    if (!textVal) return;
    if (textVal.length > 200) {
      appendChatLog('', '', 'Tin nhắn quá dài (tối đa 200 ký tự).', true);
      return;
    }
    var channel = chatChannel;
    var targetId = null;
    if (channel === 'private') {
      targetId = chatTargetId || nearestRemotePlayerId();
      if (!targetId) {
        appendChatLog('', '', 'Chưa chọn người để nhắn riêng — chạm giữ vào một người chơi để mở menu.', true);
        return;
      }
    }
    chatEls.input.value = '';
    if (netMode === 'online' && typeof NetClient !== 'undefined' && NetClient.connected) {
      NetClient.sendChat(channel, textVal, targetId);
      // own message comes back via the server broadcast — no local echo
    } else {
      deliverChat({ fromId: 'local-1', fromName: playerState.name, channel: channel, text: textVal, targetId: targetId, at: Date.now() });
      offlineBotReplies(channel, textVal, targetId);
    }
    if (chatEls.input) chatEls.input.focus();
  }

  // ---------- M1: net integration ----------
  function setNetStatus(t) {
    if (chatEls.status) chatEls.status.textContent = t;
  }
  function setStartStatus(t) {
    if (startOverlay && startOverlay.userData && startOverlay.userData.statusT) {
      startOverlay.userData.statusT.text = t;
    }
  }

  function serverUrlFromPage() {
    try {
      var q = new URLSearchParams(window.location.search);
      var s = q.get('server');
      if (s) return s;
    } catch (e) { /* URLSearchParams unsupported — fall through */ }
    var host = window.location.hostname || '';
    if (host === 'localhost' || host === '127.0.0.1' || host === '') return 'ws://localhost:2567';
    return null; // no public server configured yet -> offline mode
  }

  function goOffline(reason) {
    console.log('[net] offline mode:', reason);
    netMode = 'offline';
    setNetStatus('Offline — chơi đơn');
    setStartStatus('Offline — chơi đơn (không có máy chủ)');
    clearRemotePlayers();
    spawnOfflineBots();
  }

  function syncSelf(p) {
    // authoritative stats from the server
    playerState.hp = p.hp; playerState.hunger = p.hunger; playerState.stamina = p.stamina;
    playerState.cash = p.cash; playerState.bank = p.bank; playerState.isFainted = p.isFainted;
    // M3: job + active order (server-authoritative, §6 state lives in state).
    if (p.job) playerState.job = p.job;
    if (p.orderStatus === 'accepted') {
      playerState.order = {
        status: 'accepted', id: p.orderId, targetX: p.orderX, targetY: p.orderY,
        deadlineAt: p.orderDeadline, reward: p.orderReward,
      };
    } else playerState.order = null;
    // M3 (§3.2.3): track when fainting started — the faint panel counts
    // down from it and the hospital button enables after 10 s.
    // Rename+VFX: the false->true edge is also the ONLINE self-faint event
    // (the server sends no 'fainted' message — the known SFX gap from the
    // M3 skills audit — so the faint VFX hooks here, on the edge).
    if (p.isFainted && !faintInfo) {
      faintInfo = { at: Date.now(), until: Date.now() + 60000 };
      vfx('faint', p.x, p.y, player);
    }
    if (!p.isFainted && faintInfo) { vfx('unfaint', player); faintInfo = null; }
    // reconcile predicted position: <24px lerp, >=24px snap
    if (firstSelfSync) {
      playerState.x = p.x; playerState.y = p.y;
      if (player) player.position.set(p.x, p.y);
      firstSelfSync = false;
    } else {
      var d = Math.hypot(p.x - playerState.x, p.y - playerState.y);
      if (d >= 24) {
        playerState.x = p.x; playerState.y = p.y;
        if (player) player.position.set(p.x, p.y);
      } else if (d > 0.5) {
        playerState.x += (p.x - playerState.x) * 0.25;
        playerState.y += (p.y - playerState.y) * 0.25;
      }
    }
    if (p.chatBubble && p.chatBubbleUntil > Date.now() && p.chatBubble !== lastSelfBubbleText) {
      lastSelfBubbleText = p.chatBubble;
      showBubble(playerState.x, playerState.y, p.chatBubble, 4000);
    }
  }

  function syncRemotePlayer(p) {
    var entry = remotePlayers[p.id];
    if (!entry) {
      entry = createRemotePlayer(p, { isBot: p.id.indexOf('bot-') === 0, personaId: p.id.indexOf('bot-') === 0 ? p.id.slice(4) : null });
    } else {
      entry.tx = p.x; entry.ty = p.y;
      entry.isFainted = !!p.isFainted;
      if (p.name && p.name !== entry.name) {
        entry.name = p.name;
        if (entry.label) entry.label.text = p.name;
      }
      if (p.chatBubble && p.chatBubbleUntil > Date.now() && p.chatBubble !== entry.lastBubbleText) {
        showRemoteBubble(p.id, p.chatBubble, 4000);
      }
    }
    return entry;
  }

  function syncNpc(n) {
    // map server NPC ids onto the local M0 NPC objects
    var local = null;
    if (n.id === 'npc-guide') local = tutorialNpc ? tutorialNpc.userData : null;
    else if (n.id.indexOf('npc-walker-') === 0) {
      var idx = parseInt(n.id.slice('npc-walker-'.length), 10);
      if (!isNaN(idx) && npcs[idx]) local = npcs[idx];
    }
    if (!local) return;
    if (local.tx === undefined || Math.hypot(n.x - local.x, n.y - local.y) > 200) {
      local.x = n.x; local.y = n.y; // first sync (or teleport): snap
      if (local.container) local.container.position.set(n.x, n.y);
    }
    local.tx = n.x; local.ty = n.y;
  }

  function initNet() {
    setNetStatus('Đang kết nối…');
    setStartStatus('Đang kiểm tra máy chủ…');
    var url = serverUrlFromPage();
    if (!url) { goOffline('no-server-configured'); return; }
    if (typeof NetClient === 'undefined' || !NetClient.available) { goOffline('no-colyseus-lib'); return; }
    var selfId = function () { return NetClient.sessionId; };
    NetClient.hooks = {
      onPlayerAdded: function (p) {
        if (p.id === selfId()) return;
        syncRemotePlayer(p);
      },
      onPlayerChanged: function (p) {
        if (p.id === selfId()) { syncSelf(p); return; }
        syncRemotePlayer(p);
      },
      onPlayerRemoved: function (id) {
        if (id === selfId()) return;
        removeRemotePlayer(id);
      },
      onNpcAdded: function (n) { syncNpc(n); },
      onNpcChanged: function (n) { syncNpc(n); },
      onNpcRemoved: function (id) { /* NPCs persist in M1; ignore */ },
      onChatMessage: function (msg) { deliverChat(msg); },
      onChatError: function (err) {
        appendChatLog('', '', 'Không gửi được tin nhắn: ' + (err && err.error ? err.error : 'lỗi không rõ'), true);
      },
      onInteractError: function (err) {
        var msg = (err && err.error === 'TOO_FAR') ? 'Quá xa để cấp cứu (cần ≤ 120px).'
          : (err && err.error === 'INVALID_TARGET') ? 'Không cấp cứu được người này.'
          : (err && err.error === 'TOO_EARLY') ? 'Nút "Về Bệnh viện" chỉ mở sau 10s ngất — chờ bác sĩ tới cứu đã.'
          : 'Hành động chưa có trong M1.';
        appendChatLog('', '', msg, true);
        showBubble(playerState.x, playerState.y, msg, 3000);
      },
      onRevived: function (msg) {
        var text = msg.byName + ' đã hồi sinh một công dân.';
        if (msg.reward > 0) text += ' (thưởng ' + Math.floor(msg.reward).toLocaleString('vi-VN') + 'đ)';
        else if (msg.reason && msg.reason !== 'OK') text += ' (không thưởng: ' + msg.reason + ')';
        appendChatLog('', '', text, true);
        // Sound only when I am the reviver or the revived (local feedback).
        if (msg.targetId === mySessionId || msg.byId === mySessionId) sfx('revive');
        // VFX twin: green sparkles + ring at the revived player.
        if (msg.targetId === mySessionId) { vfx('revive', playerState.x, playerState.y); vfx('unfaint', player); }
        else if (msg.targetId && remotePlayers[msg.targetId]) {
          var rp = remotePlayers[msg.targetId];
          vfx('revive', rp.rx, rp.ry);
        }
        if (msg.targetId && remotePlayers[msg.targetId]) {
          showRemoteBubble(msg.targetId, 'Cảm ơn ' + msg.byName + '!', 4000);
        }
      },
      // M3: job/shipper results from the server.
      onJobResult: function (msg) {
        if (!msg) return;
        if (msg.type === 'job') {
          if (msg.ok) {
            playerState.job = msg.job;
            appendChatLog('', '', 'Đã chọn nghề: ' + (JOB_LABELS[msg.job] || msg.job) + '.', true);
            sfx('jobPick');
          } else {
            var why = msg.error === 'ACTIVE_ORDER' ? 'Đang có đơn Shipper — giao xong / hủy rồi mới đổi nghề.'
              : 'Không đổi được nghề: ' + (msg.error || 'lỗi không rõ');
            appendChatLog('', '', why, true);
          }
          if (typeof Jobs !== 'undefined' && Jobs.render) Jobs.render();
          return;
        }
        if (msg.type === 'shipper') {
          if (msg.ok && msg.action === 'complete') {
            appendChatLog('', '', 'Giao hàng thành công! +' +
              Math.floor(msg.reward).toLocaleString('vi-VN') + 'đ.', true);
            sfx('deliver');
            vfx('deliver', playerState.x, playerState.y, '+' + Math.floor(msg.reward).toLocaleString('vi-VN') + 'đ');
            vfx('clearPath');
            if (typeof msg.cash === 'number') playerState.cash = msg.cash;
            if (typeof msg.bank === 'number') playerState.bank = msg.bank;
          } else if (msg.ok && msg.action === 'accept' && msg.order) {
            appendChatLog('', '', 'Đã nhận đơn giao tới ' + (msg.order.poiName || 'điểm giao') +
              ' — hạn ' + msg.order.secondsLeft + 's, thưởng ' +
              Math.floor(msg.order.reward).toLocaleString('vi-VN') + 'đ. Mũi tên vàng chỉ đường!', true);
            sfx('accept');
            vfx('acceptPath', msg.order.targetX, msg.order.targetY);
          } else if (msg.ok && msg.action === 'cancel') {
            appendChatLog('', '', 'Đã hủy đơn — chờ 10s mới nhận đơn mới.', true);
            sfx('click');
            vfx('clearPath');
          } else if (!msg.ok) {
            var errMsg = msg.error === 'ALREADY_PROCESSED' ? 'Đơn này đã giao xong rồi (chống trùng).'
              : msg.error === 'TOO_FAR' ? 'Chưa tới nơi — tới Kho Hàng để nhận đơn, tới đúng điểm giao (trong 80px) để giao hàng.'
              : msg.error === 'NOT_SHIPPER' ? 'Bạn chưa chọn nghề Shipper — bấm nút NGHỀ trước.'
              : msg.error === 'ALREADY_HAVE_ORDER' ? 'Bạn đang có 1 đơn rồi.'
              : msg.error === 'COOLDOWN' ? 'Vừa hủy đơn, chờ ' + (msg.retryAfterSec || 10) + 's nữa.'
              : msg.error === 'EXPIRED' ? 'Đơn đã hết hạn — không thưởng, nhận đơn mới được rồi.'
              : msg.error === 'FAILED' ? 'Đơn FAILED (bạn ngất giữa đường) — không thưởng.'
              : msg.error === 'FAINTED' ? 'Bạn đang ngất, không làm đơn được.'
              : msg.error === 'ORDER_TAKEN' ? 'Đơn này vừa có người nhận — thử nhận đơn khác.'
              : 'Shipper lỗi: ' + (msg.error || 'không rõ');
            appendChatLog('', '', errMsg, true);
            if (msg.error === 'EXPIRED' || msg.error === 'FAILED') sfx('expire');
            else sfx('error');
            vfx('clearPath');
          }
          if (typeof Jobs !== 'undefined' && Jobs.render) Jobs.render();
          return;
        }
        if (msg.type === 'hospital' && msg.ok) {
          if (typeof msg.cash === 'number') playerState.cash = msg.cash;
          if (typeof msg.bank === 'number') playerState.bank = msg.bank;
          appendChatLog('', '', 'Bạn đã về Bệnh viện (50 HP).', true);
          sfx('hospital');
          vfx('revive', playerState.x, playerState.y);
          vfx('unfaint', player);
        }
      },
      // M3 (§10.2): NPC talk reply — bubble at the NPC + quest in chat log.
      onNpcTalk: function (msg) {
        if (!msg) return;
        sfx('talk');
        vfx('talk', msg.x, msg.y);
        if (msg.isGuide && msg.quest) {
          showBubble(msg.x, msg.y, 'Chào Công Dân mới! Xem nhiệm vụ tân thủ trong khung chat nhé.', 4000);
          appendChatLog('', '', '— Nhiệm vụ tân thủ —', true);
          msg.quest.forEach(function (step) { appendChatLog('', '', step, true); });
        } else {
          showBubble(msg.x, msg.y, msg.text, 4000);
        }
      },
      // M3 (§3.4.3): someone fainted — doctors get the alert (minimap + log).
      onFaintAlert: function (msg) {
        if (!msg) return;
        sfx('alert');
        faintAlerts.push({ x: msg.x, y: msg.y, until: Date.now() + 60000 });
        appendChatLog('', '', 'Có người ngất xỉu: ' + msg.name + ' tại (' +
          Math.round(msg.x) + ', ' + Math.round(msg.y) + ') — Bác sĩ tới cứu ngay!', true);
      },
      onWorldTime: function (minutes) { if (netMode === 'online') worldTime = minutes; },
      // M2: server economy results (starter_grant / shop_buy / atm_transfer /
      // use_item). Server is authoritative for cash/bank when online.
      onEconResult: function (msg) {
        if (!msg || !msg.ok) return;
        if (typeof msg.cash === 'number') playerState.cash = msg.cash;
        if (typeof msg.bank === 'number') playerState.bank = msg.bank;
        if (msg.type === 'use_item') {
          if (typeof msg.hunger === 'number') playerState.hunger = msg.hunger;
          if (typeof msg.stamina === 'number') playerState.stamina = msg.stamina;
        }
      },
      onSnapshot: function (snap) {
        if (netMode !== 'online') return;
        var seen = {};
        snap.players.forEach(function (p) {
          seen[p.id] = true;
          if (p.id === selfId()) syncSelf(p);
          else syncRemotePlayer(p);
        });
        Object.keys(remotePlayers).forEach(function (id) {
          if (!seen[id]) removeRemotePlayer(id);
        });
        snap.npcs.forEach(function (n) { syncNpc(n); });
        var humans = 0;
        snap.players.forEach(function (p) { if (p.id.indexOf('bot-') !== 0) humans += 1; });
        if (humans !== lastHumanCount) {
          lastHumanCount = humans;
          setNetStatus('Online: ' + humans + ' người');
          setStartStatus('Online — ' + humans + ' người trong thành phố');
        }
      },
      onDisconnected: function () {
        netMode = 'reconnecting';
        setNetStatus('Đang kết nối lại…');
        setStartStatus('Mất kết nối — đang kết nối lại…');
      },
      onReconnected: function () {
        netMode = 'online';
        mySessionId = NetClient.sessionId;
        firstSelfSync = true;
        setNetStatus('Online…');
        setStartStatus('Online — đã kết nối lại');
      },
      onReconnectFailed: function () {
        goOffline('reconnect-timeout-30s');
      }
    };
    NetClient.connect(url).then(function (res) {
      if (!res.ok) { goOffline(res.reason); return null; }
      return NetClient.joinRoom('city', { name: myName, avatar: 'hero' });
    }).then(function (res) {
      if (!res) return; // already offline
      if (!res.ok) { goOffline(res.reason); return; }
      mySessionId = res.sessionId;
      netMode = 'online';
      firstSelfSync = true;
      setNetStatus('Online…');
      setStartStatus('Online — đã kết nối máy chủ');
      // M2: ask the server for the (once-per-session) starter grant — the
      // server starts Cash = 0 and grants 50.000đ here; syncSelf then keeps
      // the server value authoritative.
      if (typeof NetClient.sendEconomy === 'function') NetClient.sendEconomy('starter_grant', {});
    }).catch(function (err) {
      console.warn('[net] init failed:', err);
      goOffline('error');
    });
  }

  // ---------- boot ----------
  async function boot() {
    if (typeof PIXI === 'undefined') return;
    app = new PIXI.Application();
    await app.init({
      resizeTo: window,
      backgroundColor: 0x1a2b1a,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });
    document.body.appendChild(app.canvas);
    app.canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // M1: identity + textures before building the world (badges need textures)
    myName = 'CongDan-' + Math.random().toString(36).slice(2, 6);
    playerState.name = myName;
    await loadTextures();

    // M2: economy first — starter grant (once) + local wallet load, before
    // the HUD reads playerState.cash. Falls back to the old 50.000đ only if
    // the economy module fails to load at all.
    try {
      if (typeof Economy !== 'undefined') Economy.init(playerState, function () { return worldTime; });
      else playerState.cash = 50000;
    } catch (e) { console.warn('[economy] init failed, fallback cash 50000:', e); playerState.cash = 50000; }

    buildWorld();
    buildNightOverlay();
    buildHUD();
    buildStart();
    buildChat();
    // Rename+VFX: init the Pixi VFX layer on the world built above (lamp
    // glow pools need lampGlows from buildWorld; the fxLayer must exist
    // before the ticker starts). Safe wrapper — VFX never crashes boot.
    try {
      if (typeof DTA_VFX !== 'undefined' && DTA_VFX.init) DTA_VFX.init({ world: world, lamps: lampGlows });
    } catch (e) { console.warn('[vfx] init failed:', e); }
    // M3: job panel + offline Shipper engine (jobs.js) and the faint panel.
    try {
      if (typeof Jobs !== 'undefined') {
        Jobs.init({
          state: playerState,
          isOnline: function () { return netMode === 'online'; },
          sendShipper: function (action, extra) {
            if (typeof NetClient !== 'undefined' && NetClient.sendShipper) NetClient.sendShipper(action, extra);
          },
          sendJob: function (job) {
            if (typeof NetClient !== 'undefined' && NetClient.sendJob) NetClient.sendJob(job);
          },
          getWorldTime: function () { return worldTime; },
          sys: function (msg) { appendChatLog('', '', msg, true); },
          economy: (typeof Economy !== 'undefined') ? Economy : null
        });
      }
    } catch (e) { console.warn('[jobs] init failed:', e); }
    faintPanelEl = document.getElementById('faintPanel');
    faintTextEl = document.getElementById('faintText');
    hospitalBtnEl = document.getElementById('hospitalBtn');
    if (hospitalBtnEl) hospitalBtnEl.addEventListener('click', function () {
      if (!playerState.isFainted) return;
      sfx('click');
      if (netMode === 'online' && typeof NetClient !== 'undefined' && NetClient.connected) {
        NetClient.sendInteract(null, 'hospital');
      } else {
        offlineHospitalRevive('button');
      }
    });
    // M3 skills revision (audio-gen): SFX mute toggle, persisted in
    // localStorage via DTA_SFX. Label mirrors the CHS pattern (🔊/🔇).
    (function () {
      var b = document.getElementById('sfxBtn');
      if (!b || typeof DTA_SFX === 'undefined') return;
      var sync = function () {
        b.textContent = DTA_SFX.enabled ? '🔊' : '🔇';
        b.classList.toggle('off', !DTA_SFX.enabled);
      };
      b.addEventListener('click', function () {
        var on = DTA_SFX.toggle();
        sync();
        if (on) sfx('click');
      });
      sync();
    })();
    // Rename+VFX: VFX toggle, same pattern as the SFX toggle above.
    // Persisted in localStorage via DTA_VFX ('dta_vfx').
    (function () {
      var b = document.getElementById('vfxBtn');
      if (!b || typeof DTA_VFX === 'undefined') return;
      var sync = function () {
        b.textContent = DTA_VFX.enabled ? '✨' : '✖';
        b.classList.toggle('off', !DTA_VFX.enabled);
      };
      b.addEventListener('click', function () {
        DTA_VFX.toggle();
        sync();
      });
      sync();
    })();
    initNet(); // async, non-blocking: online if a server answers, else offline

    window.addEventListener('keydown', function (e) {
      // typing in the chat input must not move the character (IME-safe:
      // the chat box is a real DOM <input>)
      if (chatInputFocused) return;
      // Esc closes the chat panel from anywhere
      if (e.code === 'Escape' && chatOpen) { e.preventDefault(); closeChat(); return; }
      // Enter opens the chat (or focuses it when already open)
      if (e.code === 'Enter' && started) {
        e.preventDefault();
        if (chatOpen) { if (chatEls.input) chatEls.input.focus(); }
        else openChat();
        return;
      }
      keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].indexOf(e.code) >= 0) e.preventDefault();
    });
    window.addEventListener('keyup', function (e) { keys[e.code] = false; });
    window.addEventListener('pointerup', function () { clearLongPress(); if (joy.active) endJoy(); });
    window.addEventListener('pointermove', function (e) {
      if (joy.active) updateJoy(e);
      if (longPressPos && Math.hypot(e.clientX - longPressPos.sx, e.clientY - longPressPos.sy) > 14) clearLongPress();
    });
    window.addEventListener('resize', function () { updateCamera(); layoutHUD(); });

    // pinch-to-zoom (touch): two fingers on the world, camera stays on player
    window.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'touch' || chatOpen) return;
      pinchPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(pinchPointers);
      if (ids.length === 2 && !joy.active) {
        pinchActive = true;
        var a = pinchPointers[ids[0]], b = pinchPointers[ids[1]];
        pinchStartDist = Math.hypot(a.x - b.x, a.y - b.y);
        pinchStartZoom = zoom;
        clearLongPress();
      }
    });
    window.addEventListener('pointermove', function (e) {
      if (!pinchPointers[e.pointerId]) return;
      pinchPointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (pinchActive) {
        var ids = Object.keys(pinchPointers);
        if (ids.length >= 2) {
          var a = pinchPointers[ids[0]], b = pinchPointers[ids[1]];
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d > 0 && pinchStartDist > 0) setZoom(pinchStartZoom * d / pinchStartDist);
        }
      }
    });
    var pinchEnd = function (e) {
      delete pinchPointers[e.pointerId];
      if (Object.keys(pinchPointers).length < 2) pinchActive = false;
    };
    window.addEventListener('pointerup', pinchEnd);
    window.addEventListener('pointercancel', pinchEnd);

    updateCamera();
    layoutHUD();
    updateHUD();
    drawMinimap();

    app.ticker.add(function (ticker) {
      var dt = Math.min(0.05, ticker.deltaMS / 1000);
      fpsCount++;
      fpsTimer += ticker.deltaMS;
      if (fpsTimer >= 500) {
        fpsValue = Math.round(fpsCount / (fpsTimer / 1000));
        fpsCount = 0; fpsTimer = 0;
        if (hudRefs.fpsT) hudRefs.fpsT.text = fpsValue + ' FPS';
      }
      // clock: 1 game minute per real second (offline only — online the
      // server worldTime is authoritative, via onWorldTime)
      if (netMode !== 'online') worldTime = (worldTime + dt) % DAY_MINUTES;
      var hour = Math.floor(worldTime / 60) % 24;
      var dark = darknessFor(hour);
      nightOverlay.alpha = dark;
      lampGlows.forEach(function (g) { g.visible = dark > 0.05; g.alpha = dark > 0.05 ? 1 : 0; });

      if (started) {
        updatePlayer(dt);
        updateNPCs(dt);
        updateAnimals(dt);
        updateRemotePlayers(dt);
        moveTick(dt);
        // M3: offline Shipper countdown/expiry, delivery arrow, faint panel.
        if (typeof Jobs !== 'undefined' && Jobs.tick) Jobs.tick(dt);
        updateOrderArrow();
        updateFaintPanel();
      }
      updateCamera();
      // Rename+VFX: night glow pools follow the clock; particles, rain,
      // the dashed path and the shake update AFTER updateCamera() so the
      // shake offset is transient (updateCamera resets world.x/y each
      // frame). The delivery arrow pulses while an order is active
      // (Godot-VFX juice: a static arrow reads as dead UI).
      if (typeof DTA_VFX !== 'undefined') {
        try {
          DTA_VFX.setNight(dark);
          DTA_VFX.tick(dt, {
            hour: hour,
            view: {
              left: -world.x / scale, top: -world.y / scale,
              right: (-world.x + app.renderer.width) / scale,
              bottom: (-world.y + app.renderer.height) / scale
            },
            playerX: playerState.x, playerY: playerState.y,
            order: currentOrder(),
            faint: playerState.isFainted ? { x: playerState.x, y: playerState.y } : null
          });
          if (orderArrow && currentOrder()) orderArrow.alpha = 0.7 + 0.3 * Math.sin(performance.now() / 150);
          else if (orderArrow) orderArrow.alpha = 1;
        } catch (e) { /* VFX must never crash the game */ }
      }
      updateCulling();
      updateHUD();
      minimapTimer += ticker.deltaMS;
      if (minimapTimer > 250) { minimapTimer = 0; drawMinimap(); }
    });
  }

  boot().catch(function (err) {
    console.error('[M0] boot failed:', err);
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;inset:0;background:#222;color:#fff;font-family:sans-serif;padding:40px;text-align:center;z-index:20';
    d.textContent = 'Không khởi động được game: ' + (err && err.message ? err.message : err);
    document.body.appendChild(d);
  });
})();
