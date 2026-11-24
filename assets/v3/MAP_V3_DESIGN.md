# Cuộc Sống Ảo (Đô Thị Ảo) — Map v2 Design (4800×4800, true 2D top-down)

Design doc for the v3 asset set. Code integration NOT done yet — this doc is the
spec the code agent must follow. Map grows 3200×3200 (v2.1 §3.1) → **4800×4800**.
All v2.1 coordinates below are scaled ×1.5 from `shared/colliders.js` (3200 map),
so old POI relationships are preserved. New content lives mostly in the new outer
ring (x > 3200 or y > 3200), which was empty before.

> Game renamed Đô Thị Ảo → **Cuộc Sống Ảo** 2026-11-25 (display name only;
> repo `do-thi-ao` and the GitHub Pages link stay the same).

## 1. Map texture — what `map-city-v3.png` is and is not

- `assets/v3/map-city-v3.png` (1024×1024, FLUX, PASS) is a **district reference
  texture**: grid roads with yellow centre lines, light-beige sidewalks on both
  sides of every road, grass blocks, central plaza with round blue fountain,
  flower gardens with low fences and corner gaps, trees, lamps, parking bays.
- It is **NOT stretched over the whole 4800 map** — a 1024 image stretched to
  4800 would blur badly. Code must: draw grass/roads/sidewalks from the layout
  data below (flat colours + the v3 prop sprites), and use `map-city-v3.png`
  for the **minimap** and as the plaza-area ground texture only.
- Future option (not now): split the 4800 map into 4 quadrant tiles of 2400 and
  generate one 1024 texture per quadrant.

## 2. Roads, sidewalks, vehicles vs pedestrians

- Roads: 3 vertical + 3 horizontal bands, width **180 px**, grey asphalt
  (`#7f8c8d`-ish), double yellow centre line + white dashed lane markings.
  Bands start at x/y = **1140, 2340, 3540** (v2.1 bands 760/1560/2360 × 1.5).
- Sidewalks: **40 px** light-beige strips on BOTH sides of every road
  (e.g. road x 1140–1320 → sidewalks x 1100–1140 and 1320–1360).
  **Rule: pedestrians (players on foot, walking NPCs, dogs, cats) walk on
  sidewalks and grass; vehicles (motorbikes, cars) drive on the road.**
  Code: NPC walk targets must be picked on sidewalk/grass points, never on road
  centres; bikes/cars snap to road centres.
- Plaza: centre **(2400, 2400)**, rect (2070, 2070, 660, 660), beige paving,
  round blue fountain at the centre (blocking circle r≈90, not a rect).
  Spawn point: **(2400, 2625)** — inside the plaza, south edge (v2.1 spawn
  (1600,1750) × 1.5).

## 3. Buildings — collider rects (x, y, w, h), 4800 map

Scaled ×1.5 from v2.1 `shared/colliders.js`. Sprites: use `assets/v3/<id>.png`
full image, or `*-roof.png` for a flat-roof-only look (see §6).

> RENDER FIX 2026-11-25 (live bug): the full-scene building images are NOT
> drawn stretched into these rects any more — each is tight-cropped
> (`*-tight.png`) and drawn contain-fit, centred, in `src/main.js`
> (fitRect). The plaza uses `plaza-ground.png` (centre crop of the district
> image), not the full `map-city-v3.png`. Garden beds are drawn BEFORE the
> roads. School moved (900,4200) -> (180,4240) and pavilion (3600,600) ->
> (4200,600): both overlapped a road band. Bicycle added
> (`prop-bicycle-full.png`, FLUX v2) — it did not exist before; the
> motorbike prop (`prop-motorbike-full.png`) is reused for ridden/parked bikes.

