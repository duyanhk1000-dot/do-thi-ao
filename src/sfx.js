/* Đô Thị Ảo — src/sfx.js (M3 SFX, audio-gen tier (a))
   WebAudio code-synthesized SFX — NO external files, NO AI music/SFX API
   (none is connected; Runway is not_connected, Suno/Udio need a key — see
   custom-skills/audio-gen/SKILL.md). Offline, lazy AudioContext after the
   first touch (browsers block autoplay), mute toggle saved in localStorage
   key 'dta_sfx' ('0' = off, default on), never throws into the game.

   One sound family: sine + light x2 harmonic (warm, never harsh), attack
   8 ms, exponential decay to silence, peak <= 0.5. UI sounds < 0.3 s,
   event sounds < 1 s (audio-gen rules). Only 5 distinct motifs cover the
   8 M3 events + click: click, coin, chime, low, chirp — same family,
   varied by pitch/direction, so the sounds stay coherent instead of
   9 unrelated noises. Recipes in docs/m3-sfx.md (per sfx-recipes.md).

   Plain JS, UMD-ish: window.DTA_SFX in the browser, module.exports in
   Node (the stub harness in test/sfx-harness.js loads it that way).
   Loaded BEFORE src/main.js so every call site can use it. Every public
   method is a no-op when muted or when AudioContext is unavailable. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.DTA_SFX = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'dta_sfx';
  var ac = null;
  var last = {}; // throttle key -> performance.now()
  var store = {
    get: function () {
      try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(KEY) : null; } catch (e) { return null; }
    },
    set: function (v) {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, v); } catch (e) { /* storage unavailable: stay in-memory */ }
    }
  };
  var enabled = store.get() !== '0'; // default ON; '0' = off

  function unlock() {
    if (!enabled) return false;
    try {
      if (!ac) {
        var AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
        if (!AC) return false;
        ac = new AC();
      }
      if (ac.state === 'suspended') ac.resume();
      return true;
    } catch (e) { return false; }
  }

  function gate(k, ms) {
    var n = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (last[k] && n - last[k] < ms) return false;
    last[k] = n;
    return true;
  }

  // One sine tone (+ light x2 harmonic), attack 8 ms, exp decay to silence.
  function tone(freq, o) {
    o = o || {};
    if (!enabled || !unlock()) return;
    try {
      var t = ac.currentTime + (o.delay || 0);
      var d = o.dur || 0.12;
      var v = (o.vol === undefined) ? 0.45 : o.vol;
      var osc = ac.createOscillator();
      var g = ac.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), t + d);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(g); g.connect(ac.destination);
      osc.start(t); osc.stop(t + d + 0.05);
      if (o.harm) {
        var o2 = ac.createOscillator();
        var g2 = ac.createGain();
        o2.type = 'sine';
        o2.frequency.setValueAtTime(freq * o.harm, t);
        if (o.slideTo) o2.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo * o.harm), t + d);
        g2.gain.setValueAtTime(0.0001, t);
        g2.gain.exponentialRampToValueAtTime(v * 0.3, t + 0.008);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o2.connect(g2); g2.connect(ac.destination);
        o2.start(t); o2.stop(t + d + 0.05);
      }
    } catch (e) { /* audio must never crash the game */ }
  }

  // Band-passed noise sweep (whoosh / fail texture). WebAudio only.
  function noise(o) {
    o = o || {};
    if (!enabled || !unlock()) return;
    try {
      var t = ac.currentTime + (o.delay || 0);
      var d = o.dur || 0.25;
      var v = (o.vol === undefined) ? 0.3 : o.vol;
      var len = Math.max(1, Math.floor(ac.sampleRate * d));
      var buf = ac.createBuffer(1, len, ac.sampleRate);
      var ch = buf.getChannelData(0);
      for (var i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
      var src = ac.createBufferSource();
      src.buffer = buf;
      var fl = ac.createBiquadFilter();
      fl.type = 'bandpass'; fl.Q.value = 1.2;
      fl.frequency.setValueAtTime(o.f0 || 400, t);
      fl.frequency.exponentialRampToValueAtTime(o.f1 || 2000, t + d);
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(fl); fl.connect(g); g.connect(ac.destination);
      src.start(t); src.stop(t + d + 0.05);
    } catch (e) { /* audio must never crash the game */ }
  }

  function seq(notes) {
    for (var i = 0; i < notes.length; i++) {
      tone(notes[i][0], { delay: notes[i][1], dur: notes[i][2], vol: notes[i][3] || 0.45 });
    }
  }

  // --- the 5 motifs (sfx-recipes.md) -------------------------------------
  function coin() { // E6 -> B6, up = got something good. 0.19 s.
    tone(1318.5, { dur: 0.07, vol: 0.5, harm: 2 });
    tone(1975.5, { delay: 0.07, dur: 0.12, vol: 0.5, harm: 2 });
  }
  function chime() { // C5-E5-G5 up, major, happy. 0.32 s.
    seq([[523.25, 0, 0.12], [659.25, 0.1, 0.12], [783.99, 0.2, 0.14]]);
  }
  function fail() { // A2 110 -> 95 Hz, low, sinks. 0.35 s.
    tone(110, { dur: 0.35, vol: 0.5, slideTo: 95, harm: 3 });
  }
  function heal() { // 660 -> 990 Hz glide up, soft. 0.18 s.
    tone(660, { dur: 0.18, vol: 0.32, slideTo: 990 });
  }
  function pop() { // 300 -> 900 Hz chirp up. 0.12 s.
    tone(300, { dur: 0.12, vol: 0.4, slideTo: 900 });
  }

  var api = {
    get enabled() { return enabled; },
    unlock: unlock,
    toggle: function () {
      enabled = !enabled;
      store.set(enabled ? '1' : '0');
      if (!enabled && ac) { try { ac.suspend(); } catch (e) {} }
      return enabled;
    },
    // UI click (job panel buttons, radial menu). 0.05 s.
    click: function () { tone(1200, { dur: 0.05, vol: 0.32 }); },
    // M3 shipper accept: short rising blip (order taken). 0.08 s.
    accept: function () { tone(700, { dur: 0.08, vol: 0.4, slideTo: 1050 }); },
    // M3 shipper deliver: coin (reward paid). 0.19 s.
    deliver: function () { coin(); },
    // M3 shipper expire / fail (incl. faint mid-order): low fail buzz. 0.35 s.
    expire: function () { fail(); },
    // M3 faint (self): low 196 -> 98 Hz sink + soft noise. 0.45 s.
    faint: function () {
      tone(196, { dur: 0.45, vol: 0.5, slideTo: 98, harm: 2 });
      noise({ dur: 0.3, f0: 300, f1: 120, vol: 0.15 });
    },
    // M3 doctor revive (by me or on me): heal glide + chime. 0.52 s.
    revive: function () {
      heal();
      seq([[523.25, 0.16, 0.12], [659.25, 0.26, 0.12], [783.99, 0.36, 0.14]]);
    },
    // M3 hospital revive (fee paid): heal glide + one soft coin note. 0.3 s.
    hospital: function () {
      heal();
      tone(880, { delay: 0.16, dur: 0.1, vol: 0.3, harm: 2 });
    },
    // M3 NPC talk: pop chirp (someone speaks). 0.12 s.
    talk: function () { if (gate('talk', 150)) pop(); },
    // M3 job pick: click + soft blip (choice confirmed). 0.1 s.
    jobPick: function () { tone(1200, { dur: 0.05, vol: 0.32 }); tone(1567.98, { delay: 0.05, dur: 0.08, vol: 0.3 }); },
    // M3 faint alert (doctor only, someone else fainted): two soft low
    // notes, a call — NOT the full faint sound (that is for self). 0.2 s.
    alert: function () { if (gate('alert', 500)) seq([[440, 0, 0.1], [329.63, 0.1, 0.12]]); },
    // Generic error (shipper rejected, etc.): fail buzz. 0.35 s.
    error: function () { fail(); }
  };

  // Unlock on first user gesture (browsers block autoplay before it).
  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('pointerdown', function () { unlock(); }, { once: true });
    document.addEventListener('keydown', function () { unlock(); }, { once: true });
  }
  return api;
});
