import type { Location, Npc } from '../../../shared/types.mts';

export type Segment = 'all' | 'ready' | 'waiting';

interface Props {
  search: string;
  onSearch: (value: string) => void;
  locationId: string;
  onLocation: (value: string) => void;
  npcId: string;
  onNpc: (value: string) => void;
  segment: Segment;
  onSegment: (value: Segment) => void;
  locations: Location[];
  npcs: Npc[];
}

const SEGMENTS: Array<[Segment, string]> = [
  ['all', 'All'],
  ['ready', 'Available'],
  ['waiting', 'Cooldown'],
];

export function Filters(props: Props): React.JSX.Element {
  return (
    <div className="filters">
      <input
        className="search"
        type="search"
        placeholder="Search quests…"
        value={props.search}
        onChange={(e) => props.onSearch(e.target.value)}
      />

      <select value={props.locationId} onChange={(e) => props.onLocation(e.target.value)}>
        <option value="">Location: all</option>
        {props.locations.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>

      <select value={props.npcId} onChange={(e) => props.onNpc(e.target.value)}>
        <option value="">NPC: all</option>
        {props.npcs.map((npc) => (
          <option key={npc.id} value={npc.id}>
            {npc.name}
          </option>
        ))}
      </select>

      <div className="segments">
        {SEGMENTS.map(([value, label]) => (
          <button
            key={value}
            className={props.segment === value ? 'is-active' : undefined}
            onClick={() => props.onSegment(value)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