| id | name | x | y | w | h | sprite |
|---|---|---|---|---|---|---|
| bank | Ngân Hàng & ATM | 1425 | 1425 | 450 | 330 | building-bank.png / -roof |
| shop | Cửa Hàng Tiện Lợi 24/7 | 2670 | 1425 | 450 | 330 | building-shop.png / -roof |
| hospital | Bệnh Viện | 3840 | 1425 | 570 | 420 | building-hospital.png |
| showroom | Showroom Xe Máy | 1425 | 2670 | 480 | 360 | building-showroom.png / -roof |
| motel | Khu Nhà Trọ | 2670 | 2670 | 480 | 390 | building-motel.png |
| warehouse | Kho Hàng Trung Tâm | 3840 | 2670 | 630 | 480 | building-warehouse.png |
| house1 | Nhà Dân | 180 | 180 | 390 | 300 | house-a.png |
| house2 | Chung Cư | 1425 | 180 | 480 | 330 | house-c.png |
| house3 | Nhà Dân | 2670 | 180 | 390 | 300 | house-a.png |
| house4 | Chung Cư | 3840 | 180 | 480 | 330 | house-c.png |
| house5 | Nhà Dân | 180 | 1425 | 390 | 330 | house-b.png |
| house6 | Nhà Dân | 180 | 2670 | 390 | 360 | house-b.png |
| house7 | Nhà Dân | 180 | 3840 | 420 | 390 | house-a.png |
| house8 | Chung Cư | 1425 | 3840 | 510 | 390 | house-c.png |
| house9 | Nhà Dân | 2670 | 3840 | 420 | 390 | house-b.png |
| market | Chợ | 3840 | 3840 | 630 | 450 | building-market.png |
| police | Đồn Công An (NEW) | 3720 | 600 | 480 | 360 | building-police.png |
| school | Trường Học (NEW) | 180 | 4240 | 600 | 420 | building-school-tight.png |
| cafe | Quán Cà Phê (NEW) | 2520 | 4230 | 360 | 300 | building-cafe-tight.png |
| pavilion | Nhà Vọng Cảnh / Chòi Công Viên (NEW) | 4200 | 600 | 300 | 300 | building-pavilion-tight.png |
| house10 | Nhà Dân (NEW) | 3840 | 4320 | 390 | 300 | house-a.png |
| house11 | Nhà Dân (NEW) | 4290 | 4320 | 390 | 300 | house-b.png |
| house12 | Chung Cư (NEW) | 1500 | 4230 | 480 | 360 | house-c.png |

The 7 original SRS v2.1 §3.1 POIs are all kept: Safe Zone / NPC Hướng Dẫn
(plaza + spawn), Bank/ATM, Warehouse, Shop, Showroom, Motel, Hospital.
New POIs: police station, school, cafe, pavilion, market (was already in
colliders), 3 extra houses.

## 4. Flower gardens — fences WITH gaps (the important part)

Two fenced flower gardens. Fences are **blocking** (12 px thick rects) EXCEPT
at the listed gaps — the gaps are the shortcuts for future missions
(Shipper cutting through, taxi drop-offs, stealing, dog-stealing,
catching a thief). Mechanics are NOT in scope now; only the gaps must exist
in the collider data. Do NOT fence the gaps shut later.

### Garden A — rect (600, 2400, 600, 420), centre (900, 2610)
Fence rects (blocking):
- North: y 2400–2412, x 680–1200 (gap x 600–680, NW corner, 80 px wide)
- South: y 2808–2820, x 600–1120 (gap x 1120–1200, SE corner, 80 px wide)
- West: x 600–612, y 2480–2820 (gap y 2400–2480, NW corner — same NW entry)
- East: x 1188–1200, y 2400–2740 (gap y 2740–2820, SE corner — same SE entry)
- Entries: **NW corner (600–680, 2400–2480)** and **SE corner (1120–1200, 2740–2820)**.
- Inside: flower beds, 3 bushes (`prop-bush-flower`), 2 benches, 1 lamp.

### Garden B — rect (3000, 600, 600, 420), centre (3300, 810)
Fence rects (blocking):
- North: y 600–612, x 3000–3420 (gap x 3420–3600, NE corner, 80 px wide)
- South: y 1008–1020, x 3080–3600 (gap x 3000–3080, SW corner, 80 px wide)
- West: x 3000–3012, y 600–940 (gap y 940–1020, SW corner — same SW entry)
- East: x 3588–3600, y 680–1020 (gap y 600–680, NE corner — same NE entry)
- Entries: **NE corner (3420–3600, 600–680)** and **SW corner (3000–3080, 940–1020)**.
- Inside: flower beds, 2 bushes, 1 bench, 1 lamp, pavilion is just outside
  (4200, 600) — do not fence the pavilion in.

Fence sprites: `prop-fence-segment-full.png` (straight runs, tile every ~120 px),
`prop-fence-corner-full.png` (corners), `prop-fence-gate` — the gate image is a
whole garden scene, use only as reference, not as a tile.

## 5. Props — placement

- Trees: `prop-tree-a-full.png` (round canopy) and `prop-tree-b-full.png`
  (pine) — scatter ~40 across grass blocks, never on roads/sidewalks/plaza.
  Trees are **blocking** (trunk circle r≈20) or decorative-only — code decides;
  recommend blocking for big trees, decorative for small ones.
- Lamps: `prop-lamp-full.png` — along sidewalks every ~600 px, at road
  intersections. Decorative (no collision).
- Benches: `prop-bench-full.png` — plaza (4), gardens (2 each), pavilion (4).
  Blocking (small rect).
- Bins: `prop-bin-full.png` — near shop, market, plaza, gardens. Blocking.
- Delivery boxes: `prop-box-full.png` — spawn at the warehouse dock when a
  Shipper order is accepted (M3), despawn on delivery.
- Motorbike: `prop-motorbike-full.png` — parked at showroom (5 in a row),
  taxi drivers' bikes. Car: `prop-car-full.png` — hospital bay, police car
  park, motel car park.

