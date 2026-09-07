import { useState } from 'react';
import type { Location, Npc, Quest } from '../../../shared/types.mts';
import { Modal } from './Modal.tsx';
import type { ConfirmOptions } from './ConfirmDialog.tsx';
import { formatDuration } from '../lib/time.mts';

type Tab = 'npcs' | 'quests';

interface Props {
  initialTab?: Tab;
  locations: Location[];
  npcs: Npc[];
  quests: Quest[];
  onClose: () => void;
  run: (action: () => Promise<unknown>) => Promise<boolean>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export function CatalogDialog({
  initialTab = 'quests',
  locations,
  npcs,
  quests,
  onClose,
  run,
  confirm,
}: Props): React.JSX.Element {
  const [tab, setTab] = useState<Tab>(initialTab);
  const locationName = (id: string): string => locations.find((l) => l.id === id)?.name ?? id;
  const npcName = (id: string): string => npcs.find((n) => n.id === id)?.name ?? '—';

  return (
    <Modal title="Catalog" subtitle="Quests and NPCs are yours to add" onClose={onClose} width={560}>
      <div className="tabs" style={{ padding: 0, marginBottom: 16 }}>
        <button className={tab === 'quests' ? 'is-active' : undefined} onClick={() => setTab('quests')}>
          Quests ({quests.length})
        </button>
        <button className={tab === 'npcs' ? 'is-active' : undefined} onClick={() => setTab('npcs')}>
          NPCs ({npcs.length})
        </button>
      </div>

      {tab === 'quests' ? (
        <QuestsTab quests={quests} npcs={npcs} npcName={npcName} run={run} confirm={confirm} />
      ) : (
        <NpcsTab
          npcs={npcs}
          locations={locations}
          locationName={locationName}
          run={run}
          confirm={confirm}
        />
      )}
    </Modal>
  );
}

// --- NPC -------------------------------------------------------------------

function NpcsTab({
  npcs,
  locations,
  locationName,
  run,
  confirm,
}: {
  npcs: Npc[];
  locations: Location[];
  locationName: (id: string) => string;
  run: Props['run'];
  confirm: Props['confirm'];
}): React.JSX.Element {
  const [editing, setEditing] = useState<Npc | null>(null);
  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');

  const reset = (): void => {
    setEditing(null);
    setName('');
    setLocationId(locations[0]?.id ?? '');
  };

  const submit = async (): Promise<void> => {
    const data = { name, locationId };
    const ok = await run(() =>
      editing ? window.api.npcs.update(editing.id, data) : window.api.npcs.create(data),
    );
    if (ok) reset();
  };

  return (
    <>
      <div className="field-row">
        <label className="field">
          <span>{editing ? 'EDITING NPC' : 'NEW NPC'}</span>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>LOCATION</span>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <button className="btn btn-primary" disabled={!name.trim()} onClick={() => void submit()}>
          {editing ? 'Save changes' : 'Add NPC'}
        </button>
        {editing && (
          <button className="btn" onClick={reset}>
            Cancel
          </button>
        )}
      </div>

      <div className="row-list">
        {npcs.length === 0 && <p className="quest-sub">No NPCs yet. Add one above.</p>}
        {npcs.map((npc) => (
          <div className="row-item" key={npc.id}>
            <div className="grow">
              <div className="name">{npc.name}</div>
              <div className="meta">{locationName(npc.locationId)}</div>
            </div>
            <button
              className="btn-quiet"
              onClick={() => {
                setEditing(npc);
                setName(npc.name);
                setLocationId(npc.locationId);
              }}
            >
              Edit
            </button>
            <button
              className="btn-quiet btn-danger"
              onClick={() => {
                void confirm({
                  title: 'Delete NPC?',
                  message: `“${npc.name}” will be removed. If they give any quests, the delete is rejected.`,
                }).then((ok) => {
                  if (ok) void run(() => window.api.npcs.remove(npc.id));
                });
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// --- questy ----------------------------------------------------------------

function QuestsTab({
  quests,
  npcs,
  npcName,
  run,
  confirm,
}: {
  quests: Quest[];
  npcs: Npc[];
  npcName: (id: string) => string;
  run: Props['run'];
  confirm: Props['confirm'];
}): React.JSX.Element {
  const [editing, setEditing] = useState<Quest | null>(null);
  const [name, setName] = useState('');
  const [npcId, setNpcId] = useState(npcs[0]?.id ?? '');
  const [amount, setAmount] = useState('24');
  const [unit, setUnit] = useState<'h' | 'min'>('h');

  const reset = (): void => {
    setEditing(null);
    setName('');
    setNpcId(npcs[0]?.id ?? '');
    setAmount('24');
    setUnit('h');
  };

  const cooldownMinutes = Math.round(Number(amount) * (unit === 'h' ? 60 : 1));
  const valid = name.trim() !== '' && npcId !== '' && Number.isInteger(cooldownMinutes) && cooldownMinutes > 0;

  const submit = async (): Promise<void> => {
    const data = { name, npcId, cooldownMinutes };
    const ok = await run(() =>
      editing ? window.api.quests.update(editing.id, data) : window.api.quests.create(data),
    );
    if (ok) reset();
  };

  if (npcs.length === 0) {
    return (
      <div className="empty">
        <h2>NPCs first</h2>
        <p>A quest needs someone to give it. Switch to the NPCs tab and add one.</p>
      </div>
    );
  }

  return (
    <>
      <label className="field">
        <span>{editing ? 'EDITING QUEST' : 'NEW QUEST'}</span>
        <input placeholder="Quest name" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="field-row">
        <label className="field">
          <span>GIVEN BY</span>
          <select value={npcId} onChange={(e) => setNpcId(e.target.value)}>
            {npcs.map((npc) => (
              <option key={npc.id} value={npc.id}>
                {npc.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field" style={{ maxWidth: 100 }}>
          <span>RESETS EVERY</span>
          <input
            type="number"
            min={1}
            step={unit === 'h' ? 1 : 5}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <label className="field" style={{ maxWidth: 100 }}>
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
        {quests.map((quest) => (
          <div className="row-item" key={quest.id}>
            <div className="grow">
              <div className="name">{quest.name}</div>
              <div className="meta">
                {npcName(quest.npcId)} · resets every {formatDuration(quest.cooldownMinutes)}
              </div>
            </div>
            <button
              className="btn-quiet"
              onClick={() => {
                setEditing(quest);
                setName(quest.name);
                setNpcId(quest.npcId);
                if (quest.cooldownMinutes % 60 === 0) {
                  setAmount(String(quest.cooldownMinutes / 60));
                  setUnit('h');
                } else {
                  setAmount(String(quest.cooldownMinutes));
                  setUnit('min');
                }
              }}
            >
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
        ))}
      </div>
    </>
  );
}
