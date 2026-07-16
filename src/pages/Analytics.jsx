import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { get } from '../api';

// ── Formatting ──────────────────────────────────────────────────────────────
const fmtBr = (n) =>
  'Br ' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtK = (n) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(0)}k`
  : n.toFixed(0);

// ── SVG: Smooth Area + Line Trend Chart ─────────────────────────────────────
function TrendChart({ data = [], keys = [], colors = [] }) {
  if (data.length < 2) return <p className="empty">Not enough data for this period.</p>;

  const W = 100; // viewBox width in percentage
  const padL = 7, padR = 2, padT = 3, padB = 10;
  const chartW = 100 - padL - padR;
  const chartH = 100 - padT - padB;

  const allVals = data.flatMap(d => keys.map(k => d[k] || 0));
  const maxV = Math.max(...allVals, 1);

  const toX = (i) => padL + (i / (data.length - 1)) * chartW;
  const toY = (v) => padT + chartH - (v / maxV) * chartH;

  // smooth bezier path
  const linePath = (key) => {
    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d[key] || 0) }));
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C ${cx} ${pts[i - 1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
    }
    return d;
  };

  const areaPath = (key) => {
    const pts = data.map((d, i) => ({ x: toX(i), y: toY(d[key] || 0) }));
    let d = `M ${pts[0].x} ${padT + chartH}`;
    d += ` L ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const cx = (pts[i - 1].x + pts[i].x) / 2;
      d += ` C ${cx} ${pts[i - 1].y} ${cx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${padT + chartH} Z`;
    return d;
  };

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: f * maxV, y: toY(f * maxV) }));

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 260, display: 'block', overflow: 'visible' }}>
      <defs>
        {keys.map((k, ki) => (
          <linearGradient key={k} id={`ag-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors[ki]} stopOpacity="0.22" />
            <stop offset="100%" stopColor={colors[ki]} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>

      {/* Grid */}
      {gridVals.map(({ v, y }) => (
        <g key={v}>
          <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#e2e5db" strokeWidth="0.3" />
          <text x={padL - 0.5} y={y + 0.8} textAnchor="end" fontSize="2.5" fill="#9aa390" fontFamily="IBM Plex Mono, monospace">
            {fmtK(v)}
          </text>
        </g>
      ))}

      {/* Areas + Lines */}
      {keys.map((k, ki) => (
        <g key={k}>
          <path d={areaPath(k)} fill={`url(#ag-${k})`} />
          <path d={linePath(k)} fill="none" stroke={colors[ki]} strokeWidth="0.6" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}

      {/* Dots + labels */}
      {keys.map((k, ki) =>
        data.map((d, i) => (
          <g key={`${k}-${i}`}>
            <circle cx={toX(i)} cy={toY(d[k] || 0)} r="0.9" fill="#fff" stroke={colors[ki]} strokeWidth="0.5" />
          </g>
        ))
      )}

      {/* X-axis labels */}
      {data.map((d, i) => {
        if (data.length > 20 && i % 3 !== 0) return null;
        return (
          <text key={i} x={toX(i)} y={padT + chartH + 5} textAnchor="middle" fontSize="2.5" fill="#9aa390" fontFamily="Archivo, system-ui">
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── SVG: Grouped Bar Chart ──────────────────────────────────────────────────
function GroupedBarSVG({ data = [] }) {
  if (data.length < 1) return <p className="empty">No data for this period.</p>;

  const padL = 7, padR = 2, padT = 3, padB = 10;
  const chartW = 100 - padL - padR;
  const chartH = 100 - padT - padB;

  const maxV = Math.max(...data.flatMap(d => [d.revenue, d.expenses, Math.max(d.profit, 0)]), 1);
  const numGroups = data.length;
  const groupW = chartW / numGroups;
  const barW = Math.min(groupW * 0.22, 4);
  const gap = barW * 0.4;
  const totalBarW = 3 * barW + 2 * gap;

  const toY = (v) => padT + chartH - Math.max(v, 0) / maxV * chartH;
  const toH = (v) => Math.max(v, 0) / maxV * chartH;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: f * maxV, y: padT + chartH - f * chartH }));

  const bars = [
    { key: 'revenue', color: '#1e5b45', label: 'Revenue' },
    { key: 'expenses', color: '#a63a24', label: 'Expenses' },
    { key: 'profit', color: '#c9821c', label: 'Profit' },
  ];

  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: 260, display: 'block', overflow: 'visible' }}>
      <defs>
        {bars.map(b => (
          <linearGradient key={b.key} id={`bg-${b.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={b.color} stopOpacity="1" />
            <stop offset="100%" stopColor={b.color} stopOpacity="0.55" />
          </linearGradient>
        ))}
      </defs>

      {gridVals.map(({ v, y }) => (
        <g key={v}>
          <line x1={padL} y1={y} x2={padL + chartW} y2={y} stroke="#e2e5db" strokeWidth="0.3" />
          <text x={padL - 0.5} y={y + 0.8} textAnchor="end" fontSize="2.5" fill="#9aa390" fontFamily="IBM Plex Mono, monospace">
            {fmtK(v)}
          </text>
        </g>
      ))}

      {data.map((d, i) => {
        const gx = padL + i * groupW + (groupW - totalBarW) / 2;
        return (
          <g key={i}>
            {bars.map((b, bi) => {
              const bx = gx + bi * (barW + gap);
              const bh = toH(d[b.key]);
              const by = toY(d[b.key]);
              return bh > 0.1 ? (
                <rect key={b.key} x={bx} y={by} width={barW} height={bh}
                  fill={`url(#bg-${b.key})`} rx="0.6" ry="0.6" />
              ) : null;
            })}
            {data.length <= 16 && (
              <text x={gx + totalBarW / 2} y={padT + chartH + 5} textAnchor="middle" fontSize="2.2" fill="#9aa390" fontFamily="Archivo, system-ui">
                {d.label.length > 7 ? d.label.slice(0, 7) : d.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Legend */}
      {bars.map((b, i) => (
        <g key={b.key}>
          <rect x={padL + i * 22} y={padT + chartH + 7.5} width={3.5} height={3.5} fill={b.color} rx="0.5" />
          <text x={padL + i * 22 + 4.5} y={padT + chartH + 10.5} fontSize="2.5" fill="#5c6154" fontFamily="Archivo, system-ui">{b.label}</text>
        </g>
      ))}
    </svg>
  );
}

// ── SVG: Donut Chart (Product Mix) ──────────────────────────────────────────
function DonutChart({ data = [] }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.revenue, 0) || 1;
  const COLORS = ['#1e5b45', '#2e8060', '#c9821c', '#a63a24', '#5c6154', '#9aa390'];
  const R = 30, INNER = 18;
  const CX = 50, CY = 50;

  let angle = -Math.PI / 2;
  const slices = data.slice(0, 6).map((d, i) => {
    const sweep = (d.revenue / total) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(angle);
    const y1 = CY + R * Math.sin(angle);
    angle += sweep;
    const x2 = CX + R * Math.cos(angle);
    const y2 = CY + R * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const innerX1 = CX + INNER * Math.cos(angle - sweep);
    const innerY1 = CY + INNER * Math.sin(angle - sweep);
    const innerX2 = CX + INNER * Math.cos(angle);
    const innerY2 = CY + INNER * Math.sin(angle);
    return { path: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${innerX2} ${innerY2} A ${INNER} ${INNER} 0 ${large} 0 ${innerX1} ${innerY1} Z`, color: COLORS[i], name: d.name, pct: ((d.revenue / total) * 100).toFixed(1) };
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 16, alignItems: 'center' }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: 'auto' }}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
        <text x={CX} y={CY - 3} textAnchor="middle" fontSize="5" fontWeight="700" fill="#22261f" fontFamily="IBM Plex Mono, monospace">
          {fmtK(total)}
        </text>
        <text x={CX} y={CY + 5} textAnchor="middle" fontSize="3.5" fill="#9aa390" fontFamily="Archivo, system-ui">Br revenue</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{s.name}</span>
            <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--ink-soft)' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KPI({ label, value, sub, tone, icon }) {
  const toneColor = { green: '#1e5b45', red: '#a63a24', gold: '#c9821c', neutral: '#22261f' };
  return (
    <div className="kpi-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <small className="kpi-label">{label}</small>
        {icon && <span style={{ fontSize: '1.4rem', opacity: 0.35 }}>{icon}</span>}
      </div>
      <div className="kpi-value" style={{ color: toneColor[tone] || toneColor.neutral }}>{value}</div>
      {sub && <small className="kpi-sub">{sub}</small>}
    </div>
  );
}

// ── Period selector ─────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All Time' },
];

// ── Audit Log ───────────────────────────────────────────────────────────────
function AuditPanel({ dateRange }) {
  const [page, setPage] = useState(0);
  const [entity, setEntity] = useState('');
  const [action, setAction] = useState('');
  const LIMIT = 12;

  const params = new URLSearchParams({ limit: LIMIT, offset: page * LIMIT, ...(entity ? { entity } : {}), ...(action ? { action } : {}), ...(dateRange.from ? { from: dateRange.from } : {}), ...(dateRange.to ? { to: dateRange.to } : {}) });

  const { data, isLoading } = useQuery({ queryKey: ['audit', params.toString()], queryFn: () => get(`/analytics/audit?${params}`) });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / LIMIT);

  const fmtDT = (d) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const actionColor = (a) => {
    if (a.includes('create')) return '#177346';
    if (a.includes('delete')) return '#a63a24';
    if (a.includes('correction') || a.includes('update')) return '#9a6a12';
    return '#5c6154';
  };

  return (
    <div>
      <div className="audit-filters">
        <select value={entity} onChange={e => { setEntity(e.target.value); setPage(0); }}>
          <option value="">All Entities</option>
          <option value="ClientTransaction">Sales</option>
          <option value="SupplierTransaction">Purchases</option>
          <option value="ClientPayment">Client Payments</option>
          <option value="SupplierPayment">Supplier Payments</option>
          <option value="ProductionLog">Production</option>
          <option value="Product">Products</option>
        </select>
        <select value={action} onChange={e => { setAction(e.target.value); setPage(0); }}>
          <option value="">All Actions</option>
          <option value="create">Creates</option>
          <option value="delete">Deletes</option>
          <option value="update">Updates</option>
          <option value="correction">Corrections</option>
        </select>
        <span className="audit-count">{total.toLocaleString()} total events</span>
      </div>

      {isLoading ? <p className="empty">Loading…</p> : !logs.length ? <p className="empty">No audit events match these filters.</p> : (
        <>
          <div className="audit-log">
            {logs.map(log => {
              const detail = log.detail && typeof log.detail === 'object'
                ? Object.entries(log.detail).map(([k, v]) => `${k}: ${v}`).join(' · ')
                : log.detail;
              return (
                <div key={log.id} className="audit-row">
                  <div className="audit-time">{fmtDT(log.createdAt)}</div>
                  <div className="audit-action" style={{ color: actionColor(log.action) }}>{log.action}</div>
                  <div className="audit-entity">{log.entity}</div>
                  <div className="audit-user">{log.userName}</div>
                  {detail && <div className="audit-detail" title={detail}>{detail}</div>}
                </div>
              );
            })}
          </div>
          {pages > 1 && (
            <div className="audit-pagination">
              <button className="btn ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span>{page + 1} / {pages}</span>
              <button className="btn ghost" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Analytics Page ─────────────────────────────────────────────────────
export default function Analytics() {
  const [period, setPeriod] = useState('month');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const { data: overview } = useQuery({ queryKey: ['ana-overview', period], queryFn: () => get(`/analytics/overview?period=${period}`) });
  const { data: trend = [], isLoading: trendLoad } = useQuery({ queryKey: ['ana-trend', period], queryFn: () => get(`/analytics/trend?period=${period}`) });
  const { data: products = [] } = useQuery({ queryKey: ['ana-products', period], queryFn: () => get(`/analytics/products?period=${period}`) });

  const o = overview || {};
  const profitPositive = (o.grossProfit || 0) >= 0;

  return (
    <div className="page analytics-page">
      <header className="page-head" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h1>Profit &amp; Analytics</h1>
        <div className="period-tabs">
          {PERIODS.map(p => (
            <button key={p.key} className={`period-tab${period === p.key ? ' active' : ''}`} onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* KPIs */}
      <div className="kpi-row">
        <KPI label="Total Revenue" icon="📈" value={fmtBr(o.totalRevenue || 0)} tone="green"
          sub={`From ${(o.period === 'all') ? 'all recorded sales' : `this ${o.period}`}`} />
        <KPI label="Total Expenses" icon="📦" value={fmtBr(o.totalExpenses || 0)} tone="red"
          sub="All supplier purchases" />
        <KPI label="Gross Profit" icon="💰" value={fmtBr(o.grossProfit || 0)} tone={profitPositive ? 'green' : 'red'}
          sub={`Margin: ${(o.profitMargin || 0).toFixed(1)}%`} />
        <KPI label="Net Cash Collected" icon="🏦" value={fmtBr(o.netCashPosition || 0)}
          tone={(o.netCashPosition || 0) >= 0 ? 'gold' : 'red'}
          sub="Payments in minus payments out" />
      </div>

      {/* Grouped Bar Chart */}
      <div className="panel chart-panel">
        <div className="panel-head">
          <h2>Revenue · Expenses · Profit — {PERIODS.find(p => p.key === period)?.label}</h2>
        </div>
        <div className="chart-scroll">
          {trendLoad
            ? <div className="chart-loading">Building chart…</div>
            : <GroupedBarSVG data={trend} />}
        </div>
      </div>

      {/* Trend Line + Donut side by side */}
      <div className="two-col">
        <div className="panel chart-panel">
          <div className="panel-head"><h2>Profit Trend</h2></div>
          <div className="chart-scroll">
            {trendLoad
              ? <div className="chart-loading">Building…</div>
              : <TrendChart data={trend} keys={['revenue', 'profit']} colors={['#1e5b45', '#c9821c']} />}
          </div>
        </div>

        <div className="panel chart-panel">
          <div className="panel-head"><h2>Product Revenue Mix</h2></div>
          {products.length > 0
            ? <DonutChart data={products} />
            : <p className="empty">No product sales in this period.</p>}
        </div>
      </div>

      {/* Product Table */}
      <div className="panel">
        <div className="panel-head"><h2>Per-Product Breakdown</h2></div>
        {products.length === 0 ? <p className="empty">No sales recorded for this period.</p> : (
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Units Sold</th>
                <th className="num" style={{ color: 'var(--in)' }}>Revenue</th>
                <th className="num" style={{ color: 'var(--out)' }}>Purchases Cost</th>
                <th className="num">Gross Profit</th>
                <th className="num">Margin</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const margin = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) : '—';
                return (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="num mono-sm">{Number(p.unitsSold).toLocaleString()}</td>
                    <td className="num mono-sm" style={{ color: 'var(--in)', fontWeight: 700 }}>{fmtBr(p.revenue)}</td>
                    <td className="num mono-sm" style={{ color: 'var(--out)' }}>{fmtBr(p.cost)}</td>
                    <td className="num mono-sm" style={{ color: p.profit >= 0 ? 'var(--in)' : 'var(--out)', fontWeight: 700 }}>
                      {fmtBr(p.profit)}
                    </td>
                    <td className="num">
                      <span className={`margin-badge ${p.profit >= 0 ? 'mg-good' : 'mg-bad'}`}>{margin}%</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Audit Log */}
      <div className="panel">
        <div className="panel-head">
          <h2>System Audit Log</h2>
          <span className="chart-sub">Every create / delete / update is logged</span>
        </div>
        <div className="audit-date-filter">
          <label>From <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} /></label>
          <label>To <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} /></label>
          <button className="btn ghost" onClick={() => setDateRange({ from: '', to: '' })}>Clear</button>
        </div>
        <AuditPanel dateRange={dateRange} />
      </div>
    </div>
  );
}
