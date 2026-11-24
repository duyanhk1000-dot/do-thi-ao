# Cuộc Sống Ảo — M3 Skills Audit (skills-compliance revision, 2026-11-25)

> Rename (user, 2026-11-25): the game was "Đô Thị Ảo" until this revision; the display name is now "Cuộc Sống Ảo". Repo `do-thi-ao`, localStorage keys and file names are unchanged; the SRS v2.2 update is separate later work.

Skills read in full before any change (this is the point of the task):
- `~/workspace/custom-skills/pro-prompting/SKILL.md` + `references/llm-templates.md` + `references/image-templates.md`
- `~/workspace/custom-skills/image-gen/SKILL.md` + `references/flux-profile.md`
- `~/workspace/custom-skills/audio-gen/SKILL.md` + `references/sfx-recipes.md` (+ `scripts/make_sfx.py` read, not run — WebAudio engine, no WAV files)

NOT applicable, deliberately not used (do not force them in):
- `scenario-godot-*` and `godot_web_export` — this game is PixiJS v8 + Colyseus 0.15, not Godot. No Godot file, tool, or export step exists in this project.
- `~/workspace/kybien-checkout/AGENTS.md` was read (runtime house rule, it covers Kỳ Biến VFX sprite sheets). It does not apply to Đô Thị Ảo; only the CHS WebAudio SFX engine in `co-huyen-su.html` was reused as a proven pattern, not its VFX rules.
- No AI music/SFX API is connected (Runway `not_connected`, Suno/Udio need a key) — SFX is audio-gen tier (a) code synthesis only. See `docs/m3-sfx.md`.

Scope: skills-compliance revision only. M3 rules/numbers in `shared/m3.js` and `server/rooms/CityRoom.js` were NOT redesigned; the only rule-adjacent change is the walker sprite/persona alignment (§B.3), which is an image-usage bug, not a rule change. Images were NOT regenerated (the v3 agent owns `assets/v3/`); this audit only files findings + 1-change fixes for it.

## A. pro-prompting audit — every image prompt M3 relies on (`assets/PROMPTS.md` v1/v2)

Checklist per prompt (pro-prompting §3 + image-templates checklist): style-lock first? 7 elements (subject, material, environment, lighting, colour, mood, composition)? most important constraint in first 30%? MUST/NEVER, measurable details, no vague quality words? English comma phrases? no `seed`/`cfg_scale` (schnell)? tested with 1 real FLUX image + viewed? versioned, 1 change per iteration?
Scoring per image-gen step 2: ≥8/10 to generate. All prompts pass "English, comma phrases, no seed/cfg_scale, no 4K/HD/award-winning" — the failures below are the specific items.

| Prompt | Verdict | What fails | 1-change fix proposed for the v3 agent |
|---|---|---|---|
| map v1 | PASS (9/10) | — | None. Keep as reference. |
| bank v1 | FAIL (6/10) | Says "slight isometric top-down view" — contradicts the 2D top-down goal and the style lock. No lighting/mood elements. | 1 change: replace "slight isometric top-down view" with "directly overhead, camera at 90 degrees, flat roof seen from above" (keep everything else). |
| hospital v2 | FAIL (7/10) | Same isometric phrase. v1→v2 was a correct 1-change iteration (added "fills 80% of frame, no other buildings…") — process PASS, prompt still FAIL. | Same 1 change as bank. |
| warehouse v1/v3 | FAIL (6/10) | Same isometric phrase; result has 6 trees + white van + base platform despite "no other buildings, no trees" — FLUX ignores plain-word negatives (flux-profile: no `--no`, no `(word:1.3)` for FLUX). | 1 change: drop the ineffective negative, say it positively — "bare concrete base, empty ground around the building, nothing else on the plot". |
| shop / showroom / motel v1 | FAIL (7/10) | Same isometric phrase in all three. | Same 1 change as bank, one file at a time. |
| hero v1 | FAIL (5/10) | "plain white background" ignored by FLUX (documented in PROMPTS.md); "top-down view" but result is front-facing 3/4 — subject/view mismatch; no lighting/mood. | 1 change: use the v2 magenta studio background (already proven) + "three-quarter front view" stated explicitly instead of "top-down view". |
| hero v2 (magenta) | PASS process (8/10) | Process followed: 1 change (magenta background), tested, cropped. Image still has pink fringe — see §B. | Next 1 change for v3: tighten the flood-fill tolerance in `make_full_sprites.py` by 1 step, re-run, re-view. |
| npc-shipper/bread/taxi/police/thug/student v1 | FAIL (6/10) | Same as hero v1 (white background ignored, no lighting/mood). Persona details are specific and measurable — that part PASS. | Same 1 change as hero v2 (magenta studio background). |
| npc-taxi v1/v2 | FAIL (text) | Licence plate reads "THA8J" — FLUX text rule (image-gen): short text in quotes, <10 chars, check by eye; a plate is not a quoted sign, so it hallucinates. | 1 change: add "blank license plate, no text on the vehicle". |
| npc-student v2 | FAIL (outfit) | Prompt says long black hair in a high ponytail + dark blue pleated skirt; image has short bob + grey shorts. | 1 change: move the outfit constraint into the first 30% of the prompt ("long black hair in a high ponytail, dark blue pleated skirt" right after the subject). |

