import { Room } from './Room.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
  }

  generateId() {
    let id;
    do {
      id = Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    } while (this.rooms.has(id));
    return id;
  }

  create(settings) {
    const id = this.generateId();
    const room = new Room(id, this.io, settings, () => this.rooms.delete(id));
    this.rooms.set(id, room);
    return room;
  }

  get(id) { return this.rooms.get(String(id || '').toUpperCase().trim()); }

  publicRooms() {
    return [...this.rooms.values()]
      .filter((r) => r.settings.isPublic && r.game.phase === 'LOBBY' && !r.isFull && r.activePlayers().length > 0);
  }
}
