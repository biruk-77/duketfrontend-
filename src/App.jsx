import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { get, post } from './api';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Parties from './pages/Parties';
import PartyDetail from './pages/PartyDetail';
import Products from './pages/Products';
import Users from './pages/Users';
import ImportCSV from './pages/ImportCSV';
import Production from './pages/Production';
import Analytics from './pages/Analytics';
import Finances from './pages/Finances';
import TransactionDetail from './pages/TransactionDetail';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading, null = signed out
  useEffect(() => {
    get('/auth/me').then(setUser).catch(() => setUser(null));
  }, []);
  const login = async (creds) => setUser(await post('/auth/login', creds));
  const logout = async () => {
    await post('/auth/logout').catch(() => {});
    queryClient.clear();
    setUser(null);
  };
  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="shell">
      <nav className="sidenav">
        <div className="brand">
          <span className="brand-mark">እ</span>
          <div>
            <strong>Enat Duket</strong>
            <small>Ledger</small>
          </div>
        </div>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/clients">Clients</NavLink>
        <NavLink to="/suppliers">Suppliers</NavLink>
        <NavLink to="/products">Products</NavLink>
        <NavLink to="/production">Production</NavLink>
        <NavLink to="/analytics">Analytics</NavLink>
        <NavLink to="/finances">Finances</NavLink>
        <NavLink to="/import">CSV Import</NavLink>
        {user.role === 'OWNER' && <NavLink to="/users">Staff</NavLink>}
        <div className="sidenav-foot">
          <span className="who">{user.name} · {user.role === 'OWNER' ? 'Owner' : 'Staff'}</span>
          <button className="btn ghost" onClick={() => logout().then(() => navigate('/login'))}>Sign out</button>
        </div>
      </nav>
      <main className="content">{children}</main>
    </div>
  );
}

function Protected({ children, ownerOnly = false }) {
  const { user } = useAuth();
  if (user === undefined) return <div className="page-loading">Opening the ledger…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (ownerOnly && user.role !== 'OWNER') return <Navigate to="/" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><Dashboard /></Protected>} />
            <Route path="/clients" element={<Protected><Parties kind="client" /></Protected>} />
            <Route path="/clients/:id" element={<Protected><PartyDetail kind="client" /></Protected>} />
            <Route path="/suppliers" element={<Protected><Parties kind="supplier" /></Protected>} />
            <Route path="/suppliers/:id" element={<Protected><PartyDetail kind="supplier" /></Protected>} />
            <Route path="/entries/:id" element={<Protected><TransactionDetail /></Protected>} />
            <Route path="/products" element={<Protected><Products /></Protected>} />
            <Route path="/production" element={<Protected><Production /></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
            <Route path="/finances" element={<Protected><Finances /></Protected>} />
            <Route path="/import" element={<Protected><ImportCSV /></Protected>} />
            <Route path="/users" element={<Protected ownerOnly><Users /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
