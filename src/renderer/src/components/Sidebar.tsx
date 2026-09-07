import { useEffect, useRef, useState } from 'react';
import type { Profile } from '../../../shared/types.mts';
import { VersionLine } from './VersionLine.tsx';

interface Props {
  profiles: Profile[];
  activeProfile: Profile | null;
  readyCount: number;
  onSwitchProfile: (id: string) => void;
  onAddProfile: () => void;
  onEditProfile: () => void;
  onRemoveProfile: () => void;
}

export function Sidebar({
  profiles,
  activeProfile,
  readyCount,
  onSwitchProfile,
  onAddProfile,
  onEditProfile,
  onRemoveProfile,
}: Props): React.JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent): void => {
      if (!barRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const initials = (nick: string): string =>
    nick
      .split(/[\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?';

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">SO</div>
        <div>
          <div className="brand-name">STAY OUT</div>
          <div className="brand-sub">HELPER</div>
        </div>
      </div>

      <nav className="nav">
        <button className="nav-item is-active">
          Daily Quests
          {readyCount > 0 && <span className="badge">{readyCount}</span>}
        </button>
      </nav>

      <VersionLine />

      <div className="profile-bar" ref={barRef}>
        {menuOpen && (
          <div className="profile-menu">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                className={profile.id === activeProfile?.id ? 'is-current' : undefined}
                onClick={() => {
                  onSwitchProfile(profile.id);
                  setMenuOpen(false);
                }}
              >
                {profile.id === activeProfile?.id ? '● ' : '○ '}
                {profile.nick}
              </button>
            ))}
            <hr />
            <button
              onClick={() => {
                onAddProfile();
                setMenuOpen(false);
              }}
            >
              + New character
            </button>
            {activeProfile && (
              <>
                <button
                  onClick={() => {
                    onEditProfile();
                    setMenuOpen(false);
                  }}
                >
                  Rename “{activeProfile.nick}”
                </button>
                <button
                  className="btn-danger"
                  onClick={() => {
                    onRemoveProfile();
                    setMenuOpen(false);
                  }}
                >
                  Delete “{activeProfile.nick}”
                </button>
              </>
            )}
          </div>
        )}

        <button className="profile-button" onClick={() => setMenuOpen((open) => !open)}>
          <div className="avatar">{activeProfile ? initials(activeProfile.nick) : '–'}</div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="profile-nick">{activeProfile?.nick ?? 'No character'}</div>
            <div className="profile-meta">
              {profiles.length > 1 ? `${profiles.length} characters · switch` : 'switch character'}
            </div>
          </div>
          <span style={{ color: 'var(--text-faint)' }}>⌃</span>
        </button>
      </div>
    </aside>
  );
}