Standing correction (user, 2026-11-25): the "80–120 words" rule given to the v3 asset agent was WRONG and is cancelled. The skill says detail = specific measurable details, NOT word count or long paragraphs — "Prompt dài dòng, giải thích nhiều làm model lạc hướng." The v3 prompts in `assets/v3/PROMPTS_V3.md` are long because they list measurable details; that is acceptable only as long as each phrase is a measurable detail. No word-count rule exists in the skill.

## B. image-gen audit — how M3 code uses the images (viewed the actual PNGs)

Check rules (image-gen §5): view the real image, classify the error (subject deformed, hands/eyes off, wrong text, colour off palette, composition off, extra background), 1 change at a time, version. `*-full.png` = in-world (transparent, `makeFullBody`, 42 world px tall + ellipse shadow). `*-crop.png` = HUD avatar + chat portrait ONLY. Buildings = square sprite, width = rect.w × 1.25, rounded-rect mask. Map = plaza 800×800 + start screen only.

Viewed directly in this task: `map-city-aerial.png`, `building-warehouse.png`, `hero-citizen-full.png`, `npc-bread-full.png`, `npc-taxi-full.png`, `npc-student-full.png`. `npc-shipper-full.png`, `npc-police-full.png`, `npc-thug-full.png` were NOT re-viewed here; their verdicts below are from the `assets/PROMPTS.md` v2 record ("PASS clean").

| Asset | Verdict | Notes |
|---|---|---|
| map-city-aerial.png | PASS | Roundabout + blue fountain, grey roads, green grass, no text. Matches prompt. |
| building-bank/hospital/shop/showroom/motel.png | PASS subject, FAIL style | Subject/colour correct, but all are isometric 2.5D — the user's "nhà chéo rất dị" complaint. Code usage is correct (square aspect preserved, masked, collision rect unchanged). Fix belongs to v3 regeneration, not code. |
| building-warehouse.png | FAIL | Isometric + 6 trees + white van + base platform despite "no trees". See §A fix. |
| hero-citizen-full.png | PASS outfit, FAIL fringe | Male, blue shirt, dark trousers — correct. Magenta fringe ~2–3 px on the left edge (flood-fill tolerance). At 42 px in-game it is barely visible; v3 tightens the tolerance. |
| npc-bread-full.png | PASS persona, FAIL fringe | Woman, conical hat, basket of baguettes — correct. Magenta fringe on the left edge. |
| npc-taxi-full.png | PASS persona, FAIL text + fringe | Older man, green shirt, helmet, on a motorbike — correct persona. Plate "THA8J" is gibberish; magenta fringe at the edges. |
| npc-student-full.png | PASS gender, FAIL outfit + crop | Female — correct. But short bob (prompt: long ponytail) + grey shorts (prompt: dark blue pleated skirt), plus leftover green-tree/orange pixels at the mid-left/right edges (crop incomplete). |
| npc-shipper/police/thug-full.png | PASS (per PROMPTS.md v2 record) | Recorded clean; not re-viewed in this task. |
| *-crop.png (all 7) | PASS (usage) | Code never uses them for moving characters: `makeFullBody` 6 refs in `src/main.js`, `makeBadge` = 0 everywhere. HUD avatar only, as intended. |

### B.3 Code-only image bugs found and FIXED in this task

1. **Walker sprite rides a motorbike while walking (client + server).** `WALKER_FULL` cycled 6 sprites including `taxiFull` — Chú Ba sitting on a motorbike — for NPCs that walk on foot at 90 px/s. Same on the server: `WALKER_AVATARS` included `'taxi'` and `'hero'` (a walker looking exactly like the player).
   Fix: walkers now cycle only the 5 on-foot personas — client `WALKER_FULL = [shipperFull, breadFull, policeFull, thugFull, studentFull]`, server `WALKER_AVATARS = [shipper, bread, police, thug, student]`. `taxiFull` stays only for the parked Guide (`tutorialNpc`) and for bot Chú Ba.
2. **Walker sprite/voice mismatch (client + server).** Client cycled 6 sprites against 6 personas in the same order (accidentally aligned), but the server cycled 5 avatars against 6 personas — walker-2 had the bread sprite but talked as Chú Ba (`'ba'`), walker-1 had the hero sprite but talked as Chị Lan.
   Fix: both sides now use one index-aligned 5-item list — client `WALKER_PERSONAS = ['tung','lan','cong','ty','mai']`, server `WALKER_PERSONAS` (same). A walker's look and voice now always match.
