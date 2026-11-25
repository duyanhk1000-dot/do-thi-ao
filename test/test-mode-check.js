/* Cuộc Sống Ảo — test/test-mode-check.js (test mode ?test=1, 2026-11-25)
   The user asked for a test mode for free money and movement speed.
   ?test=1 enables a small collapsible TEST panel (DOM, left edge below
   the HUD panel); without the param there is NO test UI at all. The panel
   offers +1.000.000đ, speed x1/x2/x3 and full HP/Hunger/Stamina heal.
   Limits, by design: money + heal are OFFLINE-ONLY (online the server
   owns the wallet and the stats and there is no test endpoint — adding
   one would be a cheat vector); the speed multiplier is offline-only too
   (online the server enforces its own speed). The panel states these
   limits in its note line and disables the buttons while online.
   This check verifies, headless (no browser, no PIXI):
   1. the panel is gated on ?test=1 and hidden otherwise;
   2. all three controls exist in index.html + src/main.js with the right
      ids, and the money button grants exactly 1.000.000đ via
      Economy.grant with a 'test_grant' type;
   3. the speed multiplier applies only offline (netMode !== 'online')
      and multiplies the final speed in updatePlayer;
   4. heal restores HP/Hunger/Stamina to 100 and clears a faint;
   5. the panel is positioned clear of the HUD panel / status pill /
      zoom buttons (left 10px, top 210px).
   Run: node test/test-mode-check.js   (exit 0 = all PASS) */
'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('PASS - ' + name + (detail ? ' (' + detail + ')' : '')); }
  else { failed++; console.log('FAIL - ' + name + (detail ? ' (' + detail + ')' : '')); }
}
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }

var mainSrc = read('src/main.js');
var htmlSrc = read('index.html');

// ---- 1. gating on ?test=1 ---------------------------------------------------
check('test mode is OFF by default (testMode = false)',
  /var testMode = false, testSpeedMult = 1;/.test(mainSrc));
check('test mode reads ?test=1 from the URL',
  mainSrc.indexOf("q.get('test') === '1'") >= 0);
check('panel is hidden when the param is absent',
  mainSrc.indexOf("if (!testMode) { panel.style.display = 'none'; return; }") >= 0);
check('panel div is display:none in CSS by default',
  /#testPanel \{[^}]*display: none;/.test(htmlSrc));
check('initTestMode is called from boot', mainSrc.indexOf('initTestMode();') >= 0);

// ---- 2. the three controls ---------------------------------------------------
check('panel has money / heal buttons + speed row (x1/x2/x3)',
  htmlSrc.indexOf('id="testMoney"') >= 0 && htmlSrc.indexOf('id="testHeal"') >= 0 &&
  htmlSrc.indexOf('data-speed="1"') >= 0 && htmlSrc.indexOf('data-speed="2"') >= 0 &&
  htmlSrc.indexOf('data-speed="3"') >= 0);
check('panel is collapsible (toggle + .open class)',
  htmlSrc.indexOf('id="testToggle"') >= 0 && mainSrc.indexOf("body.classList.toggle('open')") >= 0);
check('money button grants exactly 1.000.000đ via Economy.grant (test_grant)',
  mainSrc.indexOf("Economy.grant(1000000, 'test_grant'") >= 0);
check('panel note states the offline-only limits',
  htmlSrc.indexOf('Chỉ hoạt động offline') >= 0 &&
  mainSrc.indexOf('Đang ONLINE: tiền + hồi máu bị khóa') >= 0);

// ---- 3. speed multiplier: offline only ---------------------------------------
check('speed multiplier is applied in updatePlayer',
  mainSrc.indexOf('speed = Math.round(speed * testSpeedMult)') >= 0);
check('speed multiplier is offline-only (netMode !== \'online\' guard)',
  /if \(testMode && netMode !== 'online' && testSpeedMult !== 1\) speed = /.test(mainSrc));
check('speed buttons are disabled while online',
  /btns\[i\]\.disabled = online;/.test(mainSrc));

// ---- 4. heal ------------------------------------------------------------------
check('heal restores HP/Hunger/Stamina to 100',
  mainSrc.indexOf('playerState.hp = 100; playerState.hunger = 100; playerState.stamina = 100;') >= 0);
check('heal clears a faint (isFainted=false, faintInfo=null)',
  /if \(playerState\.isFainted\) \{\s*playerState\.isFainted = false; playerState\.anim = 'idle'; faintInfo = null;/.test(mainSrc));
check('money + heal buttons refuse while online (click-time guard)',
  (mainSrc.match(/if \(netMode === 'online'\) return; \/\/ server owns/g) || []).length >= 2);
check('panel re-syncs with online/offline twice a second',
  mainSrc.indexOf('if (testMode) syncTestPanel();') >= 0);

// ---- 5. placement --------------------------------------------------------------
check('panel sits below the HUD panel + status pill, clear of zoom buttons',
  /#testPanel \{ position: fixed; left: 10px; top: 210px;/.test(htmlSrc),
  'left 10px, top 210px (HUD ends y168 phone / 158 desktop, pill y174, zoom x268+)');

// ---- 6. no test affordance leaks into the normal game ---------------------------
check('no test button is visible without the panel (all inside #testPanel)',
  (function () {
    var body = htmlSrc.split('<body>')[1] || '';
    return body.indexOf('testMoney') > body.indexOf('id="testPanel"') &&
      body.indexOf('testHeal') > body.indexOf('id="testPanel"');
  })());

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
