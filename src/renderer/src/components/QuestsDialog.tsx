import { useMemo, useState } from 'react';
import type { Location, Npc, Quest } from '../../../shared/types.mts';
import { Modal } from './Modal.tsx';
import type { ConfirmOptions } from './ConfirmDialog.tsx';
import { formatDuration } from '../lib/time.mts';

interface Props {
  locations: Location[];
  npcs: Npc[];
  quests: Quest[];
  onClose: () => void;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export function QuestsDialog({
  locations,
  npcs,
  quests,
  onClose,
  run,
  confirm,
}: Props): React.JSX.Element {
  const [editing, setEditing] = useState<Quest | null>(null);
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [npcId, setNpcId] = useState('');
  const [amount, setAmount] = useState('24');
  const [unit, setUnit] = useState<'h' | 'min'>('h');

  const npcById = useMemo(() => new Map(npcs.map((n) => [n.id, n])), [npcs]);

  // Tylko lokacje, w ktorych ktos stoi - reszta byla by slepa uliczka.
  const usableLocations = useMemo(() => {
    const populated = new Set(npcs.map((n) => n.locationId));
    return locations.filter((l) => populated.has(l.id));
  }, [locations, npcs]);

  const npcsHere = useMemo(
    () => npcs.filter((n) => n.locationId === locationId),
    [npcs, locationId],
  );

  const reset = (): void => {
    setEditing(null);
    setName('');
    setLocationId('');
    setNpcId('');
    setAmount('24');
    setUnit('h');
  };

  const startEditing = (quest: Quest): void => {
    setEditing(quest);
    setName(quest.name);
    setLocationId(npcById.get(quest.npcId)?.locationId ?? '');
    setNpcId(quest.npcId);
    if (quest.cooldownMinutes % 60 === 0) {
      setAmount(String(quest.cooldownMinutes / 60));
      setUnit('h');
    } else {
      setAmount(String(quest.cooldownMinutes));
      setUnit('min');
    }
  };

  const cooldownMinutes = Math.round(Number(amount) * (unit === 'h' ? 60 : 1));
  const valid =
    name.trim() !== '' && npcId !== '' && Number.isInteger(cooldownMinutes) && cooldownMinutes > 0;

  const submit = async (): Promise<void> => {
    const data = { name, npcId, cooldownMinutes };
    const ok = await run(() =>
      editing ? window.api.quests.update(editing.id, data) : window.api.quests.create(data),
    );
    if (ok) reset();
  };

  return (
    <Modal
      title="Quests"
      subtitle={`${quests.length} tracked · ${npcs.length} NPCs built in`}
      onClose={onClose}
      width={560}
    >
      <label className="field">
        <span>{editing ? 'EDITING QUEST' : 'NEW QUEST'}</span>
        <input placeholder="Quest name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <label className="field">
        <span>LOCATION</span>
        <select
          value={locationId}
          onChange={(e) => {
            setLocationId(e.target.value);
            setNpcId('');
          }}
        >
          <option value="">Pick a location…</option>
          {usableLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.name}
            </option>
          ))}
        </select>
      </label>

      <div className="field-row">
        <label className="field">
          <span>GIVEN BY</span>
          <select
            value={npcId}
            disabled={locationId === ''}
            onChange={(e) => setNpcId(e.target.value)}
          >
            <option value="">
              {locationId === '' ? 'Pick a location first' : `Pick an NPC (${npcsHere.length})…`}
            </option>
            {npcsHere.map((npc) => (
              <option key={npc.id} value={npc.id}>
                {npc.name}
                {npc.profession ? ` — ${npc.profession}` : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ maxWidth: 92 }}>
          <span>RESETS EVERY</span>
          <input
            type="number"
            min={1}
            step={unit === 'h' ? 1 : 5}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="field" style={{ maxWidth: 104 }}>
          <span>&nbsp;</span>
          <select value={unit} onChange={(e) => setUnit(e.target.value as 'h' | 'min')}>
            <option value="h">hours</option>
            <option value="min">minutes</option>
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className="btn btn-primary" disabled={!valid} onClick={() => void submit()}>
          {editing ? 'Save changes' : 'Add quest'}
        </button>
        {editing && (
          <button className="btn" onClick={reset}>
            Cancel
          </button>
        )}
      </div>

      <div className="row-list">
        {quests.length === 0 && <p className="quest-sub">No quests yet. Add one above.</p>}
        {quests.map((quest) => {
          const npc = npcById.get(quest.npcId);
          return (
            <div className="row-item" key={quest.id}>
              <div className="grow">
                <div className="name">{quest.name}</div>
                <div className="meta">
                  {npc?.name ?? 'Unknown NPC'} · resets every {formatDuration(quest.cooldownMinutes)}
                </div>
              </div>
              <button className="btn-quiet" onClick={() => startEditing(quest)}>
                Edit
              </button>
              <button
                className="btn-quiet btn-danger"
                onClick={() => {
                  void confirm({
                    title: 'Delete quest?',
                    message: `“${quest.name}” and its entire take history will be gone — for every character.`,
                  }).then((ok) => {
                    if (ok) void run(() => window.api.quests.remove(quest.id));
                  });
                }}
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
