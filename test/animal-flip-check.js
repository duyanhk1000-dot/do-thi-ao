/* Cuộc Sống Ảo — test/animal-flip-check.js (dog streak, 2026-11-25)
   The user's phone screenshots (05:52 and 08:22) both showed the same long
   flat tan/brown smear with a magenta-red fringe along its bottom edge,
   ~80% of screen width at ~62% height, lying across the road. The dog PNG
   itself is FINE (clean tan puppy, 301x360, corner alpha 0) and propSprite/
   spawnAnimal both size it by aspect (dog 30px wide, ~36px tall) — so the
   file was never the cause. Root cause, at runtime:
   PixiJS derives a Sprite's rendered width from its scale
   (width = |scale.x| * texture.width), and setting .width only sets
   scale.x = w / texture.width ONCE. updateAnimals() then did
   `a.container.scale.x = -1` to flip the dog — which reset its rendered
   width to the full texture width (301px) while the height stayed ~36px:
   exactly a 301x36 flat tan smear (301px = ~77% of a 390px phone screen
   at zoom 1.0x), with the keyed-out shadow residue smeared along the
   bottom edge. The dog only needs to walk left once for the streak to
   appear — and it stays stretched forever (scale.x stays +/-1).
   The fix (src/main.js): spawnAnimal stores baseScaleX = spr.scale.x and
   updateAnimals flips by SIGN only (scale.x = -|baseScaleX| / +|baseScaleX|),
   so the rendered size can never change. NPC walkers were audited too:
   they flip the inner face Container (a plain Container — mirroring it
   cannot change any size), never a width-sized sprite; the player and
   remote players already flip their face container the same way.
   This check verifies, headless (no browser, no PIXI):
   1. a stub modelling PixiJS v8 Sprite width/scale semantics reproduces
      the OLD bug exactly (30px dog -> 301px smear on scale.x = -1);
   2. the NEW pattern keeps the dog 30px wide / ~36px tall and the cat
      22px wide across 200 random flip cycles (both directions);
   3. the old pattern is GONE from src/main.js and the new pattern is in
      updateAnimals + spawnAnimal, and every remaining scale.x flip in
      main.js is on a Container (face / faceO / faceW / r.face) or uses a
      base scale — never `= -1` / `= 1` on a width-sized sprite.
   Run: node test/animal-flip-check.js   (exit 0 = all PASS) */
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
function pngDims(p) {
  var b = fs.readFileSync(path.join(ROOT, p));
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null;
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

// ---- PixiJS v8 Sprite width/scale semantics (stub) -------------------------
// Sprite.width setter: scale.x = value / texture.width (v7 semantics; v8
// additionally preserves the sign, which changes nothing here — the width
// is set BEFORE any flip). Sprite.width getter: |scale.x| * texture.width.
// Sprite.height is analogous via scale.y. Setting scale.x directly does NOT
// re-derive anything: the rendered width becomes |scale.x| * texture.width.
function PixiSpriteStub(texW, texH) {
  this.texW = texW; this.texH = texH;
  this.scale = { x: 1, y: 1 };
}
Object.defineProperty(PixiSpriteStub.prototype, 'width', {
  get: function () { return Math.abs(this.scale.x) * this.texW; },
  set: function (v) { this.scale.x = v / this.texW; }
});
Object.defineProperty(PixiSpriteStub.prototype, 'height', {
  get: function () { return Math.abs(this.scale.y) * this.texH; },
  set: function (v) { this.scale.y = v / this.texH; }
});

// ---- 1. the stub reproduces the reported bug -------------------------------
var dogDims = pngDims('assets/v3/prop-dog-full.png');
var catDims = pngDims('assets/v3/prop-cat-full.png');
check('dog PNG is the clean file (301x360)', !!dogDims && dogDims.w === 301 && dogDims.h === 360,
  dogDims && dogDims.w + 'x' + dogDims.h);
check('cat PNG exists (184x360)', !!catDims && catDims.w === 184 && catDims.h === 360,
  catDims && catDims.w + 'x' + catDims.h);

var dog = new PixiSpriteStub(301, 360);
dog.width = 30; dog.height = 30 * 360 / 301;
check('dog spawns at 30px wide / ~36px tall', Math.abs(dog.width - 30) < 0.01 && Math.abs(dog.height - 35.9) < 0.1,
  dog.width.toFixed(1) + 'x' + dog.height.toFixed(1));
dog.scale.x = -1; // <- the OLD updateAnimals flip
check('OLD flip reproduces the streak: dog becomes 301px wide, height still ~36px',
  Math.abs(dog.width - 301) < 0.01 && Math.abs(dog.height - 35.9) < 0.1,
  dog.width.toFixed(1) + 'x' + dog.height.toFixed(1) + ' (301px = ~77% of a 390px phone screen)');
dog.scale.x = 1;
check('OLD flip back still leaves the dog 301px wide (streak never heals)',
  Math.abs(dog.width - 301) < 0.01, dog.width.toFixed(1) + 'px');

// ---- 2. the NEW pattern keeps the size across flip cycles ------------------
function newFlipSprite(texW, texH, w) {
  var s = new PixiSpriteStub(texW, texH);
  s.width = w; s.height = w * texH / texW;
  return { spr: s, baseScaleX: s.scale.x };
}
function flipLeft(a) { a.spr.scale.x = -Math.abs(a.baseScaleX); }
function flipRight(a) { a.spr.scale.x = Math.abs(a.baseScaleX); }
var dog2 = newFlipSprite(301, 360, 30);
var cat2 = newFlipSprite(184, 360, 22);
var dogH = 30 * 360 / 301, catH = 22 * 360 / 184; // exact aspect heights
var okDog = true, okCat = true, worstDog = 0, worstCat = 0;
for (var i = 0; i < 200; i++) {
  if (Math.random() < 0.5) flipLeft(dog2); else flipRight(dog2);
  if (Math.random() < 0.5) flipLeft(cat2); else flipRight(cat2);
  worstDog = Math.max(worstDog, Math.abs(dog2.spr.width - 30), Math.abs(dog2.spr.height - dogH));
  worstCat = Math.max(worstCat, Math.abs(cat2.spr.width - 22), Math.abs(cat2.spr.height - catH));
  if (Math.abs(dog2.spr.width - 30) > 0.01 || Math.abs(dog2.spr.height - dogH) > 0.1) okDog = false;
  if (Math.abs(cat2.spr.width - 22) > 0.01 || Math.abs(cat2.spr.height - catH) > 0.1) okCat = false;
}
check('NEW flip pattern: dog stays 30x~36px over 200 flip cycles', okDog, 'max drift ' + worstDog.toFixed(3) + 'px');
check('NEW flip pattern: cat stays 22x~43px over 200 flip cycles', okCat, 'max drift ' + worstCat.toFixed(3) + 'px');

// ---- 3. the source actually uses the new pattern ---------------------------
var mainSrc = read('src/main.js');
check('old animal flip is GONE (no "a.container.scale.x = -1" / "= 1")',
  mainSrc.indexOf('a.container.scale.x = -1') < 0 && mainSrc.indexOf('a.container.scale.x = 1') < 0);
check('spawnAnimal stores baseScaleX', /baseScaleX:\s*spr\.scale\.x/.test(mainSrc));
check('updateAnimals flips by sign of baseScaleX',
  mainSrc.indexOf('a.container.scale.x = -Math.abs(a.baseScaleX)') >= 0 &&
  mainSrc.indexOf('a.container.scale.x = Math.abs(a.baseScaleX)') >= 0);
// Audit every remaining scale.x assignment: each must be on a Container
// (face / faceO / faceW / r.face — mirroring a plain Container cannot
// change any size) — never a bare `= -1` / `= 1` on a width-sized sprite.
var flips = mainSrc.match(/[A-Za-z0-9_.$]+\.scale\.x\s*=\s*[^;]+;/g) || [];
var badFlips = flips.filter(function (f) {
  return /scale\.x\s*=\s*-?1\s*;/.test(f) &&
    !/face2\.scale\.x/.test(f) && !/faceO\.scale\.x/.test(f) &&
    !/faceW\.scale\.x/.test(f) && !/r\.face\.scale\.x/.test(f) &&
    !/face\.scale\.x/.test(f);
});
check('every remaining scale.x = +/-1 flip is on a face Container, never on a sprite',
  badFlips.length === 0, flips.length + ' scale.x assignments, bad: ' + badFlips.join(' | '));
check('NPC walkers keep a face reference for flipping (n.face)',
  mainSrc.indexOf('face: npcFace') >= 0 && mainSrc.indexOf('var faceO = n.face || n.container') >= 0);
check('no scale.x = -1 / = 1 left on any .container in main.js',
  !/\.container\.scale\.x\s*=\s*-?1\s*;/.test(mainSrc));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
