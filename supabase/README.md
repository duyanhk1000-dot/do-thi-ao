# Đô Thị Ảo — M2 Supabase setup

M2 economy chạy **plug-ready**: không có key thì game vẫn chơi được ở chế độ
local (localStorage). Khi đã cấu hình Supabase, shop/ATM/starter grant đi qua
các RPC nguyên tử dưới đây.

## 1. Tạo project (miễn phí, không cần thẻ)

1. Vào https://supabase.com → Sign in **bằng GitHub** (tài khoản của bạn đã
   liên kết GitHub, đừng dùng Google).
2. New project → tên `do-thi-ao`, region **Singapore**, đặt database password
   (ghi lại, chỉ dùng 1 lần).
3. Đợi project ready (~1 phút).

## 2. Chạy migration

Mở **SQL Editor** trong Supabase Dashboard → New query → dán từng file theo
thứ tự và Run:

1. `migrations/001_m2.sql` — bảng profiles / inventory / assets /
   transaction_logs / player_jobs / player_missions / player_sessions /
   game_items + seed bánh mì & nước tăng lực.
2. `migrations/002_rls.sql` — RLS: client chỉ đọc dữ liệu của mình, KHÔNG
   được tự sửa cash/bank (trigger chặn, chỉ RPC được sửa).
3. `migrations/003_rpc.sql` — RPC nguyên tử: `rpc_starter_grant`,
   `rpc_shop_buy`, `rpc_atm_transfer` (1 transaction + row lock +
   idempotency + log).

Kiểm tra nhanh trong SQL Editor:

```sql
select item_id, name, price, day_price from public.game_items;
-- phải ra 2 dòng: banh_mi 15000/13500, nuoc_tang_luc 10000/null
```

## 3. Lấy key

Settings → API → copy:

- **Project URL** → `SUPABASE_URL`
- **anon public key** → `SUPABASE_ANON_KEY`

> Không bao giờ dùng **service_role key** trong client. Key đó chỉ nằm trên
> server Render (env var) khi deploy M2 server.

## 4. Cắm key vào game (2 cách, không hardcode key vào code)

**Cách A — biến global trước khi load game** (khuyên dùng khi deploy Netlify:
thêm 1 đoạn script nhỏ vào `index.html` trước `src/economy.js`, hoặc set
trong Netlify environment → inject lúc build):

```html
<script>
  window.SUPABASE_URL = "https://xxxx.supabase.co";
  window.SUPABASE_ANON_KEY = "eyJhbGciOi...";
</script>
```

**Cách B — query param** (chỉ để test nhanh, đừng chia sẻ link có key):

```
https://fantastic-frangipane-53d58e.netlify.app/?supabase_url=https://xxxx.supabase.co&supabase_key=eyJhbGciOi...
```

Không có key → game tự chạy **chế độ local**: ví tiền lưu ở
localStorage (`dta_m2_wallet_v1`), starter grant 50.000đ 1 lần, shop/ATM
đầy đủ, HUD hiển thị "Chế độ local" trong panel Shop.

## 5. Auth (khi lên M2 online thật)

- Supabase Auth → bật **Email** provider (và GitHub nếu muốn).
- Client đăng nhập bằng Supabase Auth → `supabase.auth.getUser()` ra
  `user.id` → đặt `window.DTA_USER_ID` trước khi `Economy.init()` chạy
  (hiện tại `buyAsync` gửi `window.DTA_USER_ID || null`; chưa có Auth thì
  RPC trả `AUTH_REQUIRED` và client tự fallback về local).
- Server Render (M2 sau): dùng service_role key gọi cùng các RPC này để
  thay thế stub trong `server/rooms/CityRoom.js` (`_onShopBuy` /
  `_onAtmTransfer` / `_onUseItem` / `_onStarterGrant`).

## Quy tắc tiền (SRS §4.5/§5.7) — đã cài trong cả 3 lớp

| Quy tắc | Local (`src/economy.js`) | Server stub (`CityRoom.js`) | Supabase RPC |
| --- | --- | --- | --- |
| Cash mặc định 0 | ✓ | ✓ | ✓ (`profiles.cash DEFAULT 0`) |
| Starter 50.000đ 1 lần | ✓ (`granted` flag + log) | ✓ (1 lần/session) | ✓ (log `starter_grant` check) |
| Giá từ bảng server | ✓ (`ITEMS`) | ✓ (`SHOP_ITEMS`) | ✓ (`game_items`) |
| Idempotency | ✓ (`request_id` set) | ✓ (`processed` set) | ✓ (`idempotency_key` UNIQUE) |
| ATM 1.000–200.000đ/lần, 500.000đ/ngày | ✓ | ✓ | ✓ |
| Client không tự sửa tiền | — | ✓ (server validate) | ✓ (RLS + trigger) |
