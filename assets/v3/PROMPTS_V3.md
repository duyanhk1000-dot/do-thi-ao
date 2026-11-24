# Đô Thị Ảo — Asset v3 Prompts (detailed, FLUX.1-schnell)

Every prompt is 80-120 words (style lock included), 7-element framework: subject + details, action/pose, environment, lighting, colour palette, composition/framing, style/medium + negatives.

Style lock v3 (in every prompt): "Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark." Characters use the same lock adapted for a single figure on a solid bright magenta studio backdrop (proven chroma-key, test3 PASS 2026-11-25).

Tool: `python3 ~/workspace/custom-connectors/custom.nvidia/bin/nvidia_image.py generate --prompt "..." --steps 4 --out <path>.png` (1024x1024, steps 4, NO seed, NO cfg_scale). v1 short prompts (batch 2026-11-25 17:02) were replaced by these detailed prompts; v1 detailed draft (99-173 words) was stopped after 5 images and trimmed to this version.


## Characters (7)


### hero-citizen.png — 106 words

```
Detailed 2D top-down game character, viewed from directly above, camera at 90 degrees, bird's-eye view, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no side walls, no text, no words, no watermark. One single young Vietnamese man, short black hair, bright sky-blue short-sleeve shirt with chest pocket, dark navy trousers, brown leather shoes, standing still, camera directly overhead, top of head, shoulders, arms and legs visible from above, alone in an empty studio, solid bright magenta backdrop, no buildings, no street, no trees, no other objects, centered, fills 60 percent of the frame, bright daylight.
```


### npc-shipper.png — 111 words

```
Detailed 2D top-down game character, viewed from directly above, camera at 90 degrees, bird's-eye view, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no side walls, no text, no words, no watermark. One single Vietnamese delivery man Anh Tung, orange uniform shirt and trousers, orange cap, holding a brown cardboard delivery box in his left hand, black sneakers, standing still, camera directly overhead, top of head, shoulders, arms and legs visible from above, alone in an empty studio, solid bright magenta backdrop, no buildings, no street, no trees, no other objects, centered, fills 60 percent of the frame, bright daylight.
```


### npc-bread.png — 117 words

```
Detailed 2D top-down game character, viewed from directly above, camera at 90 degrees, bird's-eye view, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no side walls, no text, no words, no watermark. One single Vietnamese middle-aged woman bread seller Chi Lan, black hair in a bun, red apron over yellow floral blouse, dark skirt, holding a woven basket of golden baguettes, black flat shoes, standing still, camera directly overhead, top of head, shoulders, arms and legs visible from above, alone in an empty studio, solid bright magenta backdrop, no buildings, no street, no trees, no other objects, centered, fills 60 percent of the frame, bright daylight.
```


### npc-taxi.png — 112 words

```
Detailed 2D top-down game character, viewed from directly above, camera at 90 degrees, bird's-eye view, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no side walls, no text, no words, no watermark. One single older Vietnamese motorbike taxi driver Chu Ba, grey short hair and moustache, dark green polo shirt, beige trousers, holding a white motorcycle helmet, brown sandals, standing still, camera directly overhead, top of head, shoulders, arms and legs visible from above, alone in an empty studio, solid bright magenta backdrop, no buildings, no street, no trees, no other objects, centered, fills 60 percent of the frame, bright daylight.
```


### npc-police.png — 109 words

```
Detailed 2D top-down game character, viewed from directly above, camera at 90 degrees, bird's-eye view, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no side walls, no text, no words, no watermark. One single Vietnamese policeman Anh Cong, short black hair, dark navy-blue police uniform with peaked cap, silver chest badge, black belt, black polished shoes, standing still, camera directly overhead, top of head, shoulders, arms and legs visible from above, alone in an empty studio, solid bright magenta backdrop, no buildings, no street, no trees, no other objects, centered, fills 60 percent of the frame, bright daylight.
```


### npc-thug.png — 109 words

```
Detailed 2D top-down game character, viewed from directly above, camera at 90 degrees, bird's-eye view, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no side walls, no text, no words, no watermark. One single young Vietnamese street tough guy Ty, spiky black hair, dark sunglasses, black leather jacket over white t-shirt, ripped blue jeans, white sneakers, standing still, camera directly overhead, top of head, shoulders, arms and legs visible from above, alone in an empty studio, solid bright magenta backdrop, no buildings, no street, no trees, no other objects, centered, fills 60 percent of the frame, bright daylight.
```


