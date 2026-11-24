# Cuộc Sống Ảo — M3 SFX (audio-gen tier (a), 2026-11-25)

> Rename (user, 2026-11-25): the game was "Đô Thị Ảo" until this revision; the display name is now "Cuộc Sống Ảo".

M3 shipped with NO sound for its new features. This revision adds sound
using **audio-gen tier (a) only: code-synthesized WebAudio SFX** — the only
tier that works right now. No AI music/SFX API is connected (Runway is
`not_connected`, Suno/Udio need a key via secure form — see
`custom-skills/audio-gen/SKILL.md`), so nothing here pretends otherwise.
No music loop was added: M3 has no background-music decision yet, and
audio-gen says silence is the default — sound must earn its play.

Engine: `src/sfx.js` (`window.DTA_SFX`), patterned on the proven CHS SFX
engine (`~/workspace/kybien-checkout/frontend/co-huyen-su.html`, 45/45 stub
harness): lazy `AudioContext` after the first touch (browsers block
autoplay), sine + light x2 harmonic, attack 8 ms, exponential decay to
silence, peak ≤ 0.5, every call wrapped in try/catch so audio can never
crash the game. Mute toggle `#sfxBtn` (🔊/🔇) in `index.html`, persisted in
`localStorage` key `dta_sfx` (`'0'` = off, default on).

One sound family, 5 motifs — audio-gen caps a UI family at ~6 distinct
sounds, so the 8 M3 events + click/alert/error share motifs and vary by
pitch/direction instead of being 9 unrelated noises:
- **click** — UI confirm. **coin** — up = got something good.
- **chime** — major arpeggio up, happy. **low** — down = bad/loss.
- **chirp** — short sweep up, someone speaks.

## SFX prompts (audio-gen step 2: material + action + listening angle + space + duration, 1 event per clip)

Each prompt is the design intent for one clip; the recipe column is the
exact WebAudio implementation in `src/sfx.js` (per `sfx-recipes.md`).

| # | Sound (method) | SFX prompt | Recipe | Dur |
|---|---|---|---|---|
| 1 | click | `plastic button click, single tap, dry, close mic, 0.05s` | sine 1200 Hz, 0.05 s, vol 0.32 | 0.05 s |
| 2 | accept (shipper accept) | `paper slip stamped, single soft thump rising, dry, close mic, 0.08s` | sine 700 → 1050 Hz glide, 0.08 s, vol 0.40 | 0.08 s |
| 3 | deliver (shipper deliver) | `two gold coins clinking, bright metal, ascending, dry, close mic, 0.19s` | E6 1318.5 Hz 0.07 s → B6 1975.5 Hz 0.12 s, harm x2, vol 0.50 (recipe: coin) | 0.19 s |
| 4 | expire (shipper expire/fail) | `low brass buzz sagging down, single note, dry, close mic, 0.35s` | sine A2 110 → 95 Hz, harm x3, 0.35 s, vol 0.50 (recipe: fail) | 0.35 s |
| 5 | faint (self faints) | `body collapsing onto soft ground, low thud sinking, muffled, close mic, 0.45s` | sine 196 → 98 Hz, harm x2, 0.45 s + band-pass noise 300 → 120 Hz, vol 0.15 | 0.45 s |
| 6 | revive (doctor revive) | `warm chime blooming upward, glassy sine, bright, small room, 0.52s` | heal glide 660 → 990 Hz 0.18 s + chime C5 523.25 / E5 659.25 / G5 783.99 (recipe: success) | 0.52 s |
| 7 | hospital (hospital revive, fee paid) | `soft chime with one coin tick, glassy sine, bright, small room, 0.30s` | heal glide 660 → 990 Hz 0.18 s + 880 Hz note 0.10 s, harm x2 | 0.30 s |
| 8 | talk (NPC/bot speaks) | `small bubble popping upward, wet pop, dry, close mic, 0.12s` | sine chirp 300 → 900 Hz, 0.12 s, vol 0.40 (recipe: pop), gated 150 ms | 0.12 s |
| 9 | jobPick (job chosen) | `plastic button click plus bright tick, single tap, dry, close mic, 0.13s` | 1200 Hz 0.05 s + 1567.98 Hz 0.08 s (delay 0.05), vol 0.30–0.32 | 0.13 s |
| 10 | alert (faint alert, doctors only) | `two soft low call notes, wooden knock, distant, small room, 0.20s` | 440 Hz 0.10 s → 329.63 Hz 0.12 s, gated 500 ms | 0.22 s |
| 11 | error (shipper rejected) | `low brass buzz sagging down, single note, dry, close mic, 0.35s` | same as expire (fail recipe) | 0.35 s |

