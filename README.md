# Cuộc Sống Ảo — M0 Prototype

Prototype local 1 người chơi, **chưa có server** (không Colyseus, không Supabase,
không kinh tế / nghề / mua bán). Mục đích M0: kiểm tra di chuyển, camera,
HUD vẽ trên Canvas, Radial Menu, NPC và chu kỳ ngày/đêm trên trình duyệt
PC lẫn điện thoại.

## Công nghệ

- PixiJS **v8.13.0** qua CDN jsDelivr (`https://cdn.jsdelivr.net/npm/pixi.js@8.13.0/dist/pixi.min.js`)
- JavaScript thuần, không build step, không TypeScript compile
- Toàn bộ bản đồ / nhân vật / HUD vẽ bằng Pixi Graphics (procedural, không ảnh ngoài)
- HUD hoàn toàn trên Canvas/WebGL, không dùng DOM overlay cho gameplay

## Chạy

```bash
cd ~/workspace/do-thi-ao
python3 -m http.server 8000
# mở http://localhost:8000/  (hoặc mở trực tiếp file index.html — cần mạng để tải Pixi CDN)
```

> Cần mạng lần đầu để tải PixiJS từ CDN. Nếu offline, trang sẽ hiện
> thông báo "Không tải được PixiJS".

## Điều khiển

| Hành động | PC | Điện thoại |
|---|---|---|
| Di chuyển | WASD / mũi tên | Joystick ảo góc dưới-trái (kéo) |
| Chạy nhanh | Giữ Shift (tốn 5 Stamina/giây) | Giữ nút CHẠY góc dưới-phải |
| Mở menu tròn | Chuột phải vào NPC / địa điểm | Chạm giữ ~500ms vào NPC / địa điểm |
| Đóng menu | Bấm nút Đóng / bấm ra chỗ khác | Bấm nút Đóng / chạm ra chỗ khác |

Radial Menu có 4 nút: **Nói chuyện** (bong bóng thoại 3 giây),
**Thông tin**, **Cấp cứu** (M0: luôn tắt — chưa có ai ngất), **Đóng**.

## Có trong M0 (theo SRS v2)

1. **Bản đồ 3200×3200 px**, top-down: cỏ, đường nhựa có vạch vàng,
   vỉa hè, Quảng Trường Trung Tâm + đài phun nước, 16 tòa nhà có va chạm
   (không đi xuyên tường). POI có nhãn tiếng Việt: Điểm Hồi Sinh /
   NPC Hướng Dẫn, Ngân Hàng & ATM, Kho Hàng Trung Tâm, Cửa Hàng Tiện Lợi
   24/7, Showroom Xe Máy, Khu Nhà Trọ, Bệnh Viện (+ Nhà Dân, Chung Cư, Chợ).
   Có cây, đèn đường, ghế đá.
2. **Nhân vật** vẽ bằng Graphics, camera bám theo mượt, kẹp trong biên bản đồ,
   zoom tự fit (điện thoại ~390px thấy ~1100px thế giới, desktop tối đa 1x).
   Joystick + nút CHẠY trên Canvas.
3. **PlayerState sẵn sàng cho Colyseus**: `{id, name, x, y, vx, vy, anim,
   job, hp, hunger, stamina, cash, bank, isFainted, vehicleId}`.
   Input nội bộ dạng `{dx, dy, sprint}`. Đi 180 px/s, chạy 300 px/s,
   Stamina -5/s khi chạy / +3/s khi nghỉ, Hunger -1/15s, Hunger < 20
   thì tốc độ -30%. HP giữ 100 trong M0.
4. **HUD Canvas**: góc trái avatar + 3 thanh bo tròn (HP đỏ, Đói cam,
   Thể lực xanh) + Tiền mặt / Ngân hàng; góc phải minimap tròn (vẽ lại
   mỗi 250ms) + đồng hồ HH:MM; dưới cùng dòng gợi ý phím.
   Ngày/đêm: bắt đầu 08:00, 24 phút thực = 24 giờ game, tối phủ xanh đậm
   (alpha tới 0.38), đèn đường phát sáng ban đêm.
