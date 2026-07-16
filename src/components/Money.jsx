// Every figure in the app is set in ledger mono with tabular digits (design signature).
const fmt = new Intl.NumberFormat('en-ET', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// tone: 'auto' colors by sign (+green / -red); 'good'/'bad' force a color; 'none' stays ink.
export default function Money({ value, tone = 'none', className = '' }) {
  const n = Number(value) || 0;
  const t =
    tone === 'auto' ? (n > 0 ? 'money-in' : n < 0 ? 'money-out' : '')
    : tone === 'good' ? 'money-in'
    : tone === 'bad' ? 'money-out'
    : '';
  return (
    <span className={`money ${t} ${className}`}>
      <span className="money-cur">Br</span> {fmt.format(n === 0 ? 0 : n)}
    </span>
  );
}

// Tone for a party balance: receivable owed to you reads green; payable you owe reads red.
export const balanceTone = (kind, balance) => {
  const b = Number(balance) || 0;
  if (b === 0) return 'none';
  if (kind === 'client') return b > 0 ? 'good' : 'bad';
  return b > 0 ? 'bad' : 'good';
};
