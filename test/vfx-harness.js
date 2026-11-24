/* Cuộc Sống Ảo — test/vfx-harness.js (rename + VFX, Godot-VFX "juice is code
   you can test" rule, adapted to PixiJS)
   Verifies src/vfx.js WITHOUT a browser: a stub PIXI records every Graphics
   / Text / Container call, so the harness can check by numbers that every
   effect spawns the right objects, cleans up after itself (active counts
   return to 0 — the Godot-VFX lifecycle gate), the toggle blocks everything,
   and nothing throws when PIXI is absent — the same approach as the SFX
   stub harness (27/27 PASS).
   Run: node test/vfx-harness.js   (exit 0 = all PASS)
   No network, no rendering; the real look test is still the user's phone
   (the live Pages link after the next deploy). */
'use strict';

var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('PASS - ' + name + (detail ? ' (' + detail + ')' : '')); }
  else { failed++; console.log('FAIL - ' + name + (detail ? ' (' + detail + ')' : '')); }
}

// ---- stub PIXI: records everything, draws nothing -------------------------
function makePoint() {
  return { x: 0, y: 0, set: function (x, y) { this.x = x; this.y = y; } };
}
function FakeGraphics() {
  this.children = [];
  this.visible = true; this.alpha = 1; this.blendMode = 'normal';
  this.position = makePoint(); this.scale = makePoint(); this.scale.x = 1; this.scale.y = 1;
  this.tint = 0xffffff;
  this.calls = [];
}
FakeGraphics.prototype.clear = function () { this.calls.push('clear'); return this; };
FakeGraphics.prototype.circle = function (x, y, r) { this.calls.push(['circle', x, y, r]); return this; };
FakeGraphics.prototype.rect = function () { this.calls.push('rect'); return this; };
FakeGraphics.prototype.roundRect = function () { this.calls.push('roundRect'); return this; };
FakeGraphics.prototype.ellipse = function () { this.calls.push('ellipse'); return this; };
FakeGraphics.prototype.moveTo = function (x, y) { this.calls.push(['moveTo', x, y]); return this; };
FakeGraphics.prototype.lineTo = function (x, y) { this.calls.push(['lineTo', x, y]); return this; };
FakeGraphics.prototype.closePath = function () { this.calls.push('closePath'); return this; };
FakeGraphics.prototype.fill = function (o) { this.calls.push(['fill', o]); return this; };
FakeGraphics.prototype.stroke = function (o) { this.calls.push(['stroke', o]); return this; };
FakeGraphics.prototype.addChild = function (c) { this.children.push(c); return c; };
FakeGraphics.prototype.removeChild = function (c) {
  var i = this.children.indexOf(c);
  if (i >= 0) this.children.splice(i, 1);
  return c;
};
function FakeContainer() {
  this.children = [];
  this.visible = true; this.alpha = 1;
  this.position = makePoint();
}
FakeContainer.prototype.addChild = function (c) { this.children.push(c); return c; };
FakeContainer.prototype.removeChild = function (c) {
  var i = this.children.indexOf(c);
  if (i >= 0) this.children.splice(i, 1);
  return c;
};
function FakeText(opts) {
  this.text = (opts && opts.text) || '';
  this.style = (opts && opts.style) || {};
  this.anchor = { set: function () {} };
  this.position = makePoint();
  this.alpha = 1; this.visible = true;
}
var StubPIXI = {
  Graphics: FakeGraphics,
  Container: FakeContainer,
  Text: FakeText,
  BLEND_MODES: { ADD: 'add', NORMAL: 'normal' }
};

