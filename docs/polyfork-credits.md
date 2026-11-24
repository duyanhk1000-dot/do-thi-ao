# Polyfork credits — Cuộc Sống Ảo

Two game sprites are **renders of Polyfork free low-poly 3D models**
(rendered to 2D PNG on this machine with a pure-Python software
rasterizer, `assets/v3/polyfork/render_polyfork.py`, orthographic
70-degree high angle, magenta background, keyed out with
`assets/v3/make_v3_sprites.py` — the same pipeline as the FLUX images).

## Models used (free low-poly mesh, $0, no account)

| Model | Polyfork page | GLB | Triangles | Size (m) | Licence |
|---|---|---|---|---|---|
| Brick Depot Warehouse | https://polyfork.dev/asset/brick-depot-warehouse-3dd642 | https://polyfork.dev/cdn/brick-depot-warehouse-3dd642.glb | 1456 | 12 x 7.23 x 8 | CC BY 4.0 (credit below) |
| Cargo Crate | https://polyfork.dev/asset/cargo-crate-9afc44 | https://polyfork.dev/cdn/cargo-crate-9afc44.glb | 536 | 0.8 x 0.8 x 0.8 | CC BY 4.0 (credit below) |

Credit (CC BY 4.0): "Brick Depot Warehouse by Polyfork
(https://polyfork.dev/asset/brick-depot-warehouse-3dd642), CC BY 4.0.
Cargo Crate by Polyfork (https://polyfork.dev/asset/cargo-crate-9afc44),
CC BY 4.0." Both models were modified (rendered to 2D sprites from a
70-degree top-down angle; the warehouse render was tight-cropped).

## What the game ships

- Rendered PNGs only: `assets/v3/building-warehouse-tight.png`
  (871x697, from the warehouse render) and
  `assets/v3/prop-box-full.png` (579x737, from the crate render).
- The GLB files themselves (`assets/v3/polyfork/*.glb`) are kept locally
  as sources and are **NOT pushed to GitHub / NOT shipped in the game** —
  the game ships the rendered images, not the redistributed model files,
  which keeps us inside the Polyfork licence either way.

## Other Polyfork candidates checked (not used)

- Dock Warehouse (https://polyfork.dev/asset/dock-warehouse-bf0967) —
  wooden pirate-style shed, wrong vibe for a modern city game.
- Freight Crate and Sack Stack
  (https://polyfork.dev/asset/freight-crate-and-sack-f49cbb) — crate +
  sacks, rejected in favour of the plain Cargo Crate.

## Rejected alternative (kept as fallback)

FLUX v3 versions were generated first (per pro-prompting + image-gen)
before the user redirected to Polyfork: warehouse
`assets/v3/raw/building-warehouse-v3.png` (flat grey roof, 3 vents,
orange roller doors, dock with brown boxes — PASS on viewing) and box
`assets/v3/raw/prop-box-v3.png` (tan-brown kraft cardboard, white label
— PASS on colour; 3 stray green plants cropped out). Their keyed-out
files were overwritten by the Polyfork renders; the raws remain as
fallbacks if the Polyfork look is ever rejected.
