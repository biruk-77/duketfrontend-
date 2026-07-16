import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import Money from '../components/Money';

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const CATEGORY_LABEL = { FINISHED_GOOD: 'Finished Good', RAW_MATERIAL: 'Raw Material' };

// ── Transaction Timeline Card ──────────────────────────────────────────────
function TxnCard({ entry, isSelected, onClick }) {
  const isCharge = entry.type === 'CHARGE';
  
  // Partial / Full status determination
  let statusBadge = null;
  if (isCharge) {
    if (entry.isFullyPaid) {
      statusBadge = <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: '#eaf6f0', color: '#065f46', marginLeft: '6px' }}>Paid</span>;
    } else if (entry.isPartiallyPaid) {
      const pct = ((entry.amountPaid / entry.total) * 100).toFixed(0);
      statusBadge = <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: '#fff9db', color: '#b25e00', marginLeft: '6px' }}>Partial ({pct}%)</span>;
    } else {
      statusBadge = <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: '#ffeef0', color: '#ba2525', marginLeft: '6px' }}>Owed</span>;
    }
  } else {
    // Payment
    if (entry.linkedTransactionId) {
      statusBadge = <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: '#e1f5fe', color: '#0277bd', marginLeft: '6px' }}>Linked Payment</span>;
    } else {
      statusBadge = <span style={{ fontSize: '0.65rem', fontWeight: '700', padding: '1px 5px', borderRadius: '4px', background: '#eceff1', color: '#455a64', marginLeft: '6px' }}>On Account</span>;
    }
  }

  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        gap: '14px',
        padding: '14px 16px',
        borderRadius: '10px',
        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--line)',
        background: isSelected ? 'rgba(201,130,28,0.06)' : '#fff',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {/* Timeline dot */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '3px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem',
          background: isCharge ? '#fef3e2' : '#eaf6f0',
          border: `2px solid ${isCharge ? '#f59e0b' : '#10b981'}`,
        }}>
          {isCharge ? '📦' : '💵'}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <span style={{
              fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase',
              letterSpacing: '0.06em', padding: '2px 7px', borderRadius: '4px',
              background: isCharge ? '#fef3e2' : '#eaf6f0',
              color: isCharge ? '#92400e' : '#065f46',
              marginRight: '8px',
            }}>
              {isCharge ? (entry.subtype === 'sale' ? 'Sale' : 'Purchase') : (entry.subtype === 'receipt' ? 'Payment In' : 'Payment Out')}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--ink-soft)' }}>{fmt(entry.date)}</span>
            {statusBadge}
          </div>
          <span style={{
            fontWeight: '800', fontSize: '1.05rem', flexShrink: 0,
            color: isCharge ? '#92400e' : '#065f46',
          }}>
            {isCharge ? '+' : '−'}<Money value={isCharge ? entry.debit : entry.credit} />
          </span>
        </div>

        <div style={{ marginTop: '5px', fontWeight: '600', fontSize: '0.92rem', color: 'var(--ink)' }}>
          {isCharge ? entry.itemName : (entry.method || 'Cash Payment')}
        </div>

        {isCharge && (
          <div style={{ marginTop: '3px', fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
            {entry.quantity} {entry.productUnit || 'units'} × Br {entry.unitPrice?.toLocaleString()}
            {entry.productCategory && (
              <span style={{ marginLeft: '8px', padding: '1px 5px', borderRadius: '4px', background: '#f0f4ec', fontSize: '0.72rem', fontWeight: '600' }}>
                {CATEGORY_LABEL[entry.productCategory] || entry.productCategory}
              </span>
            )}
          </div>
        )}

        {!isCharge && entry.linkedTransactionName && (
          <div style={{ marginTop: '3px', fontSize: '0.82rem', color: '#0277bd', fontWeight: '600' }}>
            🔗 Applied to: {entry.linkedTransactionName}
          </div>
        )}

        <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', fontStyle: entry.note ? 'italic' : 'normal', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
            {entry.note || (isCharge ? (entry.productId ? '📎 Catalog product' : '📝 Free-text item') : '')}
          </span>
          <span style={{ fontSize: '0.78rem', fontWeight: '600', color: entry.runningBalance > 0 ? 'var(--out)' : 'var(--in)' }}>
            Balance: <Money value={entry.runningBalance} />
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Transaction Detail Panel ───────────────────────────────────────────────
function TxnDetail({ entry, party, onClose }) {
  const navigate = useNavigate();
  if (!entry) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-soft)', gap: '12px', padding: '40px' }}>
      <div style={{ fontSize: '2.5rem' }}>👆</div>
      <p style={{ textAlign: 'center', fontSize: '0.95rem' }}>Click any transaction to see full details</p>
    </div>
  );

  const isCharge = entry.type === 'CHARGE';

  // Calculate detailed parameters
  const amountPaid = isCharge ? (entry.amountPaid || 0) : entry.credit;
  const totalAmount = isCharge ? entry.total : (entry.linkedTransactionTotal || 0);
  const pctPaid = totalAmount > 0 ? ((amountPaid / totalAmount) * 100) : 0;
  const isLinked = !isCharge && !!entry.linkedTransactionId;

  // Equivalent units paid — use linked transaction metadata for payments
  const unitPrice = isCharge
    ? entry.unitPrice
    : (entry.linkedTransactionUnitPrice || (totalAmount && entry.linkedTransactionQuantity ? (totalAmount / entry.linkedTransactionQuantity) : 0));
  const paidUnits = unitPrice > 0 ? (amountPaid / unitPrice) : 0;
  const quantity = isCharge ? entry.quantity : (entry.linkedTransactionQuantity || 0);
  const productUnit = isCharge ? (entry.productUnit || 'units') : (entry.linkedTransactionUnit || 'units');

  return (
    <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          padding: '4px 10px', borderRadius: '6px', fontWeight: '700', fontSize: '0.8rem', textTransform: 'uppercase',
          background: isCharge ? '#fef3e2' : '#eaf6f0', color: isCharge ? '#92400e' : '#065f46',
        }}>
          {isCharge ? (entry.subtype === 'sale' ? 'Sale Record' : 'Purchase Record') : 'Payment Settlement'}
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => navigate(`/entries/${entry.id}`)}
            style={{ border: '1px solid var(--brand)', background: 'none', cursor: 'pointer', fontSize: '0.72rem', color: 'var(--brand)', padding: '3px 8px', borderRadius: '6px', fontWeight: '700' }}
          >Full Audit ↗</button>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--ink-soft)' }}>✕</button>
        </div>
      </div>

      {/* Party / context banner */}
      {party && (
        <div style={{ padding: '10px 12px', borderRadius: '8px', background: party.kind === 'client' ? '#eaf6f0' : '#fef3e2', border: `1px solid ${party.kind === 'client' ? '#a7f3d0' : '#fcd34d'}`, fontSize: '0.82rem' }}>
          <div style={{ fontWeight: '800', color: party.kind === 'client' ? '#065f46' : '#92400e' }}>
            {party.kind === 'client' ? '👤 Client' : '🏭 Supplier'}: {party.name}
          </div>
          {party.phone && <div style={{ color: 'var(--ink-soft)', marginTop: '2px' }}>📞 {party.phone}</div>}
          <div style={{ marginTop: '6px', fontSize: '0.78rem', fontWeight: '700' }}>
            {isCharge
              ? (party.kind === 'client'
                ? `They owe you this sale amount`
                : `You owe them for this purchase`)
              : (party.kind === 'client'
                ? `They paid this amount to you`
                : `You paid this to them`)}
          </div>
        </div>
      )}

      {/* Main Payment/Charge Box */}
      <div style={{ textAlign: 'center', padding: '16px', background: isCharge ? '#fef3e2' : '#eaf6f0', borderRadius: '10px' }}>
        <div style={{ fontSize: '0.8rem', color: isCharge ? '#92400e' : '#065f46', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
          {isCharge ? 'Total Amount Charged' : 'Payment Amount'}
        </div>
        <div style={{ fontSize: '2rem', fontWeight: '900', color: isCharge ? '#92400e' : '#065f46' }}>
          <Money value={isCharge ? entry.debit : entry.credit} />
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', marginTop: '4px' }}>
          Ledger Balance after this: <strong><Money value={entry.runningBalance} /></strong>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
        {isCharge && entry.amountOwed > 0.01 && (
          <button
            onClick={() => navigate(`/${party.kind}s/${party.id}?pay=${entry.id}`)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '10px',
              background: 'var(--brand)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--brand-deep)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--brand)'}
          >
            💵 Record Payment
          </button>
        )}
        <button
          onClick={() => navigate(`/${party.kind}s/${party.id}${isCharge ? `?edit=${entry.id}` : ''}`)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '10px',
            background: '#fff',
            color: 'var(--ink)',
            border: '1px solid var(--line)',
            borderRadius: '8px',
            fontWeight: '700',
            fontSize: '0.88rem',
            cursor: 'pointer',
            transition: 'background 0.15s'
          }}
          onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
          onMouseOut={(e) => e.currentTarget.style.background = '#fff'}
        >
          ✏️ Edit/Manage
        </button>
      </div>

      {/* Payment / Debt breakdown */}
      {isCharge ? (
        <div style={{ padding: '14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: '600' }}>Payment status:</span>
            <span style={{ fontWeight: '700', color: entry.isFullyPaid ? '#065f46' : entry.isPartiallyPaid ? '#b25e00' : '#ba2525' }}>
              {entry.isFullyPaid ? 'Fully Paid' : entry.isPartiallyPaid ? 'Partially Paid' : 'Owed / Unpaid'}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ height: '8px', background: '#eceff1', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pctPaid}%`, background: entry.isFullyPaid ? '#10b981' : '#f59e0b', borderRadius: '4px' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.82rem', marginTop: '4px' }}>
            <div>
              <span style={{ color: 'var(--ink-soft)' }}>Amount Paid:</span>
              <div style={{ fontWeight: '700', color: 'var(--in)' }}><Money value={entry.amountPaid} /></div>
            </div>
            <div>
              <span style={{ color: 'var(--ink-soft)' }}>Outstanding Balance:</span>
              <div style={{ fontWeight: '700', color: 'var(--out)' }}><Money value={entry.amountOwed} /></div>
            </div>
            {entry.amountPaid > 0 && (
              <div style={{ gridColumn: '1 / -1', marginTop: '4px', borderTop: '1px solid var(--line)', paddingTop: '6px' }}>
                <span style={{ color: 'var(--ink-soft)' }}>Paid Units Breakdown:</span>
                <div style={{ fontWeight: '700', color: 'var(--ink)' }}>
                  {paidUnits.toFixed(2)} / {quantity.toFixed(2)} {productUnit} paid
                  <span style={{ fontWeight: 'normal', color: 'var(--ink-soft)', marginLeft: '6px' }}>
                    ({pctPaid.toFixed(0)}% of items)
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ padding: '14px', background: '#fff', borderRadius: '8px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ fontWeight: '600' }}>Reconciliation target:</span>
            <span style={{ fontWeight: '700', color: isLinked ? '#0277bd' : '#455a64' }}>
              {isLinked ? 'Linked Transaction' : 'Standalone on Account'}
            </span>
          </div>

          {isLinked ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
              <div style={{ background: '#f5fbfd', padding: '10px', borderRadius: '6px', border: '1px solid #b3e5fc' }}>
                <small style={{ color: '#0288d1', fontWeight: '700', display: 'block', textTransform: 'uppercase', fontSize: '0.65rem', marginBottom: '2px' }}>Applied Purchase/Sale</small>
                <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#01579b' }}>{entry.linkedTransactionName}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--ink-soft)', margin: '3px 0 6px 0' }}>
                  <span>ID: #{entry.linkedTransactionId.slice(0, 8)}</span>
                  {entry.linkedTransactionDate && (
                    <span>• {new Date(entry.linkedTransactionDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  )}
                  {entry.linkedTransactionCategory && (
                    <span style={{ padding: '0px 5px', borderRadius: '3px', background: '#e1f5fe', color: '#01579b', fontWeight: '700' }}>
                      {entry.linkedTransactionCategory === 'FINISHED_GOOD' ? 'Finished Good' : 'Raw Material'}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total invoice value:</span>
                  <strong style={{ color: 'var(--ink)' }}><Money value={totalAmount} /></strong>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>This payment covered:</span>
                  <strong style={{ color: '#065f46' }}><Money value={amountPaid} /> ({pctPaid.toFixed(0)}%)</strong>
                </div>
                {entry.amountRemaining > 0 && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--ink-soft)', display: 'flex', justifyContent: 'space-between', marginTop: '2px', borderTop: '1px dotted var(--line)', paddingTop: '2px' }}>
                    <span>Left outstanding:</span>
                    <strong style={{ color: 'var(--out)' }}><Money value={entry.amountRemaining} /></strong>
                  </div>
                )}
              </div>
              
              {unitPrice > 0 && (
                <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
                  <div>Equivalent units cleared: <strong>{paidUnits.toFixed(2)} {productUnit}</strong> (at Br {unitPrice.toLocaleString()}/unit)</div>
                  {quantity > 0 && (
                    <div style={{ marginTop: '2px' }}>Total invoice quantity: {quantity.toFixed(2)} {productUnit}</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', borderTop: '1px solid var(--line)', paddingTop: '8px' }}>
              This payment reduces the general outstanding ledger balance of the client/supplier. It was not linked directly to a single invoice or sale item during entry.
            </div>
          )}
        </div>
      )}

      {/* Date & time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '4px' }}>Date</div>
          <div style={{ fontWeight: '700' }}>{fmt(entry.date)}</div>
        </div>
        {entry.createdAt && (
          <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--line)' }}>
            <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '4px' }}>Recorded At</div>
            <div style={{ fontWeight: '700' }}>{fmt(entry.createdAt)} {fmtTime(entry.createdAt)}</div>
          </div>
        )}
      </div>

      {/* Product / Item details */}
      {isCharge && (
        <div style={{ padding: '14px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--ink-soft)' }}>
            {entry.productId ? '📦 Catalog Product' : '📝 Free-Text Item'}
          </div>
          <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>{entry.itemName}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.85rem' }}>
            <div>
              <span style={{ color: 'var(--ink-soft)' }}>Quantity: </span>
              <strong>{entry.quantity} {entry.productUnit || 'units'}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--ink-soft)' }}>Unit Price: </span>
              <strong>Br {entry.unitPrice?.toLocaleString()}</strong>
            </div>
            {entry.productCategory && (
              <div>
                <span style={{ color: 'var(--ink-soft)' }}>Category: </span>
                <strong>{CATEGORY_LABEL[entry.productCategory] || entry.productCategory}</strong>
              </div>
            )}
            {entry.catalogPrice != null && entry.unitPrice !== entry.catalogPrice && (
              <div>
                <span style={{ color: 'var(--ink-soft)' }}>Catalog Price: </span>
                <strong>Br {entry.catalogPrice?.toLocaleString()}</strong>
                {entry.unitPrice > entry.catalogPrice
                  ? <span style={{ color: '#10b981', marginLeft: '4px', fontWeight: '700' }}> ↑ premium</span>
                  : <span style={{ color: '#f59e0b', marginLeft: '4px', fontWeight: '700' }}> ↓ discount</span>
                }
              </div>
            )}
            {entry.restock && (
              <div style={{ gridColumn: '1/-1', padding: '4px 8px', background: '#eaf6f0', borderRadius: '4px', color: '#065f46', fontWeight: '600', fontSize: '0.8rem' }}>
                ✅ Restocked inventory
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment method */}
      {!isCharge && entry.method && (
        <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '4px' }}>Payment Method</div>
          <div style={{ fontWeight: '700', fontSize: '1.05rem' }}>💳 {entry.method}</div>
        </div>
      )}

      {/* Note */}
      {entry.note && (
        <div style={{ padding: '12px', background: '#fffbf0', borderRadius: '8px', border: '1px solid #f59e0b40' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#92400e', marginBottom: '4px' }}>Note</div>
          <div style={{ fontStyle: 'italic', color: 'var(--ink)' }}>"{entry.note}"</div>
        </div>
      )}
    </div>
  );
}

// ── Main Finances Component ────────────────────────────────────────────────
export default function Finances() {
  const [search, setSearch] = useState('');
  const [selectedParty, setSelectedParty] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [ledgerRange, setLedgerRange] = useState({ from: '', to: '' });
  const [filterType, setFilterType] = useState('all'); // 'all' | 'CHARGE' | 'PAYMENT'

  const { data: clientsRaw = [], isLoading: lcl } = useQuery({
    queryKey: ['clients'],
    queryFn: () => get('/clients'),
  });

  const { data: suppliersRaw = [], isLoading: lsu } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => get('/suppliers'),
  });

  const { data: ledgerData, isLoading: isLoadingLedger } = useQuery({
    queryKey: ['finances-ledger', selectedParty?.id, selectedParty?.kind, ledgerRange.from, ledgerRange.to],
    queryFn: () => {
      if (!selectedParty) return null;
      const p = new URLSearchParams({ party: selectedParty.id, kind: selectedParty.kind });
      if (ledgerRange.from) p.set('from', ledgerRange.from);
      if (ledgerRange.to) p.set('to', ledgerRange.to);
      return get(`/analytics/finances/ledger?${p}`);
    },
    enabled: !!selectedParty,
  });

  const allParties = [
    ...clientsRaw.map(c => ({ ...c, kind: 'client' })),
    ...suppliersRaw.map(s => ({ ...s, kind: 'supplier' })),
  ].filter(p => Number(p.balance) > 0)
   .sort((a, b) => Number(b.balance) - Number(a.balance));

  const filteredParties = allParties.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code && p.code.toLowerCase().includes(search.toLowerCase()))
  );

  const totalReceivables = clientsRaw.reduce((s, c) => s + Number(c.balance), 0);
  const totalPayables = suppliersRaw.reduce((s, s2) => s + Number(s2.balance), 0);

  const ledger = ledgerData?.ledger || [];
  const summary = ledgerData?.summary || {};
  const displayedEntries = filterType === 'all' ? ledger : ledger.filter(e => e.type === filterType);

  const selectParty = (p) => {
    setSelectedParty({ id: p.id, name: p.name, kind: p.kind, balance: p.balance, phone: p.phone, code: p.code });
    setSelectedEntry(null);
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: '0', maxWidth: 'none', width: '100%', padding: '0 8px' }}>
      <header className="page-head">
        <h1>Finances &amp; Debt Audit</h1>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--in)', fontWeight: '700' }}>▲ Recv: <Money value={totalReceivables} /></span>
          <span style={{ color: 'var(--out)', fontWeight: '700' }}>▼ Pay: <Money value={totalPayables} /></span>
          <span style={{ fontWeight: '700' }}>Net: <Money value={totalReceivables - totalPayables} /></span>
        </div>
      </header>

      {/* ── 3-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1.4fr 400px', gap: '16px', height: 'calc(100vh - 130px)', overflow: 'hidden' }}>

        {/* ── LEFT: Party List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
          <input
            type="text"
            placeholder="Search parties…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '0.85rem', flexShrink: 0 }}
          />
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
            {(lcl || lsu) && <p className="empty">Loading…</p>}
            {!lcl && !lsu && filteredParties.length === 0 && (
              <p className="empty">No outstanding balances found.</p>
            )}
            {filteredParties.map(p => (
              <div
                key={`${p.kind}:${p.id}`}
                onClick={() => selectParty(p)}
                style={{
                  padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                  border: selectedParty?.id === p.id ? '2px solid var(--accent)' : '1px solid var(--line)',
                  background: selectedParty?.id === p.id ? 'rgba(201,130,28,0.06)' : '#fff',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', marginTop: '2px' }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: '4px', fontWeight: '700', marginRight: '6px',
                        background: p.kind === 'client' ? '#eaf6f0' : '#fef3e2',
                        color: p.kind === 'client' ? '#065f46' : '#92400e',
                        fontSize: '0.68rem', textTransform: 'uppercase',
                      }}>{p.kind}</span>
                      {p.code && p.code} {p.phone && `· ${p.phone}`}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: '800', fontSize: '0.9rem', color: p.kind === 'client' ? 'var(--in)' : 'var(--out)' }}>
                      <Money value={p.balance} />
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--ink-soft)' }}>outstanding</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── MIDDLE: Transaction Timeline ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflow: 'hidden' }}>
          {!selectedParty ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--ink-soft)', gap: '12px' }}>
              <div style={{ fontSize: '3rem' }}>👈</div>
              <p>Select a client or supplier to view their transaction history</p>
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '1rem' }}>
                  {selectedParty.name}
                  <span style={{ marginLeft: '8px', fontSize: '0.78rem', color: 'var(--ink-soft)', fontWeight: '400' }}>
                    {ledger.length} transactions
                  </span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  {['all', 'CHARGE', 'PAYMENT'].map(t => (
                    <button key={t} onClick={() => setFilterType(t)}
                      style={{
                        padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600',
                        border: filterType === t ? '2px solid var(--accent)' : '1px solid var(--line)',
                        background: filterType === t ? 'rgba(201,130,28,0.1)' : '#fff',
                      }}>
                      {t === 'all' ? 'All' : t === 'CHARGE' ? 'Sales/Purchases' : 'Payments'}
                    </button>
                  ))}
                </div>
                <input type="date" value={ledgerRange.from} onChange={(e) => setLedgerRange({ ...ledgerRange, from: e.target.value })}
                  style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '0.8rem' }} />
                <input type="date" value={ledgerRange.to} onChange={(e) => setLedgerRange({ ...ledgerRange, to: e.target.value })}
                  style={{ padding: '5px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '0.8rem' }} />
                {(ledgerRange.from || ledgerRange.to) && (
                  <button onClick={() => setLedgerRange({ from: '', to: '' })}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line)', cursor: 'pointer', fontSize: '0.78rem', background: '#fff' }}>
                    ✕ Clear
                  </button>
                )}
              </div>

              {/* Summary bar */}
              {ledgerData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', flexShrink: 0 }}>
                  {[
                    { label: 'Total Charged', val: summary.totalCharged, color: 'var(--out)' },
                    { label: 'Total Paid', val: summary.totalPaid, color: 'var(--in)' },
                    { label: 'Current Balance', val: summary.currentBalance, color: summary.currentBalance > 0 ? 'var(--out)' : 'var(--in)' },
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ padding: '10px 12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--line)' }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--ink-soft)', marginBottom: '3px' }}>{label}</div>
                      <div style={{ fontWeight: '800', fontSize: '1rem', color }}><Money value={val ?? 0} /></div>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline */}
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                {isLoadingLedger && <p className="empty">Loading transactions…</p>}
                {!isLoadingLedger && displayedEntries.length === 0 && (
                  <p className="empty">No {filterType !== 'all' ? filterType.toLowerCase() + ' ' : ''}entries found.</p>
                )}
                {displayedEntries.map((e, idx) => (
                  <TxnCard
                    key={`${e.id}-${idx}`}
                    entry={e}
                    isSelected={selectedEntry?.id === e.id}
                    onClick={() => setSelectedEntry(selectedEntry?.id === e.id ? null : e)}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── RIGHT: Detail Panel ── */}
        <div style={{ borderLeft: '1px solid var(--line)', overflowY: 'auto' }}>
          <TxnDetail entry={selectedEntry} party={selectedParty} onClose={() => setSelectedEntry(null)} />
        </div>

      </div>
    </div>
  );
}