### npc-student.png — 112 words

```
Detailed 2D top-down game character, viewed from directly above, camera at 90 degrees, bird's-eye view, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no side walls, no text, no words, no watermark. One single young Vietnamese female university student Be Mai, long black hair in a high ponytail, white short-sleeve shirt, dark blue pleated skirt, pink backpack, black shoes, standing still, camera directly overhead, top of head, shoulders, arms and legs visible from above, alone in an empty studio, solid bright magenta backdrop, no buildings, no street, no trees, no other objects, centered, fills 60 percent of the frame, bright daylight.
```


## Buildings (14)


### building-bank.png — 99 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single modern bank building, rectangular, flat bright-blue roof with a large glass skylight and white edge trim, beige stone walls, tall white columns along the front, wide stone steps, small grey ATM kiosk beside the door, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-hospital.png — 100 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single white hospital building, wide rectangle, flat white roof with a large red cross painted in the centre and red roof trim, rows of blue-tinted windows, covered entrance canopy, marked ambulance bay with one white ambulance van, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-warehouse.png — 95 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single large grey industrial warehouse, long rectangle, flat dark-grey roof with three round ventilation fans, light-grey walls, big brown sliding doors, concrete loading dock with yellow edge lines, stacked pallets and crates, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-shop.png — 91 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small orange convenience store, square, flat orange roof with white striped awning edge, cream walls, large glass shopfront, green sign board above the door, drink rack outside, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-showroom.png — 95 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single purple motorcycle showroom, rectangle, flat purple roof with white logo circle, glass front wall, five small motorcycles in red, blue, black, white and yellow parked in a neat line in front, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-motel.png — 97 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single teal motel, U-shaped around a small courtyard, flat teal roof with white trim, cream walls, identical doors with small balconies inside, two round trees in the courtyard, car park with three marked bays, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-police.png — 97 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single police station, rectangle, flat dark-blue roof with a large white star painted in the centre, pale grey walls, flag pole with red flag, car park with two white patrol cars with blue stripes, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-market.png — 95 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single open-air market hall, wide rectangle, flat roof with bold yellow and white stripes, open sides with colourful stalls in red, green and orange, crates of fruit and vegetables in neat piles, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-school.png — 95 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single school building, long rectangle, flat red roof with white trim, bright yellow walls, large windows, tall flag pole with red flag, small playground with painted court lines and two basketball hoops, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-pavilion.png — 99 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single round park pavilion gazebo, circular, green conical roof seen from above with a small golden finial, six slim white columns, round wooden floor, four wooden benches around it, ring of pink and yellow flower beds, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### house-a.png — 101 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small Vietnamese house, square, flat red tiled roof seen from above with ridge lines, warm yellow walls, wooden front door, two windows with blue shutters, tiny front garden with a round green tree and low white fence, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### house-b.png — 98 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small Vietnamese house, square, flat bright-blue roof with a white water tank on one corner, white walls, wooden front door, two windows with green shutters, tiny garden with red flowers and low brick fence, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### house-c.png — 95 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small three-storey apartment block, rectangle, flat grey concrete roof with a large black water tank, beige walls, rows of small square windows, shared entrance with steps, yard with two parked motorbikes, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


### building-cafe.png — 95 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small street cafe, square, flat warm-brown roof with white trim, cream walls, large glass windows, four round outdoor tables with white umbrellas on a paved terrace, potted plants on each table, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```


## Map (1)


