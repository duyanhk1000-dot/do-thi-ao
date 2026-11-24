# Asset Prompts — Đô Thị Ảo (FLUX.1-schnell, 1024x1024, steps 4)

Style lock (đầu mọi prompt, theo pro-prompting):
> "Bright colorful 2D top-down mobile city game, flat vector illustration, soft shading, clean simple shapes, vibrant colors, no text, no words, no watermark"

Tool: `python3 ~/workspace/custom-connectors/custom.nvidia/bin/nvidia_image.py generate --prompt "..." --steps 4 --out <path>.png`
(schnell: NO seed, NO cfg_scale.)

## v1 — kết quả kiểm tra bằng mắt (2026-11-24)

| File | Đánh giá | Ghi chú |
|---|---|---|
| map-city-aerial.png | PASS — roundabout + đài phun nước, đường, cỏ | Dùng làm nền quảng trường (800×800 tại 1600,1600) + nền màn hình chào |
| building-bank.png | PASS — ngân hàng cột, mái xanh | Sprite + mask bo góc |
| building-hospital.png | v1 FAIL — FLUX vẽ cả khu phố, bệnh viện nhỏ ở giữa. **v2 PASS** — thêm "fills 80% of the frame, no other buildings, no streets, no trees" | Tòa trắng mái đỏ, chữ thập đỏ |
| building-warehouse.png | PASS (chấp nhận) — kho chính đẹp, có thêm 2 nhà đỏ phụ + cây trên bệ | Đọc được là khu kho, mask bo góc che viền |
| building-shop.png | PASS — cửa hàng cam, mái sọc | |
| building-showroom.png | PASS — showroom tím + xe máy đỏ | |
| building-motel.png | PASS — motel xanh ngọc, chữ MOTEL đúng | |
| hero-citizen.png | PASS nhân vật, FAIL nền — FLUX vẽ cả thành phố xung quanh dù đã ghi "plain white background" | Cắt crop vuông quanh đầu/thân (xem dưới), hiển thị trong badge tròn |
| npc-shipper/bread/taxi/police/thug/student.png | PASS nhân vật (rất đẹp, đúng persona), FAIL nền — giống hero, FLUX luôn thêm phố xá mờ xung quanh | Cắt crop vuông, hiển thị trong badge tròn |

**Bài học FLUX (khớp skill pro-prompting):** "no buildings / plain white background" bị bỏ qua khi chủ thể là nhân vật — FLUX luôn thêm bối cảnh. Cách sửa đúng: crop chặt quanh nhân vật + mask tròn trong Pixi, KHÔNG tách nền bằng code (sẽ thủng vùng màu kem nhạt).

## Crops (assets/crop_portraits.py, PIL)

Crop vuông quanh đầu + thân, hiển thị trong badge tròn (mask circle + viền màu) trong game:

| File gốc | Crop box (1024) | File crop |
|---|---|---|
| hero-citizen.png | (315,260,695,640) | hero-citizen-crop.png |
| npc-shipper.png | (240,120,660,540) | npc-shipper-crop.png |
| npc-bread.png | (295,120,715,540) | npc-bread-crop.png |
| npc-taxi.png | (300,120,720,540) | npc-taxi-crop.png |
| npc-police.png | (295,170,715,590) | npc-police-crop.png |
| npc-thug.png | (295,120,715,540) | npc-thug-crop.png |
| npc-student.png | (315,240,695,620) | npc-student-crop.png |

## Cách dùng trong game (không tách nền)

- **Buildings:** `PIXI.Sprite` từ ảnh gốc, scale width = rect.w × 1.25 (giữ tỉ lệ vuông), căn giữa rect, mask = rounded-rect bo góc (che 4 góc trắng). Collision rect giữ nguyên y hệt M0.
- **Nhân vật/NPC/Bot:** sprite từ ảnh `*-crop.png`, mask = hình tròn + viền màu theo persona, đường kính ~44px trong world, tên hiển thị phía trên. Hero dùng `hero-citizen-crop.png` cho avatar HUD + sprite người chơi.
- **Map:** `map-city-aerial.png` làm nền quảng trường, không dùng làm toàn bộ map (sẽ mờ và lệch lưới đường M0).
- Không tạo `tree.png` / `lamp.png` — cây và đèn giữ vẽ bằng Graphics như M0 (đủ đẹp, tiết kiệm lượt FLUX).

## Prompts đầy đủ (v1, hospital có v2)

Style lock + phần riêng từng ảnh (xem lệnh generate trong lịch sử; hospital v2 thêm "the building fills 80 percent of the frame, no other buildings, no streets, no trees, no other objects"):

