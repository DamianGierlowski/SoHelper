import { useMemo, useState } from 'react';
import type { Profile, QuestBoardRow } from '../../shared/types.mts';
import { useAppData } from './lib/useAppData.mts';
import { useNow } from './lib/useNow.mts';
import { Sidebar } from './components/Sidebar.tsx';
import { StatCards } from './components/StatCards.tsx';
import { Filters, type Segment } from './components/Filters.tsx';
import { QuestTable } from './components/QuestTable.tsx';
import { TakeDialog } from './components/TakeDialog.tsx';
import { ProfileDialog } from './components/ProfileDialog.tsx';
import { CatalogDialog } from './components/CatalogDialog.tsx';
import { useConfirm } from './components/ConfirmDialog.tsx';
import { UpdateBanner } from './components/UpdateBanner.tsx';

export default function App(): React.JSX.Element {
  const data = useAppData();
  const now = useNow();
  const [confirmNode, confirm] = useConfirm();

  const [search, setSearch] = useState('');
  const [locationId, setLocationId] = useState('');
  const [npcId, setNpcId] = useState('');
  const [segment, setSegment] = useState<Segment>('all');

  const [profileDialog, setProfileDialog] = useState<{ profile: Profile | null } | null>(null);
  const [catalogOpen, setCatalogOpen] = useState<'quests' | 'npcs' | null>(null);
  const [takeQuest, setTakeQuest] = useState<QuestBoardRow | null>(null);

  const activeProfile = data.profiles.find((p) => p.id === data.activeProfileId) ?? null;
  const locationName = (id: string): string =>
    data.locations.find((l) => l.id === id)?.name ?? id;

  const isReady = (quest: QuestBoardRow): boolean =>
    quest.nextAvailableAt === null || quest.nextAvailableAt <= now;

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return data.board
      .filter((quest) => {
        if (needle && !`${quest.name} ${quest.npcName}`.toLowerCase().includes(needle)) return false;
        if (locationId && quest.locationId !== locationId) return false;
        if (npcId && quest.npcId !== npcId) return false;
        if (segment === 'ready') return isReady(quest);
        if (segment === 'waiting') return !isReady(quest);
        return true;
      })
      .sort((a, b) => {
        const readyA = isReady(a);
        const readyB = isReady(b);
        // Dostepne na gorze, reszta wedlug tego, co odnowi sie najszybciej.
        if (readyA !== readyB) return readyA ? -1 : 1;
        if (readyA) return a.name.localeCompare(b.name, 'en');
        return (a.nextAvailableAt ?? 0) - (b.nextAvailableAt ?? 0);
      });
    // `now` celowo w zaleznosciach: przekroczenie momentu odnowy zmienia kolejnosc.
  }, [data.board, search, locationId, npcId, segment, now]);

  const readyCount = data.board.filter(isReady).length;

  const removeProfile = async (): Promise<void> => {
    if (!activeProfile) return;
    const ok = await confirm({
      title: 'Delete character?',
      message: `“${activeProfile.nick}” and their whole take history will be gone. Quests stay.`,
    });
    if (ok) await data.run(() => window.api.profiles.remove(activeProfile.id));
  };

  const removeQuest = async (quest: QuestBoardRow): Promise<void> => {
    const ok = await confirm({
      title: 'Delete quest?',
      message: `“${quest.name}” and its entire take history will be gone — for every character.`,
    });
    if (ok) await data.run(() => window.api.quests.remove(quest.id));
  };

  return (
    <>
      <Sidebar
        profiles={data.profiles}
        activeProfile={activeProfile}
        readyCount={readyCount}
        onSwitchProfile={(id) => void data.run(() => window.api.profiles.setActive(id))}
        onAddProfile={() => setProfileDialog({ profile: null })}
        onEditProfile={() => setProfileDialog({ profile: activeProfile })}
        onRemoveProfile={() => void removeProfile()}
      />

      <div className="main">
        <header className="topbar">
          <div>
            <h1>Daily Quests</h1>
            <p className="subtitle">
              {activeProfile
                ? `${activeProfile.nick} · ${readyCount} of ${data.board.length} available`
                : 'Add a character to start'}
            </p>
          </div>
          <div className="topbar-actions">
            <button className="btn" onClick={() => setCatalogOpen('npcs')}>
              NPCs
            </button>
            <button className="btn btn-primary" onClick={() => setCatalogOpen('quests')}>
              + Quest
            </button>
          </div>
        </header>

        <div className="content">
          <UpdateBanner />

          {data.error && (
            <div className="error-bar">
              <span>{data.error}</span>
              <button onClick={data.clearError}>✕</button>
            </div>
          )}

          {data.loading ? null : !activeProfile ? (
            <div className="empty">
              <h2>Start with a character</h2>
              <p>
                Each character keeps its own take history — the same quest can be on cooldown for
                one and available for another.
              </p>
              <button className="btn btn-primary" onClick={() => setProfileDialog({ profile: null })}>
                Add character
              </button>
            </div>
          ) : data.board.length === 0 ? (
            <div className="empty">
              <h2>No quests yet</h2>
              <p>
                Add the NPC who gives the quest, then the quest itself and how long it takes to
                reset. From then on you just hit “Take”.
              </p>
              <button className="btn btn-primary" onClick={() => setCatalogOpen('npcs')}>
                Open catalog
              </button>
            </div>
          ) : (
            <>
              <StatCards board={data.board} now={now} />
              <Filters
                search={search}
                onSearch={setSearch}
                locationId={locationId}
                onLocation={setLocationId}
                npcId={npcId}
                onNpc={setNpcId}
                segment={segment}
                onSegment={setSegment}
                locations={data.locations.filter((l) =>
                  data.npcs.some((n) => n.locationId === l.id),
                )}
                npcs={data.npcs}
              />
              {rows.length === 0 ? (
                <div className="empty">
                  <h2>Nothing matches</h2>
                  <p>Change the filters or clear the search.</p>
                </div>
              ) : (
                <QuestTable
                  rows={rows}
                  now={now}
                  locationName={locationName}
                  onTakeNow={(quest) =>
                    void data.run(() =>
                      window.api.takes.add(activeProfile.id, quest.id),
                    )
                  }
                  onUndo={(quest) =>
                    void data.run(() => window.api.takes.undoLast(activeProfile.id, quest.id))
                  }
                  onBackfill={setTakeQuest}
                  onDelete={(quest) => void removeQuest(quest)}
                />
              )}
            </>
          )}
        </div>
      </div>

      {profileDialog && (
        <ProfileDialog
          profile={profileDialog.profile}
          onClose={() => setProfileDialog(null)}
          onSave={(input) => {
            const target = profileDialog.profile;
            void data
              .run(() =>
                target
                  ? window.api.profiles.update(target.id, input)
                  : window.api.profiles.create(input),
              )
              .then((ok) => {
                if (ok) setProfileDialog(null);
              });
          }}
        />
      )}

      {catalogOpen && (
        <CatalogDialog
          initialTab={catalogOpen}
          locations={data.locations}
          npcs={data.npcs}
          quests={data.quests}
          run={data.run}
          confirm={confirm}
          onClose={() => setCatalogOpen(null)}
        />
      )}

      {takeQuest && activeProfile && (
        <TakeDialog
          quest={takeQuest}
          mode={isReady(takeQuest) ? 'add' : 'replace'}
          onClose={() => setTakeQuest(null)}
          onSave={(takenAt) => {
            // Quest na cooldownie: poprawiamy wpis, ktory ten cooldown trzyma.
            // Quest dostepny: dopisujemy nowe wziecie, nie ruszajac historii.
            const replacing = !isReady(takeQuest);
            void data
              .run(async () => {
                if (replacing) await window.api.takes.undoLast(activeProfile.id, takeQuest.id);
                await window.api.takes.add(activeProfile.id, takeQuest.id, takenAt);
              })
              .then((ok) => {
                if (ok) setTakeQuest(null);
              });
          }}
        />
      )}

      {confirmNode}
    </>
  );
}