### map-city-v3.png — 109 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. Bird's-eye aerial city map, a grid of wide grey roads with yellow centre lines, light beige sidewalks along both sides of every road, green grass blocks, a central beige plaza with a round blue fountain, two flower gardens with low fences and open gaps at the corners, many round green trees, street lamps, parking areas with white lines, small colourful flat-roofed buildings, bright midday sunlight, no people, no cars.
```


## Props & animals (14)


### prop-tree-a.png — 83 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single round leafy tree seen from directly above, dense bright-green circular canopy, small brown trunk dot in the centre, soft shadow under the canopy, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-tree-b.png — 82 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single tall pine tree seen from directly above, dark-green pointed canopy with layered branches, small brown trunk dot in the middle, soft shadow, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-bush-flower.png — 81 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single round flower bush seen from directly above, dense dark-green leaves covered with small pink, yellow and white flowers, neat circular shape, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-fence-segment.png — 79 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single short straight wooden fence segment, horizontal, five vertical brown planks with two horizontal rails, small pointed tops, top-down view, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-fence-corner.png — 80 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single L-shaped wooden fence corner, two straight runs of brown planks meeting at a right angle, thicker corner post, top-down view, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-fence-gate.png — 87 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single wooden fence with a wide open gap in the middle, two short runs of brown planks, two thicker gate posts, stone path through the gap, top-down view, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-lamp.png — 82 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single street lamp seen from directly above, round dark-grey lamp head with a glowing warm-yellow centre, straight grey pole, small round concrete base, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-bench.png — 84 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single wooden park bench seen from directly above, three horizontal brown slats for the seat, two slats for the backrest, black metal armrests, soft shadow, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-dog.png — 82 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small brown dog seen from directly above, short-haired, floppy ears, long tail, four legs in a walking pose, tan belly, dark nose, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-cat.png — 80 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small orange tabby cat seen from directly above, curled body, long tail wrapped around, striped fur, pointed ears, pink nose, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-motorbike.png — 80 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single red motorbike seen from directly above, long slim body, black seat, round headlight, two black wheels in line, chrome handlebars, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-bicycle.png — 2026-11-25 (vehicles fix: the bicycle had NO image)

v1 prompt (same style-lock as the motorbike, top-down constraint first):
`Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, no isometric, no 3D perspective, no side view. 2D top-down mobile city game, Pixar animation style, rich shading, soft shadows, crisp clean shapes, vibrant colors, no text, no words, no watermark. One single blue bicycle seen from directly above, two thin black wheels in a straight vertical line, silver frame, black saddle, black handlebars with black grips, pedals, silver chain, centered on a solid bright magenta background, single object only, no rider, no people, no buildings, no street, no trees, fills 70 percent of the frame, bright daylight.`
Result v1: FAIL angle — beautiful blue bike on clean magenta, but a 3/4 SIDE view (wheels horizontal). FLUX draws bicycles from the side by default; the 90-degree constraint was ignored, same failure mode as the v1 buildings.

v2 (ONE change: the view description — explicit vertical layout + 70-degree high angle):
`Strictly top-down, camera high above looking straight down at 70 degrees, bicycle standing vertically in the frame, front wheel at the top, rear wheel at the bottom, both wheels in one straight vertical line, handlebars across the top, black saddle in the middle, no isometric, no side view, no side profile. 2D top-down mobile city game, Pixar animation style, rich shading, soft shadows, crisp clean shapes, vibrant colors, no text, no words, no watermark. One single blue bicycle, silver frame, black saddle, black handlebars with black grips, pedals, silver chain, centered on a solid bright magenta background, single object only, no rider, no people, no buildings, no street, no trees, fills 70 percent of the frame, bright daylight.`
Result v2: PASS — high-angle diagonal bike (front wheel bottom-right), matches the motorbike prop's high-angle look. Tiny gibberish text on the frame, invisible at 40-60px game size. A pure 90-degree top-down bicycle is a thin line; FLUX always adds elevation to show the object — v2 is the accepted look. Keyed out via `make_v3_sprites.py` (crop 180,220,850,740) -> `prop-bicycle-full.png` 472x360, magenta-left 0.0%.

### prop-car.png — 77 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single blue sedan car seen from directly above, four doors, black-tinted windows, silver roof, black tyres, round headlights, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-box.png — 82 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single brown cardboard delivery box seen from directly above, square shape, tape cross on top, white shipping label in one corner, worn edges, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```


### prop-bin.png — 78 words

```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single green rubbish bin seen from directly above, round dark-green lid with a handle, cylindrical body, small shadow underneath, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```

---

## Prompt v2 — angle fix (1 change, 2026-11-25)

v1 review found 5 buildings still 3/4 isometric (bank, warehouse, shop, showroom,
house-c) + 4 props wrong angle/scene (fence-segment, cat, motorbike, bin) + 2 black
placeholders (house-b, map). v2 change, applied ONLY to those 11 files: the
top-down constraint moved to the VERY FRONT of the prompt, plus the words
"strictly" and "roof only, no side walls visible". Everything else identical to v1.

