/* Đô Thị Ảo — server/rooms/CityRoom.js
   M1 Colyseus room "city": authoritative movement (§7.4), survival (§3.2),
   chat + Bot AI (§10), NPC/bot wandering. Plain JS, Colyseus 0.15.
   Bots live in state.players (they look like normal players to the client);
   the guide + walkers live in state.npcs. */
const { Room } = require('colyseus');
const { PlayerState, NpcState, CityRoomState } = require('../schema');
const Colliders = require('../../shared/colliders');
const BotBrain = require('../../shared/botBrain');
const stats = require('../stats');

const WALK_SPEED = 180, SPRINT_SPEED = 300;
const HOSPITAL = { x: 2750, y: 1090 }; // SRS §3.1 POI
const GUIDE_POS = { x: 1600, y: 1520 };
const SPAWN = { x: 1600, y: 1750 };
const CHAT_BUBBLE_MS = 4000;
const NEARBY_RADIUS = 600;
const FAINT_SECONDS = 60;

const WALKER_NAMES = ['An', 'Bình', 'Chi', 'Dũng', 'Hà', 'Khánh', 'Linh', 'Minh', 'Ngọc', 'Phúc', 'Thu', 'Tuấn'];
const WALKER_AVATARS = ['student', 'hero', 'bread', 'shipper', 'taxi'];

// M2 economy (§4/§5.7): server price table — the client never sets prices.
// Mirrors game_items seed (supabase/migrations/001_m2.sql). When Supabase is
// connected the RPCs replace these in-memory stubs (same rules, same limits).
const SHOP_ITEMS = {
  banh_mi: { price: 15000, dayPrice: 13500, hunger: 40, stamina: 0 },
  nuoc_tang_luc: { price: 10000, dayPrice: 10000, hunger: 0, stamina: 50 },
};
const STARTER_GRANT = 50000;
const ATM_MIN = 1000, ATM_MAX = 200000, ATM_DAY_MAX = 500000;
const SHOP_POS = { x: 1930, y: 1060 }; // Cửa Hàng Tiện Lợi POI
const BANK_POS = { x: 1100, y: 1060 }; // Ngân Hàng & ATM POI
const ECON_RANGE = 300;
const ECON_RATE_LIMIT = 5; // max 5 economy messages / minute per player (SRS §12.3)
function todayStr() { return new Date().toISOString().slice(0, 10); }

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function randRange(a, b) { return a + Math.random() * (b - a); }
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
      this.walkers.set(npc.id, {
        targetX: p.x, targetY: p.y, pauseUntil: 0, speed: randRange(45, 75),
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
    });
    this.state.players.set(client.sessionId, p);
    this.clientData.set(client.sessionId, {
      isBot: false, lastSeq: 0, moveTimes: [], violations: [],
      lastMoveAt: Date.now(), chatTimes: [], econTimes: [],
    });
    this.economy.set(client.sessionId, {
      inventory: new Map(), txLog: [], processed: new Set(), granted: false,
      atmDay: { date: todayStr(), total: 0 },
    });
    this.survival.set(client.sessionId, { hungerAcc: 0, hpLossAcc: 0, regenAcc: 0, faintedUntil: 0 });
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
  }

  onLeave(client, consented) {
    this.state.players.delete(client.sessionId);
    this.clientData.delete(client.sessionId);
    this.economy.delete(client.sessionId);
    this.survival.delete(client.sessionId);
    stats.humanPlayers = Math.max(0, stats.humanPlayers - 1);
    console.log(`[city] leave ${client.sessionId} players=${stats.humanPlayers}`);
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
    let speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
    if (player.hunger < 20) speed *= 0.7; // SRS §3.2.2
    if (sprinting) player.stamina = clamp(player.stamina - 5 * dt, 0, 100);
    else player.stamina = clamp(player.stamina + 3 * dt, 0, 100);

    const displacement = speed * dt * len;
    if (displacement > speed * dt * 1.1 + 1) { this._violation(client, 'speed-hack'); return; }

    // 4. Collision vs buildings (slide along walls) + 5. update position.
    const r = 16; // 32x32 hitbox, SRS §7.3
    let nx = player.x + dx * speed * dt;
    let ny = player.y + dy * speed * dt;
    if (Colliders.hitBuilding(nx, ny, r)) {
      if (!Colliders.hitBuilding(nx, player.y, r)) ny = player.y; // slide on X
      else if (!Colliders.hitBuilding(player.x, ny, r)) nx = player.x; // slide on Y
      else { nx = player.x; ny = player.y; }
    }
    nx = clamp(nx, 20, 3180); ny = clamp(ny, 20, 3180);
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

  // ---------------------------------------------------------------- interact (revive only in M1)
  _onInteract(client, msg) {
    const player = this.state.players.get(client.sessionId);
    if (!msg || typeof msg !== 'object' || !player) return;
    if (msg.action === 'revive') {
      const target = msg.targetId ? this.state.players.get(msg.targetId) : null;
      if (!target || !target.isFainted) {
        client.send('interact_error', { error: 'INVALID_TARGET' });
        return;
      }
      if (dist(player.x, player.y, target.x, target.y) > 120) {
        client.send('interact_error', { error: 'TOO_FAR' });
        return;
      }
      target.hp = 30; target.stamina = 50; target.isFainted = false; target.anim = 'idle';
      const sv = this.survival.get(msg.targetId);
      if (sv) sv.faintedUntil = 0;
      console.log(`[city] ${player.name} revived ${target.name}`);
      this.broadcast('revived', { byId: client.sessionId, byName: player.name, targetId: msg.targetId });
      // NOTE (M1): no money reward here — doctor revive reward lands in M2/M4.
    } else {
      client.send('interact_error', { error: 'NOT_IMPLEMENTED_M1', action: msg.action || null });
    }
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
    if (!Colliders.hitBuilding(nx, ny, 16)) { p.x = nx; p.y = ny; }
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
    if (!Colliders.hitBuilding(nx, ny, 16)) { n.x = nx; n.y = ny; }
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
          // Auto-revive at hospital: 50 HP, 50 stamina, lose 50% cash (sink).
          p.cash = Math.floor(p.cash / 2);
          p.x = HOSPITAL.x; p.y = HOSPITAL.y;
          p.hp = 50; p.stamina = 50; p.isFainted = false; p.anim = 'idle';
          sv.faintedUntil = 0;
          console.log(`[city] ${p.name} auto-revived at hospital (cash now ${p.cash})`);
        }
        continue;
      }
      // Hunger -1 / 15 s.
      if (++sv.hungerAcc >= 15) { sv.hungerAcc = 0; p.hunger = Math.max(0, p.hunger - 1); }
      if (p.hunger === 0) {
        // -2 HP / 10 s.
        if (++sv.hpLossAcc >= 10) {
          sv.hpLossAcc = 0; p.hp = Math.max(0, p.hp - 2);
          sv.regenAcc = 0;
        }
      } else if (p.hunger > 50) {
        // Regen +1 HP / 10 s, only when Hunger > 50 and not fainted.
        if (++sv.regenAcc >= 10) { sv.regenAcc = 0; p.hp = Math.min(100, p.hp + 1); }
      }
      if (p.hp <= 0) {
        p.hp = 0; p.isFainted = true; p.anim = 'fainted'; p.vx = 0; p.vy = 0;
        sv.faintedUntil = now + FAINT_SECONDS * 1000;
        console.log(`[city] ${p.name} fainted (60 s countdown)`);
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
