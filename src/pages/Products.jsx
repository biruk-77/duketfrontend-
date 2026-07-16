import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '../api';
import { useAuth } from '../App';
import Money from '../components/Money';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';

const blank = { name: '', unit: '', price: '', stock: '', lowStockAt: '', category: 'FINISHED_GOOD' };

export default function Products() {
  const { user } = useAuth();
  const isOwner = user.role === 'OWNER';
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['products-all'], queryFn: () => get('/products') });

  const [modal, setModal] = useState(null); // 'add' | {edit} | {stock} | {confirm}
  const [form, setForm] = useState(blank);
  const [stockForm, setStockForm] = useState({ stock: '', reason: '' });
  const [error, setError] = useState('');

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['products-all'] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['low-stock'] });
  };
  const done = () => { refresh(); setModal(null); setError(''); };

  const create = useMutation({
    mutationFn: () => post('/products', { ...form, price: Number(form.price), stock: Number(form.stock || 0), lowStockAt: Number(form.lowStockAt || 0) }),
    onSuccess: done, onError: (e) => setError(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, body }) => patch(`/products/${id}`, body),
    onSuccess: done, onError: (e) => setError(e.message),
  });
  const remove = useMutation({
    mutationFn: (id) => del(`/products/${id}`),
    onSuccess: done, onError: (e) => { setModal(null); setError(e.message); },
  });

  const openEdit = (p) => {
    setForm({ name: p.name, unit: p.unit, price: Number(p.price), lowStockAt: Number(p.lowStockAt), category: p.category });
    setError(''); setModal({ edit: p });
  };
  const openStock = (p) => {
    setStockForm({ stock: Number(p.stock), reason: '' });
    setError(''); setModal({ stock: p });
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Products & Grain Catalogue</h1>
        {isOwner && <button className="btn primary" onClick={() => { setForm(blank); setError(''); setModal('add'); }}>Add product</button>}
      </header>
      {error && !modal && <p className="form-error">{error}</p>}

      <div className="panel">
        {data?.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th><th>Category</th><th className="num">Price</th><th className="num">In stock</th>
                <th className="num hide-sm">Alert at</th><th className="actions-col" />
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className={p.isArchived ? 'row-archived' : ''}>
                  <td>
                    {p.name}
                    {p.isArchived && <span className="badge badge-archived">Archived</span>}
                    {p.lowStock && <span className="badge badge-low">Low stock</span>}
                  </td>
                  <td>
                    {p.category === 'RAW_MATERIAL' ? (
                      <span className="badge" style={{ backgroundColor: 'var(--accent)', color: 'var(--ink)' }}>Raw Grain</span>
                    ) : (
                      <span className="badge" style={{ backgroundColor: 'var(--surface-dark)', color: 'var(--ink)' }}>Flour/Bran</span>
                    )}
                  </td>
                  <td className="num"><Money value={p.price} /> <span className="per">/ {p.unit}</span></td>
                  <td className={`num mono ${p.lowStock ? 'warn' : ''}`}>{Number(p.stock)} {p.unit}</td>
                  <td className="num mono hide-sm">{Number(p.lowStockAt)} {p.unit}</td>
                  <td className="actions-col">
                    {isOwner && !p.isArchived && (
                      <>
                        <button className="icon-btn" title="Edit" onClick={() => openEdit(p)}>✎</button>
                        <button className="icon-btn" title="Correct stock" onClick={() => openStock(p)}>±</button>
                        <button className="icon-btn" title="Archive or delete" onClick={() => setModal({ confirm: p })}>🗑</button>
                      </>
                    )}
                    {isOwner && p.isArchived && (
                      <button className="btn ghost" onClick={() => update.mutate({ id: p.id, body: { isArchived: false } })}>Restore</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty">{isLoading ? 'Loading…' : 'No products yet. Add grain and flour catalog here.'}</p>
        )}
      </div>

      {(modal === 'add' || modal?.edit) && (
        <Modal title={modal === 'add' ? 'Add product' : `Edit — ${modal.edit.name}`} onClose={() => setModal(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              if (modal === 'add') create.mutate();
              else update.mutate({ id: modal.edit.id, body: { name: form.name, unit: form.unit, price: Number(form.price), lowStockAt: Number(form.lowStockAt || 0), category: form.category } });
            }}
          >
            <label>Name <input autoFocus required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            
            <label>
              Category
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="FINISHED_GOOD">Finished Flour Product</option>
                <option value="RAW_MATERIAL">Raw Material (Grain)</option>
              </select>
            </label>

            <div className="form-row">
              <label>Unit <input required placeholder="sack, kg, pcs" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></label>
              <label>Price per unit (Br) <input type="number" min="0" step="0.01" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
            </div>
            
            <div className="form-row">
              {modal === 'add' && (
                <label>Opening stock <input type="number" min="0" step="0.01" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>
              )}
              <label>Low-stock alert at <input type="number" min="0" step="0.01" value={form.lowStockAt} onChange={(e) => setForm({ ...form, lowStockAt: e.target.value })} /></label>
            </div>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button className="btn primary" disabled={create.isPending || update.isPending}>Save</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.stock && (
        <Modal title={`Correct stock — ${modal.stock.name}`} onClose={() => setModal(null)}>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate({ id: modal.stock.id, body: { stock: Number(stockForm.stock), reason: stockForm.reason.trim() } });
            }}
          >
            <p className="calc">Currently recorded: <strong className="mono">{Number(modal.stock.stock)} {modal.stock.unit}</strong></p>
            <label>Actual stock ({modal.stock.unit}) <input autoFocus type="number" min="0" step="0.01" required value={stockForm.stock} onChange={(e) => setStockForm({ ...stockForm, stock: e.target.value })} /></label>
            <label>Reason for the correction <input required minLength={3} placeholder="e.g. physical count, damaged sacks" value={stockForm.reason} onChange={(e) => setStockForm({ ...stockForm, reason: e.target.value })} /></label>
            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button className="btn primary" disabled={update.isPending}>Save correction</button>
            </div>
          </form>
        </Modal>
      )}

      {modal?.confirm && (
        <Confirm
          title="Remove product"
          confirmLabel="Remove"
          message={`Remove "${modal.confirm.name}"? If it appears in any sale or purchase it will be archived instead of deleted, and history keeps its name and prices.`}
          onClose={() => setModal(null)}
          busy={remove.isPending}
          onConfirm={() => remove.mutate(modal.confirm.id)}
        />
      )}
    </div>
  );
}
