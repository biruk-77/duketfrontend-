import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';
import Money from '../components/Money';
import { useState } from 'react';

const fmt = (d) =>
  new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

const CATEGORY_LABEL = { FINISHED_GOOD: 'Finished Good', RAW_MATERIAL: 'Raw Material' };

export default function TransactionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['transaction-detail', id],
    queryFn: () => get(`/analytics/finances/entries/${id}`),
  });

  if (isLoading) return <div className="page-loading">Loading transaction audit trail…</div>;
  if (isError) return <div className="page"><p className="form-error">Error: {error.message}</p></div>;

  const { entry, kind, type, party, auditTimeline } = data;
  const isCharge = type === 'CHARGE';
  
  // Calculations
  const amountPaid = isCharge ? (entry.amountPaid || 0) : entry.credit;
  const totalAmount = isCharge ? entry.total : (entry.linkedTransactionTotal || 0);
  const pctPaid = totalAmount > 0 ? ((amountPaid / totalAmount) * 100) : 0;
  const isLinked = !isCharge && !!entry.linkedTransactionId;
  const unitPrice = isCharge 
    ? entry.unitPrice 
    : (entry.linkedTransactionUnitPrice || (totalAmount && entry.linkedTransactionQuantity ? (totalAmount / entry.linkedTransactionQuantity) : 0));
  const paidUnits = unitPrice > 0 ? (amountPaid / unitPrice) : 0;
  const quantity = isCharge ? entry.quantity : (entry.linkedTransactionQuantity || 0);
  const productUnit = isCharge ? entry.productUnit : (entry.linkedTransactionUnit || 'units');

  return (
    <div className="page" style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px' }}>
      {/* Back crumb */}
      <p className="crumb" style={{ marginBottom: '20px' }}>
        <Link to={kind === 'client' ? '/clients' : '/suppliers'}>
          {kind === 'client' ? 'Clients' : 'Suppliers'}
        </Link>{' '}
        /{' '}
        <Link to={kind === 'client' ? `/clients/${party.id}` : `/suppliers/${party.id}`}>
          {party.name}
        </Link>{' '}
        / Detailed Audit
      </p>

      {/* Header */}
      <header className="page-head" style={{ marginBottom: '28px', borderBottom: '1px solid var(--line)', paddingBottom: '20px' }}>
        <div>
          <span style={{
            fontSize: '0.75rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 10px',
            borderRadius: '6px',
            background: isCharge ? '#fef3e2' : '#eaf6f0',
            color: isCharge ? '#b45309' : '#047857',
            display: 'inline-block',
            marginBottom: '8px'
          }}>
            {isCharge ? `${kind === 'client' ? 'Client Sale' : 'Supplier Purchase'} Record` : 'Payment Settlement'}
          </span>
          <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>{isCharge ? entry.itemName : `${entry.method} Payment`}</span>
            <span style={{ fontSize: '1rem', fontWeight: '400', color: 'var(--ink-soft)' }}>#{id.slice(0, 8)}</span>
          </h1>
          <p style={{ margin: '6px 0 0 0', color: 'var(--ink-soft)' }}>
            For {kind === 'client' ? 'Client' : 'Supplier'}: <strong>{party.name}</strong> {party.phone && `(${party.phone})`}
          </p>
        </div>
        <button className="btn" onClick={() => navigate(-1)} style={{ alignSelf: 'flex-start' }}>
          ← Back
        </button>
      </header>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>
        
        {/* Left Column: Transaction Details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Main Financial Figure */}
          <div style={{
            padding: '24px',
            background: isCharge ? 'linear-gradient(135deg, #fffbeb, #fef3e2)' : 'linear-gradient(135deg, #f0fdf4, #eaf6f0)',
            borderRadius: '12px',
            border: `1px solid ${isCharge ? '#fde68a' : '#a7f3d0'}`,
            textAlign: 'center',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
          }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '800', color: isCharge ? '#b45309' : '#047857', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {isCharge ? 'Amount Invoiced' : 'Payment Amount'}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: isCharge ? '#78350f' : '#065f46', margin: '8px 0' }}>
              <Money value={isCharge ? entry.total : entry.amount} />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
              Transaction Date: <strong>{fmt(entry.date)}</strong>
            </div>
          </div>

          {/* Payment Terms & Outstanding details */}
          {isCharge ? (
            <div className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '800', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>Payment Settlements</h3>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--ink-soft)', fontWeight: '600' }}>Reconciliation Status:</span>
                <span style={{
                  fontWeight: '800',
                  color: entry.isFullyPaid ? '#10b981' : entry.isPartiallyPaid ? '#f59e0b' : '#ef4444'
                }}>
                  {entry.isFullyPaid ? 'FULLY SETTLED' : entry.isPartiallyPaid ? 'PARTIALLY PAID' : '100% UNPAID (OWED)'}
                </span>
              </div>

              {/* Progress bar */}
              <div style={{ height: '10px', background: '#f3f4f6', borderRadius: '5px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ height: '100%', width: `${pctPaid}%`, background: entry.isFullyPaid ? '#10b981' : '#f59e0b', borderRadius: '5px', transition: 'width 0.3s ease' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--line)' }}>
                  <small style={{ color: 'var(--ink-soft)', display: 'block', marginBottom: '2px' }}>Paid Amount</small>
                  <strong style={{ fontSize: '1.1rem', color: '#047857' }}><Money value={entry.amountPaid} /></strong>
                </div>
                <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--line)' }}>
                  <small style={{ color: 'var(--ink-soft)', display: 'block', marginBottom: '2px' }}>Remaining Debt</small>
                  <strong style={{ fontSize: '1.1rem', color: '#b91c1c' }}><Money value={entry.amountOwed} /></strong>
                </div>

                {entry.amountPaid > 0 && (
                  <div style={{ gridColumn: '1 / -1', background: '#f9fafb', padding: '12px', borderRadius: '8px', border: '1px dashed var(--line)' }}>
                    <small style={{ color: 'var(--ink-soft)', display: 'block', marginBottom: '4px' }}>Paid Units Reconciliation</small>
                    <div style={{ fontSize: '0.92rem', fontWeight: '700' }}>
                      {paidUnits.toFixed(2)} out of {quantity.toFixed(2)} {productUnit} paid
                      <span style={{ fontWeight: 'normal', color: 'var(--ink-soft)', marginLeft: '6px' }}>
                        ({pctPaid.toFixed(1)}%)
                      </span>
                    </div>
                    {entry.linkedPaymentMethod && (
                      <small style={{ color: 'var(--ink-soft)', display: 'block', marginTop: '4px' }}>
                        Cleared via 💳 <strong>{entry.linkedPaymentMethod}</strong>
                      </small>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '800', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>Reconciliation Details</h3>
              {isLinked ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px' }}>
                    <small style={{ color: '#0284c7', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', fontSize: '0.7rem', marginBottom: '4px' }}>Associated Invoice / Transaction</small>
                    <div style={{ fontWeight: '800', fontSize: '1rem', color: '#0369a1' }}>
                      {entry.linkedTransactionName}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: 'var(--ink-soft)', margin: '4px 0 8px 0' }}>
                      <span>ID: #{entry.linkedTransactionId.slice(0, 8)}</span>
                      {entry.linkedTransactionDate && (
                        <span>• Date: <strong>{fmt(entry.linkedTransactionDate)}</strong></span>
                      )}
                      {entry.linkedTransactionCategory && (
                        <span>• Category: <strong>{CATEGORY_LABEL[entry.linkedTransactionCategory] || entry.linkedTransactionCategory}</strong></span>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginTop: '8px', color: 'var(--ink-soft)' }}>
                      <span>Invoice Total:</span>
                      <strong style={{ color: 'var(--ink)' }}><Money value={totalAmount} /></strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
                      <span>This Settlement:</span>
                      <strong style={{ color: '#047857' }}><Money value={amountPaid} /> ({pctPaid.toFixed(1)}%)</strong>
                    </div>
                    {entry.amountRemaining > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--ink-soft)', borderTop: '1px dotted var(--line)', paddingTop: '4px', marginTop: '4px' }}>
                        <span>Unpaid Balance:</span>
                        <strong style={{ color: '#b91c1c' }}><Money value={entry.amountRemaining} /></strong>
                      </div>
                    )}
                  </div>

                  {unitPrice > 0 && (
                    <div style={{ padding: '12px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--line)', fontSize: '0.85rem' }}>
                      <div>
                        Equivalent units cleared: <strong>{paidUnits.toFixed(2)} {productUnit}</strong> (at Br {unitPrice.toLocaleString()}/unit)
                      </div>
                      {quantity > 0 && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: '2px' }}>
                          Total invoice quantity: {quantity.toFixed(2)} {productUnit}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--ink-soft)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                  This payment was recorded as a <strong>Standalone Payment on Account</strong>. It was not mapped directly to a single transaction at the time of entry, and acts to offset the overall ledger balance.
                </div>
              )}
            </div>
          )}

          {/* Product and Catalog details */}
          {isCharge && (
            <div className="panel" style={{ padding: '20px', borderRadius: '12px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: '800', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>Product Catalog Metadata</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '0.9rem' }}>
                <div>
                  <span style={{ color: 'var(--ink-soft)', display: 'block', fontSize: '0.8rem' }}>Catalog Entry</span>
                  <strong>{entry.productId ? '📎 Yes (Linked Catalog)' : '📝 No (Free-Text Entry)'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-soft)', display: 'block', fontSize: '0.8rem' }}>Product Category</span>
                  <strong>{CATEGORY_LABEL[entry.productCategory] || entry.productCategory || 'N/A'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-soft)', display: 'block', fontSize: '0.8rem' }}>Quantity</span>
                  <strong>{entry.quantity} {entry.productUnit || 'units'}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--ink-soft)', display: 'block', fontSize: '0.8rem' }}>Unit Price</span>
                  <strong>Br {entry.unitPrice.toLocaleString()}</strong>
                </div>
                
                {entry.catalogPrice != null && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '4px' }}>
                    <span style={{ color: 'var(--ink-soft)' }}>Pricing Audit: </span>
                    <strong>Br {entry.unitPrice.toLocaleString()}</strong> vs Catalog standard <strong>Br {entry.catalogPrice.toLocaleString()}</strong>
                    {entry.unitPrice !== entry.catalogPrice ? (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        background: entry.unitPrice > entry.catalogPrice ? '#ecfdf5' : '#fffbeb',
                        color: entry.unitPrice > entry.catalogPrice ? '#047857' : '#d97706'
                      }}>
                        {entry.unitPrice > entry.catalogPrice ? `Premium (+Br ${(entry.unitPrice - entry.catalogPrice).toFixed(2)})` : `Discount (-Br ${(entry.catalogPrice - entry.unitPrice).toFixed(2)})`}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--ink-soft)', marginLeft: '8px', fontSize: '0.75rem' }}>(Perfect Match)</span>
                    )}
                  </div>
                )}

                {entry.restock && (
                  <div style={{ gridColumn: '1 / -1', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '10px', borderRadius: '6px', color: '#047857', fontWeight: '600', fontSize: '0.85rem' }}>
                    ✅ Inventory restock was completed successfully for this purchase.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Note / Remarks */}
          {entry.note && (
            <div className="panel" style={{ padding: '16px', borderRadius: '12px', background: '#fffbeb', border: '1px dashed #fcd34d' }}>
              <small style={{ color: '#b45309', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', fontSize: '0.7rem', marginBottom: '4px' }}>Remarks / Memo</small>
              <p style={{ margin: 0, fontStyle: 'italic', fontSize: '0.92rem', color: '#78350f' }}>"{entry.note}"</p>
            </div>
          )}

        </div>

        {/* Right Column: Audit Log Timeline */}
        <div className="panel" style={{ padding: '24px', borderRadius: '12px' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Timeline Audit Trail</span>
            <span style={{
              fontSize: '0.75rem',
              fontWeight: 'normal',
              color: 'var(--ink-soft)',
              background: '#f3f4f6',
              padding: '2px 8px',
              borderRadius: '999px'
            }}>
              {auditTimeline.length} events
            </span>
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', paddingLeft: '16px' }}>
            {/* Timeline line */}
            <div style={{
              position: 'absolute',
              left: 5,
              top: 8,
              bottom: 8,
              width: '2px',
              background: 'var(--line)',
              zIndex: 0
            }} />

            {auditTimeline.map((log, i) => {
              const isCreate = log.action.endsWith('.create');
              const isUpdate = log.action.endsWith('.update');
              const isDelete = log.action.endsWith('.delete');

              let actionLabel = log.action;
              let dotColor = '#94a3b8';
              if (isCreate) {
                actionLabel = 'Created';
                dotColor = '#10b981';
              } else if (isUpdate) {
                actionLabel = 'Updated';
                dotColor = '#f59e0b';
              } else if (isDelete) {
                actionLabel = 'Deleted';
                dotColor = '#ef4444';
              }

              return (
                <div key={log.id} style={{ position: 'relative', zIndex: 1 }}>
                  {/* Timeline dot */}
                  <div style={{
                    position: 'absolute',
                    left: '-16px',
                    top: '4px',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: dotColor,
                    border: '3px solid #fff',
                    boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
                  }} />

                  <div style={{ fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                      <span style={{ fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.02em', color: dotColor }}>
                        {actionLabel}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--ink-soft)' }}>
                        {fmt(log.createdAt)} {fmtTime(log.createdAt)}
                      </span>
                    </div>

                    <div style={{ fontWeight: '600', color: 'var(--ink)', margin: '2px 0' }}>
                      By: {log.userName}{' '}
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: '700',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: log.userRole === 'OWNER' ? '#fee2e2' : '#f3f4f6',
                        color: log.userRole === 'OWNER' ? '#991b1b' : '#374151',
                        marginLeft: '4px'
                      }}>
                        {log.userRole}
                      </span>
                    </div>

                    {/* Change breakdown */}
                    {log.detail && (
                      <div style={{
                        marginTop: '6px',
                        background: '#f9fafb',
                        padding: '8px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        fontSize: '0.78rem',
                        fontFamily: 'monospace',
                        color: '#374151',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {log.detail.before ? (
                          <div>
                            <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>- Before:</span>{' '}
                            {JSON.stringify(log.detail.before, null, 1)}
                            <br />
                            <span style={{ color: '#047857', fontWeight: 'bold' }}>+ After:</span>{' '}
                            {JSON.stringify(
                              Object.keys(log.detail.before).reduce((acc, k) => {
                                acc[k] = entry[k];
                                return acc;
                              }, {}),
                              null,
                              1
                            )}
                          </div>
                        ) : log.detail.reason ? (
                          <span>Info: {log.detail.reason}</span>
                        ) : (
                          <span>Details: {JSON.stringify(log.detail)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