var store = {};
function freshEnv(withPixi) {
  if (withPixi) global.PIXI = StubPIXI; else delete global.PIXI;
  global.localStorage = {
    getItem: function (k) { return (k in store) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  };
  delete require.cache[require.resolve('../src/vfx.js')];
  return require('../src/vfx.js');
}
function fakeWorld() {
  var w = new FakeContainer();
  w.position = makePoint();
  return w;
}
function fakeLamp(x, y) {
  var g = new FakeGraphics();
  g.position.set(x, y);
  return g;
}
function dayCtx() {
  return { hour: 10, view: { left: 0, top: 0, right: 1200, bottom: 900 }, playerX: 600, playerY: 450, order: null, faint: null };
}
function nightCtx() {
  var c = dayCtx();
  c.hour = 20;
  return c;
}
function advance(vfx, n, ctx) {
  for (var i = 0; i < n; i++) vfx.tick(0.05, ctx || dayCtx());
}

// ---- 1. No PIXI at all: everything no-ops, never throws -------------------
var vfx0 = freshEnv(false);
var threw = false;
try {
  vfx0.init({ world: fakeWorld(), lamps: [] });
  vfx0.deliver(0, 0, '+1đ'); vfx0.revive(0, 0); vfx0.faint(0, 0, null);
  vfx0.unfaint(null); vfx0.talk(0, 0); vfx0.acceptPath(1, 1); vfx0.clearPath();
  vfx0.setNight(0.38); vfx0.tick(0.05, dayCtx()); vfx0.toggle(); vfx0.toggle();
} catch (e) { threw = true; }
check('no PIXI: all VFX calls no-op, no throw', !threw);
check('no PIXI: debug counts are 0', vfx0._debug().poolTotal === 0 && vfx0._debug().particlesActive === 0);

// ---- 2. Init with stub PIXI ------------------------------------------------
store = {};
var vfx = freshEnv(true);
var world = fakeWorld();
var lamps = [fakeLamp(100, 100), fakeLamp(500, 100), fakeLamp(900, 500)];
check('init returns true', vfx.init({ world: world, lamps: lamps }) === true);
var d = vfx._debug();
check('init: pool is 48 particles', d.poolTotal === 48, 'pool=' + d.poolTotal);
check('init: 3 lamp glow pools', d.glowsTotal === 3, 'glows=' + d.glowsTotal);
check('init: fxLayer added to world', world.children.length === 1);
check('init: rain pool is 40 drops', d.rainDrops === 40, 'rain=' + d.rainDrops);
check('init twice returns false (no duplicate layer)', vfx.init({ world: world, lamps: [] }) === false);
check('init: nothing active yet', d.particlesActive === 0 && d.ringActive === false && d.pathVisible === false);

// ---- 3. Deliver: 12 coins + floating text, all cleaned up ------------------
vfx.deliver(600, 450, '+15.000đ');
d = vfx._debug();
check('deliver: 12 coin particles active', d.particlesActive === 12, 'active=' + d.particlesActive);
advance(vfx, 20); // 1.0 s > 0.6 s coin life
d = vfx._debug();
check('deliver: particles return to pool (0 active)', d.particlesActive === 0, 'active=' + d.particlesActive);

// ---- 4. Revive: 10 sparkles + ring, cleaned up -----------------------------
vfx.revive(600, 450);
d = vfx._debug();
check('revive: 10 sparkles + ring active', d.particlesActive === 10 && d.ringActive === true, 'active=' + d.particlesActive);
advance(vfx, 20); // 1.0 s > 0.8 s sparkle life, 0.5 s ring life
d = vfx._debug();
check('revive: sparkles + ring cleaned up', d.particlesActive === 0 && d.ringActive === false);

// ---- 5. Faint: 6 stars + shake + dim, unfaint restores ----------------------
var faceSprite = { tint: 0xffffff };
var target = { alpha: 1, userData: { face: { children: [faceSprite] } } };
vfx.faint(600, 450, target);
d = vfx._debug();
check('faint: 6 stars circling', d.starsActive === 6, 'stars=' + d.starsActive);
check('faint: shake trauma set', d.shake > 0, 'trauma=' + d.shake.toFixed(2));
check('faint: sprite dimmed (tint 0x777777, alpha 0.7)', faceSprite.tint === 0x777777 && target.alpha === 0.7);
vfx.tick(0.05, { hour: 10, view: { left: 0, top: 0, right: 1200, bottom: 900 }, playerX: 600, playerY: 450, order: null, faint: { x: 600, y: 450 } });
d = vfx._debug();
check('faint: stars follow the fainted player', d.starsActive === 6);
advance(vfx, 20, { hour: 10, view: { left: 0, top: 0, right: 1200, bottom: 900 }, playerX: 600, playerY: 450, order: null, faint: { x: 600, y: 450 } });
d = vfx._debug();
check('faint: shake decays to 0', d.shake === 0, 'trauma=' + d.shake);
check('faint: stars persist while fainted', d.starsActive === 6);
vfx.unfaint(target);
d = vfx._debug();
check('unfaint: stars cleared', d.starsActive === 0 && d.particlesActive === 0);
check('unfaint: tint + alpha restored', faceSprite.tint === 0xffffff && target.alpha === 1);

// ---- 6. Talk: puff + 3 hearts/notes, cleaned up ----------------------------
vfx.talk(300, 300);
d = vfx._debug();
check('talk: puff + 3 particles active', d.particlesActive === 4, 'active=' + d.particlesActive);
advance(vfx, 20);
check('talk: particles cleaned up', vfx._debug().particlesActive === 0);

// ---- 7. Accept path: drawn while order active, cleared on end --------------
vfx.acceptPath(900, 700);
var orderCtx = dayCtx();
orderCtx.order = { targetX: 900, targetY: 700 };
vfx.tick(0.05, orderCtx);
check('acceptPath: dashed path visible while order active', vfx._debug().pathVisible === true);
vfx.clearPath();
check('clearPath: path hidden', vfx._debug().pathVisible === false);
vfx.acceptPath(900, 700);
vfx.tick(0.05, dayCtx()); // order ended without clearPath
check('path auto-hides when the order is gone', vfx._debug().pathVisible === false);

// ---- 8. Night lighting: glow pools follow the dark --------------------------
vfx.setNight(0.38);
check('setNight(0.38): all 3 glow pools visible', vfx._debug().glowsVisible === 3);
vfx.setNight(0);
check('setNight(0): glow pools hidden', vfx._debug().glowsVisible === 0);
vfx.setNight(0.19);
check('setNight(0.19): glow pools visible at half dark', vfx._debug().glowsVisible === 3);

// ---- 9. Rain: night only, inside the camera view ----------------------------
vfx.tick(0.05, nightCtx());
check('rain: visible at 20:00 game time', vfx._debug().rainVisible === true);
vfx.tick(0.05, dayCtx());
check('rain: hidden at 10:00 game time', vfx._debug().rainVisible === false);

// ---- 10. Toggle: off blocks everything, persists, on restores ---------------
vfx.toggle(); // off
check('toggle off: enabled false', vfx.enabled === false);
check('toggle off: persisted as dta_vfx=0', store.dta_vfx === '0');
vfx.deliver(600, 450, '+1đ');
vfx.tick(0.05, nightCtx());
d = vfx._debug();
check('toggle off: deliver + tick create nothing', d.particlesActive === 0 && d.rainVisible === false && d.glowsVisible === 0);
vfx.toggle(); // on
check('toggle on: enabled true', vfx.enabled === true);
vfx.deliver(600, 450, '+1đ');
check('toggle on: deliver works again', vfx._debug().particlesActive === 12);
advance(vfx, 20);
// Fresh module with stored '0' starts disabled.
store.dta_vfx = '0';
var vfxOff = freshEnv(true);
check('stored dta_vfx=0: fresh module starts disabled', vfxOff.enabled === false);
store.dta_vfx = '1';

// ---- 11. Pool cap: 10 delivers never exceed the 48 pool ----------------------
var vfx2 = freshEnv(true);
var world2 = fakeWorld();
vfx2.init({ world: world2, lamps: [] });
for (var k = 0; k < 10; k++) vfx2.deliver(600, 450, '+1đ');
d = vfx2._debug();
check('pool cap: 10 delivers stay within 48 particles', d.particlesActive <= 48, 'active=' + d.particlesActive);
advance(vfx2, 20);
check('pool cap: everything returns to pool', vfx2._debug().particlesActive === 0);

// ---- 12. Tick with missing/empty ctx never throws -----------------------------
threw = false;
try { vfx2.tick(); vfx2.tick(0.05); vfx2.tick(0.05, {}); } catch (e) { threw = true; }
check('tick with no/empty ctx: no throw', !threw);

console.log('\nVFX harness: ' + passed + ' PASS, ' + failed + ' FAIL');
process.exit(failed ? 1 : 0);
