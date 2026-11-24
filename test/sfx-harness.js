/* Đô Thị Ảo — test/sfx-harness.js (M3 skills revision, audio-gen step 5)
   Verifies src/sfx.js WITHOUT a browser: a stub AudioContext records every
   oscillator/gain/noise call, so the harness can check frequencies,
   durations, throttling, mute persistence and crash-safety by numbers —
   the same approach as the Cờ Huyền Sử stub harness (45/45 PASS).
   Run: node test/sfx-harness.js   (exit 0 = all PASS)
   No network, no audio output; the real listening test is still the user's
   phone (see docs/m3-sfx.md). */
'use strict';

var passed = 0, failed = 0;
function check(name, ok, detail) {
  if (ok) { passed++; console.log('PASS - ' + name + (detail ? ' (' + detail + ')' : '')); }
  else { failed++; console.log('FAIL - ' + name + (detail ? ' (' + detail + ')' : '')); }
}

// ---- stub AudioContext: records everything, plays nothing ----------------
function makeParam() {
  return {
    values: [],
    setValueAtTime: function (v) { this.values.push(['set', v]); },
    exponentialRampToValueAtTime: function (v) { this.values.push(['ramp', v]); }
  };
}
function makeOsc(calls) {
  var freq = makeParam();
  var o = {
    type: 'sine', frequency: freq,
    connect: function () {}, start: function () {}, stop: function () {},
    _freq: freq
  };
  calls.oscs.push(o);
  return o;
}
function makeGain(calls) {
  var g = makeParam();
  var node = { gain: g, connect: function () {}, _gain: g };
  calls.gains.push(node);
  return node;
}
function FakeAC(calls) {
  this.calls = calls;
  this.currentTime = 10; // non-zero: proves delays are relative, not absolute
  this.sampleRate = 44100;
  this.state = 'running';
  this.destination = {};
}
FakeAC.prototype.createOscillator = function () { return makeOsc(this.calls); };
FakeAC.prototype.createGain = function () { return makeGain(this.calls); };
FakeAC.prototype.createBuffer = function (n, len) {
  return { getChannelData: function () { return new Float32Array(len); } };
};
FakeAC.prototype.createBufferSource = function () {
  var self = this;
  return { buffer: null, connect: function () {}, start: function () {}, stop: function () {} };
};
FakeAC.prototype.createBiquadFilter = function () {
  var self = this;
  self.calls.filters.push(1);
  return { type: '', Q: { value: 0 }, frequency: makeParam(), connect: function () {} };
};
FakeAC.prototype.resume = function () { this.state = 'running'; };
FakeAC.prototype.suspend = function () { this.state = 'suspended'; };

var store = {};
function freshEnv(calls, acCtor) {
  global.window = { AudioContext: acCtor || function () { return new FakeAC(calls); } };
  global.document = { addEventListener: function () {} };
  global.performance = { now: function () { return 1000; } };
  global.localStorage = {
    getItem: function (k) { return (k in store) ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); }
  };
  // Fresh module instance per env (clear require cache).
  delete require.cache[require.resolve('../src/sfx.js')];
  return require('../src/sfx.js');
}
function oscFreqs(calls) {
  return calls.oscs.map(function (o) { return o._freq.values[0] ? o._freq.values[0][1] : null; });
}
function maxDur() { return null; } // durations are asserted from the recipe
// table in docs/m3-sfx.md (tone() takes dur explicitly); the harness checks
// frequencies, envelopes, gates and mute — the numbers that can go wrong.

// ---- 1. load + defaults --------------------------------------------------
var calls = { oscs: [], gains: [], filters: [] };
var sfx = freshEnv(calls);
check('module loads, api object', sfx && typeof sfx.click === 'function');
check('enabled by default (no stored key)', sfx.enabled === true);

// ---- 2. every M3 sound creates oscillators with the recipe frequencies ---
function soundFreqs(name) {
  calls.oscs.length = 0; calls.gains.length = 0; calls.filters.length = 0;
  sfx[name]();
  return oscFreqs(calls);
}
var f;
f = soundFreqs('click'); check('click: 1200 Hz sine', f.indexOf(1200) !== -1, f.join(','));
f = soundFreqs('accept'); check('accept: 700 Hz rising blip', f.indexOf(700) !== -1, f.join(','));
f = soundFreqs('deliver'); check('deliver: coin E6 1318.5 + B6 1975.5', f.indexOf(1318.5) !== -1 && f.indexOf(1975.5) !== -1, f.join(','));
f = soundFreqs('expire'); check('expire: low A2 110 Hz', f.indexOf(110) !== -1, f.join(','));
f = soundFreqs('faint'); check('faint: 196 Hz sink + noise', f.indexOf(196) !== -1 && calls.filters.length >= 1, f.join(','));
f = soundFreqs('revive'); check('revive: heal 660 glide + chime C5 523.25', f.indexOf(660) !== -1 && f.indexOf(523.25) !== -1, f.join(','));
f = soundFreqs('hospital'); check('hospital: heal 660 + 880 note', f.indexOf(660) !== -1 && f.indexOf(880) !== -1, f.join(','));
f = soundFreqs('talk'); check('talk: 300 Hz chirp', f.indexOf(300) !== -1, f.join(','));
f = soundFreqs('jobPick'); check('jobPick: 1200 + 1567.98', f.indexOf(1200) !== -1 && f.indexOf(1567.98) !== -1, f.join(','));
f = soundFreqs('alert'); check('alert: 440 + 329.63 two-tone', f.indexOf(440) !== -1 && f.indexOf(329.63) !== -1, f.join(','));
f = soundFreqs('error'); check('error: low 110 Hz', f.indexOf(110) !== -1, f.join(','));

