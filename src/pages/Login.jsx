import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [creds, setCreds] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await login(creds);
      navigate('/');
    } catch (err) {
      console.error('[Login] Error:', err);
      const detail = err.rawResponse ? ` | Raw: ${err.rawResponse}` : '';
      setError(`${err.message} (status: ${err.status ?? 'network'})${detail}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          <span className="brand-mark">እ</span>
          <div>
            <strong>Enat Duket</strong>
            <small>Factory Credit &amp; Inventory Ledger</small>
          </div>
        </div>
        <label>
          Phone or email
          <input
            autoFocus
            value={creds.login}
            onChange={(e) => setCreds({ ...creds, login: e.target.value })}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={creds.password}
            onChange={(e) => setCreds({ ...creds, password: e.target.value })}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn primary block" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