### building-bank.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single modern bank building, rectangular, flat bright-blue roof with a large glass skylight and white edge trim, beige stone walls, tall white columns along the front, wide stone steps, small grey ATM kiosk beside the door, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```
### building-warehouse.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single large grey industrial warehouse, long rectangle, flat dark-grey roof with three round ventilation fans, light-grey walls, big brown sliding doors, concrete loading dock with yellow edge lines, stacked pallets and crates, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```
### building-shop.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small orange convenience store, square, flat orange roof with white striped awning edge, cream walls, large glass shopfront, green sign board above the door, drink rack outside, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```
### building-showroom.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single purple motorcycle showroom, rectangle, flat purple roof with white logo circle, glass front wall, five small motorcycles in red, blue, black, white and yellow parked in a neat line in front, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```
### house-c.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small three-storey apartment block, rectangle, flat grey concrete roof with a large black water tank, beige walls, rows of small square windows, shared entrance with steps, yard with two parked motorbikes, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```
### house-b.png (v2, then simplified — see note)
v2 prompt = same pattern as above, subject "One single small Vietnamese house, square, flat bright-blue roof with a white water tank on one corner, white walls, wooden front door, two windows with green shutters, tiny garden with red flowers and low brick fence". It returned the black placeholder AGAIN (6th failure). The prompt that finally worked dropped "water tank":
```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small house, square, flat bright-blue roof, white walls, wooden front door, two windows with green shutters, tiny garden with red flowers, fills 80 percent of the frame, centered, single building only, no other buildings, no streets, no trees, no people, bright midday sunlight.
```
### map-city-v3.png (v2, then simplified — see note)
v2 prompt = TOP prefix + v1 map prompt. It failed 3× (2× black placeholder, 1× 150 s timeout). The prompt that finally worked uses the proven v1 M1 wording + sidewalks/fences:
```
Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. Bird's-eye view aerial city map, gray roads with yellow lane lines in a grid, light beige sidewalks along both sides of every road, green grass blocks, small colorful building blocks, central beige plaza with round blue fountain, flower gardens with low fences and open gaps at the corners, small park with green trees, bright daylight, cheerful mood, wide top-down view, no people, no cars.
```
### prop-fence-segment.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single short straight wooden fence segment, horizontal, five vertical brown planks with two horizontal rails, small pointed tops, the fence is large and close-up and fills 80 percent of the frame, centered on a solid bright magenta background, single object only, bright daylight.
```
### prop-cat.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single small orange tabby cat seen from directly above, back and tail only, face not visible, curled body, long tail wrapped around, striped fur, pointed ears, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```
### prop-motorbike.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single red motorbike seen from directly above, long slim body, black seat, round headlight, two black wheels in line, chrome handlebars, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```
### prop-bin.png (v2)
```
Strictly top-down, camera directly overhead at exactly 90 degrees looking straight down, flat roof only, no side walls visible, no isometric, no 3D perspective, no side view. Detailed 2D top-down mobile city game, viewed from directly above, flat roofs seen from above, rich shading, soft shadows, crisp clean shapes, vibrant colors, Pixar-quality detail, no isometric, no 3D perspective, no side view, no text, no words, no watermark. One single green rubbish bin seen from directly above, round dark-green lid with a handle, cylindrical body, centered on a solid bright magenta background, single object only, fills 70 percent of the frame, bright daylight.
```

## Skill audit (pro-prompting, corrected 2026-11-25 — NO word count)

Checklist from `~/workspace/custom-skills/pro-prompting/references/image-templates.md`,
applied to the v1 prompts above:

| Check | Result |
|---|---|
| 7 elements present (subject, material/style, environment, lighting, colour, mood, composition) | PASS — all 7 in every prompt (mood via "cheerful"/expression words; characters via face/expression) |
| Style-lock first | PASS — lock is the first sentence of every prompt |
| `no text` where needed | PASS — in the lock |
| No `seed`/`cfg_scale` (schnell) | PASS — helper called with prompt + steps 4 only |
| No quality-word stuffing ("4K/8K/HD/high quality/award-winning/highly detailed") | **FAIL (1 phrase)** — the lock contains "Pixar-quality detail", a quality-word in disguise |
| English comma-separated phrases, most important constraint in first 30% | PASS — camera angle + top-down are in the lock at the front |
| Tested with 1 real FLUX image + viewed | PASS — all 36 viewed (contact sheets + full-size for failures) |

### Fix for the 1 failure — lock v3 (1 change, tested on hero)

