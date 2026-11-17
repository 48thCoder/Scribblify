# Scribblify

Real-time multiplayer draw-and-guess game. React + Vite client, Node/Express + Socket.IO server.

**Live URL:**

## Run locally

```bash
npm --prefix server install && npm --prefix client install
npm run dev:server     # terminal 1 -> http://localhost:3001
npm run dev:client     # terminal 2 -> http://localhost:5173 (proxies /socket.io)
```

Open two browser windows to play against yourself.

## Deploy (Render)

New **Web Service** from the repo: build `npm run build`, start `npm start` (or use `render.yaml`).
Express serves the built client and the WebSocket server from one service, so there is no CORS setup.

## Features

Create/join rooms (code or link, public or private), lobby with ready-up and host start, host kick,
configurable players/rounds/draw time/word choices/hints/word mode, turn-based rounds, live canvas sync,
brush colors and sizes, eraser, undo, clear, hints, countdown, chat + guessing, time-based scoring,
leaderboard and winner, reconnect after refresh.

## Architecture

```
React client ──Socket.IO──► Express server
                              RoomManager → Room → Game (state machine) + Player
```

- **Server-authoritative:** clients send intents; the server validates, updates state and broadcasts.
- **Phases:** LOBBY → WORD_SELECT → DRAWING → ROUND_END → … → GAME_OVER (`server/Game.js`).
- **Drawing:** pointer events become `draw_start/move/end` with coordinates normalized to 0–1. The server
  stores strokes, relays them to the other players, and replays them for late joiners and on undo.
- **Word matching:** `trim().toLowerCase()` and whitespace collapse, exact match. Edit distance 1 sends a private "close" hint.
  The real word is never sent to guessers before the round ends.
- **Scoring:** guesser `100 + 400 × timeLeft/drawTime`; drawer gets 50 per correct guesser.
- **Why one Render service:** Vercel/Netlify are serverless and cannot hold persistent WebSocket connections.
