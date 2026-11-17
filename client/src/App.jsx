import { useCallback, useEffect, useRef, useState } from 'react';
import { socket, getPlayerId, request } from './socket';
import { playCorrect, playTick, playRoundStart, playGameOver } from './sounds';
import Home from './components/Home.jsx';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';
import GameOver from './components/GameOver.jsx';

export default function App() {
  const [me, setMe] = useState(null);
  const [game, setGame] = useState(null);
  const [messages, setMessages] = useState([]);
  const [roundEnd, setRoundEnd] = useState(null);
  const [error, setError] = useState('');
  const [connected, setConnected] = useState(socket.connected);
  const [recentGuesser, setRecentGuesser] = useState(null);
  const gameRef = useRef(null);
  gameRef.current = game;

  const say = useCallback((text, kind = 'system', name = '', extra = {}) =>
    setMessages((m) => [...m.slice(-150), { id: Math.random(), kind, text, name, ...extra }]), []);

  const flash = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(''), 4000);
  }, []);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem('session');
    history.replaceState(null, '', '/');
    setMe(null); setGame(null); setMessages([]); setRoundEnd(null);
  }, []);

  const joined = useCallback((res) => {
    setMe({ playerId: res.playerId, name: res.player.name });
    setMessages([]);
    sessionStorage.setItem('session', JSON.stringify({
      roomId: res.roomId,
      name: res.player.name,
      avatar: res.player.avatar,
    }));
    history.replaceState(null, '', `?room=${res.roomId}`);
  }, []);

  const act = useCallback(async (event, payload) => {
    const res = await request(event, { ...payload, playerId: getPlayerId() });
    if (res.ok) joined(res); else flash(res.error);
  }, [joined, flash]);

  const leaveRoom = () => { socket.emit('leave_room'); clearSession(); };

  useEffect(() => {
    const rejoin = () => {
      const raw = sessionStorage.getItem('session');
      if (!raw) return;
      const { roomId, name, avatar } = JSON.parse(raw);
      socket.emit('join_room', { roomId, playerName: name, playerId: getPlayerId(), avatar }, (res) => {
        if (res.ok) joined(res);
        else { clearSession(); flash('That room is no longer available'); }
      });
    };

    const handlers = {
      connect: () => { setConnected(true); rejoin(); },
      disconnect: () => setConnected(false),
      game_state: (s) => { setGame(s); if (s.phase !== 'ROUND_END') setRoundEnd(null); },
      players_update: ({ players }) => setGame((g) => g && { ...g, players }),
      player_joined: ({ player, players }) => {
        setGame((g) => g && { ...g, players, hostId: players.find((p) => p.isHost)?.id });
        say(`${player.name} joined the room!`, 'system');
      },
      player_left: ({ playerId, players }) => {
        const left = gameRef.current?.players.find((p) => p.id === playerId);
        if (left) say(`${left.name} left the room`, 'system');
        setGame((g) => g && { ...g, players, hostId: players.find((p) => p.isHost)?.id });
      },
      round_start: ({ drawerName, round, totalRounds }) => {
        playRoundStart();
        say(`Round ${round}/${totalRounds}: ${drawerName} is drawing!`, 'system');
      },
      select_timer: ({ selectLeft }) => {
        setGame((g) => g && { ...g, selectLeft });
      },
      timer: ({ timeLeft }) => {
        setGame((g) => g && { ...g, timeLeft });
        if (timeLeft <= 10 && timeLeft > 0) {
          playTick();
        }
      },
      hint: ({ mask }) => {
        setGame((g) => g && { ...g, mask });
        say('A letter was revealed!', 'hint');
      },
      guess_result: ({ correct, playerId, playerName, points, players }) => {
        if (!correct) return;
        playCorrect();
        setRecentGuesser({ id: playerId, points });
        setTimeout(() => setRecentGuesser(null), 2500);
        say(`${playerName} guessed the word!`, 'correct', '', { points });
        setGame((g) => g && { ...g, players });
      },
      guess_close: () => say('So close! Check your spelling!', 'close'),
      chat_message: ({ playerName, text, privileged }) =>
        say(text, privileged ? 'private' : 'chat', playerName),
      round_end: (d) => {
        setRoundEnd(d);
      },
      game_over: (d) => {
        playGameOver();
      },
      kicked: () => { clearSession(); flash('The host removed you from the room'); },
      error_message: ({ message }) => flash(message),
    };
    for (const [ev, fn] of Object.entries(handlers)) socket.on(ev, fn);
    if (socket.connected) rejoin();
    return () => { for (const [ev, fn] of Object.entries(handlers)) socket.off(ev, fn); };
  }, [say, flash, joined, clearSession]);

  const prefill = new URLSearchParams(location.search).get('room') || '';
  let screen;
  if (!me || !game) {
    screen = (
      <Home
        prefillCode={prefill}
        onCreate={(name, settings, avatar) => act('create_room', { hostName: name, settings, avatar })}
        onJoin={(code, name, avatar) => act('join_room', { roomId: code, playerName: name, avatar })}
        onQuickPlay={(name, avatar) => act('quick_play', { playerName: name, avatar })}
      />
    );
  } else if (game.phase === 'LOBBY') {
    screen = <Lobby game={game} me={me} onLeave={leaveRoom} />;
  } else if (game.phase === 'GAME_OVER') {
    screen = <GameOver game={game} me={me} onLeave={leaveRoom} />;
  } else {
    screen = (
      <Game
        game={game}
        me={me}
        messages={messages}
        roundEnd={roundEnd}
        recentGuesser={recentGuesser}
        onLeave={leaveRoom}
      />
    );
  }

  return (
    <>
      {screen}
      {!connected && <div className="banner">Connection lost. Reconnecting…</div>}
      {error && <div className="toast" role="alert">{error}</div>}
    </>
  );
}
