/* Cuộc Sống Ảo — test/map-render-check.js (render fix 2026-11-25)
   Headless check of the map rendering: no real browser, no PIXI.
   - Loads shared/colliders.js (UMD) for the ground-truth rects.
   - Parses src/main.js source for ASSET_FILES / POI_TEX / HOUSE_TEX and for
     the draw-order / draw-call shapes (contain-fit, plaza texture).
   - Reads PNG IHDR dims (no decode) + opaque-alpha bbox for the animals.
   - Simulates fitRect() with the real texture dims and asserts every fitted
     building rect sits inside its collider rect with aspect preserved.
   - Asserts road continuity (no building covers a road-centre sample),
     the M4 subtitle, and the 80.000đ starter grant (NOT a bug — locked).
   Run: node test/map-render-check.js   (exit 0 = all PASS) */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');
var Colliders = require(path.join(ROOT, 'shared/colliders.js'));

var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('PASS - ' + name + (detail ? ' (' + detail + ')' : '')); }
  else { failed++; console.log('FAIL - ' + name + (detail ? ' (' + detail + ')' : '')); }
}
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function pngDims(p) {
  var b = fs.readFileSync(path.join(ROOT, p));
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function containsPoint(r, x, y) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
// Same math as fitRect() in src/main.js — contain-fit, centred, no stretch.
function fitRect(tw, th, x, y, w, h) {
  var s = Math.min(w / tw, h / th);
  var fw = tw * s, fh = th * s;
  return { x: x + (w - fw) / 2, y: y + (h - fh) / 2, w: fw, h: fh };
}

var mainSrc = read('src/main.js');
var econSrc = read('src/economy.js');
var citySrc = read('server/rooms/CityRoom.js');

// ---- 1. collider rects are inside the map ---------------------------------
var badBounds = Colliders.BUILDINGS.filter(function (b) {
  return b.x < 0 || b.y < 0 || b.x + b.w > Colliders.MAP_W || b.y + b.h > Colliders.MAP_H;
});
check('buildings inside 4800x4800', badBounds.length === 0,
  Colliders.BUILDINGS.length + ' buildings');

// ---- 1b. the main.js fallback BUILDINGS list must match colliders.js -----
// (the comment in main.js claims "verified identical" — enforce it, since
// both files are edited by hand; the server is authoritative).
var fallbackBlock = mainSrc.match(/\? Colliders\.BUILDINGS : \[([\s\S]*?)\n  \];/);
var fbBad = [];
if (!fallbackBlock) fbBad.push('fallback BUILDINGS block not found');
else {
  var fb = {};
  fallbackBlock[1].replace(/id: '(\w+)'[^}]*?x: (\d+),\s*y: (\d+),\s*w: (\d+),\s*h: (\d+)/g,
    function (_, id, x, y, w, h) { fb[id] = { x: +x, y: +y, w: +w, h: +h }; });
  Colliders.BUILDINGS.forEach(function (b) {
    var f = fb[b.id];
    if (!f) fbBad.push(b.id + ': missing from fallback');
    else if (f.x !== b.x || f.y !== b.y || f.w !== b.w || f.h !== b.h) {
      fbBad.push(b.id + ': fallback (' + f.x + ',' + f.y + ',' + f.w + ',' + f.h +
        ') != colliders (' + b.x + ',' + b.y + ',' + b.w + ',' + b.h + ')');
    }
  });
  Object.keys(fb).forEach(function (id) {
    if (!Colliders.BUILDINGS.some(function (b) { return b.id === id; })) fbBad.push(id + ': extra in fallback');
  });
}
check('main.js fallback BUILDINGS identical to shared/colliders.js', fbBad.length === 0,
  fbBad.join('; ') || Colliders.BUILDINGS.length + ' rects match');

