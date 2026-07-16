import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { get, reportUrl } from '../api';
import Money from '../components/Money';

const KIND_LABEL = {
  sale: 'Sale',
  purchase: 'Purchase',
  payment_in: 'Payment in',
  payment_out: 'Payment out',
};
const KIND_LINK = {
  sale: 'clients', payment_in: 'clients',
  purchase: 'suppliers', payment_out: 'suppliers',
};

function DashboardCharts({ summary, activity }) {
  const canvasRef1 = useRef(null);
  const canvasRef2 = useRef(null);

  useEffect(() => {
    // 1. Receivables vs Payables Bar Chart
    if (summary && canvasRef1.current) {
      const canvas = canvasRef1.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const rec = summary.totalReceivable || 0;
      const pay = summary.totalPayable || 0;
      const maxVal = Math.max(rec, pay, 1);
      
      // Styling
      ctx.fillStyle = '#1e5b45'; // Receivables green
      const recHeight = (rec / maxVal) * 120;
      ctx.fillRect(40, 150 - recHeight, 50, recHeight);
      
      ctx.fillStyle = '#a63a24'; // Payables red
      const payHeight = (pay / maxVal) * 120;
      ctx.fillRect(130, 150 - payHeight, 50, payHeight);
      
      // Labels
      ctx.fillStyle = '#22261f';
      ctx.font = '11px var(--display)';
      ctx.textAlign = 'center';
      ctx.fillText('Receivables', 65, 170);
      ctx.fillText('Payables', 155, 170);
      
      ctx.font = '10px var(--ledger)';
      ctx.fillText(`${Number(rec).toFixed(0)} Br`, 65, 145 - recHeight);
      ctx.fillText(`${Number(pay).toFixed(0)} Br`, 155, 145 - payHeight);
    }
    
    // 2. Sales Trend Line Chart (past 7 sales)
    if (activity && canvasRef2.current) {
      const canvas = canvasRef2.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const sales = activity.filter(a => a.kind === 'sale').slice(0, 7).reverse();
      if (sales.length > 1) {
        const amounts = sales.map(s => s.amount);
        const maxVal = Math.max(...amounts, 1);
        const minVal = Math.min(...amounts, 0);
        const rangeVal = maxVal - minVal || 1;
        
        ctx.strokeStyle = '#1e5b45';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        const stepX = 180 / (sales.length - 1);
        
        const points = [];
        sales.forEach((s, idx) => {
          const x = 30 + idx * stepX;
          const y = 150 - ((s.amount - minVal) / rangeVal) * 110;
          points.push({ x, y });
          if (idx === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        
        // Draw dots
        points.forEach((p) => {
          ctx.fillStyle = '#1e5b45';
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        });
        
        // Draw bottom labels
        ctx.fillStyle = '#5c6154';
        ctx.font = '9px var(--ledger)';
        ctx.textAlign = 'center';
        sales.forEach((s, idx) => {
          const x = 30 + idx * stepX;
          const dateStr = new Date(s.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
          ctx.fillText(dateStr, x, 170);
        });
      } else {
        ctx.fillStyle = '#5c6154';
        ctx.font = '12px var(--display)';
        ctx.textAlign = 'center';
        ctx.fillText('Not enough sales to display trend', 120, 80);
      }
    }
  }, [summary, activity]);

  return (
    <div className="two-col" style={{ margin: '20px 0' }}>
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ marginBottom: '15px', fontSize: '1rem', fontWeight: '700' }}>Receivables vs Payables Comparison</h3>
        <canvas ref={canvasRef1} width="220" height="190" style={{ maxWidth: '100%' }} />
      </div>
      <div className="panel" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ marginBottom: '15px', fontSize: '1rem', fontWeight: '700' }}>Recent Sales Volume Trend</h3>
        <canvas ref={canvasRef2} width="240" height="190" style={{ maxWidth: '100%' }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const summary = useQuery({ queryKey: ['summary'], queryFn: () => get('/dashboard/summary') });
  const lowStock = useQuery({ queryKey: ['low-stock'], queryFn: () => get('/dashboard/low-stock') });
  const activity = useQuery({ queryKey: ['activity'], queryFn: () => get('/dashboard/activity') });
  const [range, setRange] = useState({ from: '', to: '' });

  const s = summary.data;

  return (
    <div className="page">
      <header className="page-head">
        <h1>Today's position</h1>
      </header>

      {/* Signature: the ledger equation — receivable − payable = net */}
      <section className="equation" aria-label="Net position">
        <div className="eq-term">
          <small>Clients owe you</small>
          <Money value={s?.totalReceivable ?? 0} className="eq-num in" />
        </div>
        <span className="eq-op" aria-hidden="true">−</span>
        <div className="eq-term">
          <small>You owe suppliers</small>
          <Money value={s?.totalPayable ?? 0} className="eq-num out" />
        </div>
        <span className="eq-op" aria-hidden="true">=</span>
        <div className={`eq-term eq-net ${s && s.netPosition < 0 ? 'neg' : ''}`}>
          <small>Net position</small>
          <Money value={s?.netPosition ?? 0} className="eq-num" />
        </div>
      </section>

      {/* Canvas Charts Section */}
      <DashboardCharts summary={summary.data} activity={activity.data} />

      <div className="two-col">
        <section className="panel">
          <header className="panel-head">
            <h2>Low stock</h2>
            <Link to="/products" className="panel-link">All products</Link>
          </header>
          {lowStock.data?.length ? (
            <table className="table">
              <thead><tr><th>Product</th><th className="num">In stock</th><th className="num">Alert at</th></tr></thead>
              <tbody>
                {lowStock.data.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td className="num mono warn">{Number(p.stock)} {p.unit}</td>
                    <td className="num mono">{Number(p.lowStockAt)} {p.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">{lowStock.isLoading ? 'Checking stock…' : 'Every product is above its alert level.'}</p>
          )}
        </section>

        <section className="panel">
          <header className="panel-head">
            <h2>Recent activity</h2>
          </header>
          {activity.data?.length ? (
            <ul className="feed">
              {activity.data.map((a) => (
                <li key={`${a.kind}-${a.id}`}>
                  <span className={`feed-kind k-${a.kind}`}>{KIND_LABEL[a.kind]}</span>
                  <Link to={`/${KIND_LINK[a.kind]}/${a.partyId}`} className="feed-party">{a.party}</Link>
                  <span className="feed-label">{a.label}</span>
                  <Money value={a.amount} tone={a.kind === 'sale' || a.kind === 'payment_in' ? 'good' : 'bad'} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">{activity.isLoading ? 'Loading activity…' : 'Record a sale, purchase, or payment and it will appear here.'}</p>
          )}
        </section>
      </div>

      <section className="panel">
        <header className="panel-head"><h2>Export transaction log</h2></header>
        <div className="export-row">
          <label>From <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
          <label>To <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
          <a className="btn" href={reportUrl('/reports/transactions', { ...range, format: 'csv' })}>Download CSV</a>
          <a className="btn" href={reportUrl('/reports/transactions', { ...range, format: 'pdf' })}>Download PDF</a>
        </div>
      </section>
    </div>
  );
}
