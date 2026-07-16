import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api';
import Money, { balanceTone } from '../components/Money';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const COPY = {
  client: {
    title: 'Clients', add: 'Add client', owes: 'They owe',
    empty: 'No clients yet. Add the shops and bakeries you sell to on credit.',
  },
  supplier: {
    title: 'Suppliers', add: 'Add supplier', owes: 'You owe',
    empty: 'No suppliers yet. Add the unions and traders you buy from.',
  },
};

export default function Parties({ kind }) {
  const qc = useQueryClient();
  const base = kind === 'client' ? '/clients' : '/suppliers';
  const copy = COPY[kind];
  const { data, isLoading } = useQuery({ queryKey: [kind + 's'], queryFn: () => get(base) });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', code: '' });
  const [error, setError] = useState('');

  const create = useMutation({
    z: 1, // trigger reload
    mutationFn: () => post(base, { name: form.name.trim(), phone: form.phone.trim() || null, code: form.code.trim() || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [kind + 's'] });
      setAdding(false);
      setForm({ name: '', phone: '', code: '' });
      setError('');
    },
    onError: (e) => setError(e.message),
  });

  return (
    <div className="page">
      <header className="page-head">
        <h1>{copy.title}</h1>
        <button className="btn primary" onClick={() => setAdding(true)}>{copy.add}</button>
      </header>

      {data?.length ? (
        <div className="panel">
          <table className="table clickable">
            <thead>
              <tr><th>Name</th><th className="hide-sm">Phone</th><th>Status</th><th className="num">{copy.owes}</th></tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link to={`${base}/${p.id}`} className="row-link">
                      {p.name}
                      {p.code && <span className="party-code-badge">{p.code}</span>}
                    </Link>
                  </td>
                  <td className="hide-sm mono-sm">{p.phone || '—'}</td>
                  <td><Badge status={p.status} /></td>
                  <td className="num"><Money value={p.balance} tone={balanceTone(kind, p.balance)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty panel">{isLoading ? 'Loading…' : copy.empty}</p>
      )}

      {adding && (
        <Modal title={copy.add} onClose={() => setAdding(false)}>
          <form className="form" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <label>Name <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Code (optional, e.g. C001) <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
            <label>Phone (optional) <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn primary" disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