// ---- 2. no building overlaps an asphalt road band --------------------------
var ROAD_W = 180, BANDS = [1140, 2340, 3540];
var roadRects = [];
BANDS.forEach(function (p) {
  roadRects.push({ x: p, y: 0, w: ROAD_W, h: 4800 });
  roadRects.push({ x: 0, y: p, w: 4800, h: ROAD_W });
});
var roadHits = [];
Colliders.BUILDINGS.forEach(function (b) {
  roadRects.forEach(function (r, i) {
    if (rectsOverlap(b, r)) roadHits.push(b.id + ' x road#' + i);
  });
});
check('no building overlaps a road band', roadHits.length === 0, roadHits.join(', ') || 'clean');
var school = Colliders.BUILDINGS.filter(function (b) { return b.id === 'school'; })[0];
var pavilion = Colliders.BUILDINGS.filter(function (b) { return b.id === 'pavilion'; })[0];
check('school moved clear of road 1140', school.x === 180 && school.y === 4240, JSON.stringify({ x: school.x, y: school.y }));
check('pavilion moved clear of road 3540', pavilion.x === 4200 && pavilion.y === 600, JSON.stringify({ x: pavilion.x, y: pavilion.y }));

// ---- 3. no building-vs-building overlap ------------------------------------
var bbHits = [];
for (var i = 0; i < Colliders.BUILDINGS.length; i++) {
  for (var j = i + 1; j < Colliders.BUILDINGS.length; j++) {
    if (rectsOverlap(Colliders.BUILDINGS[i], Colliders.BUILDINGS[j])) {
      bbHits.push(Colliders.BUILDINGS[i].id + ' x ' + Colliders.BUILDINGS[j].id);
    }
  }
}
check('no building-vs-building overlap', bbHits.length === 0, bbHits.join(', ') || 'clean');

// ---- 4. road continuity: no building covers a road-centre sample -----------
var blocked = [];
BANDS.forEach(function (p) {
  for (var d = 0; d <= 4800; d += 60) {
    var pts = [{ x: p + 90, y: d }, { x: d, y: p + 90 }];
    pts.forEach(function (pt) {
      Colliders.BUILDINGS.forEach(function (b) {
        if (containsPoint(b, pt.x, pt.y)) blocked.push(b.id + ' @(' + pt.x + ',' + pt.y + ')');
      });
    });
  }
});
check('road centre samples clear of buildings', blocked.length === 0,
  blocked.slice(0, 5).join(', ') || 'all 486 samples clear');

// ---- 5. plaza: cropped ground texture, fountain centred --------------------
var plazaDims = pngDims('assets/v3/plaza-ground.png');
check('plaza-ground.png exists and is square', !!plazaDims && plazaDims.w === plazaDims.h,
  plazaDims ? plazaDims.w + 'x' + plazaDims.h : 'missing');
check('plaza sprite uses TEX.plazaGround (not the full district image)',
  mainSrc.indexOf('new PIXI.Sprite(TEX.plazaGround)') >= 0 &&
  (mainSrc.match(/new PIXI\.Sprite\(TEX\.plaza\)/g) || []).length === 1,
  'plazaGround for the plaza, full image kept only for the start backdrop');
// fountain offset inside the crop (cyan pixels) — must land on (2400,2400)
var plazaPng = null;
try {
  var zlib = require('zlib');
  var raw = fs.readFileSync(path.join(ROOT, 'assets/v3/plaza-ground.png'));
  // minimal PNG decode: only IHDR + IDAT, non-interlaced, 8-bit RGB(A)
  var pos = 8, idat = [], w = 0, h = 0, bitDepth = 0, colorType = 0;
  while (pos < raw.length) {
    var len = raw.readUInt32BE(pos), type = raw.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') { w = raw.readUInt32BE(pos + 8); h = raw.readUInt32BE(pos + 12); bitDepth = raw[pos + 16]; colorType = raw[pos + 17]; }
    if (type === 'IDAT') idat.push(raw.slice(pos + 8, pos + 8 + len));
    if (type === 'IEND') break;
    pos += 12 + len;
  }
  var data = zlib.inflateSync(Buffer.concat(idat));
  var ch = colorType === 6 ? 4 : 3, stride = w * ch;
  var px = Buffer.alloc(w * h * ch);
  var prev = Buffer.alloc(stride);
  var p = 0;
  for (var y = 0; y < h; y++) {
    var f = data[p++];
    var line = data.slice(p, p + stride); p += stride;
    var out = Buffer.alloc(stride);
    for (var x = 0; x < stride; x++) {
      var a = x >= ch ? out[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      var v = line[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        var pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        var pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 255;
      }
      out[x] = v;
    }
    out.copy(px, y * stride); prev = out;
  }
  var minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
  for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
    var o = (yy * w + xx) * ch, r = px[o], g = px[o + 1], b2 = px[o + 2];
    if (r >= 30 && r <= 110 && g >= 160 && g <= 220 && b2 >= 210) {
      if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
      if (yy < minY) minY = yy; if (yy > maxY) maxY = yy;
    }
  }
  if (maxX >= 0) {
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    plazaPng = { cx: cx, cy: cy, dx: cx - w / 2, dy: cy - h / 2 };
  }
} catch (e) { plazaPng = null; }
check('plaza crop fountain centred on the real fountain (2400,2400)', !!plazaPng &&
  Math.abs(plazaPng.dx) <= 8 && Math.abs(plazaPng.dy) <= 8,
  plazaPng ? 'offset (' + plazaPng.dx.toFixed(0) + ',' + plazaPng.dy.toFixed(0) + ')px in crop' : 'cyan scan failed');

