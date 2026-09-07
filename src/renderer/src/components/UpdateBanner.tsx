import { useEffect, useState } from 'react';
import type { UpdateEvent } from '../../../shared/types.mts';

type State =
  | { kind: 'idle' }
  | { kind: 'available'; version: string }
  | { kind: 'downloading'; version: string; percent: number }
  | { kind: 'downloaded'; version: string }
  | { kind: 'error'; message: string };

export function UpdateBanner(): React.JSX.Element | null {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return window.api.updates.onEvent((event: UpdateEvent) => {
      setState((previous) => {
        switch (event.type) {
          case 'available':
            return { kind: 'available', version: event.version };
          case 'progress':
            // Numer wersji znamy tylko z wczesniejszego zdarzenia, wiec go przenosimy.
            return previous.kind === 'idle'
              ? previous
              : { kind: 'downloading', version: versionOf(previous), percent: event.percent };
          case 'downloaded':
            return { kind: 'downloaded', version: versionOf(previous) };
          case 'error':
            return { kind: 'error', message: event.message };
        }
      });
      setDismissed(false);
    });
  }, []);

  if (dismissed || state.kind === 'idle') return null;

  return (
    <div className="update-bar">
      {state.kind === 'available' && (
        <>
          <span>
            Version <strong>{state.version}</strong> is available.
          </span>
          <button className="btn btn-primary" onClick={() => void window.api.updates.download()}>
            Download update
          </button>
        </>
      )}

      {state.kind === 'downloading' && (
        <>
          <span>
            Downloading {state.version}… {state.percent}%
          </span>
          <div className="update-progress">
            <span style={{ width: `${state.percent}%` }} />
          </div>
        </>
      )}

      {state.kind === 'downloaded' && (
        <>
          <span>
            Version <strong>{state.version}</strong> is ready.
          </span>
          <button className="btn btn-primary" onClick={() => void window.api.updates.install()}>
            Restart and install
          </button>
        </>
      )}

      {state.kind === 'error' && <span className="update-error">Update failed: {state.message}</span>}

      <button className="btn-quiet" onClick={() => setDismissed(true)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}

function versionOf(state: State): string {
  return 'version' in state ? state.version : '';
}
