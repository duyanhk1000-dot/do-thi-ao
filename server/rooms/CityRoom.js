/* Đô Thị Ảo — server/rooms/CityRoom.js
   M1 Colyseus room "city": authoritative movement (§7.4), survival (§3.2),
   chat + Bot AI (§10), NPC/bot wandering. Plain JS, Colyseus 0.15.
   Bots live in state.players (they look like normal players to the client);
   the guide + walkers live in state.npcs. */
const { Room } = require('colyseus');
const { PlayerState, NpcState, CityRoomState } = require('../schema');
const Colliders = require('../../shared/colliders');
const BotBrain = require('../../shared/botBrain');
const M3 = require('../../shared/m3');
const { randomUUID } = require('crypto');
const stats = require('../stats');

const WALK_SPEED = 180, SPRINT_SPEED = 300;
const HOSPITAL = { x: 4125, y: 1635 }; // SRS §3.1 POI (== M3.HOSPITAL_POS, Map v2)
const GUIDE_POS = { x: 2400, y: 2520 }; // Map v2 (clear of the fountain)
const SPAWN = { x: 2400, y: 2625 }; // Map v2 plaza south edge
const CHAT_BUBBLE_MS = 4000;
const NEARBY_RADIUS = 600;
const FAINT_SECONDS = 60;
// M3: test hook. The local test suite (server/test/test.js) sets
// DTA_ALLOW_TEST=1 and may send '__test_set' to set its OWN player's
// hp/hunger/cash so faint/doctor flows can be tested without waiting 25
// minutes. NEVER enabled in production (env var unset -> ignored).
const ALLOW_TEST = process.env.DTA_ALLOW_TEST === '1';

const WALKER_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Thu', 'Tuấn'];
const WALKER_AVATARS = ['shipper', 'bread', 'police', 'thug', 'student'];
// M3 skills revision (image-gen audit): avatar and persona lists MUST
// index-align, and 'taxi' (Chú Ba — v3 sprite is standing with a helmet,
// reserved for the Guide + bot Chú Ba) and 'hero' (looks exactly like the
// player) must never be walkers — the old lists cycled 5 avatars against
// 6 personas, so e.g. walker-2 (bread sprite) talked as Chú Ba.
const WALKER_PERSONAS = ['tung', 'lan', 'cong', 'ty', 'mai'];

// M2 economy (§4/§5.7): server price table — the client never sets prices.
// Mirrors game_items seed (supabase/migrations/001_m2.sql). When Supabase is
// connected the RPCs replace these in-memory stubs (same rules, same limits).
const SHOP_ITEMS = {
  banh_mi: { price: 15000, dayPrice: 13500, hunger: 40, stamina: 0 },
  nuoc_tang_luc: { price: 10000, dayPrice: 10000, hunger: 0, stamina: 50 },
};
const STARTER_GRANT = 50000;
const ATM_MIN = 1000, ATM_MAX = 200000, ATM_DAY_MAX = 500000;
const SHOP_POS = { x: 2895, y: 1590 }; // Cửa Hàng Tiện Lợi POI (Map v2)
const BANK_POS = { x: 1650, y: 1590 }; // Ngân Hàng & ATM POI (Map v2)
const ECON_RANGE = 300;
const ECON_RATE_LIMIT = 5; // max 5 economy messages / minute per player (SRS §12.3)
function todayStr() { return new Date().toISOString().slice(0, 10); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function randRange(a, b) { return a + Math.random() * (b - a); }
// Map v2: one blocked() test for all server movement — buildings + garden
// fences (except the corner gaps) + the plaza fountain circle.
function blocked(x, y, r) {
  return Colliders.hitBuilding(x, y, r) || Colliders.hitFence(x, y, r) || Colliders.inFountain(x, y, r);
}
// Random open point biased toward the spawn plaza so bots stay near players
// (keeps nearby-chat bot replies reachable in tests and in real play).
function randomOpenPointNearSpawn(maxR) {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * maxR;
    const x = SPAWN.x + Math.cos(a) * r, y = SPAWN.y + Math.sin(a) * r;
    if (Colliders.isOpenPoint(x, y)) return { x, y };
  }
  return Colliders.randomOpenPoint();
}

class CityRoom extends Room {
  maxClients = 8; // M1 acceptance: 8 players (SRS §2, §7.1: 16 later)
  patchRate = 50; // 20 Hz

  onCreate() {
    this.setState(new CityRoomState());
    stats.rooms += 1;

    // Server-only bookkeeping (never synced to clients).
    this.clientData = new Map(); // sessionId -> {lastSeq, moveTimes, violations, lastMoveAt, chatTimes, econTimes, isBot}
    this.survival = new Map(); // playerId -> {hungerAcc, hpLossAcc, regenAcc, faintedUntil}
    this.bots = new Map(); // botId -> {personaId, brain, targetX, targetY, pauseUntil, speed, nextProactiveAt}
    this.walkers = new Map(); // npcId -> {targetX, targetY, pauseUntil, speed}
    this.pendingBotReplies = new Set(); // timeout handles, cleared on dispose
    this.economy = new Map(); // sessionId -> {inventory, txLog, processed, granted, atmDay} (M2, in-memory; Supabase RPC replaces in production)
    // M3 jobs (in-memory mirror of the player_jobs table shape, §5.4):
    // sessionId -> {order, cancelCooldownUntil, completedOrderIds, doctor}
    //   order: {id, slotId, targetX, targetY, poiName, distance, reward,
    //           deadlineAt, idempotencyKey, status, jobType, userId} | null
    //   doctor: {lastRewardedAt, revives: [{victimId, at, rewarded}]}
    this.jobs = new Map();
    // M3 order pool (§6.2 first-come-first-served): 12 fixed delivery slots.
    // A slot is locked while its order is active; on release the slot gets a
    // NEW random target, so the next player always gets a different order.
    // maxClients is 8, so the pool can never run dry in P0.
    this.orderPool = [];
    for (let i = 0; i < 12; i++) {
      const t = M3.pickDeliveryPoint();
      this.orderPool.push({ id: 'ord-' + i, targetX: t.x, targetY: t.y, poiName: t.poiName, lockedBy: null });
    }
    this.orderSeq = 0;
    // M3: orders held when a player disconnects mid-order (§6.2: 30 s to
    // reconnect, then EXPIRED). sessionId -> {order, leftAt}.
    this.heldOrders = new Map();

    this._spawnBots();
    this._spawnNpcs();

    // 100 ms simulation: bot + walker wandering (smooth enough for 20 Hz patches).
    this.setSimulationInterval((dtMs) => this._simStep(dtMs), 100);
    // 1 s tick: world clock + survival + bot proactive chat + bubble expiry.
    this._tickTimer = setInterval(() => this._secondTick(), 1000);
  }

