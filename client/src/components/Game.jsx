import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { getAvatar } from '../avatars';
import Canvas from './Canvas.jsx';

const COLORS = [
  '#000000', '#7f7f7f', '#ffffff', '#e53935',
  '#fb8c00', '#fdd835', '#43a047', '#00acc1',
  '#1e88e5', '#8e24aa', '#d81b60', '#795548',
];
const SIZES = [4, 10, 22];

function WordBar({ game, isDrawer, drawerName }) {
  if (game.phase === 'WORD_SELECT') {
    return (
      <span className="hint">
        {isDrawer ? 'Pick a word to draw' : `${drawerName} is choosing a word… (${game.selectLeft ?? 15}s)`}
      </span>
    );
  }
  if (game.phase === 'ROUND_END') return <span className="word">{game.word || 'No word this round'}</span>;
  if (isDrawer) return <span className="word">{game.word}</span>;
  if (game.mask) {
    return (
      <span className="mask" aria-label={`${game.wordLength} letters`}>
        {game.mask.map((c, i) => (c === ' ' ? <i key={i} className="gap" /> : <i key={i} className="cell">{c === '_' ? '' : c}</i>))}
        <small>{game.wordLength}</small>
      </span>
    );
  }
  return <span className="hint">Hidden word · {game.wordLength} letters</span>;
}

function Chat({ messages, canGuess, meHasGuessed, isDrawer }) {
  const [text, setText] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last && last.kind === 'close') {
      setIsShaking(true);
      const timer = setTimeout(() => setIsShaking(false), 500);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    socket.emit(canGuess ? 'guess' : 'chat', { text });
    setText('');
  };

  const placeholder = canGuess
    ? 'Type your guess…'
    : isDrawer || meHasGuessed
    ? 'Chat with players who know the word'
    : 'Chat…';

  return (
    <aside className="panel chat">
      <div className="chat-header">
        <span>💬 Room Chat</span>
        {meHasGuessed && <span className="chat-badge ok">You guessed it!</span>}
        {isDrawer && <span className="chat-badge drawer">You are drawing</span>}
      </div>

      <ul>
        {messages.map((m) => (
          <li key={m.id} className={`m-${m.kind}`}>
            {m.kind === 'correct' && <span className="chat-icon">🎉 </span>}
            {m.kind === 'hint' && <span className="chat-icon">💡 </span>}
            {m.kind === 'close' && <span className="chat-icon">⚠️ </span>}
            {m.name && <b className="sender-name">{m.name}: </b>}
            <span className="msg-content">{m.text}</span>
            {m.points && <span className="earned-points">+{m.points}</span>}
          </li>
        ))}
        <li ref={end} />
      </ul>
      <form onSubmit={send}>
        <input
          className={`input ${isShaking ? 'shake-anim' : ''}`}
          value={text}
          maxLength={100}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          aria-label="Guess or chat"
        />
      </form>
    </aside>
  );
}

