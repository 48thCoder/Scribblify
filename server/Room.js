import { Game } from './Game.js';
import { Player } from './Player.js';

const clamp = (v, min, max, def) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

export function sanitizeSettings(s = {}) {
  return {
    maxPlayers: clamp(s.maxPlayers, 2, 20, 8),
    rounds: clamp(s.rounds, 2, 10, 3),
    drawTime: clamp(s.drawTime, 15, 240, 80),
    wordCount: clamp(s.wordCount, 1, 5, 3),
    hints: clamp(s.hints, 0, 5, 2),
    wordMode: s.wordMode === 'hidden' ? 'hidden' : 'normal',
    isPublic: !!s.isPublic,
  };
}

export class Room {
  constructor(id, io, settings, onEmpty) {
    this.id = id;
    this.io = io;
    this.settings = sanitizeSettings(settings);
    this.players = new Map();
    this.banned = new Set();
    this.hostId = null;
    this.onEmpty = onEmpty;
    this.emptyTimer = null;
    this.game = new Game(this);
  }

  activePlayers() { return [...this.players.values()].filter((p) => p.connected); }
  playersList() { return [...this.players.values()].map((p) => p.toJSON()); }
  get isFull() { return this.activePlayers().length >= this.settings.maxPlayers; }

  uniqueName(name) {
    const taken = new Set([...this.players.values()].map((p) => p.name));
    let unique = name;
    let n = 2;
    while (taken.has(unique)) unique = `${name} (${n++})`;
    return unique;
  }

  addPlayer(id, name, socketId, avatar = 0) {
    clearTimeout(this.emptyTimer);
    let p = this.players.get(id);
    if (p) {
      p.connected = true;
      p.socketId = socketId;
      if (typeof avatar === 'number') p.avatar = avatar;
      return { player: p, rejoined: true };
    }
    p = new Player(id, this.uniqueName(name), avatar);
    p.socketId = socketId;
    this.players.set(id, p);
    if (!this.hostId) { this.hostId = id; p.isHost = true; }
    return { player: p, rejoined: false };
  }

  updateSettings(newSettings) {
    this.settings = sanitizeSettings({ ...this.settings, ...newSettings });
    this.broadcastState();
  }

  handleLeave(id) {
    const p = this.players.get(id);
    if (!p) return;
    p.connected = false;
    p.socketId = null;
    const idle = this.game.phase === 'LOBBY' || this.game.phase === 'GAME_OVER';
    if (idle) this.players.delete(id);
    if (this.hostId === id) this.reassignHost();
    this.emitAll('player_left', { playerId: id, players: this.playersList() });
    this.game.onPlayerLeft(id);
    if (this.activePlayers().length === 0) this.scheduleCleanup();
  }

  reassignHost() {
    const next = this.activePlayers()[0];
    this.hostId = next ? next.id : null;
    for (const p of this.players.values()) p.isHost = p.id === this.hostId;
  }

  scheduleCleanup() {
    clearTimeout(this.emptyTimer);
    this.emptyTimer = setTimeout(() => {
      if (this.activePlayers().length === 0) { this.game.destroy(); this.onEmpty(); }
    }, 60_000);
  }

  emitAll(ev, data) { this.io.to(this.id).emit(ev, data); }
  emitTo(playerId, ev, data) {
    const p = this.players.get(playerId);
    if (p && p.socketId) this.io.to(p.socketId).emit(ev, data);
  }
  emitToMany(ids, ev, data) { ids.forEach((id) => this.emitTo(id, ev, data)); }
  emitPlayers() { this.emitAll('players_update', { players: this.playersList() }); }
  broadcastState() {
    for (const p of this.activePlayers()) this.emitTo(p.id, 'game_state', this.game.stateFor(p.id));
  }
}