3. **NOT fixed (needs a new image, v3 agent's job):** bot Chú Ba (`bot-ba`) still wanders on his motorbike, and the Guide still uses `taxiFull` standing at spawn. Both are accepted flaws until v3 provides a standing Chú Ba sprite; changing bot behaviour or the Guide's look in code would be a redesign, not a fix.

## C. audio-gen

Done in this revision — see `docs/m3-sfx.md` (engine `src/sfx.js`, 8 M3 sounds + click/alert/error, stub harness 27/27 PASS, server tests still 35/35 PASS).

## D. Agent-prompt compliance — the brief for THIS task, as a 10-component LLM template

Per pro-prompting `references/llm-templates.md` (Comprehensive, all 10 components, in order) — reuse this shape for future M4/M5 briefs. This is the template the parent agent used to brief this revision; it is recorded here verbatim in structure so the next brief does not have to be written freehand.

```xml
<role>Muse subagent: skills-compliance reviser for the Đô Thị Ảo web game (PixiJS v8 + Colyseus 0.15, plain JS, no build step).</role>

<tone>Direct, evidence-first, Vietnamese for the user-facing report; code comments in the project's existing English/Vietnamese mix.</tone>

<context>Project ~/workspace/do-thi-ao/. M3 already built and verified (35/35 server tests PASS): survival, Shipper, NPC talk. User taught custom skills in ~/workspace/custom-skills/ (pro-prompting, image-gen, audio-gen, scenario-godot-*, godot_web_export) and corrected Muse on 2026-11-25: prompts MUST follow pro-prompting exactly (5 steps, 7 elements, test 1 real image, 1 change at a time, v1/v2), the "80-120 words" rule was wrong, and every subagent brief MUST name the relevant skills to read first. M3 has NO sound for its new features. Another agent is generating v3 images in assets/v3/ right now.</context>

<task>
<objective>Revise M3 for skills compliance; add M3 SFX; audit prompts/images; do NOT redesign M3 rules.</objective>
<requirements>
- Read pro-prompting (SKILL.md + llm-templates.md + image-templates.md), image-gen (SKILL.md + flux-profile.md), audio-gen (SKILL.md + sfx-recipes.md + scripts/make_sfx.py) IN FULL before changing anything.
- Audit every M3 image prompt (assets/PROMPTS.md v1/v2) and every M3 image usage against those skills; file results in docs/m3-skills-audit.md.
- Add a WebAudio SFX engine (audio-gen tier a only) for the 8 M3 events, wire real call sites, write SFX prompts in docs/m3-sfx.md, verify with a stub-AudioContext harness.
- Fix code-only image bugs found; do NOT regenerate images.
- Write this brief as a 10-component template in docs/m3-skills-audit.md for M4/M5 reuse.
</requirements>
</task>

<rules>
<do>Follow the three skills exactly; keep server tests 35/35; wrap all audio in try/catch; lazy AudioContext after first touch; mute toggle saved in localStorage.</do>
<avoid>Do NOT push/deploy. Do NOT touch assets/v3/. Do NOT touch M3 rules/numbers in shared/m3.js and server/rooms/CityRoom.js unless a skill audit finds a bug. Do NOT use scenario-godot-* or godot_web_export (not Godot). Do NOT pretend Runway/Suno works (no AI audio API connected). Do NOT use a word-count rule for prompts.</avoid>
</rules>

<examples>
<good>CHS SFX engine in ~/workspace/kybien-checkout/frontend/co-huyen-su.html — lazy AudioContext, tone()+harm, gate(), toggle saved in localStorage, stub harness 45/45.</good>
<bad>Writing image prompts freehand, or "80-120 words" as a prompt rule — both were corrected by the user on 2026-11-25.</bad>
</examples>

<prior_context>M2 live on GitHub Pages (https://duyanhk1000-dot.github.io/do-thi-ao/); M3 built 2026-11-25 00:06 locally, not pushed/deployed; user chose to wait for v3 images and push M3+v3 together.</prior_context>

<immediate_task>Produce the audit doc, the SFX engine + wiring + harness, and this template; verify and report.</immediate_task>

<thinking_process>
Before changing anything:
1. Read the three skills in full.
2. Read the M3 code and the CHS SFX pattern.
3. Audit prompts/images against the skill checklists; separate code-fixable bugs from regeneration-only bugs.
4. Build SFX tier (a) only, wire call sites, harness-test by numbers.
5. Re-run node --check + server npm test + regression greps before reporting.
</thinking_process>

<output_format>Final report: audit table (prompt/image PASS/FAIL), SFX list with call sites + harness result, files changed, what was deliberately NOT done and why. No deploy, no push.</output_format>

<opening>Skills-compliance revision of M3 is done. ...</opening>
```

Test cases for this template (pro-prompting §4, LLM prompts): (1) standard brief → agent reads the named skills first, no freehand work; (2) brief missing the skills section → parent rejects it before spawning; (3) brief for a Godot task → scenario-godot-* named, PixiJS skills not named; (4) brief asking for AI music → agent must say no key is connected and do tier (a) instead; (5) contradictory brief (regenerate images + do not touch assets/v3/) → agent stops and asks. All 5 are satisfied by the rules above (recorded, not run — the template itself is the deliverable, its test is the next brief that reuses it).
