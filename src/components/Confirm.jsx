import Modal from './Modal';

// NFR usability: confirm before every delete.
export default function Confirm({ title = 'Are you sure?', message, confirmLabel = 'Delete', onConfirm, onClose, busy }) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-message">{message}</p>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        <button className="btn danger" onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </Modal>
  );
}