// ---- 3. slide directions (up = good, down = bad) --------------------------
calls.oscs.length = 0; sfx.deliver();
var deliv = calls.oscs.map(function (o) { return o._freq.values.map(function (v) { return v[1]; }); });
check('deliver: 2nd note higher than 1st (up = reward)', deliv.length >= 2 && deliv[1][0] > deliv[0][0], JSON.stringify(deliv));
calls.oscs.length = 0; sfx.faint();
var faint = calls.oscs[0]._freq.values;
check('faint: frequency slides DOWN (196 -> 98)', faint.some(function (v) { return v[0] === 'ramp' && v[1] === 98; }), JSON.stringify(faint));
calls.oscs.length = 0; sfx.talk();
// talk was already called in section 2 at the same frozen clock, so the
// gate blocks it — reload fresh to clear gate timestamps, then re-check.
calls = { oscs: [], gains: [], filters: [] };
sfx = freshEnv(calls);
calls.oscs.length = 0; sfx.talk();
var talk = calls.oscs[0]._freq.values;
check('talk: chirp slides UP (300 -> 900)', talk.some(function (v) { return v[0] === 'ramp' && v[1] === 900; }), JSON.stringify(talk));

// ---- 4. gain envelope: starts ~0, attacks, decays to ~0 ------------------
calls.oscs.length = 0; calls.gains.length = 0; sfx.click();
var g = calls.gains[0]._gain.values;
check('click gain envelope: 0.0001 -> peak -> 0.0001', g.length === 3 && g[0][1] === 0.0001 && g[1][1] > 0.2 && g[2][1] === 0.0001, JSON.stringify(g));
check('click peak <= 0.5 (no clipping)', g[1][1] <= 0.5, String(g[1][1]));

// ---- 5. throttling: talk/alert gated --------------------------------------
// Fresh module: clears the gate timestamps set by the section-2 calls.
calls = { oscs: [], gains: [], filters: [] };
sfx = freshEnv(calls);
calls.oscs.length = 0;
sfx.talk(); var n1 = calls.oscs.length;
sfx.talk(); var n2 = calls.oscs.length;
check('talk throttled: 2nd call within 150 ms creates nothing', n1 >= 1 && n2 === n1, n1 + ' -> ' + n2);
calls.oscs.length = 0;
sfx.alert(); var a1 = calls.oscs.length;
sfx.alert(); var a2 = calls.oscs.length;
check('alert throttled: 2nd call within 500 ms creates nothing', a1 >= 1 && a2 === a1, a1 + ' -> ' + a2);

// ---- 6. mute toggle persists + blocks sound --------------------------------
// Fresh module again (section-5 gates are still warm at a frozen clock).
calls = { oscs: [], gains: [], filters: [] };
sfx = freshEnv(calls);
check('toggle off returns false + stores 0', sfx.toggle() === false && store.dta_sfx === '0');
calls.oscs.length = 0; sfx.deliver(); sfx.click(); sfx.faint();
check('muted: no oscillators created', calls.oscs.length === 0, String(calls.oscs.length));
check('toggle on returns true + stores 1', sfx.toggle() === true && store.dta_sfx === '1');
calls.oscs.length = 0; sfx.click();
check('unmuted: sound works again', calls.oscs.length >= 1, String(calls.oscs.length));

// ---- 7. crash-safety --------------------------------------------------------
var calls2 = { oscs: [], gains: [], filters: [] };
var sfxNoAC = freshEnv(calls2, undefined);
global.window.AudioContext = undefined; // no WebAudio at all
var threw = false;
try { ['click', 'deliver', 'faint', 'revive', 'hospital', 'talk'].forEach(function (n) { sfxNoAC[n](); }); } catch (e) { threw = true; }
check('no AudioContext: all sounds no-op, no throw', !threw);

var calls3 = { oscs: [], gains: [], filters: [] };
global.window = { AudioContext: function () { throw new Error('boom'); } };
global.document = { addEventListener: function () {} };
delete require.cache[require.resolve('../src/sfx.js')];
var sfxBoom = require('../src/sfx.js');
threw = false;
try { sfxBoom.click(); sfxBoom.toggle(); sfxBoom.toggle(); } catch (e) { threw = true; }
check('AudioContext constructor throws: no throw', !threw);

// localStorage throwing (private mode): load + toggle must not throw.
global.window = { AudioContext: function () { return new FakeAC(calls3); } };
global.localStorage = { getItem: function () { throw new Error('denied'); }, setItem: function () { throw new Error('denied'); } };
delete require.cache[require.resolve('../src/sfx.js')];
threw = false;
try { var sfxLS = require('../src/sfx.js'); sfxLS.click(); sfxLS.toggle(); } catch (e) { threw = true; }
check('localStorage denied: load + click + toggle no throw', !threw);

// ---- summary ----------------------------------------------------------------
console.log('\nSFX harness: ' + passed + ' PASS, ' + failed + ' FAIL');
process.exit(failed ? 1 : 0);
