import { useCallback, useEffect, useState } from 'react';
import type { Location, Npc, Profile, Quest, QuestBoardRow } from '../../../shared/types.mts';

export interface AppData {
  loading: boolean;
  error: string | null;
  clearError: () => void;

  locations: Location[];
  profiles: Profile[];
  activeProfileId: string | null;
  npcs: Npc[];
  quests: Quest[];
  board: QuestBoardRow[];

  reload: () => Promise<void>;
  /** Wykonuje akcje, odswieza dane i zamienia wyjatek na komunikat w UI. */
  run: (action: () => Promise<unknown>) => Promise<boolean>;
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

export function useAppData(): AppData {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [board, setBoard] = useState<QuestBoardRow[]>([]);

  const reload = useCallback(async () => {
    try {
      const [nextLocations, nextProfiles, activeId, nextNpcs, nextQuests] = await Promise.all([
        window.api.locations.list(),
        window.api.profiles.list(),
        window.api.profiles.getActiveId(),
        window.api.npcs.list(),
        window.api.quests.list(),
      ]);

      setLocations(nextLocations);
      setProfiles(nextProfiles);
      setActiveProfileId(activeId);
      setNpcs(nextNpcs);
      setQuests(nextQuests);
      setBoard(activeId ? await window.api.quests.board(activeId) : []);
    } catch (err) {
      setError(message(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        setError(null);
        await reload();
        return true;
      } catch (err) {
        setError(message(err));
        return false;
      }
    },
    [reload],
  );

  return {
    loading,
    error,
    clearError: () => setError(null),
    locations,
    profiles,
    activeProfileId,
    npcs,
    quests,
    board,
    reload,
    run,
  };
}