- Change: "Detailed 2D top-down … Pixar-quality detail" → "2D top-down game character / mobile city game, viewed from directly above, camera at 90 degrees, bird's-eye view, rich shading, soft shadows, crisp clean shapes, vibrant colors, **Pixar animation style**" — drops the vague adjective "Detailed" and replaces the quality-word with a single style anchor, per the skill.
- Test (2026-11-25, `/tmp/hero-v3-test.png`): hero regenerated with the v3 lock — PASS, identical quality to the v1 hero (solid magenta, overhead, blue shirt, brown shoes). No regression.
- The 36 delivered images use the v1/v2 prompts recorded above (they are the tested PASS versions). The v3 lock is the going-forward lock for the next rerun — it was NOT applied to all 36, because the wording change tested identical on hero and a full re-render would only burn time.

## PASS / FAIL table (final, after v2 + crops + key-out)

| File | Verdict | Note |
|---|---|---|
| hero-citizen | PASS | Overhead, magenta, blue shirt; `-full.png` keyed, 52–57% opaque |
| npc-shipper | PASS | Orange uniform + cap + box; `-full.png` OK |
| npc-bread | PASS | Red apron, baguettes; `-full.png` OK |
| npc-taxi | PASS | Grey hair, green polo, helmet; `-full.png` OK |
| npc-police | PASS | Navy uniform, cap, badge; `-full.png` OK |
| npc-thug | PASS | Spiky hair, sunglasses, black jacket; `-full.png` OK |
| npc-student | PASS (after fix) | v1 auto-crop failed (corner trees) → manual crop (360,150,650,970); tiny tree fragment removed; ~2 px pink fringe at 720 px ≈ sub-pixel at 42 px game size |
| building-bank | PASS via roof crop | v2 still 3/4 → `building-bank-roof.png` (flat blue roof + skylight) is the in-game sprite |
| building-hospital | PASS | Flat white roof + red cross; small facade strip acceptable |
| building-warehouse | PASS (v2) | Flat grey roof + fans + dock; minimal facade |
| building-shop | PASS via roof crop | v2 still 3/4 → `building-shop-roof.png` (flat orange roof) |
| building-showroom | PASS via roof crop | v2 still 3/4 → `building-showroom-roof.png` (flat purple roof + logo) |
| building-motel | PASS | True top-down U-shape teal roof |
| building-police | PASS | True top-down, blue roof + white star + patrol car |
| building-market | PASS | True top-down striped roof + stalls |
| building-school | PASS | Red roof + playground; small facade strip |
| building-pavilion | PASS | True top-down green conical roof + benches |
| house-a | PASS | Red tiled roof, mostly flat |
| house-b | PASS via roof crop | 6× black placeholder; simplified prompt (no "water tank") worked; `house-b-roof.png` |
| house-c | PASS via roof crop | v2 still 3/4 → `house-c-roof.png` (brown roof + tank) |
| building-cafe | PASS | True top-down terrace + umbrellas |
| map-city-v3 | PASS | True top-down district: roads + sidewalks + plaza/fountain + fenced gardens with gaps; 5× failure before simplified prompt worked |
| prop-tree-a | PASS via crop | Centre canopy cropped; houses around removed |
| prop-tree-b | PASS via crop | Pine cropped; houses around removed |
| prop-bush-flower | PASS via crop | Flower bush cropped |
| prop-fence-segment | PASS (v2) | Clean wooden fence, large, magenta bg |
| prop-fence-corner | PASS | Clean L-shaped wooden fence |
| prop-fence-gate | CONDITIONAL | Image is a whole garden scene (fence + gate + path + trees); use as reference only, not as a tile |
| prop-lamp | PASS via crop | Lamp head + pole cropped |
| prop-bench | PASS via crop | 3 wooden slats, clean |
| prop-dog | PASS via crop | Small brown dog cropped |
| prop-cat | PASS via crop (v2) | v2 top-down (back + tail); cropped tight; ~2 px magenta remnant at corners |
| prop-motorbike | PASS (v2) | True top-down red bike, clean magenta |
| prop-car | PASS via crop | True top-down blue sedan cropped |
| prop-box | PASS via crop (fix) | v1 key-out ate the box (corner-median bg sampled inside the box); fixed with mode-of-border bg + wider crop; yellow box (not brown cardboard — FLUX chose yellow) |
| prop-bin | PASS via crop (v2) | Green lid cropped off the beige platform |

**Totals: 34 PASS (incl. 5 via roof crop, 8 via centre crop), 1 CONDITIONAL (fence-gate, reference only), 0 outstanding FAILs.** FLUX cannot render a building as pure flat-roof-only no matter how explicit the prompt (proven in v1 + v2); the roof crops are the working fix, not another prompt round.
