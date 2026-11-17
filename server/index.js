import express from 'express';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const rooms = new RoomManager(io);

app.get('/health', (_req, res) => res.json({ ok: true }));

const dist = path.join(__dirname, '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

const cleanName = (n) => String(n || '').replace(/\s+/g, ' ').trim().slice(0, 20);
const cleanId = (id) => (/^[\w-]{6,64}$/.test(String(id)) ? String(id) : null);

io.on('connection', (socket) => {
  const ctx = () => {
    const room = rooms.get(socket.data.roomId);
    const player = room?.players.get(socket.data.playerId);
    return { room, player };
  };
  const fail = (message) => socket.emit('error_message', { message });

  const leave = () => {
    const { room, player } = ctx();
    if (room && player) { socket.leave(room.id); room.handleLeave(player.id); }
    socket.data = {};
  };

  const enter = (room, playerId, name, cb, avatar = 0) => {
    const { player } = room.addPlayer(playerId, name, socket.id, avatar);
    socket.data = { roomId: room.id, playerId };
    socket.join(room.id);
    cb({ ok: true, roomId: room.id, playerId, player: player.toJSON() });
    socket.to(room.id).emit('player_joined', { player: player.toJSON(), players: room.playersList() });
    socket.emit('game_state', room.game.stateFor(playerId));
  };

  socket.on('create_room', ({ hostName, settings, playerId, avatar } = {}, cb = () => {}) => {
    const name = cleanName(hostName);
    if (!name) return cb({ ok: false, error: 'Enter a name first' });
    leave();
    enter(rooms.create(settings), cleanId(playerId) || randomUUID(), name, cb, avatar);
  });

  socket.on('join_room', ({ roomId, playerName, playerId, avatar } = {}, cb = () => {}) => {
    const room = rooms.get(roomId);
    if (!room) return cb({ ok: false, error: 'Room not found. Check the code.' });
    const pid = cleanId(playerId) || randomUUID();
    const existing = room.players.get(pid);
    const name = cleanName(playerName) || existing?.name;
    if (!name) return cb({ ok: false, error: 'Enter a name first' });
    if (room.banned.has(pid)) return cb({ ok: false, error: 'You were removed from this room' });
    if (!existing && room.isFull) return cb({ ok: false, error: 'This room is full' });
    leave();
    enter(room, pid, name, cb, avatar);
  });

  socket.on('quick_play', ({ playerName, playerId, avatar } = {}, cb = () => {}) => {
    const name = cleanName(playerName);
    if (!name) return cb({ ok: false, error: 'Enter a name first' });
    leave();
    const open = rooms.publicRooms();
    const room = open.length ? open[Math.floor(Math.random() * open.length)] : rooms.create({ isPublic: true });
    enter(room, cleanId(playerId) || randomUUID(), name, cb, avatar);
  });

  socket.on('leave_room', () => leave());

  socket.on('toggle_ready', () => {
    const { room, player } = ctx();
    if (!room || !player || room.game.phase !== 'LOBBY') return;
    player.ready = !player.ready;
    room.emitPlayers();
  });

  socket.on('update_settings', (newSettings) => {
    const { room, player } = ctx();
    if (!room || !player || room.hostId !== player.id || room.game.phase !== 'LOBBY') return;
    room.updateSettings(newSettings);
  });

  socket.on('start_game', () => {
    const { room, player } = ctx();
    if (!room || !player || room.hostId !== player.id) return fail('Only the host can start the game');
    if (room.game.phase !== 'LOBBY') return;
    if (room.activePlayers().length < 2) return fail('You need at least 2 players to start');
    room.game.start();
  });

  socket.on('play_again', () => {
    const { room, player } = ctx();
    if (!room || !player || room.hostId !== player.id || room.game.phase !== 'GAME_OVER') return;
    room.game.reset();
    for (const [id, p] of room.players) {
      if (!p.connected) room.players.delete(id);
      else { p.score = 0; p.hasGuessed = false; p.ready = false; }
    }
    room.broadcastState();
  });

  socket.on('kick_player', ({ playerId } = {}) => {
    const { room, player } = ctx();
    if (!room || !player || room.hostId !== player.id || playerId === player.id) return;
    const target = room.players.get(playerId);
    if (!target) return;
    room.banned.add(playerId);
    room.emitTo(playerId, 'kicked', {});
    io.sockets.sockets.get(target.socketId)?.leave(room.id);
    room.handleLeave(playerId);
  });

  socket.on('word_chosen', ({ word } = {}) => {
    const { room, player } = ctx();
    if (room && player) room.game.chooseWord(player.id, word);
  });

  const drawing = {
    draw_start: (g, id, d) => g.drawStart(id, d),
    draw_move: (g, id, d) => g.drawMove(id, d),
    draw_end: (g, id) => g.drawEnd(id),
    draw_undo: (g, id) => g.undo(id),
    canvas_clear: (g, id) => g.clearCanvas(id),
    draw_fill: (g, id, d) => g.drawFill(id, d),
  };
  for (const [ev, fn] of Object.entries(drawing)) {
    socket.on(ev, (d) => {
      const { room, player } = ctx();
      if (room && player) fn(room.game, player.id, d);
    });
  }

  for (const ev of ['guess', 'chat']) {
    socket.on(ev, ({ text } = {}) => {
      const { room, player } = ctx();
      if (room && player) room.game.handleGuess(player, text);
    });
  }

  socket.on('disconnect', () => {
    const { room, player } = ctx();
    if (room && player && player.socketId === socket.id) room.handleLeave(player.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => console.log(`Server listening on :${PORT}`));