import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch } from '../api';
import { useAuth } from '../App';
import Modal from '../components/Modal';

export default function Users() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => get('/users') });
  const [modal, setModal] = useState(null); // 'add' | {reset}
  const [form, setForm] = useState({ name: '', login: '', password: '', role: 'STAFF' });
  const [error, setError] = useState('');

  const done = () => { qc.invalidateQueries({ queryKey: ['users'] }); setModal(null); setError(''); };
  const create = useMutation({ mutationFn: () => post('/users', form), onSuccess: done, onError: (e) => setError(e.message) });
  const update = useMutation({ mutationFn: ({ id, body }) => patch(`/users/${id}`, body), onSuccess: done, onError: (e) => setError(e.message) });

  return (
    <div className="page">
      <header className="page-head">
        <h1>Staff</h1>
        <button className="btn primary" onClick={() => { setForm({ name: '', login: '', password: '', role: 'STAFF' }); setError(''); setModal('add'); }}>
          Add staff account
        </button>
      </header>
      {error && !modal && <p className="form-error">{error}</p>}

      <div className="panel">
        {data?.length ? (
          <table className="table">
            <thead><tr><th>Name</th><th className="hide-sm">Login</th><th>Role</th><th>Status</th><th className="actions-col" /></tr></thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id} className={u.isActive ? '' : 'row-archived'}>
                  <td>{u.name}{u.id === me.id && <span className="badge badge-you">You</span>}</td>
                  <td className="hide-sm mono-sm">{u.login}</td>
                  <td>{u.role === 'OWNER' ? 'Owner' : 'Staff'}</td>
                  <td>{u.isActive ? 'Active' : 'Deactivated'}</td>
                  <td className="actions-col">
                    {u.id !== me.id && (
                      <>
                        <button className="btn ghost" onClick={() => { setForm({ password: '' }); setError(''); setModal({ reset: u }); }}>Reset password</button>
                        <button
                          className="btn ghost"
                          onClick={() => update.mutate({ id: u.id, body: { isActive: !u.isActive } })}
                        >
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">{isLoading ? 'Loading…' : 'No accounts yet.'}</p>
        )}
      </div>
      <p className="hint">Deactivated staff can no longer sign in, but every entry they recorded stays in the ledger.</p>

      {modal === 'add' && (
        <Modal title="Add staff account" onClose={() => setModal(null)}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <label>Name <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Phone or email (their login) <input required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} /></label>
            <label>Temporary password <input required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            <label>
              Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="STAFF">Staff</option>
                <option value="OWNER">Owner</option>
              </select>
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button className="btn primary" disabled={create.isPending}>Create account</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.reset && (
        <Modal title={`Reset password — ${modal.reset.name}`} onClose={() => setModal(null)}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); update.mutate({ id: modal.reset.id, body: { password: form.password } }); }}>
            <label>New temporary password <input autoFocus required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button className="btn primary" disabled={update.isPending}>Reset password</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
