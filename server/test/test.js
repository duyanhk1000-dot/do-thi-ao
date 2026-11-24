/* Đô Thị Ảo — M1 headless test (colyseus.js client).
   Starts the real server on a test port, connects 2 clients, asserts:
     1. both clients see each other in state (+ 6 bots + 11 NPCs present)
     2. a move from A changes A's x server-side (visible to B)
     3. a world chat from A is received by B
     4. "chào Tùng" (nearby) gets a bot reply within 5 s
     5. worldTime advances (1 game-min / real sec)
   Exit 0 on pass, non-zero on fail. Prints PASS/FAIL per assertion.
   M3 tests (SRS §14.2, §14.4): pure M3 math (deadlines, rewards, faint
   loss, hospital fee, doctor caps) + live-protocol tests (job set,
   shipper accept->deliver->duplicate, NPC talk, faint->hospital fee,
   doctor revive + cooldown). The live tests use the env-gated '__test_set'
   hook (DTA_ALLOW_TEST=1, set below before the server is required) to
   teleport/set stats — never enabled in production. */
process.env.DTA_ALLOW_TEST = '1';
const { Client } = require('colyseus.js');
const { start } = require('../index');
const M3 = require('../../shared/m3');
const BotBrain = require('../../shared/botBrain');

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
  // M3 message collectors.
  const jobResultsA = [], jobResultsB = [], npcTalksA = [], revivedMsgs = [], faintAlerts = [];
  const statePlayer = (room, sid) => {
    try { return room.state && room.state.players.get(sid); } catch (e) { return null; }
  };
  const testSet = async (room, obj) => { room.send('__test_set', obj); await sleep(300); };
  const waitForMsg = (list, pred, timeoutMs) => waitFor(
    () => list.some(pred), timeoutMs || 5000);

  // ---- M3 pure math (SRS §6.3, §6.4, §3.2.3, §3.2.5, §3.4.3) ----
  // Deadlines: 500px/180 -> 33s, 2000px/180 -> 41s, 3200px/180 -> 48s, 3200px/540 -> 36s.
  check('M3 deadline 500px walk = 33s', M3.deliverySeconds(500, 180) === 33, String(M3.deliverySeconds(500, 180)));
  check('M3 deadline 2000px walk = 41s', M3.deliverySeconds(2000, 180) === 41, String(M3.deliverySeconds(2000, 180)));
  check('M3 deadline 3200px walk = 48s', M3.deliverySeconds(3200, 180) === 48, String(M3.deliverySeconds(3200, 180)));
  check('M3 deadline 3200px bike = 36s', M3.deliverySeconds(3200, 540) === 36, String(M3.deliverySeconds(3200, 540)));
  // Rewards day: 500 -> 15000 (clamped min), 2000 -> 16000, 3200 -> 19000.
  check('M3 reward 500px day = 15000', M3.deliveryReward(500, false) === 15000, String(M3.deliveryReward(500, false)));
  check('M3 reward 2000px day = 16000', M3.deliveryReward(2000, false) === 16000, String(M3.deliveryReward(2000, false)));
  check('M3 reward 3200px day = 19000', M3.deliveryReward(3200, false) === 19000, String(M3.deliveryReward(3200, false)));
  // Rewards night (x1.30): 500 -> 19500, 2000 -> 20800, 3200 -> 24700.
  check('M3 reward 500px night = 19500', M3.deliveryReward(500, true) === 19500, String(M3.deliveryReward(500, true)));
  check('M3 reward 2000px night = 20800', M3.deliveryReward(2000, true) === 20800, String(M3.deliveryReward(2000, true)));
  check('M3 reward 3200px night = 24700', M3.deliveryReward(3200, true) === 24700, String(M3.deliveryReward(3200, true)));
  // Faint loss + hospital fee: faint with 50.000 -> lose 25.000 -> fee 22.500.
  check('M3 faint loss 50000 -> 25000', M3.faintLoss(50000) === 25000, String(M3.faintLoss(50000)));
  check('M3 hospital fee on 25000 -> 22500', M3.hospitalFee(25000) === 22500, String(M3.hospitalFee(25000)));
  const d1 = M3.deductFee(25000, 0, 22500);
  check('M3 deduct fee 25000 cash pays 22500', d1.cash === 2500 && d1.bank === 0 && d1.paid === 22500, JSON.stringify(d1));
  const d2 = M3.deductFee(5000, 10000, 22500);
  check('M3 deduct fee falls back to bank, never negative', d2.cash === 0 && d2.bank === 0 && d2.paid === 15000, JSON.stringify(d2));
  const d3 = M3.deductFee(0, 0, 22500);
  check('M3 deduct fee with no money pays 0, no debt', d3.paid === 0 && d3.cash === 0 && d3.bank === 0, JSON.stringify(d3));
  // Doctor reward rules (§3.4.3): 25000 OK, 0 when not doctor / cooldown / hourly cap.
  const drOk = M3.doctorRewardCheck('doctor', 1000000, 0, 0);
  check('M3 doctor revive reward = 25000', drOk.reward === 25000 && drOk.reason === 'OK', JSON.stringify(drOk));
  check('M3 non-doctor revive reward = 0', M3.doctorRewardCheck('shipper', 1000000, 0, 0).reward === 0);
  check('M3 doctor 60s cooldown blocks reward', M3.doctorRewardCheck('doctor', 1000000, 970000, 0).reward === 0);
  check('M3 doctor 3/hour cap blocks 4th reward', M3.doctorRewardCheck('doctor', 1000000, 0, 3).reward === 0);
  check('M3 collusion flag at 11 pair revives/day', M3.collusionFlagged(11) === true && M3.collusionFlagged(10) === false);

  try {
    roomA = await client.joinOrCreate('city', { name: 'TestA', avatar: 'hero' });
    roomB = await client.joinOrCreate('city', { name: 'TestB', avatar: 'student' });
    roomA.onMessage('chat', () => {}); // silence colyseus.js "not registered" warning
    roomA.onMessage('job_result', (m) => jobResultsA.push(m));
    roomA.onMessage('npc_talk', (m) => npcTalksA.push(m));
    roomA.onMessage('revived', (m) => revivedMsgs.push(m));
    roomA.onMessage('faint_alert', (m) => faintAlerts.push(m));
    roomA.onMessage('interact_error', () => {});
    roomA.onMessage('econ_result', () => {});
    roomB.onMessage('job_result', (m) => jobResultsB.push(m));
    roomB.onMessage('revived', (m) => revivedMsgs.push(m));
    roomB.onMessage('interact_error', () => {});
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
    // Walk toward the spawn plaza (2400,2625): open ground from anywhere in
    // the spawn ring, unlike walking blindly east into the motel wall.
    const before = roomB.state.players.get(roomA.sessionId);
    const x0 = before ? before.x : null, y0 = before ? before.y : null;
    const toCx = 2400 - x0, toCy = 2625 - y0;
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

    // ---- M3 live protocol (§14.2, §14.4) ----
    // 6. Set job: TestA -> shipper.
    jobResultsA.length = 0;
    roomA.send('job', { job: 'shipper' });
    const jobOk = await waitForMsg(jobResultsA, (m) => m.type === 'job' && m.ok && m.job === 'shipper');
    const pAjob = statePlayer(roomB, roomA.sessionId);
    check('M3 set job shipper', jobOk && pAjob && pAjob.job === 'shipper',
      pAjob ? `job=${pAjob.job}` : 'no state');

    // 7. Shipper accept -> deliver -> duplicate complete (SRS §6, §14.2).
    // Teleport A just south of the warehouse (4155,3200 is open ground,
    // 290px from the warehouse POI (4155,2910) — inside the 300px range).
    await testSet(roomA, { x: 4155, y: 3200 });
    const pA0 = statePlayer(roomA, roomA.sessionId);
    const ax0 = pA0 ? pA0.x : 4155, ay0 = pA0 ? pA0.y : 3200;
    const cashBefore = pA0 ? pA0.cash : 0;
    jobResultsA.length = 0;
    roomA.send('shipper', { action: 'accept' });
    const acceptOk = await waitForMsg(jobResultsA,
      (m) => m.type === 'shipper' && m.ok && m.action === 'accept' && m.order);
    const acceptMsg = jobResultsA.find((m) => m.type === 'shipper' && m.ok && m.action === 'accept');
    let order = acceptMsg ? acceptMsg.order : null;
    let shipperDetail = 'no order';
    if (order) {
      const expectedDist = Math.round(Math.hypot(order.targetX - ax0, order.targetY - ay0));
      const expectedSec = M3.deliverySeconds(expectedDist, M3.WALK_SPEED);
      const night = M3.isNightWorld(roomA.state.worldTime);
      const expectedReward = M3.deliveryReward(expectedDist, night);
      shipperDetail = `dist=${expectedDist} sec=${order.secondsLeft}/${expectedSec} reward=${order.reward}/${expectedReward}`;
      check('M3 shipper accept: deadline + reward match SRS formulas',
        order.secondsLeft === expectedSec && order.reward === expectedReward, shipperDetail);
    } else {
      check('M3 shipper accept: deadline + reward match SRS formulas', false, shipperDetail);
    }
    // Teleport A onto the delivery target, then complete.
    if (order) {
      await testSet(roomA, { x: order.targetX, y: order.targetY });
      jobResultsA.length = 0;
      roomA.send('shipper', { action: 'complete', orderId: order.id });
      const completeOk = await waitForMsg(jobResultsA,
        (m) => m.type === 'shipper' && m.ok && m.action === 'complete');
      const completeMsg = jobResultsA.find((m) => m.type === 'shipper' && m.ok && m.action === 'complete');
      const pA1 = statePlayer(roomB, roomA.sessionId);
      check('M3 shipper deliver pays server-calculated reward once',
        completeOk && completeMsg && completeMsg.reward === order.reward && pA1 && pA1.cash === cashBefore + order.reward,
        completeMsg ? `reward=${completeMsg.reward} cash=${pA1 ? pA1.cash : '?'}` : 'no complete');
      // Duplicate complete -> ALREADY_PROCESSED, cash unchanged.
      const cashAfterDeliver = pA1 ? pA1.cash : null;
      jobResultsA.length = 0;
      roomA.send('shipper', { action: 'complete', orderId: order.id });
      const dupOk = await waitForMsg(jobResultsA,
        (m) => m.type === 'shipper' && !m.ok && m.error === 'ALREADY_PROCESSED');
      await sleep(300);
      const pA2 = statePlayer(roomB, roomA.sessionId);
      check('M3 duplicate complete -> ALREADY_PROCESSED, no double pay',
        dupOk && pA2 && pA2.cash === cashAfterDeliver, `cash=${pA2 ? pA2.cash : '?'}`);
    }

    // 8. NPC talk (§10.2): guide -> tutorial quest; walker -> persona line.
    // Teleport A next to the guide (2400,2520), 110px away.
    await testSet(roomA, { x: 2400, y: 2630 });
    npcTalksA.length = 0;
    roomA.send('interact', { action: 'talk', targetId: 'npc-guide' });
    const guideOk = await waitForMsg(npcTalksA, (m) => m.npcId === 'npc-guide' && m.isGuide);
    const guideMsg = npcTalksA.find((m) => m.npcId === 'npc-guide');
    check('M3 talk to guide shows 5-step tutorial quest',
      guideOk && guideMsg && Array.isArray(guideMsg.quest) && guideMsg.quest.length === 5,
      guideMsg ? `${guideMsg.quest.length} steps` : 'no reply');
    // Walker: teleport next to npc-walker-0 (it wanders 90px/s, so stay close).
    const walker0 = roomA.state && roomA.state.npcs ? roomA.state.npcs.get('npc-walker-0') : null;
    if (walker0) {
      await testSet(roomA, { x: walker0.x, y: walker0.y + 60 });
      npcTalksA.length = 0;
      roomA.send('interact', { action: 'talk', targetId: 'npc-walker-0' });
      const talkOk = await waitForMsg(npcTalksA, (m) => m.npcId === 'npc-walker-0' && !m.isGuide);
      const talkMsg = npcTalksA.find((m) => m.npcId === 'npc-walker-0');
      const persona = BotBrain.PERSONAS.find((pp) => pp.id === (talkMsg && talkMsg.personaId));
      check('M3 talk to walker returns a persona line',
        talkOk && !!talkMsg && !!persona && persona.lines.includes(talkMsg.text),
        talkMsg ? `${talkMsg.personaId}: "${talkMsg.text}"` : 'no reply');
    } else {
      check('M3 talk to walker returns a persona line', false, 'walker-0 missing');
    }

    // 9. Faint -> hospital fee (§14.4): B faints with 50.000 cash.
    // Faint loss at faint time: 50.000 -> 25.000; hospital fee on the
    // remaining 25.000: 10.000 + 12.500 = 22.500 -> cash 2.500, hp 50.
    await testSet(roomB, { cash: 50000, bank: 0, hp: 0, hunger: 0 });
    const faintOk = await waitFor(
      () => { const p = statePlayer(roomA, roomB.sessionId); return p && p.isFainted; }, 5000);
    const pBfaint = statePlayer(roomA, roomB.sessionId);
    check('M3 faint loses 50% cash immediately (50000 -> 25000)',
      faintOk && pBfaint && pBfaint.cash === 25000,
      pBfaint ? `cash=${pBfaint.cash} fainted=${pBfaint.isFainted}` : 'no state');
    // Force the 60 s countdown to end -> auto-revive at the hospital.
    await testSet(roomB, { faintMsLeft: 0 });
    const hospOk = await waitFor(
      () => { const p = statePlayer(roomA, roomB.sessionId); return p && !p.isFainted && p.hp === 50; }, 5000);
    const pBhosp = statePlayer(roomA, roomB.sessionId);
    check('M3 hospital auto-revive: fee 22500, cash 2500, hp 50 at hospital',
      hospOk && pBhosp && pBhosp.cash === 2500 && pBhosp.bank === 0
        && Math.abs(pBhosp.x - 4125) < 5 && Math.abs(pBhosp.y - 1635) < 5,
      pBhosp ? `cash=${pBhosp.cash} hp=${pBhosp.hp} at (${Math.round(pBhosp.x)},${Math.round(pBhosp.y)})` : 'no state');

    // 10. Doctor revive + 60 s cooldown (§3.4.3, §14.4).
    // A becomes a doctor (no active order, so the job change is allowed).
    jobResultsA.length = 0;
    roomA.send('job', { job: 'doctor' });
    await waitForMsg(jobResultsA, (m) => m.type === 'job' && m.ok && m.job === 'doctor');
    // B faints again with 10.000 cash (faint loss -> 5.000).
    await testSet(roomB, { cash: 10000, hp: 0 });
    await waitFor(
      () => { const p = statePlayer(roomA, roomB.sessionId); return p && p.isFainted; }, 5000);
    const pB2 = statePlayer(roomA, roomB.sessionId);
    await testSet(roomA, { x: pB2.x + 50, y: pB2.y }); // doctor within 120px
    const cashADoc0 = (statePlayer(roomB, roomA.sessionId) || {}).cash || 0;
    revivedMsgs.length = 0;
    roomA.send('interact', { action: 'revive', targetId: roomB.sessionId });
    const reviveOk = await waitForMsg(revivedMsgs,
      (m) => m.targetId === roomB.sessionId && m.reward === 25000);
    await sleep(300);
    const pBrev = statePlayer(roomA, roomB.sessionId);
    const pAdoc = statePlayer(roomB, roomA.sessionId);
    check('M3 doctor revive: victim 30 HP, doctor +25000',
      reviveOk && pBrev && !pBrev.isFainted && pBrev.hp === 30
        && pAdoc && pAdoc.cash === cashADoc0 + 25000,
      pAdoc ? `doctor cash ${cashADoc0} -> ${pAdoc.cash}, victim hp=${pBrev ? pBrev.hp : '?'}` : 'no state');
    // Second faint + revive within 60 s -> reward 0 (COOLDOWN).
    await testSet(roomB, { hp: 0 });
    await waitFor(
      () => { const p = statePlayer(roomA, roomB.sessionId); return p && p.isFainted; }, 5000);
    const cashADoc1 = (statePlayer(roomB, roomA.sessionId) || {}).cash || 0;
    revivedMsgs.length = 0;
    roomA.send('interact', { action: 'revive', targetId: roomB.sessionId });
    const revive2Ok = await waitForMsg(revivedMsgs,
      (m) => m.targetId === roomB.sessionId && m.reward === 0 && m.reason === 'COOLDOWN');
    await sleep(300);
    const pAdoc2 = statePlayer(roomB, roomA.sessionId);
    check('M3 doctor 2nd revive within 60s -> 0d (COOLDOWN)',
      revive2Ok && pAdoc2 && pAdoc2.cash === cashADoc1, `cash=${pAdoc2 ? pAdoc2.cash : '?'}`);
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
