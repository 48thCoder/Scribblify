import { useState } from 'react';
import { socket } from '../socket';
import { getAvatar } from '../avatars';

export default function Lobby({ game, me, onLeave }) {
  const [copied, setCopied] = useState(false);
  const isHost = game.hostId === me.playerId;
  const s = game.settings;
  const link = `${location.origin}/?room=${game.roomId}`;
  const present = game.players.filter((p) => p.connected);
  const myself = game.players.find((p) => p.id === me.playerId);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const updateSetting = (key, val) => {
    if (!isHost) return;
    socket.emit('update_settings', { [key]: val });
  };

  return (
    <main className="lobby">
      <section className="panel">
        <h2>Room <span className="roomcode">{game.roomId}</span></h2>
        <p className="muted">{s.isPublic ? 'Public room (anyone can join)' : 'Private room: share the link to invite friends'}</p>
        <div className="row">
          <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Invite link" />
          <button className="btn" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
        </div>

        <h3 style={{ margin: '4px' }}>Players ({present.length}/{s.maxPlayers})</h3>
        <ul className="plist">
          {game.players.map((p) => {
            const avatar = getAvatar(p.avatar);
            return (
              <li key={p.id} className={p.connected ? '' : 'off'}>
                <span className="avatar avatar-emoji" title={avatar.label}>{avatar.emoji}</span>
                <span className="pname">
                  {p.name}
                  {p.id === me.playerId && <b className="you-tag"> (you)</b>}
                  {p.isHost && <span className="host-badge">👑 Host</span>}
                </span>
                <span className={p.ready ? 'tag ok' : 'tag'}>{p.ready ? 'Ready' : 'Not ready'}</span>
                {isHost && p.id !== me.playerId && (
                  <button className="btn small danger" onClick={() => socket.emit('kick_player', { playerId: p.id })}>Kick</button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="row">
          <button className="btn" onClick={() => socket.emit('toggle_ready')}>{myself?.ready ? 'Not ready' : "I'm ready"}</button>
          {isHost
            ? <button className="btn go" disabled={present.length < 2} onClick={() => socket.emit('start_game')}>
                {present.length < 2 ? 'Waiting for players (min 2)…' : 'Start game'}
              </button>
            : <span className="muted">Waiting for the host to start…</span>}
          <button className="btn ghost" onClick={onLeave}>Leave</button>
        </div>
      </section>

      <aside className="panel settings">
        <div className="settings-header">
          <h3>Game settings</h3>
          {isHost && <small className="host-hint">✏️ Edit as host</small>}
        </div>

        {isHost ? (
          <div className="settings-edit-list">
            <label className="lobby-setting-row">
              <span>Rounds</span>
              <select className="input compact" value={s.rounds} onChange={(e) => updateSetting('rounds', +e.target.value)}>
                {[2, 3, 4, 5, 6, 8, 10].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>

            <label className="lobby-setting-row">
              <span>Draw time</span>
              <select className="input compact" value={s.drawTime} onChange={(e) => updateSetting('drawTime', +e.target.value)}>
                {[30, 45, 60, 80, 90, 120, 150].map(t => <option key={t} value={t}>{t}s</option>)}
              </select>
            </label>

            <label className="lobby-setting-row">
              <span>Word choices</span>
              <select className="input compact" value={s.wordCount} onChange={(e) => updateSetting('wordCount', +e.target.value)}>
                {[2, 3, 4, 5].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </label>

            <label className="lobby-setting-row">
              <span>Hints</span>
              <select className="input compact" value={s.hints} onChange={(e) => updateSetting('hints', +e.target.value)}>
                {[0, 1, 2, 3, 4, 5].map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </label>

            <label className="lobby-setting-row">
              <span>Word mode</span>
              <select className="input compact" value={s.wordMode} onChange={(e) => updateSetting('wordMode', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>

            <label className="lobby-setting-row">
              <span>Max players</span>
              <select className="input compact" value={s.maxPlayers} onChange={(e) => updateSetting('maxPlayers', +e.target.value)}>
                {[2, 4, 6, 8, 10, 12, 16, 20].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>
        ) : (
          <dl>
            <dt>Rounds</dt><dd>{s.rounds}</dd>
            <dt>Draw time</dt><dd>{s.drawTime}s</dd>
            <dt>Word choices</dt><dd>{s.wordCount}</dd>
            <dt>Hints</dt><dd>{s.hints}</dd>
            <dt>Word mode</dt><dd>{s.wordMode === 'hidden' ? 'Hidden' : 'Normal'}</dd>
            <dt>Max players</dt><dd>{s.maxPlayers}</dd>
          </dl>
        )}
      </aside>
    </main>
  );
}