  onDispose() {
    clearInterval(this._tickTimer);
    for (const t of this.pendingBotReplies) clearTimeout(t);
    this.pendingBotReplies.clear();
    stats.rooms -= 1;
  }

  // ---------------------------------------------------------------- spawn
  _spawnBots() {
    for (const persona of BotBrain.PERSONAS) {
      const id = 'bot-' + persona.id;
      const p = randomOpenPointNearSpawn(800);
      const ps = new PlayerState();
      Object.assign(ps, {
        id, name: persona.name, x: p.x, y: p.y, vx: 0, vy: 0,
        anim: 'idle', job: 'unemployed', hp: 100, hunger: 100, stamina: 100,
        cash: 0, bank: 0, isFainted: false, vehicleId: '',
        chatBubble: '', chatBubbleUntil: 0, avatar: persona.avatar,
      });
      this.state.players.set(id, ps);
      this.bots.set(id, {
        personaId: persona.id,
        brain: BotBrain.createBotState(persona.id),
        targetX: p.x, targetY: p.y, pauseUntil: 0,
        speed: randRange(45, 75), // M0 NPC speed range
        nextProactiveAt: Date.now() + randRange(5000, 25000),
      });
      this.clientData.set(id, { isBot: true });
    }
  }

  _spawnNpcs() {
    const guide = new NpcState();
    Object.assign(guide, {
      id: 'npc-guide', type: 'guide', name: 'NPC Hướng Dẫn',
      x: GUIDE_POS.x, y: GUIDE_POS.y, targetX: GUIDE_POS.x, targetY: GUIDE_POS.y,
      avatar: 'guide',
    });
    this.state.npcs.set(guide.id, guide);

    for (let i = 0; i < 10; i++) {
      const p = Colliders.randomOpenPoint();
      const npc = new NpcState();
      Object.assign(npc, {
        id: 'npc-walker-' + i, type: 'walker',
        name: WALKER_NAMES[i % WALKER_NAMES.length],
        x: p.x, y: p.y, targetX: p.x, targetY: p.y,
        avatar: WALKER_AVATARS[i % WALKER_AVATARS.length],
      });
      this.state.npcs.set(npc.id, npc);
      // M3 (§10.2): walkers wander at 90 px/s (was 45-75), pause 3-8 s,
      // and each one has a BotBrain persona so "Nói chuyện" (§10.2) gets a
      // persona line in the matching voice (index-aligned with WALKER_AVATARS).
      this.walkers.set(npc.id, {
        targetX: p.x, targetY: p.y, pauseUntil: 0, speed: 90,
        personaId: WALKER_PERSONAS[i % WALKER_PERSONAS.length],
        lastTalkLine: null,
      });
    }
  }

  // ---------------------------------------------------------------- join/leave
  onJoin(client, options = {}) {
    const p = new PlayerState();
    const spawn = randomOpenPointNearSpawn(200);
    const name = (typeof options.name === 'string' && options.name.trim())
      ? options.name.trim().slice(0, 24) : 'CongDan-' + client.sessionId.slice(0, 4);
    const avatar = (typeof options.avatar === 'string' && options.avatar.trim())
      ? options.avatar.trim().slice(0, 24) : 'hero';
    Object.assign(p, {
      id: client.sessionId, name, x: spawn.x, y: spawn.y, vx: 0, vy: 0,
      anim: 'idle', job: 'unemployed', hp: 100, hunger: 100, stamina: 100,
      cash: 0, bank: 0, // M2 (SRS §4.5/§5.1): profile starts Cash = 0; the
      // 50.000đ starter grant is applied once via starter_grant below
      // (client local / Supabase rpc_starter_grant when connected)
      isFainted: false, vehicleId: '', chatBubble: '', chatBubbleUntil: 0, avatar,
      orderStatus: 'none', orderId: '', orderX: 0, orderY: 0, orderDeadline: 0, orderReward: 0,
    });
    this.state.players.set(client.sessionId, p);
    this.clientData.set(client.sessionId, {
      isBot: false, lastSeq: 0, moveTimes: [], violations: [],
      lastMoveAt: Date.now(), chatTimes: [], econTimes: [], sprinting: false,
    });
    this.economy.set(client.sessionId, {
      inventory: new Map(), txLog: [], processed: new Set(), granted: false,
      atmDay: { date: todayStr(), total: 0 },
    });
    this.survival.set(client.sessionId, { hungerAcc: 0, hpLossAcc: 0, regenAcc: 0, faintedUntil: 0, faintedAt: 0 });
    this.jobs.set(client.sessionId, {
      order: null, cancelCooldownUntil: 0, completedOrderIds: new Set(),
      doctor: { lastRewardedAt: 0, revives: [] },
    });
    stats.humanPlayers += 1;
    console.log(`[city] join ${p.name} (${client.sessionId}) players=${stats.humanPlayers}`);

    this.onMessage('move', (c, msg) => this._onMove(c, msg));
    this.onMessage('chat', (c, msg) => this._onChat(c, msg));
    this.onMessage('interact', (c, msg) => this._onInteract(c, msg));
    // M2 economy messages (validated server-side; see _onShopBuy etc.)
    this.onMessage('starter_grant', (c, msg) => this._onStarterGrant(c, msg));
    this.onMessage('shop_buy', (c, msg) => this._onShopBuy(c, msg));
    this.onMessage('atm_transfer', (c, msg) => this._onAtmTransfer(c, msg));
    this.onMessage('use_item', (c, msg) => this._onUseItem(c, msg));
    // M3: job choice + Shipper orders (§3.4, §6).
    this.onMessage('job', (c, msg) => this._onJob(c, msg));
    this.onMessage('shipper', (c, msg) => this._onShipper(c, msg));
    if (ALLOW_TEST) this.onMessage('__test_set', (c, msg) => this._onTestSet(c, msg));
  }

  // M3 test hook (see ALLOW_TEST above): set the SENDER's own hp/hunger/
  // cash/bank, or force the faint countdown to end (faintMsLeft). The test
  // suite uses it to reach faint/hospital/doctor states without waiting
  // 25 real minutes. Ignored entirely unless DTA_ALLOW_TEST=1.
  _onTestSet(client, msg) {
    const player = this.state.players.get(client.sessionId);
    const sv = this.survival.get(client.sessionId);
    if (!player || !sv || !msg || typeof msg !== 'object') return;
    if (typeof msg.hp === 'number') player.hp = clamp(msg.hp, 0, 100);
    if (typeof msg.hunger === 'number') player.hunger = clamp(msg.hunger, 0, 100);
    if (typeof msg.cash === 'number') player.cash = Math.max(0, Math.floor(msg.cash));
    if (typeof msg.bank === 'number') player.bank = Math.max(0, Math.floor(msg.bank));
    if (typeof msg.x === 'number') player.x = clamp(msg.x, 20, 4780); // Map v2: 4800-20
    if (typeof msg.y === 'number') player.y = clamp(msg.y, 20, 4780);
    if (typeof msg.faintMsLeft === 'number' && player.isFainted) {
      sv.faintedUntil = Date.now() + msg.faintMsLeft;
    }
    console.log(`[city] __test_set ${player.name}: hp=${player.hp} hunger=${player.hunger} cash=${player.cash}`);
  }

