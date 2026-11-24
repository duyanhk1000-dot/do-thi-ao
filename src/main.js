/* Đô Thị Ảo — M0 Prototype (PixiJS v8, local single-player, no server)
   PlayerState shape is kept ready for future Colyseus (see playerState below).
   All gameplay HUD is drawn on Canvas/WebGL (Pixi). No DOM overlay in M0. */
(function () {
  'use strict';

  var MAP_W = 3200, MAP_H = 3200;
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

  // ---------- map data ----------
  var ROAD_BANDS = [760, 1560, 2360]; // roads start at these x/y, width 120
  function inRoad(x, y) {
    for (var i = 0; i < ROAD_BANDS.length; i++) {
      if (x >= ROAD_BANDS[i] && x <= ROAD_BANDS[i] + 120) return true;
      if (y >= ROAD_BANDS[i] && y <= ROAD_BANDS[i] + 120) return true;
    }
    return false;
  }

  var BUILDINGS = (typeof Colliders !== 'undefined' && Colliders.BUILDINGS) ? Colliders.BUILDINGS : [
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
  // NOTE: BUILDINGS above is the shared/colliders.js copy when available
  // (verified identical — 16 rects). Collision rects must NEVER change here;
  // the server is authoritative and uses the same data.

  var POIS = [
    { id: 'spawn',     name: 'Điểm Hồi Sinh / NPC Hướng Dẫn', x: 1600, y: 1720, color: 0x2ecc71 },
    { id: 'bank',      name: 'Ngân Hàng & ATM',        x: 1100, y: 1060, color: 0x3498db },
    { id: 'shop',      name: 'Cửa Hàng Tiện Lợi 24/7', x: 1930, y: 1060, color: 0xe67e22 },
    { id: 'hospital',  name: 'Bệnh Viện',              x: 2750, y: 1090, color: 0xe74c3c },
    { id: 'showroom',  name: 'Showroom Xe Máy',        x: 1110, y: 1900, color: 0x9b59b6 },
    { id: 'motel',     name: 'Khu Nhà Trọ',            x: 1940, y: 1910, color: 0x1abc9c },
    { id: 'warehouse', name: 'Kho Hàng Trung Tâm',     x: 2770, y: 1940, color: 0x95a5a6 }
  ];

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
  function randomOpenPoint() {
    for (var i = 0; i < 60; i++) {
      var x = randRange(60, MAP_W - 60), y = randRange(60, MAP_H - 60);
      if (isOpenPoint(x, y)) return { x: x, y: y };
    }
    return { x: 1600, y: 2000 };
  }

  // ---------- player state (Colyseus-ready shape) ----------
  var playerState = {
    id: 'local-1', name: 'CongDan', x: 1600, y: 1750, vx: 0, vy: 0,
    anim: 'idle', job: 'unemployed', hp: 100, hunger: 100, stamina: 100,
    // M2 (SRS §4.5/§5.1): profile is created with Cash = 0. The 50.000đ
    // starter grant comes from Economy.starterGrant() — ONE transaction,
    // logged as starter_grant, never a hardcoded default.
    cash: 0, bank: 0, isFainted: false, vehicleId: null
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
    plaza: 'assets/map-city-aerial.png',
    bank: 'assets/building-bank.png', hospital: 'assets/building-hospital.png',
    warehouse: 'assets/building-warehouse.png', shop: 'assets/building-shop.png',
    showroom: 'assets/building-showroom.png', motel: 'assets/building-motel.png',
    // M2: *-full.png = transparent full-body sprites for IN-WORLD characters.
    // *-crop.png (portrait crops) are ONLY for the small HUD avatar — never
    // as a moving character (user complaint M1: "sao lại là avatar hình tròn?").
    hero: 'assets/hero-citizen-crop.png', shipper: 'assets/npc-shipper-crop.png',
    bread: 'assets/npc-bread-crop.png', taxi: 'assets/npc-taxi-crop.png',
    police: 'assets/npc-police-crop.png', thug: 'assets/npc-thug-crop.png',
    student: 'assets/npc-student-crop.png',
    heroFull: 'assets/hero-citizen-full.png', shipperFull: 'assets/npc-shipper-full.png',
    breadFull: 'assets/npc-bread-full.png', taxiFull: 'assets/npc-taxi-full.png',
    policeFull: 'assets/npc-police-full.png', thugFull: 'assets/npc-thug-full.png',
    studentFull: 'assets/npc-student-full.png'
  };
  var FULL_TEX = { hero: 'heroFull', citizen: 'heroFull', guide: 'taxiFull', shipper: 'shipperFull', bread: 'breadFull', taxi: 'taxiFull', police: 'policeFull', thug: 'thugFull', student: 'studentFull' };
  var POI_TEX = { bank: 'bank', hospital: 'hospital', warehouse: 'warehouse', shop: 'shop', showroom: 'showroom', motel: 'motel' };
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

  // M2: random walkers use full-body persona sprites (cycling the 6 NPC
  // looks) instead of the M0 code-drawn person — no more SVG-looking NPCs.
  var WALKER_FULL = ['shipperFull', 'breadFull', 'taxiFull', 'policeFull', 'thugFull', 'studentFull'];
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
  // person when no texture is available. Sprite is 42 world px tall, so at
  // mobile zoom 1.6x it renders ~67px on a 390px portrait screen.
  var CHAR_H = 42;
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
    for (var i = 0; i < 260; i++) {
      var gx = randRange(0, MAP_W), gy = randRange(0, MAP_H);
      if (inRoad(gx, gy)) continue;
      ground.circle(gx, gy, randRange(6, 18)).fill({ color: 0x4c8a3d, alpha: 0.5 });
    }
    ground.eventMode = 'static';
    ground.on('pointerdown', onWorldPointerDown);
    world.addChild(ground);

    // roads (asphalt + lane dashes)
    var roads = new PIXI.Graphics();
    for (var r = 0; r < ROAD_BANDS.length; r++) {
      var p = ROAD_BANDS[r];
      roads.rect(0, p, MAP_W, 120).fill(0x3d3d3d);
      roads.rect(p, 0, 120, MAP_H).fill(0x3d3d3d);
      // sidewalks
      roads.rect(0, p - 14, MAP_W, 14).fill(0x9aa0a6);
      roads.rect(0, p + 120, MAP_W, 14).fill(0x9aa0a6);
      roads.rect(p - 14, 0, 14, MAP_H).fill(0x9aa0a6);
      roads.rect(p + 120, 0, 14, MAP_H).fill(0x9aa0a6);
      // lane dashes
      for (var d = 0; d < MAP_W; d += 80) {
        roads.rect(d, p + 56, 40, 6).fill(0xf7dc6f);
        roads.rect(p + 56, d, 6, 40).fill(0xf7dc6f);
      }
    }
    world.addChild(roads);

    // central plaza + fountain (aerial image 800x800 at 1600,1600, drawn
    // AFTER roads and BEFORE buildings; fountain + label stay on top)
    if (TEX.plaza) {
      var plazaSpr = new PIXI.Sprite(TEX.plaza);
      plazaSpr.width = 800; plazaSpr.height = 800;
      plazaSpr.position.set(1200, 1200);
      world.addChild(plazaSpr);
      cullables.push({ obj: plazaSpr, x: 1200, y: 1200, w: 800, h: 800 });
    }
    var plaza = new PIXI.Graphics();
    if (!TEX.plaza) {
      plaza.rect(1400, 1400, 400, 400).fill(0xd6c9a8);
      plaza.rect(1400, 1400, 400, 400).stroke({ width: 4, color: 0xb8a888 });
    }
    plaza.circle(1600, 1600, 46).fill(0x5dade2);
    plaza.circle(1600, 1600, 46).stroke({ width: 4, color: 0x2e86c1 });
    plaza.circle(1600, 1600, 18).fill(0x85c1e9);
    var plazaLabel = text('Quảng Trường Trung Tâm', 22, 0x5d4037, true);
    if (TEX.plaza) plazaLabel.style.stroke = { color: 0xffffff, width: 4 };
    plazaLabel.anchor.set(0.5, 0.5); plazaLabel.position.set(1600, 1428);
    world.addChild(plaza, plazaLabel);
    cullables.push({ obj: plaza, x: 1400, y: 1400, w: 400, h: 400 });
    cullables.push({ obj: plazaLabel, x: 1400, y: 1400, w: 400, h: 60 });

    // buildings
    BUILDINGS.forEach(function (b) {
      var c = new PIXI.Container();
      var g = new PIXI.Graphics();
      g.rect(b.x, b.y, b.w, b.h).fill(b.color);
      g.rect(b.x, b.y, b.w, b.h).stroke({ width: 3, color: 0x000000, alpha: 0.3 });
      // roof strip + door + windows
      g.rect(b.x, b.y, b.w, 26).fill(b.roof);
      g.rect(b.x + b.w / 2 - 16, b.y + b.h - 34, 32, 34).fill(0x5d4037);
      for (var wx = b.x + 22; wx < b.x + b.w - 30; wx += 52) {
        g.rect(wx, b.y + 44, 28, 26).fill(0xbfe3ff);
      }
      c.addChild(g);
      // POI building sprite (M1 assets): width = rect.w x 1.25, square
      // aspect, centred on the rect, masked by a rounded rect (radius ~40
      // world px, ~4% inset) so white corners are hidden. The M0 coloured
      // rect stays underneath as backing; collision rect is unchanged.
      var poiTexKey = POI_TEX[b.id];
      if (poiTexKey && TEX[poiTexKey]) {
        var bspr = new PIXI.Sprite(TEX[poiTexKey]);
        var sw = b.w * 1.25;
        bspr.width = sw; bspr.height = sw; // square aspect
        bspr.anchor.set(0.5, 0.5);
        bspr.position.set(b.x + b.w / 2, b.y + b.h / 2);
        var bmask = new PIXI.Graphics();
        bmask.roundRect(b.x + b.w * 0.04, b.y + b.h * 0.04, b.w * 0.92, b.h * 0.92, 40).fill(0xffffff);
        c.addChild(bmask);
        c.addChild(bspr);
        bspr.mask = bmask;
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

    // POI markers (coloured dot + pin at building front / spawn)
    POIS.forEach(function (p) {
      var m = new PIXI.Graphics();
      m.circle(p.x, p.y, 12).fill(p.color);
      m.circle(p.x, p.y, 12).stroke({ width: 3, color: 0xffffff });
      m.circle(p.x, p.y, 4).fill(0xffffff);
      world.addChild(m);
      cullables.push({ obj: m, x: p.x - 14, y: p.y - 14, w: 28, h: 28 });
    });

    // trees
    for (var t = 0; t < 46; t++) {
      var tp = randomOpenPoint();
      var tree = new PIXI.Graphics();
      tree.rect(-3, 0, 6, 14).fill(0x6e4b2a);
      tree.circle(0, -10, 16).fill(0x2e7d32);
      tree.circle(-8, -4, 10).fill(0x388e3c);
      tree.circle(8, -4, 10).fill(0x388e3c);
      tree.position.set(tp.x, tp.y);
      world.addChild(tree);
      cullables.push({ obj: tree, x: tp.x - 18, y: tp.y - 28, w: 36, h: 46 });
    }

    // lamps along roads (glow at night)
    for (var lx = 200; lx < MAP_W; lx += 400) {
      for (var ly = 200; ly < MAP_H; ly += 400) {
        if (!inRoad(lx, ly)) continue;
        var lamp = new PIXI.Graphics();
        lamp.rect(-2, -22, 4, 22).fill(0x333333);
        lamp.circle(0, -24, 6).fill(0xffe082);
        world.addChild(lamp);
        lamp.position.set(lx + 70, ly - 20);
        var glow = new PIXI.Graphics();
        glow.circle(0, 0, 34).fill({ color: 0xffe082, alpha: 0.18 });
        glow.position.set(lx + 70, ly - 44);
        glow.visible = false;
        world.addChild(glow);
        lampGlows.push(glow);
        cullables.push({ obj: lamp, x: lx + 50, y: ly - 50, w: 40, h: 50 });
        cullables.push({ obj: glow, x: lx + 30, y: ly - 80, w: 80, h: 80 });
      }
    }

    // benches near plaza
    [[1450, 1850], [1750, 1850], [1450, 1350], [1750, 1350]].forEach(function (pos) {
      var bench = new PIXI.Graphics();
      bench.roundRect(-26, -8, 52, 16, 4).fill(0x8d6e63);
      bench.roundRect(-26, -8, 52, 16, 4).stroke({ width: 2, color: 0x5d4037 });
      bench.position.set(pos[0], pos[1]);
      world.addChild(bench);
      cullables.push({ obj: bench, x: pos[0] - 26, y: pos[1] - 8, w: 52, h: 16 });
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
      var obj = {
        container: npc, x: sp.x, y: sp.y, targetX: tgt.x, targetY: tgt.y,
        speed: randRange(45, 75), name: NPC_NAMES[n % NPC_NAMES.length],
        color: NPC_COLORS[n % NPC_COLORS.length], isTutorial: false
      };
      npc.userData = obj;
      world.addChild(npc);
      npcs.push(obj);
      cullables.push({ obj: npc, x: sp.x - 20, y: sp.y - 30, w: 40, h: 60 });
    }

    // tutorial NPC (fixed at spawn) — full-body taxi driver look (friendly guide)
    tutorialNpc = makeFullBody(TEX.taxiFull, null);
    tutorialNpc.position.set(1600, 1520);
    tutorialNpc.eventMode = 'static';
    tutorialNpc.cursor = 'pointer';
    tutorialNpc.on('pointerdown', onWorldPointerDown);
    var tutObj = {
      container: tutorialNpc, x: 1600, y: 1520, targetX: 1600, targetY: 1520,
      speed: 0, name: 'NPC Hướng Dẫn', color: 0x27ae60, isTutorial: true
    };
    tutorialNpc.userData = tutObj;
    world.addChild(tutorialNpc);
    npcs.push(tutObj);
    cullables.push({ obj: tutorialNpc, x: 1580, y: 1490, w: 40, h: 60 });
    var tutLabel = text('NPC Hướng Dẫn', 18, 0xffff00, true);
    tutLabel.anchor.set(0.5, 0.5); tutLabel.position.set(1600, 1478);
    world.addChild(tutLabel);
    cullables.push({ obj: tutLabel, x: 1500, y: 1460, w: 200, h: 36 });

    // player (M2: full-body hero sprite + shadow; M0 code-drawn person as fallback)
    player = makeFullBody(TEX.heroFull, playerState.name);
    player.position.set(playerState.x, playerState.y);
    world.addChild(player);
    playerGfx = player;

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
      } else if (t.kind === 'player') {
        // human player: show a line, send nothing extra (per M1 brief)
        showRemoteBubble(t.id, 'Đây là ' + t.name + '.', 3000);
      } else if (t.npc && t.npc.isTutorial) {
        line = 'Chào Công Dân mới! Nhận 50.000đ\nrồi đi mua bánh mì ở Cửa Hàng\nTiện Lợi nhé. (Nhiệm vụ ở M2)';
        showBubble(t.x, t.y, line, 3000);
      } else if (t.npc) {
        line = pick(TALK_LINES);
        showBubble(t.x, t.y, line, 3000);
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
          ? t.name + ' — Dân cư đô thị\nĐang đi dạo quanh thành phố.'
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

  function drawMinimap() {
    var s = 130 / MAP_W;
    minimapG.clear();
    minimapG.circle(0, 0, 65).fill(0x5da24a);
    // roads
    ROAD_BANDS.forEach(function (p) {
      minimapG.rect(-65, (p + 60) * s - 65, 130, 120 * s).fill(0x3d3d3d);
      minimapG.rect((p + 60) * s - 65, -65, 120 * s, 130).fill(0x3d3d3d);
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
    // M1: remote players (humans white, bots yellow) — dots big enough to tell apart
    Object.keys(remotePlayers).forEach(function (id) {
      var r = remotePlayers[id];
      minimapG.circle(r.rx * s - 65, r.ry * s - 65, r.isBot ? 3.5 : 4).fill(r.isBot ? 0xf1c40f : 0xffffff);
    });
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
    var title = text('ĐÔ THỊ ẢO', 44, 0xffe082, true);
    title.anchor.set(0.5, 0.5);
    var sub = text('M2  •  PixiJS v8  •  Colyseus  •  Shop + ATM + Chat', 16, 0xffffff);
    sub.anchor.set(0.5, 0.5);
    var statusT = text('Đang kiểm tra máy chủ…', 14, 0xffe082, true);
    statusT.anchor.set(0.5, 0.5);
    // M2: guide is word-wrapped to the screen width — the M1 guide lines
    // overflowed a 390px phone screen ("chữ không đúng trong khung").
    var guide = text(
      'Joystick: di chuyển  •  Nút CHẠY: chạy nhanh\n' +
      'Chạm giữ vào NPC / địa điểm: mở menu tròn\n' +
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
    return !hitBuilding(x, y, r);
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

    // input shape (Colyseus-ready): {dx, dy, sprint}
    var sprinting = inp.wantSprint && len > 0.1 && playerState.stamina > 1;
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
      // hunger: -1 per 15s
      playerState.hunger = Math.max(0, playerState.hunger - dt / 15);
      // HP stays 100 in M0 (no damage source yet)
    }

    player.position.set(playerState.x, playerState.y);
    // flip/bob the badge face (not the whole container — the name label
    // must not mirror); for the M0 fallback person the face IS the container.
    var face = (player.userData && player.userData.face) || player;
    face.scale.y = playerState.anim === 'idle' ? 1 : 1 + Math.sin(performance.now() / 90) * 0.03;
    // direction indicator: flip by horizontal movement
    if (input.dx < -0.1) face.scale.x = -1;
    else if (input.dx > 0.1) face.scale.x = 1;
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
      if (hitBuilding(nx, n.y, 14)) { var p2 = randomOpenPoint(); n.targetX = p2.x; n.targetY = p2.y; return; }
      if (hitBuilding(n.x, ny, 14)) { var p3 = randomOpenPoint(); n.targetX = p3.x; n.targetY = p3.y; return; }
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
            if (!hitBuilding(nx, ny, 16)) { r.rx = nx; r.ry = ny; }
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
          : 'Hành động chưa có trong M1.';
        appendChatLog('', '', msg, true);
        showBubble(playerState.x, playerState.y, msg, 3000);
      },
      onRevived: function (msg) {
        appendChatLog('', '', msg.byName + ' đã hồi sinh một công dân.', true);
        if (msg.targetId && remotePlayers[msg.targetId]) {
          showRemoteBubble(msg.targetId, 'Cảm ơn ' + msg.byName + '!', 4000);
        }
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
        updateRemotePlayers(dt);
        moveTick(dt);
      }
      updateCamera();
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
