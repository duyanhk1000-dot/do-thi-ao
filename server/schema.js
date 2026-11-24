/* Đô Thị Ảo — server/schema.js
   Colyseus state schema (SRS §12.1) via @colyseus/schema v2 (defineTypes).
   PlayerState / NpcState field lists are exactly as specified in the M1 task,
   plus `avatar` on both (portrait key for the client). */
const { Schema, MapSchema, defineTypes } = require('@colyseus/schema');

class PlayerState extends Schema {}
defineTypes(PlayerState, {
  id: 'string',
  name: 'string',
  x: 'number',
  y: 'number',
  vx: 'number',
  vy: 'number',
  anim: 'string', // 'idle' | 'walk' | 'sprint' | 'fainted'
  job: 'string', // 'unemployed' | 'shipper' | 'taxi_driver' | 'doctor'
  hp: 'number',
  hunger: 'number',
  stamina: 'number',
  cash: 'number',
  bank: 'number',
  isFainted: 'boolean',
  vehicleId: 'string', // '' when not in a vehicle
  chatBubble: 'string',
  chatBubbleUntil: 'number', // ms epoch; bubble shows until then
  avatar: 'string', // 'shipper' | 'bread' | 'taxi' | 'police' | 'thug' | 'student' | 'hero' | ...
});

class NpcState extends Schema {}
defineTypes(NpcState, {
  id: 'string',
  type: 'string', // 'walker' | 'guide' | 'bot'
  name: 'string',
  x: 'number',
  y: 'number',
  targetX: 'number',
  targetY: 'number',
  avatar: 'string',
});

class CityRoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.npcs = new MapSchema();
    this.worldTime = 480; // 08:00, minutes 0..1440
  }
}
defineTypes(CityRoomState, {
  players: { map: PlayerState },
  npcs: { map: NpcState },
  worldTime: 'number',
});

module.exports = { PlayerState, NpcState, CityRoomState };
