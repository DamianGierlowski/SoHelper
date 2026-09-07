import type { QuestBoardRow } from '../../../shared/types.mts';
import { formatCountdown } from '../lib/time.mts';

interface Props {
  board: QuestBoardRow[];
  now: number;
}

export function StatCards({ board, now }: Props): React.JSX.Element {
  const ready = board.filter((q) => q.nextAvailableAt === null || q.nextAvailableAt <= now);
  const waiting = board.filter((q) => q.nextAvailableAt !== null && q.nextAvailableAt > now);

  const soonest = waiting.reduce<number | null>(
    (min, q) => (min === null || (q.nextAvailableAt as number) < min ? q.nextAvailableAt : min),
    null,
  );
  const neverTaken = board.filter((q) => q.lastTakenAt === null).length;

  return (
    <div className="stats">
      <div className="stat is-ready">
        <div className="stat-label">AVAILABLE NOW</div>
        <div className="stat-value">{ready.length}</div>
        <div className="stat-meta">of {board.length} tracked</div>
      </div>

      <div className="stat is-waiting">
        <div className="stat-label">ON COOLDOWN</div>
        <div className="stat-value">{waiting.length}</div>
        <div className="stat-meta">
          {soonest === null ? 'none' : `next in ${formatCountdown(soonest - now)}`}
        </div>
      </div>

      <div className="stat">
        <div className="stat-label">NEVER TAKEN</div>
        <div className="stat-value">{neverTaken}</div>
        <div className="stat-meta">by this character</div>
      </div>
    </div>
  );
}
