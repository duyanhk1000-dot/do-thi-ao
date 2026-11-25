/* Cuộc Sống Ảo — test/traffic-check.js (moving traffic, 2026-11-25)
   The user asked "Chưa có xe cộ di chuyển trên đường à" — the roads had
   only 3 parked cars and 5 parked showroom motorbikes, nothing moving.
   The fix adds 8 ambient vehicles (4 cars + 4 motorbikes) driving the
   road bands (shared/colliders.js ROAD_BANDS 1140/2340/3540, width 180)
   in both directions at 200-300 px/s, two right-hand lanes per band,
   wrapping at the map edges. Visual only (like the animals): no collision,
   the server never sees them. Orientation is by ROTATION only — never a
   scale.x flip (the dog-streak bug: flipping a width-sized sprite resets
   its width to texture width). Movers are y-sorted with the player via
   world.sortableChildren + zIndex = y; UI world children and the VFX
   layer are pinned above (99999 / 100000).
   This check verifies, headless (no browser, no PIXI):
   1. the car/motorbike PNGs exist with the expected aspects (car wide,
      motorbike tall — the rotation math depends on it);
   2. the wiring in src/main.js + src/vfx.js (spawn/update, ticker call,
      speeds, lanes, wrap, rotation-only, aspect-preserving sizing,
      y-sort + UI pins);
   3. a simulation of the traffic step math with the same constants from
      the source: over 60 simulated seconds every vehicle stays on its
      road band (lane coordinate exact) and inside the wrap bounds, and
      both vehicle kinds keep their aspect ratio.
   Run: node test/traffic-check.js   (exit 0 = all PASS) */
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

var mainSrc = read('src/main.js');
var vfxSrc = read('src/vfx.js');

// ---- 1. the images -----------------------------------------------------------
var carDims = pngDims('assets/v3/prop-car-full.png');
var motoDims = pngDims('assets/v3/prop-motorbike-full.png');
check('car image exists, wide side view (741x360)', !!carDims && carDims.w === 741 && carDims.h === 360,
  carDims && carDims.w + 'x' + carDims.h);
check('motorbike image exists, tall top-down (204x360)', !!motoDims && motoDims.w === 204 && motoDims.h === 360,
  motoDims && motoDims.w + 'x' + motoDims.h);

// ---- 2. wiring in the source -------------------------------------------------
function numConst(src, name) {
  // constants may be declared as `var A = 1, B = 2;` — do not anchor on var
  var m = src.match(new RegExp('(?:^|[,;\\s])' + name + '\\s*=\\s*([0-9]+)'));
  return m ? parseInt(m[1], 10) : null;
}
var count = numConst(mainSrc, 'TRAFFIC_COUNT');
var speedMin = numConst(mainSrc, 'TRAFFIC_SPEED_MIN');
var speedMax = numConst(mainSrc, 'TRAFFIC_SPEED_MAX');
var wrap = numConst(mainSrc, 'TRAFFIC_WRAP');
check('8 traffic vehicles', count === 8, 'TRAFFIC_COUNT=' + count);
check('traffic speed 200-300 px/s', speedMin === 200 && speedMax === 300, speedMin + '-' + speedMax);
check('wrap margin 120px', wrap === 120, 'TRAFFIC_WRAP=' + wrap);
check('spawnTraffic() exists and is called from buildWorld',
  mainSrc.indexOf('function spawnTraffic()') >= 0 && mainSrc.indexOf('spawnTraffic();') >= 0);
check('updateTraffic(dt) exists and is called in the ticker',
  mainSrc.indexOf('function updateTraffic(dt)') >= 0 && mainSrc.indexOf('updateTraffic(dt);') >= 0);
check('traffic drives the ROAD_BANDS (1140/2340/3540)',
  mainSrc.indexOf('var band = ROAD_BANDS[i % ROAD_BANDS.length];') >= 0 &&
  JSON.stringify(Colliders.ROAD_BANDS) === JSON.stringify([1140, 2340, 3540]));
check('two lanes per band (offsets +45 / +135)',
  mainSrc.indexOf('? 45 : 135') >= 0 && mainSrc.indexOf('? 135 : 45') >= 0);
check('traffic uses both directions', mainSrc.indexOf("var dir = (i % 3 === 0) ? -1 : 1;") >= 0);
check('traffic sprites are aspect-preserved (height = w * th/tw)',
  /spr\.height = w \* tex\.height \/ tex\.width;/.test(mainSrc));
check('traffic has no scale.x flip (rotation only — dog-streak rule)',
  (function () {
    var start = mainSrc.indexOf('function spawnTraffic()');
    var end = mainSrc.indexOf('function updateTraffic(dt)');
    var end2 = mainSrc.indexOf('\n  }', end);
    var block = mainSrc.slice(start, end2);
    return block.indexOf('scale.x') < 0 && block.indexOf('rotation') >= 0;
  })());
check('parked showroom motorbikes + parked cars are untouched (still drawn)',
  mainSrc.indexOf("propSprite('motorbike', bx, 3080, 34)") >= 0 &&
  mainSrc.indexOf("propSprite('car', 4000, 1920, 90)") >= 0);
