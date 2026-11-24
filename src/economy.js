/* Đô Thị Ảo — M2 Economy (SRS v2.1 §4, §5).
   Plug-ready Supabase + local fallback. NO real keys are hardcoded here.
   - With Supabase configured (window.SUPABASE_URL + SUPABASE_ANON_KEY, or
     ?supabase_url= / ?supabase_key=), buy/ATM go through the atomic RPCs
     (rpc_shop_buy / rpc_atm_transfer / rpc_starter_grant) — see
     supabase/migrations/003_rpc.sql. Any Supabase error falls back to local.
   - Without keys: everything works LOCALLY (localStorage wallet +
     in-memory transaction log with idempotency keys), so the Netlify link
     still plays. Local mode is clearly labelled in the UI ("Chế độ local").
   Rules enforced here (same rules the server enforces online):
   - profile starts Cash = 0; starter grant 50.000đ ONCE (starter_grant tx)
   - prices come from ITEMS (= game_items table), never hardcoded in gameplay
   - every money action has an idempotency request_id; a repeated request_id
     returns ALREADY_PROCESSED and changes nothing
   - ATM: 1.000–200.000đ per transaction, max 500.000đ/day (real day) */
(function () {
  'use strict';

  // Mirror of game_items seed (supabase/migrations/001_m2.sql). The server
  // and Supabase are the source of truth when connected; this copy is only
  // for local/offline mode.
  var ITEMS = {
    banh_mi: { id: 'banh_mi', name: 'Bánh mì', price: 15000, dayPrice: 13500, hunger: 40, stamina: 0, desc: 'Hồi +40 Độ no' },
    nuoc_tang_luc: { id: 'nuoc_tang_luc', name: 'Nước tăng lực', price: 10000, dayPrice: 10000, hunger: 0, stamina: 50, desc: 'Hồi +50 Thể lực' }
  };
  var STARTER_GRANT = 50000;
  var ATM_MIN = 1000, ATM_MAX = 200000, ATM_DAY_MAX = 500000;
  var SHOP_POS = { x: 1930, y: 1060 }; // Cửa Hàng Tiện Lợi POI
  var BANK_POS = { x: 1100, y: 1060 }; // Ngân Hàng & ATM POI
  var SHOP_RANGE = 300; // must be within 300px to open shop/ATM (SRS gameplay)
  var LS_KEY = 'dta_m2_wallet_v1';

  var state = null;        // playerState object (attached by main.js)
  var clockFn = null;      // () => worldTime minutes
  var wallet = null;       // local wallet (localStorage)
  var mode = 'local';      // 'local' | 'supabase'
  var sb = null;           // supabase client, when configured

  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function fmt(n) { return Math.floor(n).toLocaleString('vi-VN') + 'đ'; }
  function hourNow() {
    try { var m = clockFn ? clockFn() : 480; return Math.floor(m / 60) % 24; } catch (e) { return 8; }
  }
  function isDay() { var h = hourNow(); return h >= 6 && h < 18; }
  function priceOf(item) { return (isDay() && item.dayPrice) ? item.dayPrice : item.price; }

  function loadWallet() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) { var w = JSON.parse(raw); if (w && typeof w.cash === 'number') return w; }
    } catch (e) { /* private mode etc. — fall through to fresh wallet */ }
    return { cash: 0, bank: 0, inventory: {}, tx: [], granted: false, atmDay: { date: todayStr(), total: 0 }, processed: [] };
  }
  function saveWallet() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(wallet)); } catch (e) { /* ignore */ }
  }
  function logTx(type, amount, meta) {
    wallet.tx.unshift({ type: type, amount: amount, at: Date.now(), meta: meta || {} });
    if (wallet.tx.length > 50) wallet.tx.length = 50;
  }
  function applyToState() {
    if (!state) return;
    state.cash = wallet.cash;
    state.bank = wallet.bank;
  }

  // ---- Supabase plug (optional) ----
  function trySupabase() {
    var url = null, key = null;
    try {
      var q = new URLSearchParams(window.location.search);
      url = q.get('supabase_url') || window.SUPABASE_URL || null;
      key = q.get('supabase_key') || window.SUPABASE_ANON_KEY || null;
    } catch (e) { /* ignore */ }
    if (url && key && typeof window.supabase !== 'undefined' && window.supabase.createClient) {
      try {
        sb = window.supabase.createClient(url, key);
        mode = 'supabase';
        console.log('[economy] Supabase configured — RPC mode');
        return true;
      } catch (e) { console.warn('[economy] supabase client failed, local mode:', e); }
    }
    mode = 'local';
    return false;
  }

  // ---- core actions (local path; Supabase path calls the same RPC names) ----
  function starterGrant() {
    if (wallet.granted) return { ok: false, error: 'ALREADY_GRANTED' };
    wallet.granted = true;
    wallet.cash += STARTER_GRANT;
    logTx('starter_grant', STARTER_GRANT, { once: true });
    saveWallet(); applyToState();
    return { ok: true, cash: wallet.cash };
  }

  function buy(itemId, qty) {
    qty = Math.max(1, Math.min(99, qty | 0 || 1));
    var item = ITEMS[itemId];
    if (!item) return { ok: false, error: 'ITEM_NOT_FOUND' };
    var requestId = uuid();
    if (wallet.processed.indexOf(requestId) !== -1) return { ok: false, error: 'ALREADY_PROCESSED' };
    var total = priceOf(item) * qty;
    if (wallet.cash < total) return { ok: false, error: 'INSUFFICIENT_FUNDS', need: total, cash: wallet.cash };
    if (mode === 'supabase' && sb) {
      // Async path: the caller uses buyAsync instead; this sync path is
      // local-only by design (see buyAsync below).
      return { ok: false, error: 'USE_ASYNC' };
    }
    wallet.processed.push(requestId);
    wallet.cash -= total;
    wallet.inventory[itemId] = (wallet.inventory[itemId] || 0) + qty;
    logTx('shop_buy', -total, { item_id: itemId, qty: qty, unit_price: priceOf(item), request_id: requestId });
    saveWallet(); applyToState();
    return { ok: true, cash: wallet.cash, qty: wallet.inventory[itemId], total: total, request_id: requestId };
  }

  function buyAsync(itemId, qty) {
    if (mode !== 'supabase' || !sb) return Promise.resolve(buy(itemId, qty));
    var item = ITEMS[itemId];
    if (!item) return Promise.resolve({ ok: false, error: 'ITEM_NOT_FOUND' });
    var requestId = uuid();
    return sb.rpc('rpc_shop_buy', {
      p_user_id: window.DTA_USER_ID || null,
      p_item_id: itemId, p_qty: qty, p_idempotency_key: requestId
    }).then(function (res) {
      if (res.error) { console.warn('[economy] rpc_shop_buy failed, local fallback:', res.error); return buy(itemId, qty); }
      var d = res.data;
      // No Auth yet (window.DTA_USER_ID unset) -> RPC refuses; fall back to
      // local wallet so the game still plays (README §4/§5).
      if (d && d.error === 'AUTH_REQUIRED') return buy(itemId, qty);
      if (!d || !d.ok) return { ok: false, error: (d && d.error) || 'RPC_FAILED' };
      wallet.cash = d.new_cash; wallet.inventory[itemId] = (wallet.inventory[itemId] || 0) + qty;
      saveWallet(); applyToState();
      return { ok: true, cash: wallet.cash, qty: wallet.inventory[itemId] };
    }).catch(function (err) {
      console.warn('[economy] rpc error, local fallback:', err);
      return buy(itemId, qty);
    });
  }

  function useItem(itemId) {
    var item = ITEMS[itemId];
    if (!item) return { ok: false, error: 'ITEM_NOT_FOUND' };
    if ((wallet.inventory[itemId] || 0) < 1) return { ok: false, error: 'NO_ITEM' };
    if (!state) return { ok: false, error: 'NO_STATE' };
    wallet.inventory[itemId] -= 1;
    if (item.hunger) state.hunger = Math.min(100, state.hunger + item.hunger);
    if (item.stamina) state.stamina = Math.min(100, state.stamina + item.stamina);
    logTx('use_item', 0, { item_id: itemId });
    saveWallet();
    return { ok: true, hunger: state.hunger, stamina: state.stamina, left: wallet.inventory[itemId] };
  }

  function atm(action, amount) {
    amount = Math.floor(amount);
    if (!isFinite(amount) || amount < ATM_MIN || amount > ATM_MAX) {
      return { ok: false, error: 'AMOUNT_RANGE', min: ATM_MIN, max: ATM_MAX };
    }
    if (wallet.atmDay.date !== todayStr()) wallet.atmDay = { date: todayStr(), total: 0 };
    if (wallet.atmDay.total + amount > ATM_DAY_MAX) {
      return { ok: false, error: 'DAILY_LIMIT', dayMax: ATM_DAY_MAX, used: wallet.atmDay.total };
    }
    var requestId = uuid();
    if (action === 'deposit') {
      if (wallet.cash < amount) return { ok: false, error: 'INSUFFICIENT_FUNDS' };
      wallet.cash -= amount; wallet.bank += amount;
    } else if (action === 'withdraw') {
      if (wallet.bank < amount) return { ok: false, error: 'INSUFFICIENT_FUNDS' };
      wallet.bank -= amount; wallet.cash += amount;
    } else return { ok: false, error: 'BAD_ACTION' };
    wallet.processed.push(requestId);
    wallet.atmDay.total += amount;
    logTx('atm', action === 'deposit' ? -amount : amount, { action: action, request_id: requestId });
    saveWallet(); applyToState();
    return { ok: true, cash: wallet.cash, bank: wallet.bank, dayUsed: wallet.atmDay.total };
  }

  function nearShop() {
    if (!state) return false;
    return Math.hypot(state.x - SHOP_POS.x, state.y - SHOP_POS.y) <= SHOP_RANGE;
  }
  function nearBank() {
    if (!state) return false;
    return Math.hypot(state.x - BANK_POS.x, state.y - BANK_POS.y) <= SHOP_RANGE;
  }

  // ---- DOM panels (Hybrid UI: money input is DOM, shop list is DOM too) ----
  var shopEl = null, atmEl = null, shopMsg = null, atmMsg = null;

  function el(id) { return document.getElementById(id); }
  function showMsg(node, text, isErr) {
    if (!node) return;
    node.textContent = text;
    node.style.color = isErr ? '#ff9a9a' : '#a5e08a';
  }
  function errText(res) {
    switch (res.error) {
      case 'INSUFFICIENT_FUNDS': return 'Không đủ tiền! Cần ' + fmt(res.need || 0) + ', bạn có ' + fmt(wallet.cash) + '.';
      case 'ALREADY_PROCESSED': return 'Giao dịch này đã xử lý rồi (chống trùng).';
      case 'AMOUNT_RANGE': return 'Số tiền phải từ ' + fmt(ATM_MIN) + ' tới ' + fmt(ATM_MAX) + ' / lần.';
      case 'DAILY_LIMIT': return 'Đã dùng ' + fmt(res.used || 0) + ' hôm nay, tối đa ' + fmt(ATM_DAY_MAX) + '/ngày.';
      case 'NO_ITEM': return 'Bạn không có vật phẩm này.';
      case 'ITEM_NOT_FOUND': return 'Không có mặt hàng này.';
      default: return 'Lỗi: ' + (res.error || 'không rõ');
    }
  }

  function renderShop() {
    if (!shopEl) return;
    var list = el('shopList');
    if (!list) return;
    // BUG FIX (M2 browser test): the buy/use buttons stay usable only near
    // the shop — but the PANEL itself must open from anywhere (see
    // openShopPanel). When far, disable the buttons and say so in-panel
    // instead of silently refusing to open (the old proximity gate).
    var farFromShop = !nearShop();
    list.innerHTML = '';
    Object.keys(ITEMS).forEach(function (id) {
      var item = ITEMS[id];
      var row = document.createElement('div');
      row.className = 'shopRow';
      var have = wallet.inventory[id] || 0;
      row.innerHTML = '<div class="shopName">' + item.name + ' <span class="shopDesc">' + item.desc + '</span></div>' +
        '<div class="shopPrice">' + fmt(priceOf(item)) + (isDay() && item.dayPrice ? ' <span class="shopSale">giá ngày</span>' : '') + '</div>' +
        '<div class="shopHave">Có: ' + have + '</div>';
      var buyBtn = document.createElement('button');
      buyBtn.className = 'shopBtn'; buyBtn.textContent = 'Mua';
      buyBtn.disabled = farFromShop; // must be near the shop to buy (SRS)
      buyBtn.addEventListener('click', function () {
        buyBtn.disabled = true; // double-click guard (idempotency, SRS §4.3)
        var done = function (res) {
          buyBtn.disabled = false;
          if (res.ok) showMsg(shopMsg, 'Đã mua ' + item.name + ' (' + fmt(res.total || priceOf(item)) + '). Còn ' + fmt(wallet.cash) + '.');
          else showMsg(shopMsg, errText(res), true);
          renderShop(); renderAtm();
        };
        if (mode === 'supabase' && sb) buyAsync(id, 1).then(done);
        else done(buy(id, 1));
      });
      row.appendChild(buyBtn);
      if (have > 0) {
        var useBtn = document.createElement('button');
        useBtn.className = 'shopBtn useBtn'; useBtn.textContent = 'Dùng';
        useBtn.disabled = farFromShop;
        useBtn.addEventListener('click', function () {
          var res = useItem(id);
          if (res.ok) showMsg(shopMsg, 'Đã dùng ' + item.name + '! Độ no ' + Math.floor(state.hunger) + ', Thể lực ' + Math.floor(state.stamina) + '.');
          else showMsg(shopMsg, errText(res), true);
          renderShop();
        });
        row.appendChild(useBtn);
      }
      list.appendChild(row);
    });
    var walletLine = el('shopWallet');
    if (walletLine) walletLine.textContent = 'Tiền mặt: ' + fmt(wallet.cash) + '  •  Ngân hàng: ' + fmt(wallet.bank) + (mode === 'local' ? '  •  Chế độ local' : '  •  Supabase');
    // Only overwrite the message when far (never wipe a buy-success message
    // — renderShop is called right after a successful buy).
    if (farFromShop) showMsg(shopMsg, 'Bạn đang ở xa Cửa Hàng Tiện Lợi — tới gần điểm cam trên bản đồ để mua / dùng đồ.');
  }

  function renderAtm() {
    if (!atmEl) return;
    var line = el('atmWallet');
    if (line) line.textContent = 'Tiền mặt: ' + fmt(wallet.cash) + '  •  Ngân hàng: ' + fmt(wallet.bank) + '  •  Đã giao dịch hôm nay: ' + fmt(wallet.atmDay.total) + ' / ' + fmt(ATM_DAY_MAX);
    // BUG FIX (M2 browser test): same as shop — panel opens from anywhere,
    // but Gửi/Rút are disabled until the player is near the bank.
    var farFromBank = !nearBank();
    var depBtn = el('atmDeposit'), wdBtn = el('atmWithdraw');
    if (depBtn) depBtn.disabled = farFromBank;
    if (wdBtn) wdBtn.disabled = farFromBank;
    if (farFromBank) showMsg(atmMsg, 'Bạn đang ở xa Ngân Hàng — tới gần để gửi / rút tiền.');
  }

  function openShopPanel() {
    // BUG FIX (M2 browser test) — ROOT CAUSE: this used to return early with
    // only an alert() when the player was not within 300px of the shop.
    // Spawn (1600,1750) is ~765px from the shop (1930,1060), so every SHOP
    // click from spawn did nothing visible (the alert is suppressed / missed
    // in a live browser test) while CHAT, which has no gate, worked fine.
    // The handler itself was wired correctly (wirePanels) and the button was
    // on top (z-index 6) — the gate was the bug, not the wiring.
    // Fix: SHOP toggles the panel open/closed reliably, exactly like CHAT.
    // The proximity rule is preserved where it belongs: Mua/Dùng buttons are
    // disabled in renderShop() until the player is near the shop.
    console.log('[economy] openShopPanel, nearShop=', nearShop());
    if (shopEl && shopEl.classList.contains('open')) { closePanels(); return; }
    renderShop();
    if (shopEl) shopEl.classList.add('open');
    if (atmEl) atmEl.classList.remove('open');
  }
  function openAtmPanel() {
    // Same fix as openShopPanel: toggle reliably from anywhere; Gửi/Rút are
    // disabled in renderAtm() until the player is near the bank (1100,1060).
    console.log('[economy] openAtmPanel, nearBank=', nearBank());
    if (atmEl && atmEl.classList.contains('open')) { closePanels(); return; }
    renderAtm();
    if (atmEl) atmEl.classList.add('open');
    if (shopEl) shopEl.classList.remove('open');
  }
  function closePanels() {
    if (shopEl) shopEl.classList.remove('open');
    if (atmEl) atmEl.classList.remove('open');
  }

  function wirePanels() {
    shopEl = el('shopPanel'); atmEl = el('atmPanel');
    shopMsg = el('shopMsg'); atmMsg = el('atmMsg');
    var shopClose = el('shopClose'), atmClose = el('atmClose');
    if (shopClose) shopClose.addEventListener('click', closePanels);
    if (atmClose) atmClose.addEventListener('click', closePanels);
    var shopBtn = el('shopBtn');
    if (shopBtn) shopBtn.addEventListener('click', function () {
      console.log('[economy] SHOP button clicked');
      openShopPanel();
    });
    // BUG FIX (M2 browser test): there was no ATM button on screen at all.
    // Standalone ATM button (same 56px round style as SHOP/CHAT) + a clear
    // "ATM — Gửi / Rút tiền" button inside the Shop panel.
    var atmBtn = el('atmBtn');
    if (atmBtn) atmBtn.addEventListener('click', function () {
      console.log('[economy] ATM button clicked');
      openAtmPanel();
    });
    var shopAtmBtn = el('shopAtmBtn');
    if (shopAtmBtn) shopAtmBtn.addEventListener('click', function () {
      console.log('[economy] Shop-panel ATM button clicked');
      openAtmPanel();
    });
    var amt = el('atmAmount');
    var dep = el('atmDeposit'), wd = el('atmWithdraw');
    function doAtm(action) {
      var amount = amt ? parseInt(amt.value, 10) : NaN;
      var res = atm(action, amount);
      if (res.ok) {
        showMsg(atmMsg, (action === 'deposit' ? 'Đã gửi ' : 'Đã rút ') + fmt(amount) + '.');
        renderAtm(); renderShop();
      } else showMsg(atmMsg, errText(res), true);
    }
    if (dep) dep.addEventListener('click', function () { doAtm('deposit'); });
    if (wd) wd.addEventListener('click', function () { doAtm('withdraw'); });
  }

  // ---- public API ----
  window.Economy = {
    ITEMS: ITEMS,
    init: function (playerState, clock) {
      state = playerState; clockFn = clock || null;
      wallet = loadWallet();
      trySupabase();
      var g = starterGrant();
      if (g.ok) console.log('[economy] starter grant +50.000đ (once, local mode)');
      applyToState();
      wirePanels();
      return { mode: mode, granted: wallet.granted };
    },
    buy: buy, buyAsync: buyAsync, useItem: useItem, atm: atm,
    starterGrant: starterGrant, nearShop: nearShop, nearBank: nearBank,
    getWallet: function () { return wallet; },
    getMode: function () { return mode; },
    priceOf: priceOf, isDay: isDay,
    renderShop: renderShop, renderAtm: renderAtm,
    openShopPanel: openShopPanel, openAtmPanel: openAtmPanel, closePanels: closePanels
  };
  window.openShopPanel = openShopPanel;
  window.openAtmPanel = openAtmPanel;
})();