- map: bird's-eye view aerial city map, gray roads with yellow lane lines in a grid, green grass blocks, small colorful building blocks, central beige plaza with round blue fountain, small park with green trees, bright daylight, cheerful mood, wide top-down view, empty open center for gameplay
- bank: one single modern bank building with blue roof and tall columns, slight isometric top-down view, centered on plain white background, full building visible
- hospital v2: one single white hospital building with red roof and red cross symbol, fills 80% of frame, slight isometric top-down view, centered on plain white background, no other buildings/streets/trees/objects
- warehouse: one single gray industrial warehouse with big sliding doors, fills 80% of frame, slight isometric top-down view, plain white background
- shop: one single small orange convenience store with striped awning, fills 80% of frame, slight isometric top-down view, plain white background
- showroom: one single purple motorcycle showroom with glass front and small motorcycle parked outside, fills 80% of frame, slight isometric top-down view, plain white background
- motel: one single teal motel with two floors and small balconies, fills 80% of frame, slight isometric top-down view, plain white background
- hero: cute chibi citizen, top-down view, full body, big head, smiling face, blue shirt, dark pants, standing pose, centered on plain white background
- shipper (Anh Tùng): cute chibi delivery shipper man, orange uniform and cap, holding brown delivery box, fills 70% of frame, full body, big head, smiling
- bread (Chị Lan): cute chibi Vietnamese woman bread seller, colorful apron, holding basket of baguettes, fills 70% of frame, full body, big head, warm smile
- taxi (Chú Ba): cute chibi older Vietnamese motorbike taxi driver, green shirt, holding motorcycle helmet, friendly face, fills 70% of frame
- police (Anh Công): cute chibi Vietnamese policeman, dark blue uniform and cap, serious friendly face, fills 70% of frame
- thug (Tý): cute chibi young street tough guy, black jacket, sunglasses, spiky hair, confident smirk, fills 70% of frame
- student (Bé Mai): cute chibi Vietnamese female university student, white shirt and backpack, curious happy face, fills 70% of frame

## v2 — M2 (2026-11-24): full-body thay badge tròn (user phàn nàn avatar tròn)

**Vấn đề v1:** FLUX bỏ qua "plain white background" với nhân vật và vẽ thêm phố xá mờ xung quanh, nên M1 phải nhét ảnh vào badge tròn — user chê: "người chơi sao lại là avatar hình tròn?".
**Cách sửa v2 (đã test và thành công):** dùng nền **magenta đậm** làm chroma-key thay vì nền trắng. Prompt thêm "isolated on a solid bright magenta background, single character only" — FLUX TÔN TRỌNG nền magenta đặc (khác hẳn nền trắng: nền trắng nó vẫn vẽ phố, nền magenta nó giữ nguyên màu đặc). Sau đó script `assets/make_full_sprites.py` crop chặt quanh nhân vật + flood-fill từ viền ảnh (chỉ xóa pixel nối với viền và gần màu nền, nên áo đỏ/tím bên trong không bị ăn) → PNG trong suốt `*-full.png` (cao 720px, tỉ lệ giữ nguyên).

Style lock v2 cho nhân vật: "Bright colorful 3D cartoon mobile city game character, soft rounded shapes, smooth shading, vibrant colors" + "full body, three-quarter front view, standing pose, isolated on a solid bright magenta background, single character only, no buildings, no street, no trees, no other objects, no text".
- hero v2 (test magenta đầu tiên): nhân vật đẹp, nhưng FLUX thêm 1 tòa nhà bên phải → crop (278,180,490,895) cắt nhà. File `hero-citizen-full.png`.
- shipper v1: có cây + nhà 2 bên và vạch kẻ đường trắng lơ lửng ngang hông → **v2 PASS sạch hoàn toàn** (thêm "standing alone in an empty studio, solid bright magenta studio backdrop filling the whole background"). Crop (400,230,640,920). Lưu ý: mũ có logo "M" nhỏ, ở cỡ game 42px không đọc được.
- bread: v1 đã sạch hoàn toàn (không cần v2), crop (270,110,720,905). Áo đỏ không bị ăn nhờ flood-fill.
- taxi: v1 sạch, nhân vật ngồi trên xe máy (đúng persona tài xế xe ôm, đứng chờ khách thì hợp lý). Crop (250,180,700,920). Biển xe có chữ "THA8J" sai chính tả — ở cỡ game không đọc được, chấp nhận.
- police: v1 sạch hoàn toàn, crop (300,100,720,930).
- thug: v1 sạch hoàn toàn, crop (260,110,700,920).
- student v1: nền là cả con phố hồng + cây → crop vẫn còn cây và đường hồng. **v2**: vẫn có cây 2 bên nhưng nhân vật đứng giữa, crop (310,180,700,920) cắt hết cây. Chấp nhận, còn vài pixel cây ở mép (1-2px ở cỡ game).
- Kiểm tra bằng composite trên nền cỏ + đường: không thủng áo/quần, chỉ còn vài đốm hồng 1-2px ở mép (hero, shipper) — chấp nhận, ở cỡ game 42px không thấy.

**Kho v3:** `building-warehouse.png` cũ có thêm 2 nhà đỏ phụ + cây trên bệ tròn → v3 (prompt thêm "no other buildings, no trees") ra 1 kho duy nhất, sạch, có bệ + vài cây nhỏ quanh (chấp nhận, đọc là khu kho). Đã ghi đè file cũ (convert sang PNG thật).
**Map / bank / shop / hospital / showroom / motel:** giữ nguyên v1 (đã đẹp, nền trắng sạch, isometric).
**Quy tắc dùng trong game từ M2:** `*-full.png` (trong suốt) = nhân vật ĐI TRONG THẾ GIỚI (full-body + bóng đổ ellipse dưới chân). `*-crop.png` (cũ) CHỈ dùng cho avatar HUD góc trái + ảnh đại diện chat — không bao giờ làm nhân vật di chuyển.
