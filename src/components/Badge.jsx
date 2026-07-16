const LABELS = { owed: 'Owed', settled: 'Settled', overpaid: 'Overpaid' };
export default function Badge({ status }) {
  return <span className={`badge badge-${status}`}>{LABELS[status] ?? status}</span>;
}