// ---- 6. tight crops exist with the recorded dims ---------------------------
var tight = {
  'building-hospital-tight.png': [580, 570], 'building-warehouse-tight.png': [690, 620],
  'building-motel-tight.png': [900, 680], 'building-market-tight.png': [480, 440],
  'building-police-tight.png': [680, 550], 'building-school-tight.png': [680, 330],
  'building-cafe-tight.png': [670, 710], 'building-pavilion-tight.png': [600, 690],
  'house-a-tight.png': [660, 860]
};
var tightOk = true, tightBad = [];
Object.keys(tight).forEach(function (f) {
  var d = pngDims('assets/v3/' + f);
  if (!d || d.w !== tight[f][0] || d.h !== tight[f][1]) { tightOk = false; tightBad.push(f); }
});
check('9 tight building crops exist with recorded dims', tightOk, tightBad.join(', ') || 'all 9 match');

// ---- 7. building draw: contain-fit, never stretch --------------------------
check('building loop uses fitRect (contain-fit)', mainSrc.indexOf('var fit = fitRect(bTex.width, bTex.height, b.x, b.y, b.w, b.h);') >= 0);
check('old stretch draw is gone', mainSrc.indexOf('bspr.width = b.w; bspr.height = b.h;') < 0);
check('fitRect helper exists', /function fitRect\(tw, th, x, y, w, h\)/.test(mainSrc));
// simulate contain-fit for every building with its real texture dims
function blockMap(src, name) {
  var m = src.match(new RegExp('var ' + name + ' = \\{([^}]*)\\};'));
  var out = {};
  if (!m) return out;
  m[1].split(',').forEach(function (kv) {
    var p = kv.split(':');
    if (p.length === 2) out[p[0].trim()] = p[1].trim().replace(/^'|'$/g, '');
  });
  return out;
}
function assetMap(src) {
  var m = src.match(/var ASSET_FILES = \{([\s\S]*?)\n  \};/);
  var out = {};
  if (!m) return out;
  m[1].replace(/(\w+):\s*'([^']+)'/g, function (_, k, v) { out[k] = v; });
  return out;
}
var assets = assetMap(mainSrc);
var poiTex = blockMap(mainSrc, 'POI_TEX');
var houseTex = blockMap(mainSrc, 'HOUSE_TEX');
var fitBad = [], fitCount = 0;
Colliders.BUILDINGS.forEach(function (b) {
  var key = poiTex[b.id] || houseTex[b.id];
  if (!key || !assets[key]) return;
  var d = pngDims(assets[key]);
  if (!d) { fitBad.push(b.id + ': missing ' + assets[key]); return; }
  var f = fitRect(d.w, d.h, b.x, b.y, b.w, b.h);
  fitCount++;
  var inside = f.x >= b.x - 0.01 && f.y >= b.y - 0.01 &&
    f.x + f.w <= b.x + b.w + 0.01 && f.y + f.h <= b.y + b.h + 0.01;
  var aspectKept = Math.abs((f.w / f.h) - (d.w / d.h)) < 1e-9;
  var centred = Math.abs((f.x - b.x) - ((b.w - f.w) / 2)) < 0.01 &&
    Math.abs((f.y - b.y) - ((b.h - f.h) / 2)) < 0.01;
  var areaOk = (f.w * f.h) >= 0.35 * b.w * b.h; // roof crops are wide by
  // nature (showroom roof 705x210 -> 40% of its rect): they fill the width
  // and the flat backing reads as the building body — undistorted is what
  // matters, not the fill ratio.
  if (!inside || !aspectKept || !centred || !areaOk) {
    fitBad.push(b.id + ': inside=' + inside + ' aspect=' + aspectKept + ' centred=' + centred + ' area=' + ((f.w * f.h / (b.w * b.h)) * 100).toFixed(0) + '%');
  }
});
check('contain-fit: every building sprite inside its rect, aspect kept, centred', fitBad.length === 0,
  fitCount + ' buildings fitted' + (fitBad.length ? ' — ' + fitBad.join('; ') : ''));

