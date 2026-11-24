/* Đô Thị Ảo — src/jobs.js (M3: job choice + Shipper, SRS §3.4, §6, §10.2)
   Plain JS, no build step. Loaded AFTER src/economy.js, BEFORE src/main.js.
   Owns the #jobPanel DOM (job buttons + Shipper order controls) and the
   OFFLINE Shipper engine — the same rules/numbers as the server
   (shared/m3.js): 1 order at a time, accept at the warehouse only,
   deadline = distance/180 + 30 s, server-calculated reward (here: the
   local engine, since there is no server offline), deliver within 80 px,
   cancel = 10 s cooldown, faint = FAILED, duplicate complete =
   ALREADY_PROCESSED. Online mode only renders the panel and forwards
   clicks to NetClient — the server decides everything there.
   main.js drives it: Jobs.init(ctx) in boot, Jobs.tick(dt) in the ticker,
   Jobs.onServerOrder(order) from the net hooks. */
(function () {
  'use strict';

  var M3 = (typeof window !== 'undefined' && window.M3) ? window.M3 : null;
  if (typeof module !== 'undefined' && module.exports && !M3) {
    try { M3 = require('../shared/m3'); } catch (e) { M3 = null; }
  }

  var ctx = null; // {state, isOnline, sendShipper, sendJob, getWorldTime, sys, economy}
  var panelEl = null, orderInfoEl = null, jobLineEl = null;
  var acceptBtn = null, completeBtn = null, cancelBtn = null;
  var jobBtns = {};
  var localOrder = null; // offline active order (same shape as the server's)
  var localCancelCooldownUntil = 0;
  var localCompletedIds = {}; // orderId -> true (idempotency, §4.3)
  var localOrderSeq = 0;
  var uiAccum = 0;

  function el(id) { return document.getElementById(id); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function fmt(n) { return Math.floor(n).toLocaleString('vi-VN') + 'đ'; }
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  function isOnline() { return ctx && ctx.isOnline && ctx.isOnline(); }
  function state() { return ctx ? ctx.state : null; }

  // Current active order, from the server state when online, local when offline.
  function getOrder() {
    var st = state();
    if (!st) return null;
    if (isOnline()) {
      if (st.order && st.order.status === 'accepted') return st.order;
      return null;
    }
    return localOrder;
  }

  function isNight() {
    if (!M3) return false;
    var wt = ctx && ctx.getWorldTime ? ctx.getWorldTime() : 480;
    return M3.isNightWorld(wt);
  }

  // SFX (M3 skills revision, audio-gen tier a): never crash the game.
  function sfx(name) {
    try { if (typeof window !== 'undefined' && window.DTA_SFX && window.DTA_SFX[name]) window.DTA_SFX[name](); } catch (e) { /* audio must never crash the game */ }
  }

  // VFX (rename+VFX): same call sites as sfx() — sight + sound together.
  function vfx(name, a, b, c) {
    try { if (typeof window !== 'undefined' && window.DTA_VFX && window.DTA_VFX[name]) window.DTA_VFX[name](a, b, c); } catch (e) { /* visuals must never crash the game */ }
  }

  // ---- offline Shipper engine (same rules as server/_onShipper) ----
  function localAccept() {
    var st = state();
    if (!st || !M3) return { ok: false, error: 'NO_M3' };
    if (st.job !== 'shipper') return { ok: false, error: 'NOT_SHIPPER' };
    if (st.isFainted) return { ok: false, error: 'FAINTED' };
    if (localOrder) return { ok: false, error: 'ALREADY_HAVE_ORDER' };
    var now = Date.now();
    if (now < localCancelCooldownUntil) {
      return { ok: false, error: 'COOLDOWN', retryAfterSec: Math.ceil((localCancelCooldownUntil - now) / 1000) };
    }
    if (dist(st.x, st.y, M3.WAREHOUSE_POS.x, M3.WAREHOUSE_POS.y) > M3.SHIPPER_RANGE) {
      return { ok: false, error: 'TOO_FAR' };
    }
    var target = M3.pickDeliveryPoint();
    var distance = Math.round(dist(st.x, st.y, target.x, target.y));
    var seconds = M3.deliverySeconds(distance, M3.WALK_SPEED);
    localOrder = {
      id: 'local-' + (++localOrderSeq),
      targetX: target.x, targetY: target.y, poiName: target.poiName,
      distance: distance, reward: M3.deliveryReward(distance, isNight()),
      deadlineAt: now + seconds * 1000, idempotencyKey: uuid(),
      status: 'accepted',
    };
    if (ctx.sys) ctx.sys('Đã nhận đơn giao tới ' + (target.poiName || 'điểm giao') +
      ' (' + distance + 'm) — hạn ' + seconds + 's, thưởng ' + fmt(localOrder.reward) + '.');
    sfx('accept');
    vfx('acceptPath', target.x, target.y);
    render();
    return { ok: true, order: localOrder };
  }

  function localComplete() {
    var st = state();
    if (!st || !M3) return { ok: false, error: 'NO_M3' };
    if (!localOrder) return { ok: false, error: 'NO_ORDER' };
    var order = localOrder;
    if (localCompletedIds[order.id]) return { ok: false, error: 'ALREADY_PROCESSED' };
    if (st.isFainted) return { ok: false, error: 'FAINTED' };
    var now = Date.now();
    if (now > order.deadlineAt) {
      localOrder = null;
      if (ctx.sys) ctx.sys('Đơn ' + order.id + ' đã hết hạn (EXPIRED) — không thưởng, nhận đơn mới được rồi.');
      sfx('expire');
      vfx('clearPath');
      render();
      return { ok: false, error: 'EXPIRED' };
    }
    if (dist(st.x, st.y, order.targetX, order.targetY) > M3.DELIVER_RANGE) {
      return { ok: false, error: 'TOO_FAR', needPx: M3.DELIVER_RANGE };
    }
    localCompletedIds[order.id] = true;
    localOrder = null;
    if (ctx.economy && ctx.economy.grant) {
      ctx.economy.grant(order.reward, 'job_reward', {
        job: 'delivery', delivery_id: order.id, distance_px: order.distance,
        idempotency_key: order.idempotencyKey,
      });
    } else {
      st.cash += order.reward;
    }
    if (ctx.sys) ctx.sys('Giao hàng thành công! +' + fmt(order.reward) + ' (đơn ' + order.id + ').');
    sfx('deliver');
    vfx('deliver', st.x, st.y, '+' + fmt(order.reward));
    vfx('clearPath');
    render();
    return { ok: true, reward: order.reward };
  }

  function localCancel() {
    if (!localOrder) return { ok: false, error: 'NO_ORDER' };
    var id = localOrder.id;
    localOrder = null;
    localCancelCooldownUntil = Date.now() + M3.ORDER_CANCEL_COOLDOWN_S * 1000;
    if (ctx.sys) ctx.sys('Đã hủy đơn ' + id + ' — chờ 10s mới nhận đơn mới.');
    sfx('click');
    vfx('clearPath');
    render();
    return { ok: true };
  }

  // Called by main.js when the local player faints (§6.2: order FAILED).
  function onLocalFaint() {
    if (!localOrder) return;
    var id = localOrder.id;
    localOrder = null;
    if (ctx.sys) ctx.sys('Đơn ' + id + ' FAILED vì bạn ngất giữa đường — không thưởng.');
    vfx('clearPath');
    render();
  }

  // ---- panel ----
  function jobErrText(res) {
    switch (res && res.error) {
      case 'NOT_SHIPPER': return 'Bạn chưa chọn nghề Shipper — bấm nút Shipper ở trên trước.';
      case 'FAINTED': return 'Bạn đang ngất, không làm đơn được.';
      case 'ALREADY_HAVE_ORDER': return 'Bạn đang có 1 đơn rồi — giao xong / hủy rồi mới nhận đơn mới.';
      case 'COOLDOWN': return 'Vừa hủy đơn, chờ ' + (res.retryAfterSec || 10) + 's nữa mới nhận đơn mới.';
      case 'TOO_FAR': return 'Chưa tới nơi — tới Kho Hàng Trung Tâm (điểm xám phía Đông Nam) để nhận đơn, tới đúng điểm giao để giao hàng.';
      case 'NO_ORDER': return 'Bạn chưa có đơn nào.';
      case 'ALREADY_PROCESSED': return 'Đơn này đã giao xong rồi (chống trùng).';
      case 'EXPIRED': return 'Đơn đã hết hạn — không thưởng, nhận đơn mới được rồi.';
      case 'ACTIVE_ORDER': return 'Đang có đơn Shipper — giao xong / hủy rồi mới đổi nghề.';
      case 'ORDER_TAKEN': return 'Đơn này vừa có người nhận — đã cấp đơn khác cho bạn.';
      default: return 'Lỗi: ' + ((res && res.error) || 'không rõ');
    }
  }

  function setJob(job) {
    var st = state();
    if (!st) return;
    if (isOnline()) {
      if (ctx.sendJob) ctx.sendJob(job);
      return;
    }
    if (localOrder && job !== 'shipper') {
      if (ctx.sys) ctx.sys(jobErrText({ error: 'ACTIVE_ORDER' }));
      return;
    }
    st.job = job;
    if (ctx.sys) ctx.sys('Đã chọn nghề: ' + (M3 ? M3.JOB_LABELS[job] : job) +
      (job === 'taxi_driver' ? ' (cơ chế chở khách là M4 — hiện chỉ ghi nhận nghề).' : '.'));
    sfx('jobPick');
    render();
  }

  function render() {
    if (!panelEl) return;
    var st = state();
    if (!st) return;
    var label = (M3 ? M3.JOB_LABELS[st.job] : st.job) || 'Chưa có';
    if (jobLineEl) jobLineEl.textContent = 'Nghề hiện tại: ' + label +
      (st.job === 'shipper' ? ' — nhận đơn ở Kho Hàng Trung Tâm.' : '');
    Object.keys(jobBtns).forEach(function (j) {
      if (jobBtns[j]) jobBtns[j].classList.toggle('active', st.job === j);
    });
    var order = getOrder();
    var now = Date.now();
    if (orderInfoEl) {
      if (!order) {
        var cd = isOnline() ? 0 : Math.max(0, Math.ceil((localCancelCooldownUntil - now) / 1000));
        orderInfoEl.textContent = st.job === 'shipper'
          ? (cd > 0 ? 'Chờ ' + cd + 's nữa mới nhận đơn mới (vừa hủy đơn).'
            : 'Chưa có đơn — tới Kho Hàng Trung Tâm rồi bấm Nhận đơn.')
          : 'Chọn nghề Shipper để nhận đơn giao hàng.';
      } else {
        var secLeft = Math.max(0, Math.ceil((order.deadlineAt - now) / 1000));
        var d = Math.round(dist(st.x, st.y, order.targetX, order.targetY));
        orderInfoEl.textContent = 'Đơn ' + order.id + ' → ' + (order.poiName || 'điểm giao') +
          ' • cách ' + d + 'm • còn ' + secLeft + 's • thưởng ' + fmt(order.reward);
      }
    }
    var nearWarehouse = M3 && dist(st.x, st.y, M3.WAREHOUSE_POS.x, M3.WAREHOUSE_POS.y) <= M3.SHIPPER_RANGE;
    var nearTarget = order && dist(st.x, st.y, order.targetX, order.targetY) <= M3.DELIVER_RANGE;
    if (acceptBtn) acceptBtn.disabled = !(st.job === 'shipper' && !order && !st.isFainted && nearWarehouse);
    if (completeBtn) completeBtn.disabled = !(order && !st.isFainted && nearTarget);
    if (cancelBtn) cancelBtn.disabled = !order;
    if (acceptBtn) acceptBtn.title = nearWarehouse ? '' : 'Tới Kho Hàng Trung Tâm để nhận đơn';
    if (completeBtn) completeBtn.title = nearTarget ? '' : 'Tới trong 80px quanh điểm giao để giao hàng';
  }

  function openPanel() {
    if (!panelEl) return;
    var wasOpen = panelEl.classList.contains('open');
    closeAllPanels();
    if (!wasOpen) { render(); panelEl.classList.add('open'); }
  }
  function closeAllPanels() {
    if (panelEl) panelEl.classList.remove('open');
    if (typeof window.closePanels === 'function') window.closePanels();
    else {
      var sp = document.getElementById('shopPanel'), ap = document.getElementById('atmPanel');
      if (sp) sp.classList.remove('open');
      if (ap) ap.classList.remove('open');
    }
  }

  function tick(dt) {
    // Offline: expire overdue orders (§6.2) + refresh the panel ~4x/s.
    if (!isOnline() && localOrder && Date.now() > localOrder.deadlineAt) {
      var id = localOrder.id;
      localOrder = null;
      if (ctx.sys) ctx.sys('Đơn ' + id + ' đã hết hạn (EXPIRED) — không thưởng, nhận đơn mới được rồi.');
      vfx('clearPath');
    }
    uiAccum += dt;
    if (uiAccum > 0.25) { uiAccum = 0; render(); }
  }

  function init(c) {
    ctx = c;
    panelEl = el('jobPanel');
    orderInfoEl = el('jobOrderInfo');
    jobLineEl = el('jobCurrent');
    acceptBtn = el('jobAccept');
    completeBtn = el('jobComplete');
    cancelBtn = el('jobCancel');
    var closeBtn = el('jobClose');
    if (closeBtn) closeBtn.addEventListener('click', closeAllPanels);
    var jobBtn = el('jobBtn');
    if (jobBtn) jobBtn.addEventListener('click', function () { openPanel(); });
    ['shipper', 'doctor', 'taxi_driver'].forEach(function (job) {
      var b = el('jobPick_' + job);
      if (b) {
        jobBtns[job] = b;
        b.addEventListener('click', function () { setJob(job); });
      }
    });
    if (acceptBtn) acceptBtn.addEventListener('click', function () {
      sfx('click');
      var res;
      if (isOnline()) { if (ctx.sendShipper) ctx.sendShipper('accept'); return; }
      res = localAccept();
      if (!res.ok && ctx.sys) ctx.sys(jobErrText(res));
    });
    if (completeBtn) completeBtn.addEventListener('click', function () {
      sfx('click');
      var res;
      if (isOnline()) {
        var order = getOrder();
        if (ctx.sendShipper) ctx.sendShipper('complete', order ? { orderId: order.id } : null);
        return;
      }
      res = localComplete();
      if (!res.ok && ctx.sys) ctx.sys(jobErrText(res));
    });
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      sfx('click');
      if (isOnline()) { if (ctx.sendShipper) ctx.sendShipper('cancel'); return; }
      var res = localCancel();
      if (!res.ok && ctx.sys) ctx.sys(jobErrText(res));
    });
    render();
  }

  if (typeof window !== 'undefined') {
    window.Jobs = {
      init: init, tick: tick, render: render, getOrder: getOrder,
      onLocalFaint: onLocalFaint, openPanel: openPanel,
      jobErrText: jobErrText,
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { init: init, tick: tick, getOrder: getOrder };
  }
})();
