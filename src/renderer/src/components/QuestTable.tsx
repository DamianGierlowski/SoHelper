import type { QuestBoardRow } from '../../../shared/types.mts';
import { formatCountdown, formatDateTime, formatDuration } from '../lib/time.mts';
import { ClockIcon } from './ClockIcon.tsx';
import { TrashIcon } from './TrashIcon.tsx';

interface Props {
  rows: QuestBoardRow[];
  now: number;
  locationName: (id: string) => string;
  onTakeNow: (quest: QuestBoardRow) => void;
  onBackfill: (quest: QuestBoardRow) => void;
  onUndo: (quest: QuestBoardRow) => void;
  onDelete: (quest: QuestBoardRow) => void;
}

export function QuestTable({
  rows,
  now,
  locationName,
  onTakeNow,
  onBackfill,
  onUndo,
  onDelete,
}: Props): React.JSX.Element {
  return (
    <div className="quest-table">
      <div className="quest-head">
        <div>QUEST</div>
        <div>LOCATION</div>
        <div>NPC</div>
        <div>STATUS</div>
        <div />
      </div>

      {rows.map((quest) => (
        <QuestRow
          key={quest.id}
          quest={quest}
          now={now}
          locationName={locationName}
          onTakeNow={onTakeNow}
          onBackfill={onBackfill}
          onUndo={onUndo}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function QuestRow({
  quest,
  now,
  locationName,
  onTakeNow,
  onBackfill,
  onUndo,
  onDelete,
}: { quest: QuestBoardRow } & Omit<Props, 'rows'>): React.JSX.Element {
  const ready = quest.nextAvailableAt === null || quest.nextAvailableAt <= now;
  const total = quest.cooldownMinutes * 60_000;
  const elapsed = quest.lastTakenAt === null ? 0 : now - quest.lastTakenAt;
  const progress = Math.min(100, Math.max(0, (elapsed / total) * 100));

  return (
    <div className="quest-row">
      <div>
        <div className="quest-name">{quest.name}</div>
        <div className="quest-sub">
          resets every {formatDuration(quest.cooldownMinutes)}
          {quest.lastTakenAt !== null && ` · last taken ${formatDateTime(quest.lastTakenAt)}`}
        </div>
      </div>

      <div className="cell-dim">{locationName(quest.locationId)}</div>
      <div className="cell-dim">{quest.npcName}</div>

      <div>
        {ready ? (
          <div className="status-ready">
            <span className="dot" />
            {quest.lastTakenAt === null ? 'Never taken' : 'Available'}
          </div>
        ) : (
          <div className="status-waiting">
            <span className="time">{formatCountdown((quest.nextAvailableAt as number) - now)}</span>{' '}
            <span className="caption">until reset</span>
            <div className="progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </div>

      <div className="quest-actions">
        {ready ? (
          <>
            <button className="btn btn-ready" onClick={() => onTakeNow(quest)}>
              Take
            </button>
            <button
              className="btn btn-icon"
              title="Set when you took it"
              onClick={() => onBackfill(quest)}
            >
              <ClockIcon />
            </button>
          </>
        ) : (
          <>
            <button className="btn" onClick={() => onUndo(quest)}>
              Undo
            </button>
            <button
              className="btn btn-icon"
              title="Fix when you took it"
              onClick={() => onBackfill(quest)}
            >
              <ClockIcon />
            </button>
          </>
        )}

        <button
          className="btn destroy"
          title="Delete quest"
          aria-label="Delete quest"
          onClick={() => onDelete(quest)}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}
