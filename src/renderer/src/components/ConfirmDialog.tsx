import { useCallback, useState, type ReactNode } from 'react';
import { Modal } from './Modal.tsx';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

/**
 * Potwierdzenie jako obietnica: `if (await confirm({...}))`. Zastepuje natywne
 * window.confirm, ktore blokuje caly renderer i wyglada obco na tle aplikacji.
 */
export function useConfirm(): [ReactNode, (options: ConfirmOptions) => Promise<boolean>] {
  const [request, setRequest] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setRequest({ options, resolve })),
    [],
  );

  const settle = (value: boolean): void => {
    request?.resolve(value);
    setRequest(null);
  };

  const node = request ? (
    <Modal title={request.options.title} onClose={() => settle(false)} width={400}>
      <p style={{ margin: 0, color: 'var(--text-dim)' }}>{request.options.message}</p>
      <div className="modal-foot" style={{ margin: '18px -18px -18px', paddingBottom: 0 }}>
        <button className="btn" onClick={() => settle(false)}>
          Cancel
        </button>
        <button
          className={request.options.danger === false ? 'btn btn-primary' : 'btn btn-confirm-danger'}
          autoFocus
          onClick={() => settle(true)}
        >
          {request.options.confirmLabel ?? 'Delete'}
        </button>
      </div>
    </Modal>
  ) : null;

  return [node, confirm];
}