  onLeave(client, consented) {
    // M3 (§6.2): a mid-order disconnect holds the order 30 s for reconnect;
    // the 1 s tick expires it after that (see _secondTick heldOrders sweep).
    const job = this.jobs.get(client.sessionId);
    if (job && job.order) {
      this.heldOrders.set(client.sessionId, { order: job.order, leftAt: Date.now() });
    }
    this.state.players.delete(client.sessionId);
    this.clientData.delete(client.sessionId);
    this.economy.delete(client.sessionId);
    this.survival.delete(client.sessionId);
    this.jobs.delete(client.sessionId);
    stats.humanPlayers = Math.max(0, stats.humanPlayers - 1);
    console.log(`[city] leave ${client.sessionId} players=${stats.humanPlayers}`);
  }

  // Send a message to one session (or nothing if they already left).
  _sendTo(sessionId, type, msg) {
    for (const c of this.clients) {
      if (c.sessionId === sessionId) { try { c.send(type, msg); } catch (e) { /* ignore */ } return; }
    }
  }

  // ---------------------------------------------------------------- economy (M2, §4/§5.7)
  // In-memory stubs with the SAME rules as the Supabase RPCs: server-side
  // price table, balance check, amount limits, idempotency (request_id),
  // 5/min rate-limit (SRS §12.3), in-memory tx log. A Supabase-connected
  // deployment replaces these with rpc_* calls — the client protocol
  // (request/response shape) is identical.
  _econCheck(client, msg, type) {
    const data = this.clientData.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!data || !player || data.isBot) return null;
    const now = Date.now();
    const econ = this.economy.get(client.sessionId);
    if (!econ) return null;
    const requestId = msg && typeof msg.request_id === 'string' ? msg.request_id : null;
    // Idempotency FIRST: a retried request is free (no state change) and
    // must answer ALREADY_PROCESSED even if the client is rate-limited —
    // otherwise a legit retry is misreported as RATE_LIMITED.
    if (requestId && econ.processed.has(requestId)) {
      client.send('econ_result', { type: type || 'econ', ok: false, error: 'ALREADY_PROCESSED' });
      return null;
    }
    // Rate-limit: 5 economy messages / minute (SRS §12.3).
    data.econTimes = (data.econTimes || []).filter((t) => now - t < 60000);
    if (data.econTimes.length >= ECON_RATE_LIMIT) {
      client.send('econ_result', { type: 'rate_limited', ok: false, error: 'RATE_LIMITED' });
      return null;
    }
    data.econTimes.push(now);
    if (requestId) econ.processed.add(requestId);
    return { player, econ, requestId };
  }
  _econLog(econ, type, amount, meta) {
    econ.txLog.unshift({ type, amount, at: Date.now(), meta: meta || {} });
    if (econ.txLog.length > 50) econ.txLog.length = 50;
  }
  _isDay() {
    const h = Math.floor((this.state.worldTime || 480) / 60) % 24;
    return h >= 6 && h < 18;
  }
  _onStarterGrant(client, msg) {
    const ctx = this._econCheck(client, msg, 'starter_grant');
    if (!ctx) return;
    const { player, econ } = ctx;
    if (econ.granted) {
      client.send('econ_result', { type: 'starter_grant', ok: false, error: 'ALREADY_GRANTED' });
      return;
    }
    econ.granted = true;
    player.cash += STARTER_GRANT;
    this._econLog(econ, 'starter_grant', STARTER_GRANT, { once: true });
    client.send('econ_result', { type: 'starter_grant', ok: true, cash: player.cash, bank: player.bank });
  }
  _onShopBuy(client, msg) {
    const ctx = this._econCheck(client, msg, 'shop_buy');
    if (!ctx) return;
    const { player, econ, requestId } = ctx;
    const item = SHOP_ITEMS[msg && msg.item_id];
    if (!item) {
      client.send('econ_result', { type: 'shop_buy', ok: false, error: 'ITEM_NOT_FOUND' });
      return;
    }
    const qty = Math.max(1, Math.min(99, (msg.qty | 0) || 1));
    if (dist(player.x, player.y, SHOP_POS.x, SHOP_POS.y) > ECON_RANGE) {
      client.send('econ_result', { type: 'shop_buy', ok: false, error: 'TOO_FAR' });
      return;
    }
    const unit = (this._isDay() && item.dayPrice) ? item.dayPrice : item.price;
    const total = unit * qty;
    if (player.cash < total) {
      client.send('econ_result', { type: 'shop_buy', ok: false, error: 'INSUFFICIENT_FUNDS', need: total, cash: player.cash });
      return;
    }
    player.cash -= total;
    econ.inventory.set(msg.item_id, (econ.inventory.get(msg.item_id) || 0) + qty);
    this._econLog(econ, 'shop_buy', -total, { item_id: msg.item_id, qty, unit_price: unit, request_id: requestId });
    client.send('econ_result', {
      type: 'shop_buy', ok: true, cash: player.cash, bank: player.bank,
      item_id: msg.item_id, qty: econ.inventory.get(msg.item_id), total,
    });
  }
  _onAtmTransfer(client, msg) {
    const ctx = this._econCheck(client, msg, 'atm_transfer');
    if (!ctx) return;
    const { player, econ, requestId } = ctx;
    const amount = Math.floor(msg && msg.amount);
    if (!isFinite(amount) || amount < ATM_MIN || amount > ATM_MAX) {
      client.send('econ_result', { type: 'atm_transfer', ok: false, error: 'AMOUNT_RANGE', min: ATM_MIN, max: ATM_MAX });
      return;
    }
    if (dist(player.x, player.y, BANK_POS.x, BANK_POS.y) > ECON_RANGE) {
      client.send('econ_result', { type: 'atm_transfer', ok: false, error: 'TOO_FAR' });
      return;
    }
    if (econ.atmDay.date !== todayStr()) econ.atmDay = { date: todayStr(), total: 0 };
    if (econ.atmDay.total + amount > ATM_DAY_MAX) {
      client.send('econ_result', { type: 'atm_transfer', ok: false, error: 'DAILY_LIMIT', dayMax: ATM_DAY_MAX, used: econ.atmDay.total });
      return;
    }
    const action = msg.action;
    if (action === 'deposit') {
      if (player.cash < amount) {
        client.send('econ_result', { type: 'atm_transfer', ok: false, error: 'INSUFFICIENT_FUNDS' });
        return;
      }
      player.cash -= amount; player.bank += amount;
    } else if (action === 'withdraw') {
      if (player.bank < amount) {
        client.send('econ_result', { type: 'atm_transfer', ok: false, error: 'INSUFFICIENT_FUNDS' });
        return;
      }
      player.bank -= amount; player.cash += amount;
    } else {
      client.send('econ_result', { type: 'atm_transfer', ok: false, error: 'BAD_ACTION' });
      return;
    }
    econ.atmDay.total += amount;
    this._econLog(econ, 'atm', action === 'deposit' ? -amount : amount, { action, request_id: requestId });
    client.send('econ_result', { type: 'atm_transfer', ok: true, cash: player.cash, bank: player.bank, dayUsed: econ.atmDay.total });
  }
  _onUseItem(client, msg) {
    const ctx = this._econCheck(client, msg, 'use_item');
    if (!ctx) return;
    const { player, econ } = ctx;
    const item = SHOP_ITEMS[msg && msg.item_id];
    if (!item) {
      client.send('econ_result', { type: 'use_item', ok: false, error: 'ITEM_NOT_FOUND' });
      return;
    }
    const have = econ.inventory.get(msg.item_id) || 0;
    if (have < 1) {
      client.send('econ_result', { type: 'use_item', ok: false, error: 'NO_ITEM' });
      return;
    }
    econ.inventory.set(msg.item_id, have - 1);
    if (item.hunger) player.hunger = Math.min(100, player.hunger + item.hunger);
    if (item.stamina) player.stamina = Math.min(100, player.stamina + item.stamina);
    this._econLog(econ, 'use_item', 0, { item_id: msg.item_id });
    client.send('econ_result', {
      type: 'use_item', ok: true, hunger: player.hunger, stamina: player.stamina,
      left: econ.inventory.get(msg.item_id), cash: player.cash, bank: player.bank,
    });
  }

  // ---------------------------------------------------------------- movement (§7.4, 6 steps)
  _onMove(client, msg) {
    const data = this.clientData.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!data || !player) return;
    const now = Date.now();

    // 1. Validate input format.
    if (!msg || typeof msg !== 'object') return;
    const dx = msg.dx, dy = msg.dy, sprint = msg.sprint, seq = msg.seq;
    if (typeof dx !== 'number' || typeof dy !== 'number' || !isFinite(dx) || !isFinite(dy)
      || dx < -1 || dx > 1 || dy < -1 || dy > 1 || typeof sprint !== 'boolean'
      || typeof seq !== 'number' || !Number.isInteger(seq)) {
      console.log(`[city] bad move from ${client.sessionId}: ${JSON.stringify(msg)}`);
      return;
    }
    const len = Math.hypot(dx, dy);
    if (len > 1 + 1e-6) { this._violation(client, 'move-vector'); return; }
    if (seq <= data.lastSeq) return; // stale / duplicate
    data.lastSeq = seq;
    if (player.isFainted) return; // fainted players cannot move

    // Rate-limit: 30 move/s.
    data.moveTimes = data.moveTimes.filter((t) => now - t < 1000);
    if (data.moveTimes.length >= 30) {
      console.log(`[city] move rate-limit ${client.sessionId}`);
      return;
    }
    data.moveTimes.push(now);

    // 2. Speed check: displacement the server itself integrates can never
    // exceed maxSpeed * dt; a dt anomaly is still treated as a violation.
    const dt = clamp((now - data.lastMoveAt) / 1000, 0, 0.5);
    data.lastMoveAt = now;

    // 3. Stamina: sprint blocked below 10 (fall back to walk).
    let sprinting = sprint && len > 0;
    if (sprinting && player.stamina < 10) sprinting = false;
    data.sprinting = sprinting; // M3: the 1 s tick regens stamina while idle
    let speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (player.hunger < 20) speed *= 0.7; // SRS §3.2.2
    if (sprinting) player.stamina = clamp(player.stamina - 5 * dt, 0, 100);
    else player.stamina = clamp(player.stamina + 3 * dt, 0, 100);

    const displacement = speed * dt * len;
    if (displacement > speed * dt * 1.1 + 1) { this._violation(client, 'speed-hack'); return; }

    // 4. Collision vs buildings + fences + fountain (slide along walls) + 5. update position.
    const r = 16; // 32x32 hitbox, SRS §7.3
    let nx = player.x + dx * speed * dt;
    let ny = player.y + dy * speed * dt;
    if (blocked(nx, ny, r)) {
      if (!blocked(nx, player.y, r)) ny = player.y; // slide on X
      else if (!blocked(player.x, ny, r)) nx = player.x; // slide on Y
      else { nx = player.x; ny = player.y; }
    }
    nx = clamp(nx, 20, 4780); ny = clamp(ny, 20, 4780);
    player.x = nx; player.y = ny;
    player.vx = dx * speed; player.vy = dy * speed;
    player.anim = len === 0 ? 'idle' : (sprinting ? 'sprint' : 'walk');
  }

  _violation(client, kind) {
    const data = this.clientData.get(client.sessionId);
    if (!data) return;
    const now = Date.now();
    data.violations = data.violations.filter((t) => now - t < 60000);
    data.violations.push(now);
    console.log(`[city] violation ${kind} from ${client.sessionId} (${data.violations.length}/5 per min)`);
    if (data.violations.length >= 5) {
      console.log(`[city] kicking ${client.sessionId} for repeated violations`);
      try { client.leave(); } catch (e) { console.log('[city] kick failed:', e.message); }
    }
  }

  // ---------------------------------------------------------------- chat (§10)
  _onChat(client, msg) {
    const data = this.clientData.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!data || !player) return;
    const now = Date.now();

    if (!msg || typeof msg !== 'object' || typeof msg.text !== 'string') return;
    const text = msg.text.trim();
    const channel = msg.channel;
    if (!['world', 'nearby', 'private'].includes(channel)) return;
    if (text.length === 0 || text.length > 200) {
      console.log(`[city] chat rejected (length ${text.length}) from ${client.sessionId}`);
      return;
    }
    // Spam: max 5 msgs / 10 s (6th dropped + logged, SRS §10.1).
    data.chatTimes = data.chatTimes.filter((t) => now - t < 10000);
    if (data.chatTimes.length >= 5) {
      console.log(`[city] chat spam dropped from ${player.name}: "${text.slice(0, 60)}"`);
      return;
    }
    data.chatTimes.push(now);
    // Absolute filter (no toggle): links + phone numbers (SRS §10.3).
    if (/https?:\/\/|www\.|(\d[\s\-]?){9,}/i.test(text)) {
      console.log(`[city] chat blocked (link/phone) from ${player.name}: "${text.slice(0, 60)}"`);
      return;
    }

    // Chat bubble on the sender for every channel (4 s).
    player.chatBubble = text.slice(0, 120);
    player.chatBubbleUntil = now + CHAT_BUBBLE_MS;

    const out = {
      fromId: client.sessionId, fromName: player.name,
      channel, text, targetId: msg.targetId || null, at: now,
    };
    if (channel === 'world') {
      this.broadcast('chat', out);
      this._maybeBotReply(null, text, player.name, player.x, player.y);
    } else if (channel === 'nearby') {
      for (const c of this.clients) {
        const p = this.state.players.get(c.sessionId);
        if (p && dist(p.x, p.y, player.x, player.y) <= NEARBY_RADIUS) c.send('chat', out);
      }
      this._maybeBotReply(NEARBY_RADIUS, text, player.name, player.x, player.y);
    } else { // private
      const target = msg.targetId ? this.state.players.get(msg.targetId) : null;
      if (!target) { client.send('chat_error', { error: 'TARGET_NOT_FOUND' }); return; }
      client.send('chat', out);
      if (this.bots.has(msg.targetId)) {
        // Private chat with a bot: the bot answers directly.
        this._scheduleBotReply(msg.targetId, text, player.name);
      } else {
        for (const c of this.clients) {
          if (c.sessionId === msg.targetId) c.send('chat', out);
        }
      }
    }
  }

  _maybeBotReply(maxDist, text, playerName, px, py) {
    // Prefer a bot explicitly called by name; else one random bot in range.
    const called = this._findCalledBot(text);
    const candidates = [];
    for (const [botId, bot] of this.bots) {
      const p = this.state.players.get(botId);
      if (!p) continue;
      if (maxDist !== null && dist(p.x, p.y, px, py) > maxDist) continue;
      candidates.push(botId);
    }
    if (!candidates.length) return;
    let chosen = called && candidates.includes(called) ? called
      : candidates[Math.floor(Math.random() * candidates.length)];
    // World chat: at most one bot answers per message (avoid a chorus).
    this._scheduleBotReply(chosen, text, playerName);
  }

  _findCalledBot(text) {
    const norm = BotBrain.stripDiacritics(text);
    for (const persona of BotBrain.PERSONAS) {
      for (const call of persona.callNames) {
        if (norm.includes(call)) return 'bot-' + persona.id;
      }
    }
    return null;
  }

  _scheduleBotReply(botId, text, playerName) {
    const bot = this.bots.get(botId);
    const botPlayer = this.state.players.get(botId);
    if (!bot || !botPlayer) return;
    const delay = randRange(1000, 3000); // human-like 1-3 s delay, SRS §10.3
    const timer = setTimeout(() => {
      this.pendingBotReplies.delete(timer);
      if (!this.state || !this.state.players.has(botId)) return;
      const reply = BotBrain.respond(bot.personaId, text, playerName, bot.brain);
      if (!reply) return; // bot stays silent sometimes
      const now = Date.now();
      botPlayer.chatBubble = reply.slice(0, 120);
      botPlayer.chatBubbleUntil = now + CHAT_BUBBLE_MS;
      this.broadcast('chat', {
        fromId: botId, fromName: botPlayer.name,
        channel: 'world', text: reply, targetId: null, at: now,
      });
    }, delay);
    this.pendingBotReplies.add(timer);
  }

  _speakProactively(botId) {
    const bot = this.bots.get(botId);
    const botPlayer = this.state.players.get(botId);
    if (!bot || !botPlayer) return;
    const persona = BotBrain.PERSONAS.find((p) => p.id === bot.personaId);
    const line = persona.lines.filter((l) => l !== bot.brain.lastLine);
    const chosen = line[Math.floor(Math.random() * line.length)];
    bot.brain.lastLine = chosen;
    bot.brain.lastSpokeAt = Date.now();
    botPlayer.chatBubble = chosen.slice(0, 120);
    botPlayer.chatBubbleUntil = Date.now() + CHAT_BUBBLE_MS;
    this.broadcast('chat', {
      fromId: botId, fromName: botPlayer.name,
      channel: 'nearby', text: chosen, targetId: null, at: Date.now(),
    });
  }

  // ---------------------------------------------------------------- interact (M1 revive + M3 doctor/hospital/talk)
  _onInteract(client, msg) {
    const player = this.state.players.get(client.sessionId);
    if (!msg || typeof msg !== 'object' || !player) return;
    if (msg.action === 'revive') {
      const target = msg.targetId ? this.state.players.get(msg.targetId) : null;
      if (!target || !target.isFainted) {
        client.send('interact_error', { error: 'INVALID_TARGET' });
        return;
      }
      if (dist(player.x, player.y, target.x, target.y) > M3.REVIVE_RANGE) {
        client.send('interact_error', { error: 'TOO_FAR' });
        return;
      }
      target.hp = 30; target.stamina = 50; target.isFainted = false; target.anim = 'idle';
      const sv = this.survival.get(msg.targetId);
      if (sv) { sv.faintedUntil = 0; sv.faintedAt = 0; }
      // M3 (§3.4.3): only a doctor gets the 25.000đ SYSTEM reward, with
      // anti-farm caps. Anyone can revive, but a non-doctor earns 0đ.
      const reward = this._doctorReviveReward(client.sessionId, msg.targetId);
      console.log(`[city] ${player.name} revived ${target.name} (reward ${reward.reward}đ, ${reward.reason})`);
      this.broadcast('revived', {
        byId: client.sessionId, byName: player.name, targetId: msg.targetId,
        reward: reward.reward, reason: reward.reason, job: player.job,
      });
    } else if (msg.action === 'hospital') {
      // M3 (§3.2.4): "Về Bệnh viện" — only for the fainted sender, only
      // after 10 s of fainting. Same hospital revive as the 60 s auto-revive.
      if (!player.isFainted) {
        client.send('interact_error', { error: 'INVALID_TARGET' });
        return;
      }
      const sv = this.survival.get(client.sessionId);
      if (!sv || Date.now() - (sv.faintedAt || 0) < M3.HOSPITAL_BUTTON_DELAY_S * 1000) {
        client.send('interact_error', { error: 'TOO_EARLY' });
        return;
      }
      this._hospitalRevive(player, sv);
      client.send('job_result', { type: 'hospital', ok: true, cash: player.cash, bank: player.bank });
    } else if (msg.action === 'talk') {
      // M3 (§10.2): talk to an NPC within 120 px. Guide -> tutorial quest;
      // walker -> one random line from its persona (BotBrain).
      const npc = msg.targetId ? this.state.npcs.get(msg.targetId) : null;
      if (!npc) {
        client.send('interact_error', { error: 'INVALID_TARGET' });
        return;
      }
      if (dist(player.x, player.y, npc.x, npc.y) > M3.TALK_RANGE) {
        client.send('interact_error', { error: 'TOO_FAR' });
        return;
      }
      if (npc.type === 'guide') {
        client.send('npc_talk', {
          npcId: npc.id, name: npc.name, isGuide: true, x: npc.x, y: npc.y,
          text: 'Chào Công Dân mới! Nhiệm vụ tân thủ của bạn:',
          quest: [
            '1. Nói chuyện với NPC Hướng Dẫn — nhận 50.000đ vốn khởi nghiệp',
            '2. Mua 1 Bánh mì ở Cửa Hàng Tiện Lợi và ăn (+40 Độ no)',
            '3. Làm Shipper: nhận 1 đơn ở Kho Hàng và giao thành công',
            '4. Gửi 20.000đ vào Bank tại ATM',
            '5. Hoàn thành cả 4 bước — thưởng 30.000đ + danh hiệu "Công dân chính thức"',
          ],
        });
        return;
      }
      const w = this.walkers.get(npc.id);
      const personaId = (w && w.personaId) || 'mai';
      const persona = BotBrain.PERSONAS.find((pp) => pp.id === personaId) || BotBrain.PERSONAS[0];
      const pool = persona.lines.filter((l) => !w || l !== w.lastTalkLine);
      const line = pool.length ? pool[Math.floor(Math.random() * pool.length)] : persona.lines[0];
      if (w) w.lastTalkLine = line;
      client.send('npc_talk', {
        npcId: npc.id, name: npc.name, isGuide: false, x: npc.x, y: npc.y,
        personaId: persona.id, text: line,
      });
    } else {
      client.send('interact_error', { error: 'NOT_IMPLEMENTED_M1', action: msg.action || null });
    }
  }

  // M3 (§3.4.3): doctor revive reward + anti-farm. Returns {reward, reason}.
  // The revive itself always succeeds; only the REWARD is capped.
  _doctorReviveReward(doctorId, victimId) {
    const now = Date.now();
    const doctor = this.state.players.get(doctorId);
    const jobEntry = this.jobs.get(doctorId);
    const econ = this.economy.get(doctorId);
    if (!doctor || !jobEntry || !econ) return { reward: 0, reason: 'NO_STATE' };
    const d = jobEntry.doctor;
    const oneHourAgo = now - 3600 * 1000;
    const revivesLastHour = d.revives.filter(
      (r) => r.victimId === victimId && r.rewarded && r.at > oneHourAgo).length;
    const check = M3.doctorRewardCheck(doctor.job, now, d.lastRewardedAt, revivesLastHour);
    // Count this pair's revives today for the collusion flag (§3.4.3).
    const today = todayStr();
    const pairToday = d.revives.filter(
      (r) => r.victimId === victimId && new Date(r.at).toISOString().slice(0, 10) === today).length + 1;
    const flagged = M3.collusionFlagged(pairToday);
    d.revives.push({ victimId, at: now, rewarded: check.reward > 0 });
    if (d.revives.length > 200) d.revives.splice(0, d.revives.length - 200);
    if (check.reward > 0) {
      d.lastRewardedAt = now;
      doctor.cash += check.reward;
      this._econLog(econ, 'job_reward', check.reward, {
        job: 'revive', doctor_id: doctorId, victim_id: victimId,
        flag: flagged ? 'suspected_collusion' : undefined,
      });
    } else if (flagged) {
      // Even a 0đ revive is logged when the pair looks collusive.
      this._econLog(econ, 'job_reward', 0, {
        job: 'revive', doctor_id: doctorId, victim_id: victimId,
        flag: 'suspected_collusion',
      });
    }
    return { reward: check.reward, reason: check.reason, flagged };
  }

  // M3 (§3.2.4/§3.2.5): hospital revive — 50 HP, 50 stamina, teleport to
  // the hospital, fee = 10.000 + 50% of Cash remaining after the faint loss.
  // Cash first, then Bank; never negative, never debt. Fee is a sink.
  _hospitalRevive(player, sv) {
    const fee = M3.hospitalFee(player.cash);
    const after = M3.deductFee(player.cash, player.bank, fee);
    player.cash = after.cash; player.bank = after.bank;
    const econ = this.economy.get(player.id);
    if (econ) this._econLog(econ, 'hospital_fee', -after.paid, { fee, cash_after: after.cash });
    player.x = HOSPITAL.x; player.y = HOSPITAL.y;
    player.hp = 50; player.stamina = 50; player.isFainted = false; player.anim = 'idle';
    if (sv) { sv.faintedUntil = 0; sv.faintedAt = 0; }
    console.log(`[city] ${player.name} hospital revive (fee ${after.paid}đ, cash now ${player.cash}, bank ${player.bank})`);
  }

  // ---------------------------------------------------------------- jobs (M3: §3.4 job choice, §6 Shipper)
  _syncOrderState(player, order) {
    if (!player) return;
    if (!order) {
      player.orderStatus = 'none'; player.orderId = '';
      player.orderX = 0; player.orderY = 0; player.orderDeadline = 0; player.orderReward = 0;
    } else {
      player.orderStatus = 'accepted'; player.orderId = order.id;
      player.orderX = order.targetX; player.orderY = order.targetY;
      player.orderDeadline = order.deadlineAt; player.orderReward = order.reward;
    }
  }

  // Release an order slot back to the pool with a FRESH random target, so
  // the next player always gets a different order (§6.2 ORDER_TAKEN rule).
  _releaseOrderSlot(order) {
    if (!order) return;
    const slot = this.orderPool.find((s) => s.id === order.slotId);
    if (!slot) return;
    slot.lockedBy = null;
    const t = M3.pickDeliveryPoint();
    slot.targetX = t.x; slot.targetY = t.y; slot.poiName = t.poiName;
  }

  // Fail the player's active order (faint mid-order, §6.2): no reward, no
  // extra penalty beyond the faint itself. Notifies the client.
  _failActiveOrder(sessionId, reason) {
    const jobEntry = this.jobs.get(sessionId);
    if (!jobEntry || !jobEntry.order) return;
    const order = jobEntry.order;
    order.status = 'failed';
    this._releaseOrderSlot(order);
    jobEntry.order = null;
    const player = this.state.players.get(sessionId);
    this._syncOrderState(player, null);
    this._sendTo(sessionId, 'job_result', { type: 'shipper', ok: false, error: 'FAILED', orderId: order.id, reason: reason || 'fainted' });
  }

  _onJob(client, msg) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !msg || typeof msg !== 'object') return;
    const job = msg.job;
    if (!M3.JOBS.includes(job)) {
      client.send('job_result', { type: 'job', ok: false, error: 'BAD_JOB', job: job || null });
      return;
    }
    const jobEntry = this.jobs.get(client.sessionId);
    // Cannot abandon Shipper mid-order: finish / cancel it first (§6.2:
    // max 1 order, and the order belongs to the Shipper job).
    if (jobEntry && jobEntry.order && job !== 'shipper') {
      client.send('job_result', { type: 'job', ok: false, error: 'ACTIVE_ORDER' });
      return;
    }
    player.job = job;
    client.send('job_result', { type: 'job', ok: true, job });
    console.log(`[city] ${player.name} job -> ${job}`);
  }

  _onShipper(client, msg) {
    const player = this.state.players.get(client.sessionId);
    const jobEntry = this.jobs.get(client.sessionId);
    const econ = this.economy.get(client.sessionId);
    if (!player || !jobEntry || !econ || !msg || typeof msg !== 'object') return;
    const action = msg.action;
    const now = Date.now();

    if (action === 'accept') {
      if (player.job !== 'shipper') {
        client.send('job_result', { type: 'shipper', ok: false, error: 'NOT_SHIPPER' });
        return;
      }
      if (player.isFainted) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'FAINTED' });
        return;
      }
      if (jobEntry.order) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'ALREADY_HAVE_ORDER', orderId: jobEntry.order.id });
        return;
      }
      if (now < jobEntry.cancelCooldownUntil) {
        client.send('job_result', {
          type: 'shipper', ok: false, error: 'COOLDOWN',
          retryAfterSec: Math.ceil((jobEntry.cancelCooldownUntil - now) / 1000),
        });
        return;
      }
      if (dist(player.x, player.y, M3.WAREHOUSE_POS.x, M3.WAREHOUSE_POS.y) > M3.SHIPPER_RANGE) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'TOO_FAR' });
        return;
      }
      const slot = this.orderPool.find((s) => !s.lockedBy);
      if (!slot) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'ORDER_TAKEN' });
        return;
      }
      slot.lockedBy = client.sessionId;
      const distance = Math.round(dist(player.x, player.y, slot.targetX, slot.targetY));
      const seconds = M3.deliverySeconds(distance, M3.WALK_SPEED); // M3: on foot (bike is M4)
      const order = {
        id: slot.id + '-' + (++this.orderSeq),
        slotId: slot.id, targetX: slot.targetX, targetY: slot.targetY, poiName: slot.poiName,
        distance, reward: M3.deliveryReward(distance, M3.isNightWorld(this.state.worldTime)),
        deadlineAt: now + seconds * 1000, idempotencyKey: randomUUID(),
        status: 'accepted', jobType: 'delivery', userId: client.sessionId,
      };
      jobEntry.order = order;
      this._syncOrderState(player, order);
      client.send('job_result', {
        type: 'shipper', ok: true, action: 'accept',
        order: {
          id: order.id, targetX: order.targetX, targetY: order.targetY, poiName: order.poiName,
          distance: order.distance, reward: order.reward, deadlineAt: order.deadlineAt,
          secondsLeft: seconds,
        },
      });
      console.log(`[city] ${player.name} accepted ${order.id} -> (${order.targetX},${order.targetY}) ${distance}px ${seconds}s reward ${order.reward}đ`);
      return;
    }

    if (action === 'complete') {
      // Idempotency FIRST (§4.3): a retried complete of an already-paid
      // order answers ALREADY_PROCESSED and pays nothing twice.
      if (msg.orderId && jobEntry.completedOrderIds.has(msg.orderId)) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'ALREADY_PROCESSED', orderId: msg.orderId });
        return;
      }
      const order = jobEntry.order;
      if (!order || (msg.orderId && msg.orderId !== order.id)) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'NO_ORDER' });
        return;
      }
      if (player.isFainted) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'FAINTED' });
        return;
      }
      if (now > order.deadlineAt) {
        order.status = 'expired';
        this._releaseOrderSlot(order);
        jobEntry.order = null;
        this._syncOrderState(player, null);
        client.send('job_result', { type: 'shipper', ok: false, error: 'EXPIRED', orderId: order.id });
        return;
      }
      if (dist(player.x, player.y, order.targetX, order.targetY) > M3.DELIVER_RANGE) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'TOO_FAR', needPx: M3.DELIVER_RANGE });
        return;
      }
      order.status = 'delivered';
      jobEntry.completedOrderIds.add(order.id);
      this._releaseOrderSlot(order);
      jobEntry.order = null;
      this._syncOrderState(player, null);
      player.cash += order.reward;
      this._econLog(econ, 'job_reward', order.reward, {
        job: 'delivery', delivery_id: order.id, distance_px: order.distance,
        idempotency_key: order.idempotencyKey,
      });
      client.send('job_result', {
        type: 'shipper', ok: true, action: 'complete',
        orderId: order.id, reward: order.reward, cash: player.cash, bank: player.bank,
      });
      console.log(`[city] ${player.name} delivered ${order.id} +${order.reward}đ (cash ${player.cash})`);
      return;
    }

    if (action === 'cancel') {
      const order = jobEntry.order;
      if (!order) {
        client.send('job_result', { type: 'shipper', ok: false, error: 'NO_ORDER' });
        return;
      }
      order.status = 'cancelled';
      this._releaseOrderSlot(order);
      jobEntry.order = null;
      this._syncOrderState(player, null);
      jobEntry.cancelCooldownUntil = now + M3.ORDER_CANCEL_COOLDOWN_S * 1000;
      client.send('job_result', { type: 'shipper', ok: true, action: 'cancel', orderId: order.id });
      console.log(`[city] ${player.name} cancelled ${order.id} (10 s cooldown)`);
      return;
    }

    if (action === 'status') {
      const order = jobEntry.order;
      client.send('job_result', {
        type: 'shipper', ok: true, action: 'status',
        order: order ? {
          id: order.id, targetX: order.targetX, targetY: order.targetY, poiName: order.poiName,
          distance: order.distance, reward: order.reward, deadlineAt: order.deadlineAt,
          secondsLeft: Math.max(0, Math.ceil((order.deadlineAt - now) / 1000)),
        } : null,
        cancelCooldownSec: Math.max(0, Math.ceil((jobEntry.cancelCooldownUntil - now) / 1000)),
      });
      return;
    }

    client.send('job_result', { type: 'shipper', ok: false, error: 'BAD_ACTION', action: action || null });
  }

  // ---------------------------------------------------------------- simulation
  _simStep(dtMs) {
    const dt = dtMs / 1000;
    // Bots: walk to target, pause 3-8 s, pick a new open target.
    for (const [botId, bot] of this.bots) {
      const p = this.state.players.get(botId);
      if (!p) continue;
      this._wander(p, bot, dt);
    }
    for (const [npcId, w] of this.walkers) {
      const n = this.state.npcs.get(npcId);
      if (!n) continue;
      this._wanderNpc(n, w, dt);
    }
  }

  _wander(p, bot, dt) {
    const now = Date.now();
    if (now < bot.pauseUntil) { p.vx = 0; p.vy = 0; if (p.anim !== 'idle') p.anim = 'idle'; return; }
    const d = dist(p.x, p.y, bot.targetX, bot.targetY);
    if (d < 8) {
      bot.pauseUntil = now + randRange(3000, 8000);
      p.vx = 0; p.vy = 0; p.anim = 'idle';
      const t = randomOpenPointNearSpawn(1200);
      bot.targetX = t.x; bot.targetY = t.y;
      return;
    }
    const step = bot.speed * dt;
    const nx = p.x + ((bot.targetX - p.x) / d) * step;
    const ny = p.y + ((bot.targetY - p.y) / d) * step;
    if (!blocked(nx, ny, 16)) { p.x = nx; p.y = ny; }
    else { const t = randomOpenPointNearSpawn(1200); bot.targetX = t.x; bot.targetY = t.y; }
    p.vx = ((bot.targetX - p.x) / d) * bot.speed;
    p.vy = ((bot.targetY - p.y) / d) * bot.speed;
    p.anim = 'walk';
  }

  _wanderNpc(n, w, dt) {
    const now = Date.now();
    if (now < w.pauseUntil) return;
    const d = dist(n.x, n.y, w.targetX, w.targetY);
    if (d < 8) {
      w.pauseUntil = now + randRange(3000, 8000);
      const t = Colliders.randomOpenPoint();
      w.targetX = t.x; w.targetY = t.y; n.targetX = t.x; n.targetY = t.y;
      return;
    }
    const step = w.speed * dt;
    const nx = n.x + ((w.targetX - n.x) / d) * step;
    const ny = n.y + ((w.targetY - n.y) / d) * step;
    if (!blocked(nx, ny, 16)) { n.x = nx; n.y = ny; }
    else { const t = Colliders.randomOpenPoint(); w.targetX = t.x; w.targetY = t.y; n.targetX = t.x; n.targetY = t.y; }
  }

  // 1 s tick: world clock, survival, faint auto-revive, bot proactive chat.
  _secondTick() {
    if (!this.state) return;
    const now = Date.now();
    this.state.worldTime = (this.state.worldTime + 1) % 1440; // 1 game-min / real sec

    for (const [id, p] of this.state.players) {
      // Expire chat bubbles.
      if (p.chatBubble && now > p.chatBubbleUntil) p.chatBubble = '';
      if (this.bots.has(id)) continue; // bots don't hunger/faint
      const sv = this.survival.get(id);
      if (!sv) continue;
      if (p.isFainted) {
        if (sv.faintedUntil && now >= sv.faintedUntil) {
          // Auto-revive at hospital after 60 s (§3.2.4/§3.2.5): fee, not
          // a second 50% loss — the faint loss was already taken at faint
          // time (see below).
          this._hospitalRevive(p, sv);
        }
        continue;
      }
      // M3: stamina regens +3/s while idle too. _onMove only regens on
      // move messages, and an idle client sends none — without this, a
      // standing player's stamina would never recover server-side.
      const data = this.clientData.get(id);
      if (data && !data.sprinting && now - (data.lastMoveAt || 0) > 1000) {
        p.stamina = clamp(p.stamina + 3, 0, 100);
      }
      // Hunger -1 / 15 s.
      if (++sv.hungerAcc >= 15) { sv.hungerAcc = 0; p.hunger = Math.max(0, p.hunger - 1); }
      if (p.hunger === 0) {
        // -2 HP / 10 s.
        if (++sv.hpLossAcc >= 10) {
          sv.hpLossAcc = 0; p.hp = Math.max(0, p.hp - 2);
          sv.regenAcc = 0;
        }
      } else {
        sv.hpLossAcc = 0;
        if (p.hunger > 50) {
          // Regen +1 HP / 10 s, only when Hunger > 50 and not fainted.
          if (++sv.regenAcc >= 10) { sv.regenAcc = 0; p.hp = Math.min(100, p.hp + 1); }
        } else sv.regenAcc = 0;
      }
      if (p.hp <= 0) {
        p.hp = 0; p.isFainted = true; p.anim = 'fainted'; p.vx = 0; p.vy = 0;
        sv.faintedUntil = now + FAINT_SECONDS * 1000;
        sv.faintedAt = now;
        // M3 (§3.2.3): lose 50% Cash IMMEDIATELY on fainting (sink, Bank
        // untouched), logged as faint_loss. The hospital fee later is
        // charged on the REMAINING cash (§3.2.5).
        const lost = M3.faintLoss(p.cash);
        p.cash -= lost;
        const econ = this.economy.get(id);
        if (econ) this._econLog(econ, 'faint_loss', -lost, { cash_after: p.cash });
        console.log(`[city] ${p.name} fainted (60 s countdown, lost ${lost}đ, cash now ${p.cash})`);
        // M3 (§6.2): fainting mid-order fails the order, no reward.
        this._failActiveOrder(id, 'fainted');
        // M3 (§3.4.3): alert doctors (job='doctor') with coordinates —
        // shown on their minimap + system chat.
        for (const c of this.clients) {
          const dp = this.state.players.get(c.sessionId);
          if (dp && dp.job === 'doctor' && c.sessionId !== id) {
            try { c.send('faint_alert', { playerId: id, name: p.name, x: p.x, y: p.y, at: now }); } catch (e) { /* ignore */ }
          }
        }
      }
    }

    // M3 (§6.2): expire overdue orders (no reward, no penalty) and release
    // their slots; held orders from disconnected players expire after 30 s.
    for (const [sid, jobEntry] of this.jobs) {
      const order = jobEntry.order;
      if (order && now > order.deadlineAt) {
        order.status = 'expired';
        this._releaseOrderSlot(order);
        jobEntry.order = null;
        const player = this.state.players.get(sid);
        this._syncOrderState(player, null);
        this._sendTo(sid, 'job_result', { type: 'shipper', ok: false, error: 'EXPIRED', orderId: order.id });
        console.log(`[city] order ${order.id} EXPIRED`);
      }
    }
    for (const [sid, held] of this.heldOrders) {
      if (now - held.leftAt > 30000) {
        held.order.status = 'expired';
        this._releaseOrderSlot(held.order);
        this.heldOrders.delete(sid);
        console.log(`[city] held order ${held.order.id} EXPIRED (no reconnect in 30 s)`);
      }
    }

    // Bot proactive chat: max 1 line per 20-40 s per bot, only with a human nearby.
    for (const [botId, bot] of this.bots) {
      if (now < bot.nextProactiveAt) continue;
      bot.nextProactiveAt = now + randRange(20000, 40000);
      const bp = this.state.players.get(botId);
      if (!bp) continue;
      let humanNear = false;
      for (const [id, p] of this.state.players) {
        if (this.bots.has(id)) continue;
        if (dist(p.x, p.y, bp.x, bp.y) <= NEARBY_RADIUS) { humanNear = true; break; }
      }
      if (humanNear) this._speakProactively(botId);
    }
  }
}

module.exports = { CityRoom };
