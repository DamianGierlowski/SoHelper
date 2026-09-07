import { useEffect, useState } from 'react';

export function VersionLine(): React.JSX.Element {
  const [version, setVersion] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  // Wydania powstaja tylko dla Windows - gdzie indziej przycisk nie ma sensu.
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    void window.api.getAppInfo().then((info) => {
      setVersion(info.version);
      setSupported(info.platform === 'win32');
    });
  }, []);

  const check = async (): Promise<void> => {
    setChecking(true);
    setNote(null);
    const status = await window.api.updates.check();
    setChecking(false);

    switch (status.state) {
      case 'available':
        // Szczegoly pokaze pasek aktualizacji, tu wystarczy potwierdzenie.
        setNote(`v${status.version} available`);
        break;
      case 'current':
        setNote('Up to date');
        break;
      case 'dev':
        setNote('Dev build');
        break;
      case 'unsupported':
        setNote('Windows only');
        break;
      case 'error':
        setNote('Check failed');
        break;
    }
  };

  return (
    <div className="version-line">
      <span>{note ?? (version && `v${version}`)}</span>
      {supported && (
        <button disabled={checking} onClick={() => void check()}>
          {checking ? 'Checking…' : 'Check for updates'}
        </button>
      )}
    </div>
  );
}