5. **NPC**: 10 NPC đi dạo (AI đơn giản, tránh tòa nhà) + 1 NPC Hướng Dẫn
   đứng cố định ở điểm hồi sinh. Radial Menu chuột phải / chạm giữ trong
   ~150px quanh NPC/POI, tối đa 4 nút, nói chuyện hiện bong bóng thoại.
6. **Polish**: delta-time, frustum culling (chỉ vẽ vật trong tầm camera),
   xử lý resize, màn hình bắt đầu vẽ trên Canvas (tiêu đề + nút BẮT ĐẦU),
   hiển thị FPS góc dưới-phải, toàn bộ chữ tiếng Việt.

## M3 — Sinh tồn + NPC + Shipper (SRS v2.1 §3.2, §6, §10.2)

- **Sinh tồn**: ngất mất 50% Cash ngay lúc ngất; về Bệnh viện phí
  10.000đ + 50% Cash còn lại (trừ Cash trước rồi Bank, không âm); nút
  "Về Bệnh viện" chỉ mở sau 10s ngất; ngất 60s không ai cứu thì tự về
  Bệnh viện (50 HP). Ngất không di chuyển/mua bán được, vẫn chat được.
- **Bác sĩ**: cấp cứu trong 120px hồi 30 HP; chỉ nghề Bác sĩ được
  25.000đ/lần, tối đa 3 lần cùng 1 người/giờ, cooldown 60s giữa 2 lần
  thưởng; cùng 1 cặp cứu nhau > 10 lần/ngày thì gắn cờ
  `suspected_collusion` (không tự ban). Bác sĩ nhận cảnh báo tọa độ
  (`faint_alert`) khi có người ngất.
- **Shipper**: nút NGHỀ chọn Shipper / Bác sĩ / Tài xế (Tài xế chỉ ghi
  nhận nghề, cơ chế chở khách là M4). Nhận đơn ở Kho Hàng (300px),
  tối đa 1 đơn/lúc, deadline = khoảng cách/180 + 30s, thưởng server
  tự tính 15.000–22.000đ ngày (×1,3 đêm), giao trong 80px, hủy đơn
  chờ 10s, hết hạn/ngất giữa đường thì đơn FAILED/EXPIRED, gửi hoàn
  thành 2 lần chỉ thưởng 1 lần (`ALREADY_PROCESSED`). HUD có mũi tên
  vàng chỉ điểm giao + đếm ngược + điểm giao trên minimap.
- **NPC**: tới gần NPC đi dạo < 120px → Radial Menu → Nói chuyện →
  NPC trả lời 1 câu theo persona (Anh Tùng, Chị Lan, Chú Ba, Anh Công,
  Tý, Bé Mai); NPC Hướng Dẫn hiện nhiệm vụ tân thủ 5 bước. NPC đi
  dạo 90px/s, dừng 3–8s.
- **Offline**: tất cả trên đều chạy ở chế độ chơi đơn (không server)
  với cùng số liệu — dùng chung `shared/m3.js` với server.
- **Test**: `cd server && npm test` — 35/35 PASS (xem
  `server/test/test.js`). Supabase vẫn chưa nối: tiền/job/log vẫn
  in-memory như M2; Taxi chở khách, xe máy, nhà trọ là M4; server
  chưa deploy.

## Chưa có trong M0 (để M1/M2/M3)

Colyseus multiplayer, Supabase/Auth, nhiệm vụ tân thủ, nghề Shipper /
Tài xế / Bác sĩ, mua bán, ATM chuyển khoản, xe máy, nhà trọ, tiền bẩn,
cảnh sát, nhà tù. Các nút liên quan trong M0 chỉ hiện thông tin / bị tắt.

## File

- `index.html` — khung trang + nạp Pixi CDN + `src/main.js`
- `src/main.js` — toàn bộ game M0 (bản đồ, nhân vật, NPC, HUD, minimap, menu tròn, ngày/đêm)
- `README.md` — file này
