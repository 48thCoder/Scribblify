export class Player {
  constructor(id, name, avatar = 0) {
    this.id = id;
    this.name = name;
    this.avatar = typeof avatar === 'number' ? Math.max(0, Math.min(11, avatar)) : 0;
    this.score = 0;
    this.hasGuessed = false;
    this.connected = true;
    this.ready = false;
    this.isHost = false;
    this.socketId = null;
  }
  toJSON() {
    const { id, name, avatar, score, hasGuessed, connected, ready, isHost } = this;
    return { id, name, avatar, score, hasGuessed, connected, ready, isHost };
  }
}