// ---- 8. draw order: garden beds BEFORE roads -------------------------------
var buildWorld = mainSrc.slice(mainSrc.indexOf('function buildWorld()'));
var bedIdx = buildWorld.indexOf('bed.rect(gd.x, gd.y, gd.w, gd.h)');
var roadsIdx = buildWorld.indexOf('var roads = new PIXI.Graphics();');
var plazaIdx = buildWorld.indexOf('var plazaSpr = new PIXI.Sprite(TEX.plazaGround)');
check('garden beds drawn before roads (roads paint over the overlap)',
  bedIdx >= 0 && roadsIdx >= 0 && bedIdx < roadsIdx, 'bed@' + bedIdx + ' roads@' + roadsIdx);
check('plaza sprite drawn after roads', plazaIdx > roadsIdx, 'plaza@' + plazaIdx);

// ---- 9. animals / props: real aspect, no smear band ------------------------
var propDraws = [
  { id: 'dog', file: 'assets/v3/prop-dog-full.png', w: 30 },
  { id: 'cat', file: 'assets/v3/prop-cat-full.png', w: 22 },
  { id: 'motorbike', file: 'assets/v3/prop-motorbike-full.png', w: 34 },
  { id: 'bicycle', file: 'assets/v3/prop-bicycle-full.png', w: 56 },
];
var propBad = [];
propDraws.forEach(function (pd) {
  var d = pngDims(pd.file);
  if (!d) { propBad.push(pd.id + ': missing'); return; }
  var aspect = d.w / d.h;
  if (aspect < 0.2 || aspect > 5) propBad.push(pd.id + ': aspect ' + aspect.toFixed(2));
  var drawnH = pd.w * d.h / d.w;
  if (drawnH < 15 || drawnH > 90) propBad.push(pd.id + ': drawn height ' + drawnH.toFixed(0));
});
check('animal/prop PNGs: sane aspect, sane drawn size', propBad.length === 0,
  propDraws.map(function (pd) {
    var d = pngDims(pd.file);
    return pd.id + ' ' + d.w + 'x' + d.h + ' -> ' + pd.w + 'x' + Math.round(pd.w * d.h / d.w);
  }).join(', ') + (propBad.length ? ' — ' + propBad.join('; ') : ''));
check('spawnAnimal preserves aspect in code',
  mainSrc.indexOf('spr.height = w * tex.height / tex.width;') >= 0);
check('propSprite preserves aspect in code',
  /function propSprite[\s\S]*?spr\.height = w \* tex\.height \/ tex\.width;/.test(mainSrc));

// ---- 10. subtitle + starter grant (locked findings) -------------------------
check('start-screen subtitle is M4', mainSrc.indexOf("text('M4  •  PixiJS v8") >= 0);
check('no stale M3 subtitle left', mainSrc.indexOf("text('M3  •  PixiJS v8") < 0);
check('starter grant is 80.000đ (client)', /var STARTER_GRANT = 80000;/.test(econSrc));
check('starter grant is 80.000đ (server)', /STARTER_GRANT = 80000/.test(citySrc));
check('no 50.000đ grant on the fresh-player path', !/STARTER_GRANT = 50000/.test(econSrc) && !/STARTER_GRANT = 50000/.test(citySrc));
check('starterGrant() runs at Economy.init', /starterGrant\(\)/.test(econSrc));

// ---- summary ----------------------------------------------------------------
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
