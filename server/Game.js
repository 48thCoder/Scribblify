import { readFileSync } from 'node:fs';

const CATEGORIES = JSON.parse(readFileSync(new URL('./words.json', import.meta.url), 'utf8'));
const ALL_WORDS = Object.values(CATEGORIES).flat();

const SELECT_TIME = 15;
const ROUND_END_DELAY = 5000;

const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
const num01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000');
const safeSize = (s) => Math.min(60, Math.max(1, Number(s) || 4));

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export class Game {
  constructor(room) {
    this.room = room;
    this.reset();
  }

  get settings() { return this.room.settings; }

  reset() {
    this.clearTimers();
    this.phase = 'LOBBY';
    this.round = 0;
    this.turnQueue = [];
    this.drawerId = null;
    this.word = '';
    this.wordOptions = [];
    this.strokes = [];
    this.current = null;
    this.timeLeft = 0;
    this.revealed = [];
    this.hintAt = new Set();
    this.usedWords = new Set();
    this.roundGain = {};
    this.selectLeft = 0;
  }

  clearTimers() {
    clearInterval(this.timer);
    clearInterval(this.selectTimer);
    clearTimeout(this.nextTimer);
    this.timer = this.selectTimer = this.nextTimer = null;
  }

  destroy() { this.clearTimers(); }

  start() {
    this.reset();
    for (const p of this.room.players.values()) { p.score = 0; p.ready = false; }
    this.nextRound();
  }

  nextRound() {
    this.round++;
    if (this.round > this.settings.rounds) return this.endGame();
    this.turnQueue = this.room.activePlayers().map((p) => p.id);
    this.nextTurn();
  }

  nextTurn() {
    if (this.room.activePlayers().length < 2) return this.endGame();
    let drawer = null;
    while (this.turnQueue.length) {
      const p = this.room.players.get(this.turnQueue.shift());
      if (p && p.connected) { drawer = p; break; }
    }
    if (!drawer) return this.nextRound();

    this.phase = 'WORD_SELECT';
    this.drawerId = drawer.id;
    this.word = '';
    this.strokes = [];
    this.current = null;
    this.roundGain = {};
    for (const p of this.room.players.values()) p.hasGuessed = false;

    let pool = ALL_WORDS.filter((w) => !this.usedWords.has(w));
    if (pool.length < this.settings.wordCount) { this.usedWords.clear(); pool = ALL_WORDS; }
    this.wordOptions = shuffle(pool).slice(0, this.settings.wordCount);

    for (const p of this.room.activePlayers()) {
      this.room.emitTo(p.id, 'round_start', {
        drawerId: drawer.id,
        drawerName: drawer.name,
        round: this.round,
        totalRounds: this.settings.rounds,
        drawTime: this.settings.drawTime,
        wordOptions: p.id === drawer.id ? this.wordOptions : undefined,
      });
    }
    this.room.emitAll('canvas_clear', {});
    this.room.broadcastState();

    this.selectLeft = SELECT_TIME;
    this.room.emitAll('select_timer', { selectLeft: this.selectLeft });
    this.selectTimer = setInterval(() => {
      this.selectLeft--;
      this.room.emitAll('select_timer', { selectLeft: this.selectLeft });
      if (this.selectLeft <= 0) this.chooseWord(this.drawerId, this.wordOptions[0]);
    }, 1000);
  }

  chooseWord(playerId, word) {
    if (this.phase !== 'WORD_SELECT' || playerId !== this.drawerId) return;
    if (!this.wordOptions.includes(word)) return;
    clearInterval(this.selectTimer);
    this.word = word;
    this.usedWords.add(word);
    this.phase = 'DRAWING';
    this.timeLeft = this.settings.drawTime;
    this.revealed = [...word].map((c) => c === ' ');

    const T = this.settings.drawTime, h = this.settings.hints;
    this.hintAt = new Set();
    for (let k = 1; k <= h; k++) this.hintAt.add(T - Math.round((T * k) / (h + 1)));

    this.room.broadcastState();
    this.timer = setInterval(() => this.tick(), 1000);
  }

  tick() {
    this.timeLeft--;
    this.room.emitAll('timer', { timeLeft: this.timeLeft });
    if (this.hintAt.has(this.timeLeft)) this.revealHint();
    if (this.timeLeft <= 0) this.endRound('time');
  }

  mask() {
    if (!this.word || this.settings.wordMode === 'hidden') return null;
    return [...this.word].map((c, i) => (this.revealed[i] ? c : '_'));
  }

  revealHint() {
    if (this.settings.wordMode === 'hidden') return;
    const hidden = [...this.word].map((_, i) => i).filter((i) => !this.revealed[i]);
    if (hidden.length <= 1) return;
    this.revealed[hidden[Math.floor(Math.random() * hidden.length)]] = true;
    this.room.emitAll('hint', { mask: this.mask() });
  }

  endRound(reason) {
    if (this.phase !== 'DRAWING' && this.phase !== 'WORD_SELECT') return;
    this.clearTimers();
    this.phase = 'ROUND_END';
    const scores = [...this.room.players.values()].map((p) => ({
      id: p.id, name: p.name, score: p.score, gain: this.roundGain[p.id] || 0,
    }));
    const nextId = this.turnQueue.find((id) => this.room.players.get(id)?.connected);
    this.room.emitAll('round_end', {
      word: this.word, reason, scores,
      nextDrawer: nextId ? this.room.players.get(nextId).name : null,
    });
    this.room.broadcastState();
    this.nextTimer = setTimeout(() => this.nextTurn(), ROUND_END_DELAY);
  }

  endGame() {
    this.clearTimers();
    this.phase = 'GAME_OVER';
    const leaderboard = [...this.room.players.values()]
      .sort((a, b) => b.score - a.score)
      .map((p, i) => ({ rank: i + 1, id: p.id, name: p.name, score: p.score }));
    const top = leaderboard.length ? leaderboard[0].score : 0;
    const winners = leaderboard.filter((p) => p.score === top);
    this.room.emitAll('game_over', { winner: winners[0] || null, winners, leaderboard });
    this.room.broadcastState();
  }

  onPlayerLeft(id) {
    if (this.phase === 'LOBBY' || this.phase === 'GAME_OVER') return;
    const active = this.room.activePlayers();
    if (active.length < 2) return this.endGame();
    if (id === this.drawerId && (this.phase === 'DRAWING' || this.phase === 'WORD_SELECT'))
      return this.endRound('drawer_left');
    if (this.phase === 'DRAWING') this.checkAllGuessed();
  }

  checkAllGuessed() {
    const guessers = this.room.activePlayers().filter((p) => p.id !== this.drawerId);
    if (guessers.length && guessers.every((p) => p.hasGuessed)) this.endRound('all_guessed');
  }

  handleGuess(player, rawText) {
    const text = String(rawText || '').slice(0, 100);
    if (!text.trim()) return;
    const msg = { playerId: player.id, playerName: player.name, text };

    if (this.phase !== 'DRAWING') return this.room.emitAll('chat_message', msg);

    if (player.id === this.drawerId || player.hasGuessed) {
      const ids = this.room.activePlayers()
        .filter((p) => p.id === this.drawerId || p.hasGuessed).map((p) => p.id);
      return this.room.emitToMany(ids, 'chat_message', { ...msg, privileged: true });
    }

    const guess = norm(text), answer = norm(this.word);
    if (guess === answer) {
      const points = 100 + Math.round((this.timeLeft / this.settings.drawTime) * 400);
      player.score += points;
      player.hasGuessed = true;
      this.roundGain[player.id] = (this.roundGain[player.id] || 0) + points;
      const drawer = this.room.players.get(this.drawerId);
      if (drawer) {
        drawer.score += 50;
        this.roundGain[drawer.id] = (this.roundGain[drawer.id] || 0) + 50;
      }
      this.room.emitAll('guess_result', {
        correct: true, playerId: player.id, playerName: player.name, points,
        players: this.room.playersList(),
      });
      this.checkAllGuessed();
    } else {
      if (guess.length > 3 && editDistance(guess, answer) === 1)
        this.room.emitTo(player.id, 'guess_close', {});
      this.room.emitAll('chat_message', msg);
    }
  }

  isDrawer(id) { return this.phase === 'DRAWING' && id === this.drawerId; }

  relay(fromId, data) {
    for (const p of this.room.activePlayers()) if (p.id !== fromId) this.room.emitTo(p.id, 'draw_data', data);
  }

  drawStart(id, d = {}) {
    if (!this.isDrawer(id)) return;
    const x = num01(d.x), y = num01(d.y);
    this.current = { color: safeColor(d.color), size: safeSize(d.size), points: [{ x, y }] };
    this.strokes.push(this.current);
    this.relay(id, { type: 'start', x, y, color: this.current.color, size: this.current.size });
  }

  drawMove(id, d = {}) {
    if (!this.isDrawer(id) || !this.current) return;
    const x = num01(d.x), y = num01(d.y);
    this.current.points.push({ x, y });
    this.relay(id, { type: 'move', x, y });
  }

  drawEnd(id) {
    if (!this.isDrawer(id)) return;
    this.current = null;
    this.relay(id, { type: 'end' });
  }

  undo(id) {
    if (!this.isDrawer(id)) return;
    this.strokes.pop();
    this.current = null;
    this.room.emitAll('canvas_redraw', { strokes: this.strokes });
  }

  clearCanvas(id) {
    if (!this.isDrawer(id)) return;
    this.strokes = [];
    this.current = null;
    this.room.emitAll('canvas_clear', {});
  }

  drawFill(id, d = {}) {
    if (!this.isDrawer(id)) return;
    const x = num01(d.x), y = num01(d.y);
    const fillItem = { type: 'fill', color: safeColor(d.color), x, y };
    this.strokes.push(fillItem);
    this.relay(id, { type: 'fill', color: fillItem.color, x, y });
  }

  stateFor(playerId) {
    const isDrawer = playerId === this.drawerId;
    const reveal = isDrawer || this.phase === 'ROUND_END';
    return {
      phase: this.phase,
      round: this.round,
      totalRounds: this.settings.rounds,
      drawerId: this.drawerId,
      drawTime: this.settings.drawTime,
      timeLeft: this.timeLeft,
      selectLeft: this.selectLeft,
      wordOptions: isDrawer && this.phase === 'WORD_SELECT' ? this.wordOptions : [],
      word: reveal ? this.word : null,
      wordLength: this.word.length,
      mask: this.phase === 'DRAWING' ? this.mask() : null,
      players: this.room.playersList(),
      hostId: this.room.hostId,
      settings: this.settings,
      roomId: this.room.id,
      strokes: this.strokes,
    };
  }
}
