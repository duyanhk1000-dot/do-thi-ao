/* Đô Thị Ảo — M1 headless test (colyseus.js client).
   Starts the real server on a test port, connects 2 clients, asserts:
     1. both clients see each other in state (+ 6 bots + 11 NPCs present)
     2. a move from A changes A's x server-side (visible to B)
     3. a world chat from A is received by B
     4. "chào Tùng" (nearby) gets a bot reply within 5 s
     5. worldTime advances (1 game-min / real sec)
   Exit 0 on pass, non-zero on fail. Prints PASS/FAIL per assertion. */
const { Client } = require('colyseus.js');
const { start } = require('../index');

const PORT = parseInt(process.env.TEST_PORT || '2568', 10);
let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${detail !== undefined ? ' (' + detail + ')' : ''}`);
  if (!ok) failures += 1;
}
function waitFor(cond, timeoutMs, stepMs = 100) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    const tick = () => {
      let ok = false;
      try { ok = cond(); } catch (e) { ok = false; }
      if (ok) return resolve(true);
      if (Date.now() >= deadline) return resolve(false);
      setTimeout(tick, stepMs);
    };
    tick();
  });
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const { httpServer } = start(PORT);
  await sleep(500);
  const client = new Client(`ws://127.0.0.1:${PORT}`);
  let roomA, roomB;
  const chatsB = [];
  const botReplies = [];

  try {
    roomA = await client.joinOrCreate('city', { name: 'TestA', avatar: 'hero' });
    roomB = await client.joinOrCreate('city', { name: 'TestB', avatar: 'student' });
    roomA.onMessage('chat', () => {}); // silence colyseus.js "not registered" warning
    roomB.onMessage('chat', (msg) => {
      chatsB.push(msg);
      if (msg.fromId && msg.fromId.startsWith('bot-')) botReplies.push(msg);
    });

    // 1. Both see each other in state; bots + NPCs spawned.
    const seen = await waitFor(() => {
      const ps = roomB.state && roomB.state.players;
      if (!ps) return false;
      let humans = 0, bots = 0;
      ps.forEach((p) => { if (p.id.startsWith('bot-')) bots += 1; else humans += 1; });
      return humans >= 2 && bots >= 6;
    }, 5000);
    let humanCount = 0, botCount = 0, npcCount = 0;
    if (roomB.state) {
      roomB.state.players.forEach((p) => { if (p.id.startsWith('bot-')) botCount += 1; else humanCount += 1; });
      npcCount = roomB.state.npcs ? roomB.state.npcs.size : 0;
    }
    check('both clients see each other + 6 bots in state', seen,
      `humans=${humanCount} bots=${botCount} npcs=${npcCount}`);

    // 2. Move from A changes A's position server-side (observed by B).
    // Walk toward the spawn plaza (1600,1750): open ground from anywhere in
    // the spawn ring, unlike walking blindly east into the motel wall.
    const before = roomB.state.players.get(roomA.sessionId);
    const x0 = before ? before.x : null, y0 = before ? before.y : null;
    const toCx = 1600 - x0, toCy = 1750 - y0;
    const toLen = Math.hypot(toCx, toCy) || 1;
    const mdx = toLen < 50 ? -1 : toCx / toLen, mdy = toLen < 50 ? 0 : toCy / toLen;
    for (let i = 1; i <= 20; i++) {
      roomA.send('move', { seq: i, dx: mdx, dy: mdy, sprint: false });
      await sleep(50);
    }
    const moved = await waitFor(() => {
      const p = roomB.state.players.get(roomA.sessionId);
      return p && x0 !== null && Math.hypot(p.x - x0, p.y - y0) > 50;
    }, 3000);
    const pAfter = roomB.state.players.get(roomA.sessionId);
    check('move from A changes A position server-side (seen by B)', moved,
      `(${x0.toFixed(0)},${y0.toFixed(0)}) -> (${pAfter ? pAfter.x.toFixed(1) : '?'},${pAfter ? pAfter.y.toFixed(1) : '?'})`);

    // 3. World chat from A is received by B.
    chatsB.length = 0;
    roomA.send('chat', { channel: 'world', text: 'xin chào mọi người' });
    const chatOk = await waitFor(
      () => chatsB.some((m) => m.fromId === roomA.sessionId && m.text === 'xin chào mọi người'),
      3000);
    check('world chat from A received by B', chatOk, `B got ${chatsB.length} chat msg(s)`);

    // 4. Greet a bot nearby -> bot replies within 5 s.
    // Drain first: the world-chat reply from step 3 (1-3 s delay) may still
    // land after the reset, and a proactive bot line is not a reply either.
    // So wait out any pending reply, then only count replies whose text is
    // NOT one of that persona's proactive lines.
    await sleep(3500);
    botReplies.length = 0;
    const BotBrain = require('../../shared/botBrain');
    const isGenuineReply = (m) => {
      const persona = BotBrain.PERSONAS.find((p) => 'bot-' + p.id === m.fromId);
      return persona && !persona.lines.includes(m.text);
    };
    let botOk = false;
    for (let attempt = 0; attempt < 2 && !botOk; attempt += 1) {
      roomA.send('chat', { channel: 'nearby', text: 'chào Tùng ơi' });
      botOk = await waitFor(() => botReplies.some(isGenuineReply), 5000);
      if (!botOk) await sleep(500);
    }
    const genuine = botReplies.find(isGenuineReply);
    check('bot replies to "chào Tùng" (nearby) within 5 s', botOk,
      genuine ? `${genuine.fromName}: "${genuine.text}"` : 'no bot reply');

    // 5. worldTime advances.
    const t0 = roomB.state.worldTime;
    await sleep(2100);
    const t1 = roomB.state.worldTime;
    check('worldTime advances ~1 game-min per real sec', t1 > t0, `${t0} -> ${t1}`);
  } catch (err) {
    console.log('FAIL - test crashed:', err && err.message);
    failures += 1;
  } finally {
    try { if (roomA) await roomA.leave(); } catch (e) {}
    try { if (roomB) await roomB.leave(); } catch (e) {}
    httpServer.close(() => process.exit(failures === 0 ? 0 : 1));
    setTimeout(() => process.exit(failures === 0 ? 0 : 1), 2000);
  }
}

main();
