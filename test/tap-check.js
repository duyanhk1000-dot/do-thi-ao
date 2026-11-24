/* Cuộc Sống Ảo — test/tap-check.js (tap-to-talk fix 2026-11-25)
   Headless check of the tap-to-talk interaction: the user reported that
   long-press (500ms) was too slow because NPCs walk away before the menu
   opens. A quick tap (<350ms, <14px move) on a nearby NPC/player must now
   open the radial menu instantly; long-press stays as a fallback.
   - Parses the thresholds + range from src/main.js source (so the check
     fails if the code drifts from the locked numbers).
   - Simulates the tap predicate (handleTap logic) over tap / slow-press /
     drag / pinch / DOM-target cases.
   - Simulates nearestTarget range (120px) over in-range / out-of-range
     targets, including the parked-vehicle targets.
   Run: node test/tap-check.js   (exit 0 = all PASS) */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('PASS - ' + name + (detail ? ' (' + detail + ')' : '')); }
  else { failed++; console.log('FAIL - ' + name + (detail ? ' (' + detail + ')' : '')); }
}
var mainSrc = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');

// ---- thresholds + range parsed from the source (locked numbers) --------------
var tapMs = /Date\.now\(\) - d\.t >= (\d+)\)/.exec(mainSrc);
var tapPx = /Math\.hypot\(e\.clientX - d\.sx, e\.clientY - d\.sy\) >= (\d+)\)/.exec(mainSrc);
var range = /var best = null, bestD = (\d+);/.exec(mainSrc);
var longPressMs = /longPressTimer = setTimeout\(function \(\) \{[\s\S]*?\}, (\d+)\);/.exec(mainSrc);
check('tap time threshold is 350ms in code', tapMs && +tapMs[1] === 350, tapMs && tapMs[1] + 'ms');
check('tap move threshold is 14px in code', tapPx && +tapPx[1] === 14, tapPx && tapPx[1] + 'px');
check('nearestTarget range is 120px in code', range && +range[1] === 120, range && range[1] + 'px');
check('long-press fallback still armed at 500ms', longPressMs && +longPressMs[1] === 500, longPressMs && longPressMs[1] + 'ms');

// ---- wiring: the tap path must exist in the code -----------------------------
check('onWorldPointerDown records tapDown', /tapDown = \{ sx: e\.global\.x, sy: e\.global\.y, t: Date\.now\(\), wx: w\.x, wy: w\.y \};/.test(mainSrc));
check('window pointerup calls handleTap(e)', /addEventListener\('pointerup', function \(e\) \{ clearLongPress\(\); if \(joy\.active\) endJoy\(\); handleTap\(e\); \}\);/.test(mainSrc));
check('pointermove cancels a dragged tap', /if \(tapDown && Math\.hypot\(e\.clientX - tapDown\.sx, e\.clientY - tapDown\.sy\) > 14\) tapDown = null;/.test(mainSrc));
check('handleTap searches at the DOWN position', /var t = nearestTarget\(d\.wx, d\.wy\);/.test(mainSrc));
check('handleTap ignores taps ending on a DOM element', /if \(e\.target !== app\.view\) return false;/.test(mainSrc));
check('handleTap ignores two-finger pinches', /if \(pinchActive\) return false;/.test(mainSrc));
check('handleTap opens the radial on a target', /if \(t\) \{ openRadial\(t\); sfx\('click'\); \}/.test(mainSrc));
check('right-click still opens the radial immediately', /if \(e\.button === 2\) \{\s*var target = nearestTarget\(w\.x, w\.y\);/.test(mainSrc));
check('floating 💬 indicator created', /talkHint = text\('💬', 26, 0xffffff, true\);/.test(mainSrc));
check('💬 indicator never eats taps (eventMode none)', /talkHint\.eventMode = 'none';/.test(mainSrc));
check('updateTalkHint runs every ticker tick', /updateTalkHint\(\); \/\/ TAP-TO-TALK/.test(mainSrc));
check('💬 only for NPC/player targets within range', /if \(t && \(t\.kind === 'npc' \|\| t\.kind === 'player'\)\) \{/.test(mainSrc));
check('💬 hides while the radial menu is open', /if \(!started \|\| radialMenu\.visible \|\| chatOpen \|\| playerState\.isFainted\) \{/.test(mainSrc));
check('hint line says tap-to-talk', mainSrc.indexOf("Chạm NPC: nói chuyện") >= 0);
check('no "Giữ: mở menu" hint text left', mainSrc.indexOf('Giữ: mở menu') < 0 && mainSrc.indexOf('chạm giữ vào một người chơi') < 0);
check('start guide says tap to open the menu', mainSrc.indexOf('Chạm vào NPC / người chơi gần bạn: mở menu tròn ngay') >= 0);

// ---- tap predicate simulation (same logic as handleTap) ----------------------
var TAP_MS = tapMs ? +tapMs[1] : 350;
var TAP_PX = tapPx ? +tapPx[1] : 14;
function isTap(down, up) {
  // down/up: {t, sx, sy, targetIsCanvas, pinch}
  if (!down) return false;
  if (!up.targetIsCanvas) return false;
  if (up.pinch) return false;
  if (up.t - down.t >= TAP_MS) return false;
  if (Math.hypot(up.sx - down.sx, up.sy - down.sy) >= TAP_PX) return false;
  return true;
}
var down = { t: 1000, sx: 200, sy: 400 };
check('quick tap on the canvas counts as a tap',
  isTap(down, { t: 1150, sx: 202, sy: 402, targetIsCanvas: true, pinch: false }));
check('tap at exactly 13px still counts', isTap(down, { t: 1100, sx: 213, sy: 400, targetIsCanvas: true, pinch: false }));
check('slow press (400ms) is NOT a tap (long-press owns it)',
  !isTap(down, { t: 1400, sx: 200, sy: 400, targetIsCanvas: true, pinch: false }));
check('drag of 20px is NOT a tap',
  !isTap(down, { t: 1150, sx: 220, sy: 400, targetIsCanvas: true, pinch: false }));
check('tap ending on a DOM button is NOT a world tap',
  !isTap(down, { t: 1150, sx: 200, sy: 400, targetIsCanvas: false, pinch: false }));
check('two-finger pinch is NOT a tap',
  !isTap(down, { t: 1150, sx: 200, sy: 400, targetIsCanvas: true, pinch: true }));

// ---- nearestTarget range simulation (120px) ----------------------------------
var RANGE = range ? +range[1] : 120;
function nearest(wx, wy, targets) {
  var best = null, bestD = RANGE;
  targets.forEach(function (t) {
    var d = Math.hypot(t.x - wx, t.y - wy);
    if (d < bestD) { bestD = d; best = t; }
  });
  return best;
}
var npc = { kind: 'npc', name: 'Anh Tùng', x: 100, y: 100 };
var poi = { kind: 'poi', name: 'Cửa Hàng', x: 500, y: 500 };
var bike = { kind: 'vehicle', name: 'Xe đạp của bạn', x: 200, y: 200 };
check('NPC at 119px is found', !!nearest(100, 219, [npc, poi]));
check('NPC at 121px is NOT found (range is 120)', !nearest(100, 221, [npc, poi]));
check('nearest of two in-range targets wins', nearest(160, 160, [npc, poi, bike]) === bike);
check('parked vehicle is a tap target within 120px',
  nearest(200, 250, [bike]) === bike);
check('parked vehicle at 130px is NOT a tap target', !nearest(200, 330, [bike]));
check('no target nearby returns null', !nearest(0, 0, [npc, poi, bike]));

// ---- summary ----------------------------------------------------------------
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
