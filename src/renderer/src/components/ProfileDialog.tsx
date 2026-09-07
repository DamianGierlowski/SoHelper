import { useState } from 'react';
import type { Profile, ProfileInput } from '../../../shared/types.mts';
import { Modal } from './Modal.tsx';

interface Props {
  profile: Profile | null;
  onClose: () => void;
  onSave: (data: ProfileInput) => void;
}

export function ProfileDialog({ profile, onClose, onSave }: Props): React.JSX.Element {
  const [nick, setNick] = useState(profile?.nick ?? '');
  const valid = nick.trim() !== '';

  return (
    <Modal
      title={profile ? 'Rename character' : 'New character'}
      subtitle="Each character keeps its own take history"
      onClose={onClose}
      width={400}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!valid} onClick={() => onSave({ nick })}>
            Save
          </button>
        </>
      }
    >
      <label className="field" style={{ marginBottom: 0 }}>
        <span>NAME</span>
        <input
          value={nick}
          autoFocus
          onChange={(e) => setNick(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && valid) onSave({ nick });
          }}
        />
      </label>
    </Modal>
  );
}
