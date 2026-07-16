import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del, reportUrl } from '../api';
import { useAuth } from '../App';
import Money, { balanceTone } from '../components/Money';
import Badge from '../components/Badge';
import Modal from '../components/Modal';
import Confirm from '../components/Confirm';

const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

function TxnForm({ kind, products, initial, onSubmit, busy, error, submitLabel }) {
  const isClient = kind === 'client';
  const [f, setF] = useState(initial ?? {
    date: today(),
    productId: '',
    itemName: '',
    quantity: '',
    unitPrice: '',
    total: '',
    restock: false,
    saveAsProduct: false,
    productCategory: 'FINISHED_GOOD',
    productUnit: 'kg',
    paymentType: 'owe', // 'owe' | 'paid' | 'partial'
    amountPaid: '',
    paidUnits: '',
    paymentMethod: 'Cash',
  });

  const product = products?.find((p) => p.id === f.productId);
  const calculatedTotal = Number(f.total || 0) || (Number(f.quantity || 0) * Number(f.unitPrice || 0));

  const set = (k, v) => setF((s) => {
    const nextState = { ...s, [k]: v };

    if (k === 'productId') {
      const found = products?.find(p => p.id === v);
      const pr = found ? String(found.price) : '';
      nextState.unitPrice = pr;
      if (s.quantity && pr) {
        nextState.total = String(Number(s.quantity) * Number(pr));
      } else if (s.total && pr) {
        nextState.quantity = String(Number(s.total) / Number(pr));
      }
    } else if (k === 'quantity') {
      const qVal = Number(v);
      const pVal = Number(s.unitPrice);
      if (qVal && pVal) {
        nextState.total = String(qVal * pVal);
      } else if (qVal && Number(s.total)) {
        nextState.unitPrice = String(Number(s.total) / qVal);
      }
    } else if (k === 'unitPrice') {
      const pVal = Number(v);
      const qVal = Number(s.quantity);
      if (pVal && qVal) {
        nextState.total = String(qVal * pVal);
      } else if (pVal && Number(s.total)) {
        nextState.quantity = String(Number(s.total) / pVal);
      }
    } else if (k === 'total') {
      const tVal = Number(v);
      const pVal = Number(s.unitPrice);
      const qVal = Number(s.quantity);
      if (tVal && pVal) {
        nextState.quantity = String(tVal / pVal);
      } else if (tVal && qVal) {
        nextState.unitPrice = String(tVal / qVal);
      }
    } else if (k === 'paidUnits') {
      const puVal = Number(v);
      const pVal = Number(nextState.unitPrice || 0);
      nextState.amountPaid = String(puVal * pVal);
    } else if (k === 'amountPaid') {
      const apVal = Number(v);
      const pVal = Number(nextState.unitPrice || 0);
      if (pVal > 0) {
        nextState.paidUnits = String(apVal / pVal);
      }
    }

    // Auto-update amountPaid / paidUnits based on paymentType selection
    const computedTotal = Number(nextState.total || 0) || (Number(nextState.quantity || 0) * Number(nextState.unitPrice || 0));
    const currentType = k === 'paymentType' ? v : s.paymentType;
    if (currentType === 'paid') {
      nextState.amountPaid = String(computedTotal);
      nextState.paidUnits = nextState.quantity;
    } else if (currentType === 'owe') {
      nextState.amountPaid = '0';
      nextState.paidUnits = '0';
    } else if (k === 'paymentType' && v === 'partial') {
      nextState.amountPaid = '';
      nextState.paidUnits = '';
    } else {
      if (currentType === 'partial' && (k === 'unitPrice' || k === 'productId' || k === 'quantity' || k === 'total')) {
        if (nextState.paidUnits) {
          nextState.amountPaid = String(Number(nextState.paidUnits) * Number(nextState.unitPrice || 0));
        } else if (nextState.amountPaid && Number(nextState.unitPrice) > 0) {
          nextState.paidUnits = String(Number(nextState.amountPaid) / Number(nextState.unitPrice));
        }
      }
    }

    return nextState;
  });

  const submit = (e) => {
    e.preventDefault();
    const qtyVal = Number(f.quantity || 0);
    const priceVal = Number(f.unitPrice || 0);
    onSubmit({
      date: f.date,
      productId: f.productId || null,
      itemName: f.productId ? undefined : f.itemName.trim(),
      quantity: qtyVal,
      unitPrice: priceVal,
      ...(isClient ? {} : { restock: Boolean(f.restock && f.productId) }),
      saveAsProduct: !f.productId ? Boolean(f.saveAsProduct) : undefined,
      productCategory: !f.productId && f.saveAsProduct ? f.productCategory : undefined,
      productUnit: !f.productId && f.saveAsProduct ? f.productUnit : undefined,
      amountPaid: f.paymentType !== 'owe' ? Number(f.amountPaid || 0) : undefined,
      paymentMethod: f.paymentType !== 'owe' ? f.paymentMethod : undefined,
    });
  };

  return (
    <form className="form" onSubmit={submit}>
      <label>Date <input type="date" required value={f.date} onChange={(e) => set('date', e.target.value)} /></label>
      <label>
        Product
        <select value={f.productId} onChange={(e) => set('productId', e.target.value)}>
          <option value="">— Free-text item —</option>
          {products?.filter((p) => !p.isArchived).map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({Number(p.stock)} {p.unit} in stock)</option>
          ))}
        </select>
      </label>
      
      {!f.productId && (
        <>
          <label>Item name <input required value={f.itemName} onChange={(e) => set('itemName', e.target.value)} /></label>
          <div style={{ margin: '8px 0 15px 0', padding: '10px', background: '#f5f7f3', borderRadius: '8px', border: '1px dashed var(--line)' }}>
            <label className="check" style={{ cursor: 'pointer', fontWeight: '600' }}>
              <input type="checkbox" checked={f.saveAsProduct} onChange={(e) => set('saveAsProduct', e.target.checked)} />
              Save to Product Catalog
            </label>
            {f.saveAsProduct && (
              <div className="form-row" style={{ marginTop: '8px' }}>
                <label>
                  Category
                  <select value={f.productCategory} onChange={(e) => set('productCategory', e.target.value)}>
                    <option value="FINISHED_GOOD">Finished Good (Flour, Semolina)</option>
                    <option value="RAW_MATERIAL">Raw Material (Grain, Bran)</option>
                  </select>
                </label>
                <label>
                  Unit
                  <input placeholder="e.g. kg, 50kg, bag" required value={f.productUnit} onChange={(e) => set('productUnit', e.target.value)} />
                </label>
              </div>
            )}
          </div>
        </>
      )}

      <div className="form-row">
        <label>Quantity <input type="number" min="0.01" step="0.01" required value={f.quantity} onChange={(e) => set('quantity', e.target.value)} /></label>
        <label>
          Unit price (Br)
          <input
            type="number" min="0" step="0.01"
            required={!f.productId}
            placeholder={product ? Number(product.price).toFixed(2) : ''}
            value={f.unitPrice}
            onChange={(e) => set('unitPrice', e.target.value)}
          />
        </label>
        <label>
          Total (Br)
          <input
            type="number" min="0" step="0.01"
            value={f.total}
            onChange={(e) => set('total', e.target.value)}
            placeholder="Calculated total"
          />
        </label>
      </div>

      {!isClient && f.productId && (
        <label className="check">
          <input type="checkbox" checked={f.restock} onChange={(e) => set('restock', e.target.checked)} />
          Restock — add {f.quantity || 'this'} {product?.unit || ''} to inventory
        </label>
      )}

      {f.quantity && (f.unitPrice || product) && (() => {
        const currentStock = product ? Number(product.stock) : 0;
        const qtyNum = Number(f.quantity || 0);
        const remainingStock = isClient 
          ? currentStock - qtyNum 
          : (f.restock ? currentStock + qtyNum : currentStock);
        
        const paymentAmount = f.paymentType === 'owe' 
          ? 0 
          : (f.paymentType === 'paid' ? calculatedTotal : Number(f.amountPaid || 0));
        
        const remainingPayment = Math.max(calculatedTotal - paymentAmount, 0);

        return (
          <div style={{ marginTop: '12px', padding: '12px', background: '#fbfcf8', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '0.88rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '0.94rem' }}>
              <span>Total amount:</span>
              <Money value={calculatedTotal} />
            </div>
            
            {product && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: remainingStock < 0 ? '#a63a24' : '#5c6154' }}>
                <span>Remaining stock:</span>
                <span style={{ fontWeight: '600' }}>
                  {currentStock.toLocaleString()} → {remainingStock.toLocaleString()} {product.unit}
                  {remainingStock < 0 && ' (Stock Alert: Overdrawn!)'}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', color: remainingPayment > 0 ? '#c9821c' : '#1e5b45' }}>
              <span>Remaining balance:</span>
              <span style={{ fontWeight: '700' }}>
                <Money value={remainingPayment} />
                {remainingPayment > 0 ? ' (added to ledger)' : ' (fully paid)'}
              </span>
            </div>
          </div>
        );
      })()}

      {/* Payment Selection */}
      <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(201, 130, 28, 0.07)', borderRadius: '8px', border: '1px solid rgba(201, 130, 28, 0.2)' }}>
        <label style={{ fontWeight: '700', marginBottom: '8px', display: 'block', fontSize: '0.88rem' }}>Payment Terms</label>
        <div className="form-row" style={{ gap: '15px', marginBottom: f.paymentType !== 'owe' ? '10px' : '0' }}>
          <label className="check" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="radio" name="paymentType" value="owe" checked={f.paymentType === 'owe'} onChange={() => set('paymentType', 'owe')} />
            Owe (On account)
          </label>
          <label className="check" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="radio" name="paymentType" value="paid" checked={f.paymentType === 'paid'} onChange={() => set('paymentType', 'paid')} />
            Fully Paid (Cash/Bank)
          </label>
          <label className="check" style={{ cursor: 'pointer', fontSize: '0.85rem' }}>
            <input type="radio" name="paymentType" value="partial" checked={f.paymentType === 'partial'} onChange={() => set('paymentType', 'partial')} />
            Partial Payment
          </label>
        </div>

        {f.paymentType !== 'owe' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="form-row">
              {f.paymentType === 'partial' && (
                <label>
                  Paid Units / Qty
                  <input
                    type="number" min="0" step="0.01"
                    placeholder="e.g. 5 bags"
                    value={f.paidUnits}
                    onChange={(e) => set('paidUnits', e.target.value)}
                  />
                </label>
              )}
              <label>
                Amount Paid (Br)
                <input type="number" min="0" step="0.01" required value={f.amountPaid} disabled={f.paymentType === 'paid'} onChange={(e) => set('amountPaid', e.target.value)} />
              </label>
              <label>
                Method
                <select value={f.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>
                  <option value="Cash">Cash</option>
                  <option value="Telebirr">Telebirr</option>
                  <option value="CBE">CBE (Commercial Bank)</option>
                  <option value="Other">Other Bank</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}

function PaymentForm({ onSubmit, busy, error, unpaidTransactions = [], initialSelectedTxId }) {
  const [f, setF] = useState(() => {
    const initialSelected = {};
    if (initialSelectedTxId) {
      const tx = unpaidTransactions.find(t => t.id === initialSelectedTxId);
      if (tx) {
        initialSelected[tx.id] = {
          checked: true,
          amount: String(tx.amountOwed),
          payType: 'amount',
          units: tx.unitPrice ? String(Number((tx.amountOwed / tx.unitPrice).toFixed(4))) : ''
        };
      }
    }
    return {
      date: today(),
      method: '',
      note: '',
      generalAmount: '',
      selectedTxs: initialSelected
    };
  });

  const handleCheckboxChange = (tx, isChecked) => {
    setF(prev => {
      const nextTxs = { ...prev.selectedTxs };
      if (isChecked) {
        nextTxs[tx.id] = {
          checked: true,
          amount: String(tx.amountOwed),
          payType: 'amount',
          units: tx.unitPrice ? String(Number((tx.amountOwed / tx.unitPrice).toFixed(4))) : ''
        };
      } else {
        delete nextTxs[tx.id];
      }
      return { ...prev, selectedTxs: nextTxs };
    });
  };

  const handleTxAmountChange = (tx, val) => {
    setF(prev => {
      const nextTxs = { ...prev.selectedTxs };
      const current = nextTxs[tx.id] || {};
      let units = '';
      if (tx.unitPrice && val) {
        units = String(Number((Number(val) / tx.unitPrice).toFixed(4)));
      }
      nextTxs[tx.id] = {
        ...current,
        amount: val,
        units
      };
      return { ...prev, selectedTxs: nextTxs };
    });
  };

  const handleTxUnitsChange = (tx, val) => {
    setF(prev => {
      const nextTxs = { ...prev.selectedTxs };
      const current = nextTxs[tx.id] || {};
      let amount = '';
      if (tx.unitPrice && val) {
        amount = String(Number((Number(val) * tx.unitPrice).toFixed(2)));
      }
      nextTxs[tx.id] = {
        ...current,
        units: val,
        amount
      };
      return { ...prev, selectedTxs: nextTxs };
    });
  };

  const handleTxPayTypeChange = (tx, payType) => {
    setF(prev => {
      const nextTxs = { ...prev.selectedTxs };
      const current = nextTxs[tx.id] || {};
      nextTxs[tx.id] = {
        ...current,
        payType
      };
      return { ...prev, selectedTxs: nextTxs };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const paymentsToCreate = [];

    // 1. Linked payments
    Object.entries(f.selectedTxs).forEach(([txId, txData]) => {
      if (!txData.checked) return;
      const amount = Number(txData.amount);
      if (amount <= 0) return;

      const linkTag = `[Link: ${txId}]`;
      const finalNote = linkTag + (f.note.trim() ? ` ${f.note.trim()}` : '');
      paymentsToCreate.push({
        date: f.date || undefined,
        amount,
        method: f.method.trim() || null,
        note: finalNote
      });
    });

    // 2. General/unlinked payment
    const generalAmt = Number(f.generalAmount);
    if (generalAmt > 0) {
      paymentsToCreate.push({
        date: f.date || undefined,
        amount: generalAmt,
        method: f.method.trim() || null,
        note: f.note.trim() || null
      });
    }

    if (paymentsToCreate.length === 0) {
      return;
    }

    onSubmit(paymentsToCreate);
  };

  const allSelected = unpaidTransactions.length > 0 && unpaidTransactions.every(tx => f.selectedTxs[tx.id]?.checked);

  const handleToggleAll = () => {
    setF(prev => {
      const nextTxs = { ...prev.selectedTxs };
      if (allSelected) {
        unpaidTransactions.forEach(tx => {
          delete nextTxs[tx.id];
        });
      } else {
        unpaidTransactions.forEach(tx => {
          nextTxs[tx.id] = {
            checked: true,
            amount: String(tx.amountOwed),
            payType: 'amount',
            units: tx.unitPrice ? String(Number((tx.amountOwed / tx.unitPrice).toFixed(4))) : ''
          };
        });
      }
      return { ...prev, selectedTxs: nextTxs };
    });
  };

  const totalLinked = Object.values(f.selectedTxs)
    .filter(x => x.checked)
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const totalPayment = totalLinked + Number(f.generalAmount || 0);

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>Date <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <label>Method <input placeholder="Cash, Telebirr, CBE…" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })} /></label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--ink-soft)' }}>
            Apply to Invoices (Select Multiple)
          </span>
          {unpaidTransactions.length > 0 && (
            <button
              type="button"
              onClick={handleToggleAll}
              style={{
                background: 'none', border: 'none', color: 'var(--brand)',
                fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', padding: '0 4px'
              }}
            >
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        {unpaidTransactions.length === 0 ? (
          <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--ink-soft)', textAlign: 'center' }}>
            No unpaid invoices. Any payment will go to General Balance.
          </div>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '8px',
            maxHeight: '200px', overflowY: 'auto',
            border: '1px solid var(--line)', borderRadius: '8px',
            padding: '10px', background: '#fff'
          }}>
            {unpaidTransactions.map(tx => {
              const dateStr = new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
              const categoryStr = tx.productCategory === 'FINISHED_GOOD' ? 'Finished Good' : tx.productCategory === 'RAW_MATERIAL' ? 'Raw Material' : 'N/A';
              const txData = f.selectedTxs[tx.id] || { checked: false };

              return (
                <div key={tx.id} style={{
                  padding: '8px',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  background: txData.checked ? '#f0fdf4' : 'transparent',
                  transition: 'background 0.15s'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={txData.checked}
                      onChange={(e) => handleCheckboxChange(tx, e.target.checked)}
                      style={{ width: 'auto', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1, fontSize: '0.82rem', cursor: 'pointer' }} onClick={() => handleCheckboxChange(tx, !txData.checked)}>
                      <strong>[{dateStr}] {tx.itemName}</strong>
                      <span style={{ color: 'var(--ink-soft)', marginLeft: '6px' }}>({categoryStr})</span>
                      <div style={{ fontSize: '0.78rem', color: txData.checked ? '#166534' : 'var(--ink-soft)' }}>
                        Owed: <strong>Br {tx.amountOwed.toLocaleString()}</strong>
                      </div>
                    </div>
                  </div>

                  {txData.checked && (
                    <div style={{
                      marginTop: '8px',
                      paddingTop: '8px',
                      borderTop: '1px dotted #bbf7d0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}>
                      {tx.unitPrice ? (
                        <>
                          <div style={{ display: 'flex', gap: '14px', fontSize: '0.78rem' }}>
                            <label className="check" style={{ cursor: 'pointer', color: '#166534' }}>
                              <input
                                type="radio"
                                name={`payType-${tx.id}`}
                                checked={txData.payType === 'amount'}
                                onChange={() => handleTxPayTypeChange(tx, 'amount')}
                                style={{ width: 'auto', marginRight: '4px' }}
                              />
                              Pay Amount
                            </label>
                            <label className="check" style={{ cursor: 'pointer', color: '#166534' }}>
                              <input
                                type="radio"
                                name={`payType-${tx.id}`}
                                checked={txData.payType === 'units'}
                                onChange={() => handleTxPayTypeChange(tx, 'units')}
                                style={{ width: 'auto', marginRight: '4px' }}
                              />
                              Pay Units
                            </label>
                          </div>

                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {txData.payType === 'amount' ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                <span style={{ fontSize: '0.8rem', color: '#166534' }}>Br</span>
                                <input
                                  type="number"
                                  min="0.01"
                                  step="0.01"
                                  required
                                  value={txData.amount}
                                  onChange={(e) => handleTxAmountChange(tx, e.target.value)}
                                  style={{ padding: '4px 6px', fontSize: '0.8rem', width: '100px' }}
                                />
                                <span style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
                                  (= {txData.units || '0'} {tx.productUnit || 'units'})
                                </span>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                <input
                                  type="number"
                                  min="0.0001"
                                  step="0.0001"
                                  required
                                  value={txData.units}
                                  onChange={(e) => handleTxUnitsChange(tx, e.target.value)}
                                  style={{ padding: '4px 6px', fontSize: '0.8rem', width: '90px' }}
                                />
                                <span style={{ fontSize: '0.78rem', color: '#166534' }}>
                                  {tx.productUnit || 'units'} @ Br {Number(tx.unitPrice).toLocaleString()} = <strong>Br {Number(txData.amount || 0).toLocaleString()}</strong>
                                </span>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.8rem', color: '#166534' }}>Amount: Br</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            required
                            value={txData.amount}
                            onChange={(e) => handleTxAmountChange(tx, e.target.value)}
                            style={{ padding: '4px 6px', fontSize: '0.8rem', width: '120px' }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="form-row">
        <label>
          General / Leftover Amount (Br)
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="For unlinked/excess payment"
            value={f.generalAmount}
            onChange={(e) => setF({ ...f, generalAmount: e.target.value })}
          />
        </label>
        <label>Note <input placeholder="Optional memo..." value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
      </div>

      <div style={{
        marginTop: '6px',
        padding: '12px',
        background: '#f1f5f9',
        borderRadius: '8px',
        border: '1px solid var(--line)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: '700', fontSize: '0.9rem', color: 'var(--ink)' }}>Total Payment:</span>
        <strong style={{ fontSize: '1.2rem', color: 'var(--brand)' }}>
          Br {totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </strong>
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button className="btn primary" disabled={busy || totalPayment <= 0}>
          {busy ? 'Saving…' : 'Record payment'}
        </button>
      </div>
    </form>
  );
}


export default function PartyDetail({ kind }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isClient = kind === 'client';
  const base = isClient ? '/clients' : '/suppliers';
  const txnPath = isClient ? 'sales' : 'purchases';
  const isOwner = user.role === 'OWNER';

  const [searchParams, setSearchParams] = useSearchParams();
  const payTxId = searchParams.get('pay');
  const editTxId = searchParams.get('edit');

  const party = useQuery({ queryKey: [kind, id], queryFn: () => get(`${base}/${id}`) });
  const products = useQuery({ queryKey: ['products'], queryFn: () => get('/products?active=1') });
  const ledgerQuery = useQuery({
    queryKey: ['finances-ledger', id, kind],
    queryFn: () => get(`/analytics/finances/ledger?party=${id}&kind=${kind}`),
  });

  const unpaidTransactions = (ledgerQuery.data?.ledger || [])
    .filter(e => e.type === 'CHARGE' && e.amountOwed > 0.01)
    .sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));

  const [modal, setModal] = useState(null); // 'txn' | 'payment' | {edit} | {confirm}
  const [error, setError] = useState('');
  const [initialPayTxId, setInitialPayTxId] = useState(null);

  // Auto-trigger modals from query params
  useEffect(() => {
    if (party.data && ledgerQuery.data) {
      if (editTxId) {
        const txnToEdit = party.data.history?.find(h => h.id === editTxId);
        if (txnToEdit) {
          setModal({ edit: txnToEdit });
        }
        setSearchParams({}, { replace: true });
      } else if (payTxId) {
        const isUnpaid = unpaidTransactions.some(tx => tx.id === payTxId);
        if (isUnpaid) {
          setInitialPayTxId(payTxId);
          setModal('payment');
        }
        setSearchParams({}, { replace: true });
      }
    }
  }, [payTxId, editTxId, party.data, ledgerQuery.data, unpaidTransactions, setSearchParams]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: [kind, id] });
    qc.invalidateQueries({ queryKey: [kind + 's'] });
    qc.invalidateQueries({ queryKey: ['products'] });
    qc.invalidateQueries({ queryKey: ['summary'] });
    qc.invalidateQueries({ queryKey: ['activity'] });
    qc.invalidateQueries({ queryKey: ['low-stock'] });
  };
  const done = () => { refresh(); setModal(null); setInitialPayTxId(null); setError(''); };

  const createTxn = useMutation({ mutationFn: (body) => post(`${base}/${id}/${txnPath}`, body), onSuccess: done, onError: (e) => setError(e.message) });
  const editSale = useMutation({ mutationFn: ({ saleId, body }) => patch(`${base}/${id}/sales/${saleId}`, body), onSuccess: done, onError: (e) => setError(e.message) });
  const createPayment = useMutation({
    mutationFn: async (body) => {
      if (Array.isArray(body)) {
        for (const p of body) {
          await post(`${base}/${id}/payments`, p);
        }
      } else {
        await post(`${base}/${id}/payments`, body);
      }
    },
    onSuccess: done,
    onError: (e) => setError(e.message)
  });
  const removeEntry = useMutation({ mutationFn: (path) => del(path), onSuccess: done, onError: (e) => setError(e.message) });
  const removeParty = useMutation({
    mutationFn: () => del(`${base}/${id}`),
    onSuccess: () => { refresh(); navigate(base); },
    onError: (e) => { setModal(null); setError(e.message); },
  });

  if (party.isLoading) return <div className="page-loading">Loading ledger…</div>;
  if (party.isError) return <div className="page"><p className="form-error">{party.error.message}</p></div>;
  const p = party.data;

  return (
    <div className="page">
      <p className="crumb"><Link to={base}>{isClient ? 'Clients' : 'Suppliers'}</Link> / {p.name}</p>
      <header className="page-head party-head">
        <div>
          <h1>{p.name}</h1>
          <p className="sub">{p.phone || 'No phone on file'} · <Badge status={p.status} /></p>
        </div>
        <div className="party-balance">
          <small>{isClient ? 'Owes you' : 'You owe'}</small>
          <Money value={p.balance} tone={balanceTone(kind, p.balance)} className="big" />
        </div>
      </header>

      {error && !modal && <p className="form-error">{error}</p>}

      <div className="toolbar">
        <button className="btn primary" onClick={() => { setError(''); setModal('txn'); }}>
          {isClient ? 'Record sale' : 'Record purchase'}
        </button>
        <button className="btn" onClick={() => { setError(''); setModal('payment'); }}>Record payment</button>
        <span className="spacer" />
        <a className="btn ghost" href={reportUrl(`/reports/${kind}/${id}/statement`, { format: 'csv' })}>Statement CSV</a>
        <a className="btn ghost" href={reportUrl(`/reports/${kind}/${id}/statement`, { format: 'pdf' })}>Statement PDF</a>
        {isOwner && (
          <button className="btn ghost danger-text" onClick={() => setModal({ confirm: { path: `${base}/${id}`, party: true, label: p.name } })}>
            Delete {kind}
          </button>
        )}
      </div>

      <div className="panel">
        {p.history.length ? (() => {
          // Merge "Recorded with sale/purchase" payments into their parent transaction row
          const withSalePayments = p.history.filter(h =>
            h.kind === 'payment' &&
            (h.note?.toLowerCase().includes('recorded with sale') || h.note?.toLowerCase().includes('recorded with purchase'))
          );
          const usedPaymentIds = new Set();

          const processedHistory = p.history.reduce((acc, h) => {
            // Skip standalone "recorded with sale" payments — they'll be embedded in the sale row
            if (withSalePayments.find(wp => wp.id === h.id)) return acc;

            if (h.kind !== 'payment') {
              // Check if there's a "recorded with sale" payment paired to this transaction
              const linked = withSalePayments.find(wp =>
                !usedPaymentIds.has(wp.id) &&
                String(wp.date).slice(0, 10) === String(h.date).slice(0, 10) &&
                Math.abs(new Date(wp.createdAt) - new Date(h.createdAt)) < 15000
              );
              if (linked) {
                usedPaymentIds.add(linked.id);
                acc.push({ ...h, linkedPayment: linked });
                return acc;
              }
            }

            acc.push(h);
            return acc;
          }, []);

          return (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th><th>Entry</th><th className="hide-sm">Details</th>
                  <th className="num">Amount</th><th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {processedHistory.map((h) => {
                  const lp = h.linkedPayment;
                  const saleTotal = Number(h.total);
                  const partialPct = lp ? ((Number(lp.amount) / saleTotal) * 100).toFixed(0) : null;
                  const stillOwed = lp ? saleTotal - Number(lp.amount) : null;

                  return (
                    <tr
                      key={`${h.kind}-${h.id}`}
                      onClick={() => navigate(`/entries/${h.id}`)}
                      style={{ cursor: 'pointer' }}
                      className="hover-row"
                    >
                      <td className="mono-sm">{fmtDate(h.date)}</td>
                      <td>
                        {h.kind === 'payment'
                          ? <span className="entry pay">Payment {isClient ? 'received' : 'made'}</span>
                          : (
                            <span className="entry txn">
                              {isClient ? 'Sale' : h.restock ? 'Purchase · restock' : 'Purchase'} — {h.itemName}
                              {lp && (
                                <span style={{
                                  marginLeft: '8px', fontSize: '0.68rem', fontWeight: '700',
                                  padding: '1px 6px', borderRadius: '4px',
                                  background: partialPct >= 100 ? '#eaf6f0' : '#fff9db',
                                  color: partialPct >= 100 ? '#065f46' : '#b25e00',
                                }}>
                                  {partialPct >= 100 ? '✓ Paid' : `⬤ Partial ${partialPct}%`}
                                </span>
                              )}
                            </span>
                          )}
                      </td>
                      <td className="hide-sm mono-sm">
                        {h.kind === 'payment'
                          ? [h.method, h.note].filter(Boolean).join(' — ') || '—'
                          : lp
                            ? (
                              <span>
                                {Number(h.quantity)} × {Number(h.unitPrice).toFixed(2)}
                                <span style={{ marginLeft: '8px', color: 'var(--in)', fontWeight: '600' }}>
                                  · Paid: Br {Number(lp.amount).toLocaleString()} ({lp.method || 'Cash'})
                                </span>
                                {stillOwed > 0.01 && (
                                  <span style={{ marginLeft: '6px', color: 'var(--out)', fontWeight: '600' }}>
                                    · Owes: Br {stillOwed.toLocaleString()}
                                  </span>
                                )}
                              </span>
                            )
                            : `${Number(h.quantity)} × ${Number(h.unitPrice).toFixed(2)}`
                        }
                      </td>
                      <td className="num">
                        {h.kind === 'payment'
                          ? <Money value={-h.amount} tone="good" />
                          : <Money value={h.total} />}
                      </td>
                      <td className="actions-col" onClick={(e) => e.stopPropagation()}>
                        {h.kind !== 'payment' && isClient && (
                          <button className="icon-btn" title="Edit" onClick={() => { setError(''); setModal({ edit: h }); }}>✎</button>
                        )}
                        {isOwner && (
                          <button
                            className="icon-btn" title="Delete"
                            onClick={() => setModal({
                              confirm: {
                                path: `${base}/${id}/${h.kind === 'payment' ? 'payments' : txnPath}/${h.id}`,
                                label: h.kind === 'payment' ? `the Br ${Number(h.amount).toFixed(2)} payment on ${fmtDate(h.date)}` : `"${h.itemName}" on ${fmtDate(h.date)}`,
                              },
                            })}
                          >🗑</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })() : (
          <p className="empty">No entries yet. Record the first {isClient ? 'sale' : 'purchase'} or payment above.</p>
        )}
      </div>

      {modal === 'txn' && (
        <Modal title={isClient ? `Record sale — ${p.name}` : `Record purchase — ${p.name}`} onClose={() => setModal(null)}>
          <TxnForm kind={kind} products={products.data} onSubmit={(b) => createTxn.mutate(b)} busy={createTxn.isPending} error={error} submitLabel={isClient ? 'Record sale' : 'Record purchase'} />
        </Modal>
      )}

      {modal?.edit && (
        <Modal title={`Edit sale — ${modal.edit.itemName}`} onClose={() => setModal(null)}>
          <TxnForm
            kind={kind}
            products={products.data}
            initial={{
              date: String(modal.edit.date).slice(0, 10),
              productId: modal.edit.productId || '',
              itemName: modal.edit.productId ? '' : modal.edit.itemName,
              quantity: Number(modal.edit.quantity),
              unitPrice: Number(modal.edit.unitPrice),
              restock: false,
            }}
            onSubmit={(b) => editSale.mutate({ saleId: modal.edit.id, body: b })}
            busy={editSale.isPending}
            error={error}
            submitLabel="Save changes"
          />
        </Modal>
      )}

      {modal === 'payment' && (
        <Modal title={`Record payment — ${p.name}`} onClose={() => { setModal(null); setInitialPayTxId(null); setSearchParams({}, { replace: true }); }}>
          <PaymentForm
            unpaidTransactions={unpaidTransactions}
            initialSelectedTxId={initialPayTxId}
            onSubmit={(b) => createPayment.mutate(b)}
            busy={createPayment.isPending}
            error={error}
          />
        </Modal>
      )}

      {modal?.confirm && (
        <Confirm
          message={modal.confirm.party
            ? `Delete ${modal.confirm.label}? This only works if they have no recorded history.`
            : `Delete ${modal.confirm.label}? The balance will update and stock will be restored where it applies. This action is logged.`}
          onClose={() => setModal(null)}
          busy={removeEntry.isPending || removeParty.isPending}
          onConfirm={() => (modal.confirm.party ? removeParty.mutate() : removeEntry.mutate(modal.confirm.path))}
        />
      )}
    </div>
  );
}
