# Cuộc Sống Ảo — Rename + VFX (2026-11-25)

## Rename

- Display name is now **"Cuộc Sống Ảo"** (user, 2026-11-25). Changed in:
  `index.html` (`<title>`), `src/main.js` (header comment + start-screen
  title `CUỘC SỐNG ẢO`), `README.md`, `docs/m3-skills-audit.md` and
  `docs/m3-sfx.md` headers (with a rename note). Grep-verify:
  `grep -rn "Đô Thị Ảo" index.html src/main.js README.md` → no matches.
- NOT renamed (deliberate): GitHub repo `do-thi-ao`, GitHub Pages URL,
  localStorage keys (`dta_m2_wallet_v1`, `dta_sfx`, `dta_vfx`), file/folder
  names, server room `'city'`, the SRS file (rename lands in SRS v2.2,
  separate later work). Comments in other files may still say "Đô Thị Ảo"
  as history.

## VFX — `src/vfx.js` (`window.DTA_VFX`)

PixiJS-only, Graphics/Text, no new image assets. Principles adapted from
`scenario-godot-vfx` SKILL.md: effects are layers (burst + ring + text),
juice is testable code (harness below), tier by amount (fixed small counts),
pooled lifecycle (one 48-Graphics pool, no hot-loop allocation).

| Effect | Event (same call site as SFX) | Call sites |
|---|---|---|
| Night lamp glow pools (additive, fade with darkness) | every tick, `darknessFor(hour)` | `main.js` ticker → `setNight(dark)` |
| Deliver: 12 gold coins + floating `+Xđ` text | shipper deliver | `main.js` `onJobResult` complete, `jobs.js` `localComplete` |
| Revive: 10 green sparkles + ring pulse | doctor/hospital revive | `main.js` `onRevived`, `onJobResult` hospital, `offlineHospitalRevive` |
| Faint: 6 grey stars circling + 150ms shake (~4px, trauma², decay 1.8/s) + sprite dims (tint 0x777777, alpha 0.7) | faint | `main.js` `offlineFaint`, `syncSelf` false→true edge (online self-faint — this also covers the known SFX gap: no server `fainted` message) |
| Talk: white speech puff + 3 heart/note particles | NPC talk | `main.js` `onNpcTalk`, radial talk (bot / guide / walker, offline) |
| Shipper accept: dashed yellow path line player → target, cleared on deliver/expire/cancel/faint | shipper accept | `main.js` `onJobResult` accept, `jobs.js` `localAccept`; cleared in `onJobResult` complete/cancel/!ok, `jobs.js` `localComplete`/`localCancel`/`onLocalFaint`/`tick` |
| Delivery arrow pulse | order active | `main.js` ticker (`orderArrow.alpha = 0.7 + 0.3·sin(t)`) |
| Rain: 40 thin streaks in camera view | 18:00–06:00 game time | `main.js` ticker → `DTA_VFX.tick` |

Toggle: `#vfxBtn` (✨/✖, bottom 518px) in `index.html`, persisted as
localStorage `dta_vfx` ('0' = off, default on). Off clears every live
effect immediately. VFX never throws into the game (all public methods
guarded; `vfx()` wrapper in `main.js`/`jobs.js` mirrors the `sfx()` wrapper).

FPS choices (cloud browser already runs ~10 FPS): particle pool 48 max,
one Graphics per effect layer (ring/path/rain redrawn, not re-created),
rain is a single Graphics with 40 line segments, glow pools are one
Graphics per lamp created once at init (tick only moves/alpha-fades them),
shake is a transient offset applied after `updateCamera()`.

## Verification

- `node --check` PASS on all 13 JS files (src + shared + server + tests).
- `node test/vfx-harness.js`: **40 PASS, 0 FAIL** (stub PIXI: lifecycle,
  toggle persistence, pool cap, no-PIXI no-throw).
- `node test/sfx-harness.js`: **27 PASS, 0 FAIL** (unchanged).
- `cd server && npm test`: **35 PASS, 0 FAIL** (3 clean runs; one earlier
  back-to-back run showed a single transient FAIL — port collision between
  two test runs started in the same command, no server code was touched
  by this task).
- Static serving: `index.html`, `src/main.js`, `src/vfx.js`, `src/sfx.js`,
  `src/jobs.js` all HTTP 200; title is "Cuộc Sống Ảo".
- Regressions: `makeFullBody` 6 refs, `makeBadge` 0, ATM/SHOP wired.

## NOT done

- Economy v2 / professions / mini-games and SRS v2.2: separate later work
  (user direction 2026-11-25; production chains + server as market-maker
  with a buy-cheap/sell-expensive spread — recorded in MEMORY.md).
- Map v2 integration (4800 map, v3 assets): separate task; `assets/v3/`
  was not touched. Note from the v3 report: `hero-citizen-full.png` still
  shows its magenta background (flood-fill transparency not yet applied)
  — run it before integration.
- No real browser/phone test of the VFX (look test is still the user's
  phone on the live Pages link after the next deploy). Not pushed/deployed.
