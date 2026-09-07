import { useState } from 'react';
import type { QuestBoardRow } from '../../../shared/types.mts';
import { Modal } from './Modal.tsx';
import { formatCountdown, formatDuration, fromDateTimeLocal, toDateTimeLocal } from '../lib/time.mts';

const HOUR = 3_600_000;

const SHORTCUTS: Array<[string, number]> = [
  ['Now', 0],
  ['1 hour ago', HOUR],
  ['3 hours ago', 3 * HOUR],
  ['6 hours ago', 6 * HOUR],
  ['Yesterday, same time', 24 * HOUR],
];

interface Props {
  quest: QuestBoardRow;
  /** 'add' dopisuje nowe wziecie, 'replace' poprawia to, ktore trzyma cooldown. */
  mode: 'add' | 'replace';
  onClose: () => void;
  onSave: (takenAt: number) => void;
}

export function TakeDialog({ quest, mode, onClose, onSave }: Props): React.JSX.Element {
  const [value, setValue] = useState(() => toDateTimeLocal(Date.now()));

  const takenAt = fromDateTimeLocal(value);
  const valid = Number.isFinite(takenAt) && takenAt <= Date.now();
  const nextAt = takenAt + quest.cooldownMinutes * 60_000;
  const remaining = nextAt - Date.now();

  return (
    <Modal
      title={mode === 'replace' ? 'Fix when you took it' : 'When did you take this quest?'}
      subtitle={quest.name}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => onSave(takenAt)}>
            Save
          </button>
        </>
      }
    >
      <div className="chips">
        {SHORTCUTS.map(([label, ago]) => (
          <button key={label} onClick={() => setValue(toDateTimeLocal(Date.now() - ago))}>
            {label}
          </button>
        ))}
      </div>

      <label className="field">
        <span>EXACT TIME</span>
        <input
          type="datetime-local"
          value={value}
          max={toDateTimeLocal(Date.now())}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>

      {mode === 'replace' && (
        <div className="hint" style={{ marginBottom: 12 }}>
          <span>This replaces the take that's currently holding the cooldown.</span>
        </div>
      )}

      <div className="hint">
        {!valid ? (
          <span>The take time cannot be in the future.</span>
        ) : (
          <span>
            Resets {formatDuration(quest.cooldownMinutes)} after the chosen time —{' '}
            {remaining <= 0
              ? 'the quest is available right away.'
              : `${formatCountdown(remaining)} left.`}
          </span>
        )}
      </div>
    </Modal>
  );
}
