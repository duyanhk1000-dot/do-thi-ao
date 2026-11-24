/* Đô Thị Ảo — shared/m3.js
   M3 pure game rules (SRS v2.1 §3.2 survival, §3.4.3 doctor, §6 Shipper).
   NO dependencies except Colliders (for delivery-point picking) and NO
   side effects: every function is pure and takes its inputs explicitly, so
   the Colyseus server, the offline client and the tests all use the SAME
   numbers. Plain JS, UMD (Node require() + browser <script>), like
   shared/colliders.js and shared/botBrain.js.

   Verified SRS examples (see server/test/test.js):
     deliverySeconds: 500px/180 -> 33s, 2000px/180 -> 41s, 3200px/180 -> 48s,
                      3200px/540 -> 36s   (Math.round(dist/speed + 30))
     deliveryReward:  500px -> 15.000đ day / 19.500đ night (clamped minimum)
                      2000px -> 16.000đ day / 20.800đ night
                      3200px -> 19.000đ day / 24.700đ night
     faintLoss:       50.000 -> lose 25.000
     hospitalFee:     25.000 remaining -> fee 22.500 (10.000 + 12.500) */
(function (root, factory) {
  var Colliders = null;
  if (typeof module !== 'undefined' && module.exports) {
    try { Colliders = require('./colliders'); } catch (e) { Colliders = null; }
    module.exports = factory(Colliders);
  } else {
    root.M3 = factory(root.Colliders || null);
  }
})(typeof self !== 'undefined' ? self : this, function (Colliders) {
  'use strict';

  var WALK_SPEED = 180, SPRINT_SPEED = 300, BIKE_SPEED = 540;
  var WAREHOUSE_POS = { x: 4155, y: 2910 }; // Kho Hàng Trung Tâm POI (Map v2: building centre)
  var HOSPITAL_POS = { x: 4125, y: 1635 };  // Bệnh Viện POI (Map v2: building centre)
  var FAINT_SECONDS = 60;
  var HOSPITAL_BUTTON_DELAY_S = 10; // "Về Bệnh viện" appears after 10 s (§3.2.4)
  var DOCTOR_REWARD = 25000;
  var REVIVE_RANGE = 120, TALK_RANGE = 120, SHIPPER_RANGE = 300, DELIVER_RANGE = 80;
  var ORDER_CANCEL_COOLDOWN_S = 10;
  var DOCTOR_COOLDOWN_S = 60;      // between rewarded revives (§3.4.3)
  var DOCTOR_HOURLY_CAP = 3;        // rewarded revives of same victim / hour
  var COLLUSION_PAIR_PER_DAY = 10;  // same pair > 10 revives/day -> flag

  // Delivery-point POIs (§6.2: random coordinate near a POI). Warehouse is
  // the pickup point, so it is never a delivery target. Coords are Map v2
  // building centres (shared/colliders.js §3).
  var DELIVERY_POIS = [
    { id: 'spawn',    name: 'Quảng Trường Trung Tâm', x: 2400, y: 2625 },
    { id: 'bank',     name: 'Ngân Hàng & ATM',        x: 1650, y: 1590 },
    { id: 'shop',     name: 'Cửa Hàng Tiện Lợi 24/7', x: 2895, y: 1590 },
    { id: 'hospital', name: 'Bệnh Viện',              x: 4125, y: 1635 },
    { id: 'showroom', name: 'Showroom Xe Máy',        x: 1665, y: 2850 },
    { id: 'motel',    name: 'Khu Nhà Trọ',            x: 2910, y: 2865 }
  ];

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }

  // §6.3: Delivery_Time = distance/speed + 30 s buffer, rounded to seconds.
  function deliverySeconds(distancePx, speedPxPerS) {
    return Math.round(distancePx / speedPxPerS + 30);
  }

  // §6.4: base = 12000 + ceil(dist/500)*1000, clamped 15.000-22.000 day,
  // night = round(day * 1.30).
  function deliveryReward(distancePx, isNight) {
    var base = 12000 + Math.ceil(distancePx / 500) * 1000;
    var day = clamp(base, 15000, 22000);
    return isNight ? Math.round(day * 1.30) : day;
  }

  // §3.2.3: fainting loses 50% of carried Cash immediately (round down).
  function faintLoss(cash) { return Math.floor(cash / 2); }

  // §3.2.5: hospital fee = 10.000 + 50% of Cash REMAINING after faint loss.
  function hospitalFee(cashAfterLoss) {
    return 10000 + Math.floor(cashAfterLoss / 2);
  }

  // §3.2.5: deduct fee from Cash first, then Bank; never negative, never debt.
  // Returns {cash, bank, paid} — paid < fee only when cash+bank < fee.
  function deductFee(cash, bank, fee) {
    var paid = 0;
    var fromCash = Math.min(cash, fee);
    cash -= fromCash; paid += fromCash;
    var fromBank = Math.min(bank, fee - paid);
    bank -= fromBank; paid += fromBank;
    return { cash: cash, bank: bank, paid: paid };
  }

  function isNightWorld(worldTime) {
    var h = Math.floor((worldTime || 480) / 60) % 24;
    return h >= 18 || h < 6;
  }

  // §6.2: random delivery point near a POI (open ground, not inside a
  // building, not on a road). randFn defaults to Math.random; pass a seeded
  // function in tests for determinism.
  function pickDeliveryPoint(randFn) {
    var rnd = randFn || Math.random;
    if (Colliders) {
      for (var i = 0; i < 40; i++) {
        var poi = DELIVERY_POIS[Math.floor(rnd() * DELIVERY_POIS.length)];
        var a = rnd() * Math.PI * 2, r = 40 + rnd() * 220;
        var x = poi.x + Math.cos(a) * r, y = poi.y + Math.sin(a) * r;
        if (Colliders.isOpenPoint(x, y)) return { x: Math.round(x), y: Math.round(y), poiId: poi.id, poiName: poi.name };
      }
      var p = Colliders.randomOpenPoint(rnd);
      return { x: Math.round(p.x), y: Math.round(p.y), poiId: null, poiName: null };
    }
    // No Colliders (should not happen in the game): fall back to a POI point.
    var poi2 = DELIVERY_POIS[Math.floor(rnd() * DELIVERY_POIS.length)];
    return { x: poi2.x, y: poi2.y, poiId: poi2.id, poiName: poi2.name };
  }

  // §3.4.3 doctor revive reward, all server-side. Inputs are explicit so
  // tests can pass fake timestamps:
  //   job: the reviver's job; now: ms epoch; lastRewardedAt: ms epoch of
  //   the doctor's last REWARDED revive (0 = none); revivesLastHour: number
  //   of REWARDED revives of THIS victim in the last hour.
  // Returns {reward, reason}: reason is 'OK' | 'NOT_DOCTOR' | 'COOLDOWN' |
  // 'HOURLY_CAP'.
  function doctorRewardCheck(job, now, lastRewardedAt, revivesLastHour) {
    if (job !== 'doctor') return { reward: 0, reason: 'NOT_DOCTOR' };
    if (lastRewardedAt && now - lastRewardedAt < DOCTOR_COOLDOWN_S * 1000) {
      return { reward: 0, reason: 'COOLDOWN' };
    }
    if (revivesLastHour >= DOCTOR_HOURLY_CAP) {
      return { reward: 0, reason: 'HOURLY_CAP' };
    }
    return { reward: DOCTOR_REWARD, reason: 'OK' };
  }

  // §3.4.3: same doctor/victim pair reviving > 10 times in one day is
  // flagged 'suspected_collusion' (no auto-ban in P0).
  function collusionFlagged(pairRevivesToday) {
    return pairRevivesToday > COLLUSION_PAIR_PER_DAY;
  }

  var JOB_LABELS = {
    unemployed: 'Chưa có', shipper: 'Shipper', doctor: 'Bác sĩ', taxi_driver: 'Tài xế'
  };
  var JOBS = ['unemployed', 'shipper', 'doctor', 'taxi_driver'];

  return {
    WALK_SPEED: WALK_SPEED, SPRINT_SPEED: SPRINT_SPEED, BIKE_SPEED: BIKE_SPEED,
    WAREHOUSE_POS: WAREHOUSE_POS, HOSPITAL_POS: HOSPITAL_POS,
    FAINT_SECONDS: FAINT_SECONDS, HOSPITAL_BUTTON_DELAY_S: HOSPITAL_BUTTON_DELAY_S,
    DOCTOR_REWARD: DOCTOR_REWARD,
    REVIVE_RANGE: REVIVE_RANGE, TALK_RANGE: TALK_RANGE,
    SHIPPER_RANGE: SHIPPER_RANGE, DELIVER_RANGE: DELIVER_RANGE,
    ORDER_CANCEL_COOLDOWN_S: ORDER_CANCEL_COOLDOWN_S,
    DOCTOR_COOLDOWN_S: DOCTOR_COOLDOWN_S, DOCTOR_HOURLY_CAP: DOCTOR_HOURLY_CAP,
    COLLUSION_PAIR_PER_DAY: COLLUSION_PAIR_PER_DAY,
    DELIVERY_POIS: DELIVERY_POIS, JOB_LABELS: JOB_LABELS, JOBS: JOBS,
    clamp: clamp, dist: dist,
    deliverySeconds: deliverySeconds, deliveryReward: deliveryReward,
    faintLoss: faintLoss, hospitalFee: hospitalFee, deductFee: deductFee,
    isNightWorld: isNightWorld, pickDeliveryPoint: pickDeliveryPoint,
    doctorRewardCheck: doctorRewardCheck, collusionFlagged: collusionFlagged
  };
});
