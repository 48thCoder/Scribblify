import { useState } from 'react';
import { AVATARS, getAvatar } from '../avatars';

const DEFAULTS = { maxPlayers: 8, rounds: 3, drawTime: 80, wordCount: 3, hints: 2, wordMode: 'normal', isPublic: false };

function Range({ label, value, min, max, unit = '', onChange }) {
  return (
    <label className="range">
      <span>{label}<b>{value}{unit}</b></span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(+e.target.value)} />
    </label>
  );
}

export default function Home({ onCreate, onJoin, onQuickPlay, prefillCode }) {
  const [name, setName] = useState(localStorage.getItem('name') || '');
  const [avatarId, setAvatarId] = useState(() => {
    const saved = localStorage.getItem('avatar');
    return saved !== null ? Number(saved) : Math.floor(Math.random() * AVATARS.length);
  });
  const [code, setCode] = useState(prefillCode);
  const [tab, setTab] = useState(prefillCode ? 'join' : 'play');
  const [s, setS] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setS((o) => ({ ...o, [k]: v }));

  const currentAvatar = getAvatar(avatarId);

  const prevAvatar = () => {
    const next = (avatarId - 1 + AVATARS.length) % AVATARS.length;
    setAvatarId(next);
    localStorage.setItem('avatar', next);
  };

  const nextAvatar = () => {
    const next = (avatarId + 1) % AVATARS.length;
    setAvatarId(next);
    localStorage.setItem('avatar', next);
  };

  const run = async (fn) => {
    if (!name.trim() || busy) return;
    localStorage.setItem('name', name.trim());
    localStorage.setItem('avatar', avatarId);
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <main className="home">
      <h1 className="logo" aria-label="Scribblify">
        {'Scribblify'.split('').map((c, i) => (
          <span
            key={i}
            className="logo-letter"
            style={{
              color: ['#3b79c9', '#e53935', '#fdd835', '#43a047', '#fb8c00'][i % 5],
              '--i': i,
            }}
          >
            {c === ' ' ? '\u00A0' : c}
          </span>
        ))}
      </h1>
      <p className="tagline">Draw it. Guess it. Win it.</p>

      <section className="panel home-card">
        <div className="avatar-picker">
          <button type="button" className="avatar-nav-btn" onClick={prevAvatar} aria-label="Previous Avatar">◀</button>
          <div className="avatar-preview-wrap">
            <span className="avatar-big">{currentAvatar.emoji}</span>
            <span className="avatar-label">{currentAvatar.label}</span>
          </div>
          <button type="button" className="avatar-nav-btn" onClick={nextAvatar} aria-label="Next Avatar">▶</button>
        </div>

        <input
          className="input big" placeholder="Your name" maxLength={20} value={name}
          onChange={(e) => setName(e.target.value)} aria-label="Your name"
        />
        <div className="tabs" role="tablist">
          {[['play', 'Play'], ['join', 'Join with code'], ['create', 'Create room']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'tab on' : 'tab'} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'play' && (
          <div className="stack">
            <p className="muted">Jump into a public room, or start one if none are open.</p>
            <button className="btn go" disabled={!name.trim() || busy} onClick={() => run(() => onQuickPlay(name, avatarId))}>Play now</button>
          </div>
        )}

        {tab === 'join' && (
          <div className="stack">
            <input
              className="input code" placeholder="ROOM CODE" maxLength={5} value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Room code"
            />
            <button className="btn go" disabled={!name.trim() || code.length < 5 || busy} onClick={() => run(() => onJoin(code, name, avatarId))}>Join room</button>
          </div>
        )}

        {tab === 'create' && (
          <div className="stack">
            <div className="grid2">
              <Range label="Players " value={s.maxPlayers} min={2} max={20} onChange={set('maxPlayers')} />
              <Range label="Rounds " value={s.rounds} min={2} max={10} onChange={set('rounds')} />
              <Range label="Draw time " value={s.drawTime} min={15} max={240} unit="s" onChange={set('drawTime')} />
              <Range label="Word choices " value={s.wordCount} min={1} max={5} onChange={set('wordCount')} />
              <Range label="Hints " value={s.hints} min={0} max={5} onChange={set('hints')} />
              <label className="range">
                <span>Word mode</span>
                <select className="input" value={s.wordMode} onChange={(e) => set('wordMode')(e.target.value)}>
                  <option value="normal">Normal (blanks + hints)</option>
                  <option value="hidden">Hidden (length only)</option>
                </select>
              </label>
            </div>
            <label className="check">
              <input type="checkbox" checked={s.isPublic} onChange={(e) => set('isPublic')(e.target.checked)} />
              List as a public room (otherwise invite-only by link)
            </label>
            <button className="btn go" disabled={!name.trim() || busy} onClick={() => run(() => onCreate(name, s, avatarId))}>Create room</button>
          </div>
        )}
      </section>
    </main>
  );
}
