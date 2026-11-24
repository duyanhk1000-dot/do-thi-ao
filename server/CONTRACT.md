# Đô Thị Ảo — M1 Server ↔ Client Contract

Server: Node ≥ 20, plain JS, `node index.js` (PORT env or 2567). Room name: **`city`**
(maxClients 8, patchRate 50 ms / 20 Hz). Health: `GET /health` → `{ok:true, room:'city', players:n}` (n = human players).

## Join

`client.joinOrCreate('city', { name, avatar })` — `name` ≤ 24 chars (default
`CongDan-xxxx`), `avatar` ∈ `shipper|bread|taxi|police|thug|student|hero|guide|citizen`
(default `hero`). Spawn near (1600, 1750). Starting stats: HP/Hunger/Stamina 100,
cash 50000, bank 0 (M0 value; M2 replaces with Supabase starter grant).

## State (`CityRoomState`)

- `state.worldTime`: number, 0–1440 game-minutes, starts 480 (08:00), +1 / real second.
- `state.players`: Map<sessionId, PlayerState> — includes the 6 bots
  (`bot-tung`, `bot-lan`, `bot-ba`, `bot-cong`, `bot-ty`, `bot-mai`).
  PlayerState: `id, name, x, y, vx, vy, anim ('idle'|'walk'|'sprint'|'fainted'),
  job ('unemployed'|'shipper'|'taxi_driver'|'doctor'), hp, hunger, stamina,
  cash, bank, isFainted (bool), vehicleId ('' = none), chatBubble (string),
  chatBubbleUntil (ms epoch), avatar (string)`.
- `state.npcs`: Map<id, NpcState> — 1 guide (`npc-guide`, type `guide`, fixed at
  1600,1520) + 10 walkers (`npc-walker-0..9`, type `walker`).
  NpcState: `id, type ('walker'|'guide'|'bot'), name, x, y, targetX, targetY, avatar`.

## Client → Server messages

| Message | Payload | Server behaviour |
|---|---|---|
| `move` | `{seq, dx, dy, sprint}` — dx,dy ∈ [-1,1], length ≤ 1, seq strictly increasing, sprint bool | Authoritative: walk 180 / sprint 300 px/s (×0.7 if hunger<20); stamina −5/s sprint, +3/s else; sprint blocked < 10 stamina; building collision (slide), clamp 20..3180. Rate-limit 30/s; bad vector = violation, 5/min → kick. Fainted players cannot move. Server does NOT echo input — client predicts, reconciles from state patches. |
| `chat` | `{channel:'world'\|'nearby'\|'private', targetId?, text}` | text ≤ 200 chars; max 5 msgs/10 s (6th dropped + logged); links/phone numbers blocked (dropped + logged). Sets sender `chatBubble` + `chatBubbleUntil` = now+4000. `nearby` → only players ≤ 600 px. `private` → only targetId (+sender); target must exist or `chat_error {error:'TARGET_NOT_FOUND'}`. Fainted players CAN still chat. |
| `interact` | `{targetId, action:'revive'}` | Revive only in M1: target must be fainted and ≤ 120 px → target HP 30, stamina 50, `isFainted=false`. Broadcasts `revived {byId, byName, targetId}`. Other actions → `interact_error {error:'NOT_IMPLEMENTED_M1'}`. No money reward in M1. |

## Server → Client messages (in addition to state patches)

| Message | Payload |
|---|---|
| `chat` | `{fromId, fromName, channel, text, targetId, at}` — also how bots speak (fromId `bot-*`). |
| `chat_error` | `{error:'TARGET_NOT_FOUND'}` |
| `interact_error` | `{error:'INVALID_TARGET'\|'TOO_FAR'\|'NOT_IMPLEMENTED_M1', action?}` |
| `revived` | `{byId, byName, targetId}` |

## Server rules the client must NOT re-implement

- Survival (server 1 s tick): hunger −1/15 s; hunger 0 → −2 HP/10 s; HP regen
  +1/10 s only if hunger > 50 and not fainted; HP 0 → fainted, 60 s countdown,
  then auto-revive at hospital (2750,1090) with 50 HP / 50 stamina / lose 50% cash.
- Bots: walk 45–75 px/s to random open points, pause 3–8 s; proactive line max
  1 per 20–40 s per bot, only with a human ≤ 600 px; reply to nearby/world chat
  after a random 1–3 s delay (sometimes silent). Bot brain is in
  `shared/botBrain.js` (same file the client may load for reference — the
  server is authoritative).
- Walkers wander like M0 NPCs (45–75 px/s, pause 3–8 s); guide never moves.

## Shared files (single source of truth)

- `shared/colliders.js` — `MAP_W/MAP_H = 3200`, `ROAD_BANDS`, `BUILDINGS`
  (copied exactly from `src/main.js`), `hitBuilding(x,y,r)`, `isOpenPoint(x,y)`,
  `randomOpenPoint(randFn)`. Browser-safe (UMD, no Node-only code).
- `shared/botBrain.js` — `PERSONAS`, `createBotState(personaId)`,
  `respond(personaId, text, playerName, state)` → string|null. UMD, no deps.

## Known M1 deviations from SRS v2.1 (deliberate, per M1 task)

- Auto-revive hospital fee is simplified to "lose 50% cash" (§3.2.5's
  10 000 + 50%-of-remainder fee + bank top-up needs Supabase — M2).
- No `job_action` / `shop_buy` / `atm_transfer` / `use_item` messages yet (M2–M4).
- No 30 s reconnect session grace (§7.5) — Colyseus default leave handling;
  reconnect = fresh join at spawn.