function Toolbar({ tool, setTool }) {
  return (
    <div className="toolbar panel">
      <div className="tool-modes">
        <button
          type="button"
          aria-label="Brush / Pen"
          title="Pen / Brush"
          className={`btn-icon ${tool.mode === 'brush' ? 'on' : ''}`}
          onClick={() => setTool({ ...tool, mode: 'brush' })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/>
            <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <path d="M2 2l7.586 7.586"/>
            <circle cx="11" cy="11" r="2"/>
          </svg>
          <span className="tool-label">Pen</span>
        </button>

        <button
          type="button"
          aria-label="Paint Bucket / Fill"
          title="Paint Bucket / Flood Fill"
          className={`btn-icon ${tool.mode === 'fill' ? 'on' : ''}`}
          onClick={() => setTool({ ...tool, mode: 'fill' })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/>
            <path d="m5 2 5 5"/>
            <path d="M2 13h15"/>
            <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/>
          </svg>
          <span className="tool-label">Fill</span>
        </button>

        <button
          type="button"
          aria-label="Eraser"
          title="Eraser"
          className={`btn-icon ${tool.mode === 'eraser' ? 'on' : ''}`}
          onClick={() => setTool({ ...tool, mode: 'eraser' })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/>
            <path d="M22 21H7"/>
            <path d="m5 11 9 9"/>
          </svg>
          <span className="tool-label">Eraser</span>
        </button>
      </div>

      <div className="swatches">
        {COLORS.map((c) => (
          <button
            key={c}
            aria-label={`Color ${c}`}
            style={{ background: c }}
            className={tool.mode !== 'eraser' && tool.color === c ? 'sw on' : 'sw'}
            onClick={() => setTool({ ...tool, color: c, mode: tool.mode === 'eraser' ? 'brush' : tool.mode })}
          />
        ))}
      </div>

      <div className="sizes">
        {SIZES.map((s) => (
          <button
            key={s}
            aria-label={`Brush size ${s}`}
            title={`Size ${s}`}
            className={tool.size === s ? 'sz on' : 'sz'}
            onClick={() => setTool({ ...tool, size: s })}
          >
            <i style={{ width: s + 4, height: s + 4 }} />
          </button>
        ))}
      </div>

      <div className="action-buttons">
        <button
          type="button"
          className="btn small"
          title="Undo last stroke"
          onClick={() => socket.emit('draw_undo')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>
          </svg>
          Undo
        </button>
        <button
          type="button"
          className="btn small danger"
          title="Clear canvas"
          onClick={() => socket.emit('canvas_clear')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          </svg>
          Clear
        </button>
      </div>
    </div>
  );
}

export default function Game({ game, me, messages, roundEnd, recentGuesser, onLeave }) {
  const [tool, setTool] = useState({ color: '#000000', size: 10, mode: 'brush' });
  const isDrawer = game.drawerId === me.playerId;
  const drawer = game.players.find((p) => p.id === game.drawerId);
  const mine = game.players.find((p) => p.id === me.playerId);
  const canGuess = game.phase === 'DRAWING' && !isDrawer && !mine?.hasGuessed;
  const ranked = [...game.players].sort((a, b) => b.score - a.score);
  const pct = game.phase === 'DRAWING' ? (game.timeLeft / game.drawTime) * 100 : 0;
  const low = game.phase === 'DRAWING' && game.timeLeft <= 10;

  return (
    <main className="game">
      <header className="topbar panel">
        <span className="round">Round {game.round}/{game.totalRounds}</span>
        <WordBar game={game} isDrawer={isDrawer} drawerName={drawer?.name} />
        <span className={low ? 'clock low clock-pulse' : 'clock'}>
          {game.phase === 'DRAWING' ? game.timeLeft : '–'}
        </span>
        <button className="btn small ghost" onClick={onLeave}>Leave</button>
      </header>
      <div className="timebar"><div className={low ? 'low' : ''} style={{ width: `${pct}%` }} /></div>

      <div className="cols">
        <aside className="panel players">
          <ol>
            {ranked.map((p, i) => {
              const avatar = getAvatar(p.avatar);
              const isRecent = recentGuesser && recentGuesser.id === p.id;
              return (
                <li
                  key={p.id}
                  className={`${p.connected ? '' : 'off'} ${p.id === game.drawerId ? 'drawing' : ''} ${isRecent ? 'player-bounce' : ''}`}
                >
                  <span className="rank">#{i + 1}</span>
                  <span className="avatar-in-list" title={avatar.label}>{avatar.emoji}</span>
                  <span className="pname">
                    {p.name}
                    {p.id === me.playerId && <small className="you-label"> (you)</small>}
                  </span>
                  <div className="score-wrap">
                    <span className="pscore">{p.score}</span>
                    {isRecent && <span className="score-popup">+{recentGuesser.points}</span>}
                  </div>
                  {p.id === game.drawerId && <span className="tag">✏️ drawing</span>}
                  {p.hasGuessed && <span className="tag ok">✅ guessed</span>}
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="center">
          <div className="stage">
            <Canvas canDraw={isDrawer && game.phase === 'DRAWING'} tool={tool} strokes={game.strokes} />

            {game.phase === 'WORD_SELECT' && (
              <div className="overlay">
                {isDrawer ? (
                  <>
                    <h2>Choose a word to draw</h2>
                    <div className="row wrap">
                      {game.wordOptions.map((w) => (
                        <button key={w} className="btn go big-word-choice" onClick={() => socket.emit('word_chosen', { word: w })}>
                          {w}
                        </button>
                      ))}
                    </div>
                    <p className="select-countdown">
                      Auto-picking in <b>{game.selectLeft ?? 15}s</b>
                    </p>
                  </>
                ) : (
                  <div className="guesser-wait-box">
                    <h2>{drawer?.name} is choosing a word…</h2>
                    <div className="spinner-dots">
                      <div className="pulse-timer-circle">
                        <span>{game.selectLeft ?? 15}s</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {game.phase === 'ROUND_END' && roundEnd && (
              <div className="overlay">
                <p className="muted">{roundEnd.reason === 'drawer_left' ? 'The drawer left the game' : 'The word was'}</p>
                {roundEnd.word && <h2 className="bigword">{roundEnd.word}</h2>}
                <ul className="gains">
                  {[...roundEnd.scores].sort((a, b) => b.gain - a.gain).map((s) => (
                    <li key={s.id}>
                      <span>{s.name}</span>
                      <b className={s.gain ? 'plus' : ''}>{s.gain ? `+${s.gain}` : '0'}</b>
                    </li>
                  ))}
                </ul>
                {roundEnd.nextDrawer && <p className="muted">Next drawer: <b>{roundEnd.nextDrawer}</b></p>}
              </div>
            )}
          </div>
          {isDrawer && game.phase === 'DRAWING' && <Toolbar tool={tool} setTool={setTool} />}
        </section>

        <Chat messages={messages} canGuess={canGuess} meHasGuessed={!!mine?.hasGuessed} isDrawer={isDrawer} />
      </div>
    </main>
  );
}
