import { useEffect, useRef } from 'react';

// Small confirmation before leaving a shopping run that has progress.
export function LeaveDialog({
  open,
  stay,
  leave,
}: {
  open: boolean;
  stay: () => void;
  leave: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="therapist-dialog leave-dialog"
      aria-labelledby="leave-heading"
      onClose={stay}
    >
      <div className="dialog-content">
        <h2 id="leave-heading">¿Volver al inicio?</h2>
        <p className="panel-description">
          Se borra lo que ya pusiste en el carrito.
        </p>
        <div className="therapist-actions">
          <button className="soft-button" onClick={stay} autoFocus>
            Seguir comprando
          </button>
          <button className="primary-button" onClick={leave}>
            Volver al inicio
          </button>
        </div>
      </div>
    </dialog>
  );
}