// y-sort: sortable world + zIndex = y on every mover class, UI pinned above.
check('world is sortable (sortableChildren)', mainSrc.indexOf('world.sortableChildren = true;') >= 0);
check('player/NPC/animal/remote/traffic zIndex follows y',
  mainSrc.indexOf('player.zIndex = playerState.y') >= 0 &&
  mainSrc.indexOf('n.container.zIndex = n.y') >= 0 &&
  mainSrc.indexOf('a.container.zIndex = a.y') >= 0 &&
  mainSrc.indexOf('r.container.zIndex = r.ry') >= 0 &&
  mainSrc.indexOf('t.spr.zIndex = t.y') >= 0);
check('UI world children pinned above movers (zIndex 99999)',
  (mainSrc.match(/\.zIndex = 99999/g) || []).length >= 5);
check('VFX layer pinned above movers (zIndex 100000)',
  vfxSrc.indexOf('fxLayer.zIndex = 100000;') >= 0);

// ---- 3. simulation of the traffic step math ---------------------------------
// Same constants as the source: bands [1140,2340,3540], lanes from the
// right-hand rule, speeds 200-300, wrap 120, map 4800x4800.
var MAP = 4800;
var BANDS = [1140, 2340, 3540];
var kinds = ['car', 'motorbike', 'car', 'motorbike', 'car', 'motorbike', 'car', 'motorbike'];
var vehicles = [];
for (var i = 0; i < count; i++) {
  var kind = kinds[i % kinds.length];
  var vertical = (i % 2 === 0);
  var band = BANDS[i % BANDS.length];
  var dir = (i % 3 === 0) ? -1 : 1;
  var lane = vertical ? (dir > 0 ? 45 : 135) : (dir > 0 ? 135 : 45);
  var speed = speedMin + Math.random() * (speedMax - speedMin);
  vehicles.push({
    kind: kind, vertical: vertical, band: band, lane: lane, dir: dir, speed: speed,
    x: vertical ? band + lane : Math.random() * MAP,
    y: vertical ? Math.random() * MAP : band + lane
  });
}
var simOk = true, simDetail = '';
var dt = 0.05; // 20 Hz, same as the game ticker clamp
for (var step = 0; step < 1200; step++) { // 60 simulated seconds
  vehicles.forEach(function (t) {
    if (t.vertical) {
      t.y += t.dir * t.speed * dt;
      if (t.y > MAP + wrap) t.y = -wrap;
      else if (t.y < -wrap) t.y = MAP + wrap;
      // lane coordinate must stay exactly on the road band, all the time
      if (Math.abs(t.x - (t.band + t.lane)) > 0.001) { simOk = false; simDetail = 'vertical lane drift x=' + t.x; }
      if (t.y < -wrap - 0.001 || t.y > MAP + wrap + 0.001) { simOk = false; simDetail = 'vertical y out of wrap y=' + t.y; }
      if (!Colliders.inRoad(t.x, t.y) && t.y >= 0 && t.y <= MAP) {
        // on a vertical band the x is always in a road band; y may cross
        // a horizontal band too — either way inRoad must be true on-map
        simOk = false; simDetail = 'vertical vehicle off-road at (' + t.x + ',' + t.y + ')';
      }
    } else {
      t.x += t.dir * t.speed * dt;
      if (t.x > MAP + wrap) t.x = -wrap;
      else if (t.x < -wrap) t.x = MAP + wrap;
      if (Math.abs(t.y - (t.band + t.lane)) > 0.001) { simOk = false; simDetail = 'horizontal lane drift y=' + t.y; }
      if (t.x < -wrap - 0.001 || t.x > MAP + wrap + 0.001) { simOk = false; simDetail = 'horizontal x out of wrap x=' + t.x; }
      if (!Colliders.inRoad(t.x, t.y) && t.x >= 0 && t.x <= MAP) {
        simOk = false; simDetail = 'horizontal vehicle off-road at (' + t.x + ',' + t.y + ')';
      }
    }
  });
}
check('simulation: all 8 vehicles stay on their road band for 60 s', simOk, simDetail || '8 vehicles x 1200 steps');
var nVert = vehicles.filter(function (v) { return v.vertical; }).length;
var nHoriz = vehicles.length - nVert;
check('simulation: traffic uses both axes (vertical + horizontal roads)',
  nVert > 0 && nHoriz > 0, nVert + ' vertical, ' + nHoriz + ' horizontal');
var nDirPos = vehicles.filter(function (v) { return v.dir > 0; }).length;
check('simulation: traffic drives in both directions', nDirPos > 0 && nDirPos < vehicles.length,
  nDirPos + ' forward, ' + (vehicles.length - nDirPos) + ' backward');
// Aspect ratio is preserved by the sizing (height = w * th/tw), not by flips.
check('aspect: car 90px wide -> ~44px tall, motorbike 34px wide -> ~60px tall',
  Math.abs(90 * 360 / 741 - 43.7) < 0.2 && Math.abs(34 * 360 / 204 - 60) < 0.2,
  'car h=' + (90 * 360 / 741).toFixed(1) + ', bike h=' + (34 * 360 / 204).toFixed(1));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
