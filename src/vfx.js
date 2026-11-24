/* Cuộc Sống Ảo — src/vfx.js (rename + VFX, 2026-11-25)
   PixiJS-only visual effects, drawn with Graphics/Text, NO new image assets.
   VFX design principles adapted from scenario-godot-vfx SKILL.md (do NOT
   import Godot code — this game is PixiJS v8): an effect is LAYERS, not one
   particle system (a deliver is flash + coin burst + floating text; a revive
   is sparkles + ring pulse); JUICE IS CODE YOU CAN TEST (every effect is
   spawned by a function and cleans up after itself — see test/vfx-harness.js);
   TIER BY AMOUNT (particle counts are small and fixed: 12-coin burst, 10
   sparkles, 6 stars, 40 rain streaks — never hidden-ratio tricks); lifecycle
   is pooled, not freed-per-spawn (ONE pre-built pool of 48 Graphics, reused,
   so there is no per-frame allocation in the hot loop — the cloud browser
   already runs ~10 FPS).
   Fires at the SAME events as src/sfx.js (audio-gen tier (a)), so sight +
   sound match: deliver / revive / hospital / faint / talk / accept / jobPick
   all have a VFX twin next to their SFX call site in src/main.js / src/jobs.js.
   Toggle persisted in localStorage key 'dta_vfx' ('0' = off, default on);
   turning VFX off clears every live effect. All public methods are no-ops
   when PIXI/world is missing and never throw into the game.

   Plain JS, UMD-ish like sfx.js: window.DTA_VFX in the browser,
   module.exports in Node (the stub harness in test/vfx-harness.js loads it
   that way). Loaded AFTER src/sfx.js, BEFORE src/main.js. */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.DTA_VFX = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KEY = 'dta_vfx';
  var POOL_N = 48;      // one pre-built particle pool, never grows at runtime
  var RAIN_N = 40;      // thin rain streaks, night only
  var TEXT_N = 4;       // floating-text pool
  var NIGHT_MAX = 0.38; // matches darknessFor() in src/main.js

  var store = {
    get: function () {
      try { return (typeof localStorage !== 'undefined') ? localStorage.getItem(KEY) : null; } catch (e) { return null; }
    },
    set: function (v) {
      try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, v); } catch (e) { /* stay in-memory */ }
    }
  };
  var enabled = store.get() !== '0'; // default ON; '0' = off

  function PX() {
    try { return (typeof PIXI !== 'undefined') ? PIXI : null; } catch (e) { return null; }
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  var world = null;     // PIXI.Container (the map), set by init()
  var fxLayer = null;   // Container on top of the world, holds all VFX
  var glows = [];       // lamp glow pools: {g, x, y}
  var particles = [];   // pooled {g, active, ...}
  var texts = [];       // pooled floating texts {t, active, life, maxLife}
  var ring = null;      // {g, active, x, y, r, maxR, life, maxLife, color}
  var pathG = null;     // dashed delivery-path Graphics
  var pathTarget = null; // {x, y} | null
  var rainG = null;
  var rain = [];        // {x, y, len, spd}
  var stars = null;     // {parts:[particles], x, y} while someone is fainted
  var dimmed = null;    // {target, alpha} while the fainted sprite is dimmed
  var trauma = 0;       // screen shake, Godot-VFX style: trauma^2, decay 1.8/s
  var shakeX = 0, shakeY = 0;
  var nightDark = 0;

  function makeGfx() {
    var P = PX();
    if (!P) return null;
    try { return new P.Graphics(); } catch (e) { return null; }
  }
  function makeText(str) {
    var P = PX();
    if (!P) return null;
    try {
      return new P.Text({
        text: str,
        style: {
          fontFamily: 'Arial, sans-serif', fontSize: 18, fill: 0xffe082,
          fontWeight: 'bold', stroke: { color: 0x000000, width: 4 }, align: 'center'
        }
      });
    } catch (e) { return null; }
  }

  // One particle Graphics, drawn once at spawn (circle r=5, scaled to size).
  function drawParticle(p, color) {
    try {
      p.g.clear();
      p.g.circle(0, 0, 5).fill({ color: color, alpha: 1 });
      p.g.scale.set(p.size / 5, p.size / 5);
      p.g.alpha = 1;
      p.g.visible = true;
      p.g.position.set(p.x, p.y);
    } catch (e) { /* never throw */ }
  }
  function spawnParticle(kind, x, y, o) {
    o = o || {};
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (p.active) continue;
      p.active = true; p.kind = kind;
      p.x = x; p.y = y;
      p.vx = o.vx || 0; p.vy = o.vy || 0;
      p.life = o.life || 0.6; p.maxLife = p.life;
      p.grav = o.grav || 0; p.size = o.size || 5;
      p.orbitR = o.orbitR || 0; p.orbitAng = o.orbitAng || 0; p.orbitSpd = o.orbitSpd || 0;
      drawParticle(p, o.color || 0xffffff);
      return p;
    }
    return null; // pool exhausted: skip the particle, never allocate
  }
  function killParticle(p) {
    p.active = false; p.kind = '';
    try { p.g.visible = false; } catch (e) {}
  }
  function activeCount() {
    var n = 0;
    for (var i = 0; i < particles.length; i++) if (particles[i].active) n++;
    return n;
  }

  function clearAll() {
    for (var i = 0; i < particles.length; i++) killParticle(particles[i]);
    for (var j = 0; j < texts.length; j++) {
      texts[j].active = false;
      try { texts[j].t.visible = false; } catch (e) {}
    }
    for (var k = 0; k < glows.length; k++) {
      try { glows[k].g.visible = false; } catch (e) {}
    }
    if (ring) { ring.active = false; try { ring.g.visible = false; } catch (e) {} }
    if (pathG) { try { pathG.clear(); pathG.visible = false; } catch (e) {} }
    pathTarget = null;
    if (rainG) { try { rainG.visible = false; } catch (e) {} }
    stars = null;
    trauma = 0; shakeX = 0; shakeY = 0;
    restoreDim();
  }
  function restoreDim() {
    if (!dimmed) return;
    try {
      var face = dimmed.target && dimmed.target.userData && dimmed.target.userData.face;
      if (face && face.children) {
        for (var i = 0; i < face.children.length; i++) {
          if (face.children[i].tint !== undefined) face.children[i].tint = 0xffffff;
        }
      }
      if (dimmed.target) dimmed.target.alpha = dimmed.alpha;
    } catch (e) { /* never throw */ }
    dimmed = null;
  }

  var api = {
    get enabled() { return enabled; },
    toggle: function () {
      enabled = !enabled;
      store.set(enabled ? '1' : '0');
      if (!enabled) clearAll();
      else if (fxLayer) { try { fxLayer.visible = true; } catch (e) {} }
      return enabled;
    },

    // Called once from main.js boot, after buildWorld() (world + lampGlows
    // exist). lamps: array of Graphics with .position {x, y} (main.js lampGlows).
    init: function (opts) {
      var P = PX();
      if (!P || !opts || !opts.world || fxLayer) return false;
      try {
        world = opts.world;
        fxLayer = new P.Container();
        world.addChild(fxLayer);
        // Particle pool: pre-built once, reused forever (no hot-loop alloc).
        for (var i = 0; i < POOL_N; i++) {
          var g = makeGfx();
          if (!g) return false;
          g.visible = false;
          fxLayer.addChild(g);
          particles.push({ g: g, active: false, kind: '', x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, grav: 0, size: 5, orbitR: 0, orbitAng: 0, orbitSpd: 0 });
        }
        // Floating-text pool.
        for (var j = 0; j < TEXT_N; j++) {
          var t = makeText('');
          if (!t) return false;
          t.visible = false;
          try { t.anchor.set(0.5, 0.5); } catch (e) {}
          fxLayer.addChild(t);
          texts.push({ t: t, active: false, life: 0, maxLife: 1 });
        }
        // Ring pulse (one Graphics, redrawn while active).
        ring = { g: makeGfx(), active: false, x: 0, y: 0, r: 0, maxR: 60, life: 0, maxLife: 0.5, color: 0x2ecc71 };
        if (!ring.g) return false;
        ring.g.visible = false;
        fxLayer.addChild(ring.g);
        // Dashed delivery path (one Graphics, redrawn in tick while active).
        pathG = makeGfx();
        if (!pathG) return false;
        pathG.visible = false;
        fxLayer.addChild(pathG);
        // Rain (one Graphics, redrawn in tick while it rains).
        rainG = makeGfx();
        if (!rainG) return false;
        rainG.visible = false;
        fxLayer.addChild(rainG);
        for (var k = 0; k < RAIN_N; k++) rain.push({ x: 0, y: 0, len: 26, spd: 700 });
        // Lamp glow pools: 3 concentric warm circles, additive blend, so
        // the lamps read as pools of light on the dark night map. One
        // Graphics per lamp, created once — tick only moves/alpha-fades them.
        var lamps = opts.lamps || [];
        for (var l = 0; l < lamps.length; l++) {
          var lg = makeGfx();
          if (!lg) continue;
          try {
            lg.circle(0, 0, 64).fill({ color: 0xffd97a, alpha: 0.10 });
            lg.circle(0, 0, 42).fill({ color: 0xffd97a, alpha: 0.14 });
            lg.circle(0, 0, 22).fill({ color: 0xffd97a, alpha: 0.20 });
            lg.blendMode = 'add';
            lg.position.set(lamps[l].position.x, lamps[l].position.y - 20);
            lg.visible = false;
          } catch (e) { continue; }
          fxLayer.addChild(lg);
          glows.push({ g: lg });
        }
        return true;
      } catch (e) { return false; }
    },

    // Night lighting: called every tick from main.js with the same darkness
    // value as the night overlay (0 day .. 0.38 full night). Glow pools
    // fade in with the dark, so lamps genuinely light the night.
    setNight: function (dark) {
      nightDark = clamp(dark || 0, 0, NIGHT_MAX);
      var a = enabled ? nightDark / NIGHT_MAX : 0;
      for (var i = 0; i < glows.length; i++) {
        try { glows[i].g.visible = a > 0.05; glows[i].g.alpha = a; } catch (e) {}
      }
    },

    // Deliver success (same call site as SFX deliver): 12 gold coins burst
    // + floating "+15.000đ" text rising above the player. Layered like a
    // Godot explosion: flash particles first, text reads second.
    deliver: function (x, y, label) {
      if (!enabled || !fxLayer) return;
      try {
        for (var i = 0; i < 12; i++) {
          var ang = (i / 12) * Math.PI * 2 + 0.3;
          var spd = 60 + (i % 4) * 30;
          spawnParticle('coin', x, y - 10, {
            vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 90,
            life: 0.6, grav: 320, size: 4 + (i % 3), color: 0xffd700
          });
        }
        if (label) {
          for (var j = 0; j < texts.length; j++) {
            if (texts[j].active) continue;
            texts[j].active = true;
            texts[j].life = 1.0; texts[j].maxLife = 1.0;
            texts[j].t.text = label;
            texts[j].t.position.set(x, y - 56);
            texts[j].t.visible = true;
            texts[j].t.alpha = 1;
            break;
          }
        }
      } catch (e) { /* never throw */ }
    },

    // Revive / hospital (same call site as SFX revive/hospital): 10 green
    // cross sparkles rising + one soft ring pulse expanding and fading.
    revive: function (x, y) {
      if (!enabled || !fxLayer) return;
      try {
        for (var i = 0; i < 10; i++) {
          var ang = (i / 10) * Math.PI * 2;
          spawnParticle('spark', x, y - 10, {
            vx: Math.cos(ang) * 40, vy: -70 - (i % 3) * 25,
            life: 0.8, grav: -20, size: 4 + (i % 2), color: 0x2ecc71
          });
        }
        if (ring) {
          ring.active = true; ring.x = x; ring.y = y - 10; ring.r = 8; ring.maxR = 64;
          ring.life = 0.5; ring.maxLife = 0.5; ring.color = 0x2ecc71;
          ring.g.visible = true;
        }
      } catch (e) { /* never throw */ }
    },

    // Faint (same call site as SFX faint): 6 grey stars circling above the
    // fainted player for as long as they stay fainted + a short screen
    // shake (trauma 0.6, ~4px, decay 1.8/s per the Godot-VFX numbers) +
    // the sprite dims/desaturates while fainted.
    faint: function (x, y, target) {
      if (!enabled || !fxLayer) return;
      try {
        trauma = Math.max(trauma, 0.6);
        var parts = [];
        for (var i = 0; i < 6; i++) {
          var p = spawnParticle('orbit', x, y - 52, {
            life: 0, size: 4, color: 0xbbbbbb,
            orbitR: 26, orbitAng: (i / 6) * Math.PI * 2, orbitSpd: 3
          });
          if (p) parts.push(p);
        }
        stars = { parts: parts, x: x, y: y };
        if (target && !dimmed) {
          var origAlpha = (target.alpha !== undefined) ? target.alpha : 1;
          var face = target.userData && target.userData.face;
          if (face && face.children) {
            for (var j = 0; j < face.children.length; j++) {
              if (face.children[j].tint !== undefined) face.children[j].tint = 0x777777;
            }
          }
          target.alpha = 0.7;
          dimmed = { target: target, alpha: origAlpha };
        }
      } catch (e) { /* never throw */ }
    },
    unfaint: function (target) {
      stars = null;
      if (target && dimmed && dimmed.target === target) restoreDim();
      else if (!target) restoreDim();
      for (var i = 0; i < particles.length; i++) {
        if (particles[i].active && particles[i].kind === 'orbit') killParticle(particles[i]);
      }
    },

    // NPC talk (same call site as SFX talk): a small white speech puff
    // above the NPC + 3 heart/note particles rising when the persona line
    // appears. Throttled by the caller (one talk per radial click).
    talk: function (x, y) {
      if (!enabled || !fxLayer) return;
      try {
        var puff = spawnParticle('puff', x, y - 56, { vx: 0, vy: -12, life: 0.4, size: 9, color: 0xffffff });
        if (puff) puff.g.alpha = 0.9;
        var cols = [0xff6b9d, 0xffe082, 0xff6b9d];
        for (var i = 0; i < 3; i++) {
          spawnParticle('note', x + (i - 1) * 12, y - 56, {
            vx: (i - 1) * 12, vy: -46 - i * 10, life: 0.7, size: 4, color: cols[i]
          });
        }
      } catch (e) { /* never throw */ }
    },

    // Shipper accept (same call site as SFX accept): the dashed path line
    // is created now and lives until deliver / expire / cancel / faint.
    // It is redrawn in tick() from the player's CURRENT position, so it
    // stays accurate as the player moves (a line drawn once at accept time
    // would go stale within a second).
    acceptPath: function (tx, ty) {
      if (!enabled || !fxLayer) return;
      pathTarget = { x: tx, y: ty };
    },
    clearPath: function () {
      pathTarget = null;
      if (pathG) { try { pathG.clear(); pathG.visible = false; } catch (e) {} }
    },

    // Per-frame update, called from main.js ticker AFTER updateCamera()
    // (so the shake offset applied here is transient — updateCamera resets
    // world.x/y every frame). ctx: {hour, view:{left,top,right,bottom},
    // playerX, playerY, order:{targetX,targetY}|null, faint:{x,y}|null}.
    // Rain only runs 18:00–06:00 game time, inside the camera view.
    tick: function (dt, ctx) {
      if (!enabled || !fxLayer || !world) return;
      dt = Math.min(0.05, dt || 0);
      ctx = ctx || {};
      try {
        var i, p;
        // Particles: integrate, fade, return to pool at life 0.
        for (i = 0; i < particles.length; i++) {
          p = particles[i];
          if (!p.active) continue;
          if (p.kind === 'orbit') {
            p.orbitAng += p.orbitSpd * dt;
            var cx = (ctx.faint ? ctx.faint.x : (stars ? stars.x : p.x));
            var cy = (ctx.faint ? ctx.faint.y - 52 : (stars ? stars.y - 52 : p.y));
            p.x = cx + Math.cos(p.orbitAng) * p.orbitR;
            p.y = cy + Math.sin(p.orbitAng) * p.orbitR * 0.5;
            p.g.position.set(p.x, p.y);
            continue;
          }
          if (p.maxLife > 0) {
            p.life -= dt;
            if (p.life <= 0) { killParticle(p); continue; }
          }
          p.vy += p.grav * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.g.position.set(p.x, p.y);
          p.g.alpha = clamp(p.life / p.maxLife, 0, 1);
        }
        // Ring pulse: expand + fade, then hide.
        if (ring && ring.active) {
          ring.life -= dt;
          if (ring.life <= 0) { ring.active = false; ring.g.visible = false; }
          else {
            var k = 1 - ring.life / ring.maxLife;
            ring.r = 8 + (ring.maxR - 8) * k;
            ring.g.clear();
            ring.g.circle(ring.x, ring.y, ring.r).stroke({ width: 4, color: ring.color, alpha: 1 - k });
          }
        }
        // Floating texts: rise + fade.
        for (i = 0; i < texts.length; i++) {
          var ft = texts[i];
          if (!ft.active) continue;
          ft.life -= dt;
          if (ft.life <= 0) { ft.active = false; ft.t.visible = false; continue; }
          ft.t.position.y -= 34 * dt;
          ft.t.alpha = clamp(ft.life / ft.maxLife, 0, 1);
        }
        // Dashed delivery path: player -> target, while an order is active.
        if (pathG) {
          if (pathTarget && ctx.order) {
            var x0 = ctx.playerX || 0, y0 = ctx.playerY || 0;
            var dx = pathTarget.x - x0, dy = pathTarget.y - y0;
            var d = Math.hypot(dx, dy);
            pathG.clear();
            if (d > 30) {
              var ux = dx / d, uy = dy / d;
              var dash = 14, gap = 10, s = 0;
              pathG.visible = true;
              while (s < d) {
                var e = Math.min(s + dash, d);
                pathG.moveTo(x0 + ux * s, y0 + uy * s);
                pathG.lineTo(x0 + ux * e, y0 + uy * e);
                s = e + gap;
              }
              pathG.stroke({ width: 3, color: 0xf1c40f, alpha: 0.85 });
            } else pathG.visible = false;
          } else if (pathTarget && !ctx.order) {
            // Order ended without a clearPath call: hide the line.
            pathG.clear(); pathG.visible = false; pathTarget = null;
          }
        }
        // Rain: 40 thin streaks inside the camera view, night only.
        var hour = (ctx.hour === undefined) ? 12 : ctx.hour;
        var isNight = (hour >= 18 || hour < 6);
        if (rainG) {
          if (!isNight) { rainG.visible = false; }
          else {
            var view = ctx.view || { left: (ctx.playerX || 0) - 600, top: (ctx.playerY || 0) - 450, right: (ctx.playerX || 0) + 600, bottom: (ctx.playerY || 0) + 450 };
            rainG.visible = true;
            rainG.clear();
            for (i = 0; i < rain.length; i++) {
              var r = rain[i];
              if (r.y === 0 && r.x === 0) { r.x = view.left + Math.random() * (view.right - view.left); r.y = view.top + Math.random() * (view.bottom - view.top); }
              r.y += r.spd * dt;
              r.x += 40 * dt;
              if (r.y > view.bottom) { r.y = view.top - 10; r.x = view.left + Math.random() * (view.right - view.left); }
              if (r.x > view.right) r.x = view.left;
              rainG.moveTo(r.x, r.y);
              rainG.lineTo(r.x - 3, r.y + r.len);
            }
            rainG.stroke({ width: 1.5, color: 0x9fc4e8, alpha: 0.35 });
          }
        }
        // Screen shake: trauma^2 * 4px, decay 1.8/s (Godot-VFX numbers).
        // Applied to world.position AFTER updateCamera, so it never fights
        // the camera — it is a transient offset, gone next frame.
        if (trauma > 0) trauma = Math.max(0, trauma - 1.8 * dt);
        var mag = trauma * trauma * 4;
        shakeX = mag * (Math.random() * 2 - 1);
        shakeY = mag * (Math.random() * 2 - 1);
        try {
          world.position.x += shakeX;
          world.position.y += shakeY;
        } catch (e) { /* world without a position: skip shake */ }
      } catch (e) { /* VFX must never crash the game */ }
    },

    _debug: function () {
      var glowsOn = 0;
      for (var i = 0; i < glows.length; i++) { try { if (glows[i].g.visible) glowsOn++; } catch (e) {} }
      return {
        enabled: enabled, poolTotal: particles.length, particlesActive: activeCount(),
        glowsTotal: glows.length, glowsVisible: glowsOn,
        ringActive: !!(ring && ring.active), pathVisible: !!(pathG && pathG.visible),
        rainVisible: !!(rainG && rainG.visible), rainDrops: rain.length,
        starsActive: stars ? stars.parts.length : 0,
        shake: trauma, shakeX: shakeX, shakeY: shakeY, nightDark: nightDark
      };
    }
  };

  return api;
});