## 6. Characters — which file to use in game

- In-world walkers: `assets/v3/<name>-full.png` (transparent, 720 px tall,
  magenta keyed out). 7 figures: hero-citizen, npc-shipper (Anh Tùng, orange),
  npc-bread (Chị Lan, red apron), npc-taxi (Chú Ba, green), npc-police
  (Anh Công, navy), npc-thug (Tý, black jacket), npc-student (Bé Mai, white).
  All are **overhead high-angle** figures (top of head, shoulders, legs from
  above, face looking up) — this is the closest FLUX gets to true top-down
  for people (see §8). At the in-game size (~42 px) they read by shirt colour.
  Render them SMALLER than v2 (v2 full-body was 42 px tall standing; v3
  top-down figures should be ~36–42 px, roughly circular footprint, with the
  ellipse shadow under the feet kept).
- HUD avatar / chat portrait: keep using the v2 `*-crop.png` portraits
  (front-facing) for now — v3 has no front-facing portraits. Do NOT use the
  v3 top-down figures as chat portraits.
- Buildings: `assets/v3/<id>.png` full image shows a 3/4 front for
  bank/shop/showroom/house-b/house-c (FLUX always adds a facade strip).
  For a flat 2D look use the `*-roof.png` crops (roof only, truly flat):
  `building-bank-roof`, `building-shop-roof`, `building-showroom-roof`,
  `house-b-roof`, `house-c-roof`. The other buildings are already flat
  enough in the full image (motel, police, market, school, pavilion, cafe,
  hospital, warehouse).

## 7. Animals & NPC walk zones

- Dogs (`prop-dog-full.png`): spawn (900, 3000) near Garden A and
  (3300, 1500) near the shop. Wander on sidewalks/grass, speed ~60 px/s,
  never on roads. Future: dog-stealing / catching-thief missions use these.
- Cats (`prop-cat-full.png`): spawn (1500, 900) and (4000, 3000). Sit/wander
  near houses, speed ~40 px/s, sidewalks/grass only.
- Walking NPCs (10 + Guide): walk targets must be **sidewalk or plaza
  points** (not road centres, not inside buildings/gardens). Speed 90 px/s,
  pause 3–8 s (v2.1 §10.2). Taxi guest NPCs wait at intersections on the
  sidewalk (max 4, despawn after 5 min).
- `isOpenPoint` / `randomOpenPoint` must be updated for 4800: map bounds,
  new building rects (§3), garden fence rects (§4, gaps open), plaza/fountain
  circle.

## 8. What FLUX could / could not do (honest notes for the code agent)

- TRUE top-down buildings: FLUX renders a 3/4 facade strip for most
  buildings no matter how explicit the prompt ("strictly top-down… roof only"
  moved to the front, v2). Buildings that came out truly flat: motel, police,
  market, pavilion, cafe, hospital (roof), warehouse (roof). The rest are
  fixed by the `*-roof.png` crops (§6) — use those.
- TRUE top-down people: FLUX cannot do a pure "only the top of the head"
  figure on a clean background — test2 (street scene) proved the angle is
  possible but the background becomes a street; test3 (studio) keeps the
  magenta background but the face looks up at the camera. v3 uses the
  test3 compromise (high-angle overhead). It matches the map far better
  than the v2 front-facing portraits.
- "Water tank" in a prompt returns a black error placeholder (house-b failed
  6×: identical 6,428-byte black PNG, md5 d2b3434a…). The simplified prompt
  without "water tank" worked first try. The map prompt failed the same way
  5× until simplified to the proven v1 M1 wording + sidewalks/fences.
  If a future prompt returns a 6,428-byte black PNG, simplify the prompt —
  do not retry the same words.
- Props: FLUX puts a whole neighbourhood of little houses around any small
  prop on a magenta background. The central subject is usually correct, so
  crop tight around it and key out the magenta (mode-of-border background
  colour — corner-median fails when the crop is tighter than the subject).
  Fence-segment v1 failed (tiny fence, houses dominate); v2 with
  "large and close-up, fills 80 percent" worked.

## 9. Files

- `assets/v3/raw/*.png` — 36 FLUX originals (1024×1024).
- `assets/v3/*.png` — same 36 finals at top level, plus:
  `*-full.png` transparent keyed sprites (7 characters + 9 props),
  `*-roof.png` flat-roof crops (5 buildings).
- `assets/v3/PROMPTS_V3.md` — every prompt verbatim (v1 detailed, v2 angle
  fix, v3 skill-compliance lock) + PASS/FAIL table.
- `assets/v3/MAP_V3_DESIGN.md` — this file.
- `assets/v3/make_v3_sprites.py` lives at `/tmp/make_v3_sprites.py` (+ fix
  script `/tmp/make_v3_sprites2.py`); copy into `assets/v3/` on integration
  if the code agent wants to re-run the key-out.
