import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, del } from '../api';
import { useAuth } from '../App';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function Production() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const isOwner = user.role === 'OWNER';

  const { data: logs, isLoading: loadingLogs } = useQuery({ queryKey: ['production-logs'], queryFn: () => get('/production') });
  const { data: products, isLoading: loadingProducts } = useQuery({ queryKey: ['products'], queryFn: () => get('/products') });

  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [error, setError] = useState('');

  const [f, setF] = useState({
    date: today(),
    inputProductId: '',
    inputQuantity: '',
    outputProductId: '',
    outputQuantity: '',
    byproductProductId: '',
    byproductQuantity: '',
    note: ''
  });

  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));

  const recordProduction = useMutation({
    mutationFn: (body) => post('/production', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-logs'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      qc.invalidateQueries({ queryKey: ['low-stock'] });
      setAdding(false);
      setF({
        date: today(),
        inputProductId: '',
        inputQuantity: '',
        outputProductId: '',
        outputQuantity: '',
        byproductProductId: '',
        byproductQuantity: '',
        note: ''
      });
      setError('');
    },
    onError: (err) => setError(err.message)
  });

  const deleteProduction = useMutation({
    mutationFn: (id) => del(`/production/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-logs'] });
      qc.invalidateQueries({ queryKey: ['products'] });
      setConfirmDelete(null);
    },
    onError: (err) => alert(err.message)
  });

  const rawMaterials = products?.filter(p => p.category === 'RAW_MATERIAL' && !p.isArchived) || [];
  const finishedGoods = products?.filter(p => p.category === 'FINISHED_GOOD' && !p.isArchived) || [];

  const inputProduct = products?.find(p => p.id === f.inputProductId);
  const outputProduct = products?.find(p => p.id === f.outputProductId);
  const byproductProduct = products?.find(p => p.id === f.byproductProductId);

  const inputQty = parseFloat(f.inputQuantity) || 0;
  const outputQty = parseFloat(f.outputQuantity) || 0;
  const byproductQty = parseFloat(f.byproductQuantity) || 0;

  const millingLoss = inputQty > 0 ? (inputQty - outputQty - byproductQty) : 0;
  const extractionRate = inputQty > 0 ? ((outputQty / inputQty) * 100) : 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    recordProduction.mutate({
      date: new Date(f.date).toISOString(),
      inputProductId: f.inputProductId,
      inputQuantity: inputQty,
      outputProductId: f.outputProductId,
      outputQuantity: outputQty,
      byproductProductId: f.byproductProductId || null,
      byproductQuantity: f.byproductProductId ? byproductQty : null,
      note: f.note || null
    });
  };

  return (
    <div className="page">
      <header className="page-head">
        <h1>Milling & Production Logs</h1>
        <button className="btn primary" onClick={() => setAdding(true)}>Record Production Run</button>
      </header>

      {logs?.length ? (
        <div className="panel">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Wheat Input</th>
                <th>Flour Output</th>
                <th>Bran Byproduct</th>
                <th className="num">Loss</th>
                <th className="num">Yield %</th>
                <th className="actions-col"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="mono-sm">{fmtDate(log.date)}</td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{Number(log.inputQuantity)} {log.inputProduct?.unit}</div>
                    <small style={{ color: 'var(--ink-soft)' }}>{log.inputProduct?.name}</small>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--in)' }}>+{Number(log.outputQuantity)} {log.outputProduct?.unit}</div>
                    <small style={{ color: 'var(--ink-soft)' }}>{log.outputProduct?.name}</small>
                  </td>
                  <td>
                    {log.byproductProductId ? (
                      <>
                        <div style={{ fontWeight: '600' }}>+{Number(log.byproductQuantity)} {log.byproductProduct?.unit}</div>
                        <small style={{ color: 'var(--ink-soft)' }}>{log.byproductProduct?.name}</small>
                      </>
                    ) : '—'}
                  </td>
                  <td className="num mono-sm" style={{ color: 'var(--out)' }}>
                    {Number(log.millingLoss)} {log.inputProduct?.unit}
                  </td>
                  <td className="num mono" style={{ fontWeight: '700' }}>
                    {Number(log.extractionRate).toFixed(1)}%
                  </td>
                  <td className="actions-col">
                    {isOwner && (
                      <button
                        className="icon-btn"
                        title="Revert Production"
                        onClick={() => setConfirmDelete(log)}
                      >
                        🗑
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty panel">{loadingLogs ? 'Loading logs…' : 'No production logs recorded yet. Start milling wheat to populate.'}</p>
      )}

      {adding && (
        <Modal title="Record Milling Production" onClose={() => setAdding(false)}>
          <form className="form" onSubmit={handleSubmit}>
            <label>Date <input type="date" required value={f.date} onChange={(e) => set('date', e.target.value)} /></label>

            <label>
              Raw Material (Input)
              <select required value={f.inputProductId} onChange={(e) => set('inputProductId', e.target.value)}>
                <option value="">— Select Grain —</option>
                {rawMaterials.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({Number(p.stock)} {p.unit} stock)</option>
                ))}
              </select>
            </label>

            <label>Input Quantity {inputProduct && `(${inputProduct.unit})`}
              <input type="number" min="0.01" step="0.01" required value={f.inputQuantity} onChange={(e) => set('inputQuantity', e.target.value)} />
            </label>

            <div style={{ borderTop: '1px solid var(--line)', margin: '10px 0' }}></div>

            <label>
              Finished Flour (Output)
              <select required value={f.outputProductId} onChange={(e) => set('outputProductId', e.target.value)}>
                <option value="">— Select Output Flour —</option>
                {finishedGoods.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label>Output Quantity {outputProduct && `(${outputProduct.unit})`}
              <input type="number" min="0.01" step="0.01" required value={f.outputQuantity} onChange={(e) => set('outputQuantity', e.target.value)} />
            </label>

            <div style={{ borderTop: '1px solid var(--line)', margin: '10px 0' }}></div>

            <label>
              Byproduct (Optional)
              <select value={f.byproductProductId} onChange={(e) => set('byproductProductId', e.target.value)}>
                <option value="">— None —</option>
                {finishedGoods.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            {f.byproductProductId && (
              <label>Byproduct Quantity {byproductProduct && `(${byproductProduct.unit})`}
                <input type="number" min="0.01" step="0.01" required value={f.byproductQuantity} onChange={(e) => set('byproductQuantity', e.target.value)} />
              </label>
            )}

            {inputQty > 0 && outputQty > 0 && (
              <div style={{ padding: '12px', background: 'var(--surface)', borderRadius: '8px', fontSize: '0.9rem' }}>
                <div>Extraction Yield Rate: <strong style={{ color: 'var(--in)' }}>{extractionRate.toFixed(2)}%</strong></div>
                <div>Milling Loss: <strong style={{ color: millingLoss < 0 ? 'var(--out)' : 'var(--ink)' }}>{millingLoss.toFixed(2)} {inputProduct?.unit || ''}</strong></div>
              </div>
            )}

            <label>Notes <input value={f.note} placeholder="Milling shift, grain quality note, etc." onChange={(e) => set('note', e.target.value)} /></label>

            {error && <p className="form-error">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn primary" disabled={recordProduction.isPending}>
                {recordProduction.isPending ? 'Processing…' : 'Record Production Run'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {confirmDelete && (
        <Confirm
          message={`Are you sure you want to delete the production run from ${fmtDate(confirmDelete.date)}? This will reverse the stock values (add back ${Number(confirmDelete.inputQuantity)} input and subtract output/byproduct stock).`}
          onClose={() => setConfirmDelete(null)}
          busy={deleteProduction.isPending}
          onConfirm={() => deleteProduction.mutate(confirmDelete.id)}
        />
      )}
    </div>
  );
}