All UI sounds < 0.3 s, all event sounds < 1 s (audio-gen limits). No sound
is the only signal for its event — every event also shows a chat line /
bubble / panel (audio-gen: sound supplements the image, never replaces it).
`talk` and `alert` are throttled (150 ms / 500 ms) so a crowded street
cannot stack chirps. `revive` plays only when I am the reviver or the
revived; other players' revives are silent for me (their bubble is the
signal).

## Call sites

| Event | Where it plays | Online | Offline |
|---|---|---|---|
| shipper accept | `src/jobs.js` `localAccept()` ok; `src/main.js` `onJobResult` shipper/accept ok | onJobResult | localAccept |
| shipper deliver | `src/jobs.js` `localComplete()` ok; `src/main.js` `onJobResult` shipper/complete ok | onJobResult | localComplete |
| shipper expire/fail | `src/jobs.js` `localComplete()` EXPIRED; `src/main.js` `onJobResult` shipper !ok EXPIRED/FAILED | onJobResult | localComplete |
| shipper error | `src/main.js` `onJobResult` shipper !ok (other errors) | onJobResult | — (local errors show text only) |
| faint (self) | `src/main.js` `offlineFaint()` | server faint is seen via `playerState.isFainted` flip — no sound wired yet (server has no `fainted` message; see §Known gaps) | offlineFaint |
| hospital revive | `src/main.js` `offlineHospitalRevive()`; `onJobResult` hospital ok | onJobResult | offlineHospitalRevive |
| doctor revive | `src/main.js` `onRevived` (only if `targetId` or `byId` is me) | onRevived | — (no human doctor exists offline; hospital is the offline revive path, per SRS) |
| NPC/bot talk | `src/main.js` radial `talk` (offline local lines + bot lines); `onNpcTalk` (server reply) | onNpcTalk | radial talk |
| job pick | `src/jobs.js` `setJob()` offline; `src/main.js` `onJobResult` job ok | onJobResult | setJob |
| faint alert | `src/main.js` `onFaintAlert` (doctors only) | onFaintAlert | — (no other players offline) |
| UI click | job panel buttons (`src/jobs.js` init), radial revive send, hospital button (`src/main.js`) | same | same |

## Known gaps (not hidden)

- **Online self-faint has no sound yet.** Offline faint plays in
  `offlineFaint()`, but online the server flips `isFainted` through state
  sync and there is no `fainted` server message to hook. Fix for M4: add a
  server `fainted` message (or play on the `isFainted` false→true edge in
  `onPlayerChanged` for the local player). Do NOT fake it from the
  offline path — online survival is server-authoritative.
- **No music loop.** Deliberate: no music decision, no connected music
  API. When the user wants one, it is audio-gen tier (b)/(c) with a key.
- **Listening test still needed.** The harness checks numbers, not ears.
  The user must listen on his phone: faint/revive/deliver on the live
  Pages link after the next deploy, and judge feel (too loud? too shrill?).

## Verification (this revision)

- `node --check` PASS: `src/sfx.js`, `src/main.js`, `src/jobs.js`, `server/rooms/CityRoom.js`, `server/schema.js`, `shared/m3.js`.
- `node test/sfx-harness.js`: **27 PASS, 0 FAIL** (stub AudioContext: all 11
  sounds create oscillators with the recipe frequencies; slide directions
  up/down verified; gain envelope 0.0001 → peak ≤ 0.5 → 0.0001; talk/alert
  throttling; mute persists in localStorage and blocks sound; no
  AudioContext / throwing AudioContext / denied localStorage all no-throw).
- `cd server && npm test`: **35 PASS, 0 FAIL** (unchanged from M3).
- Regression greps: `makeFullBody` 6 refs in `src/main.js`, `makeBadge` = 0,
  ATM/SHOP buttons still wired (`src/economy.js`), script order in
  `index.html` is `sfx.js` after `jobs.js`, before `main.js`; all client
  files serve HTTP 200 locally.
- Not tested in a real browser/phone yet (no live-browser access in this
  task) — the parent agent should browser-verify: NGHỀ panel sound, accept/
  deliver flow, faint + hospital button, NPC talk, and the 🔊 mute toggle
  on the live Pages link after the next deploy.
