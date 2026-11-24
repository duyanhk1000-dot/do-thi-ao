/* Shared mutable counters for the /health endpoint. Kept in its own module
   so rooms and index.js share one object without a circular require. */
module.exports = { humanPlayers: 0, rooms: 0 };
