import { socket } from '../socket';
import { getAvatar } from '../avatars';

export default function GameOver({ game, me, onLeave }) {
  const board = [...game.players].sort((a, b) => b.score - a.score);
  const top = board[0]?.score ?? 0;
  const winners = board.filter((p) => p.score === top);
  const isHost = game.hostId === me.playerId;

  return (
    <main className="over">
      <section className="panel over-card">
        <span className="trophy-icon">🏆</span>
        <p className="muted">{winners.length > 1 ? 'It’s a tie!' : 'Winner!'}</p>
        <h1 className="winner">{winners.map((w) => w.name).join(' & ')}</h1>

        <ol className="board">
          {board.map((p, i) => {
            const avatar = getAvatar(p.avatar);
            const isWinner = p.score === top && top > 0;
            return (
              <li key={p.id} className={isWinner ? 'first' : ''}>
                <span className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                <span className="avatar-in-list">{avatar.emoji}</span>
                <span className="pname">
                  {p.name}
                  {p.id === me.playerId && ' (you)'}
                </span>
                <b className="final-score">{p.score} pts</b>
              </li>
            );
          })}
        </ol>

        <div className="row">
          {isHost ? (
            <button className="btn go" onClick={() => socket.emit('play_again')}>
              🔄 Back to lobby
            </button>
          ) : (
            <span className="muted">Waiting for the host to restart…</span>
          )}
          <button className="btn ghost" onClick={onLeave}>Leave</button>
        </div>
      </section>
    </main>
  );
}
