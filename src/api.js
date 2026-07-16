const BASE = '/api/v1';

async function raw(path, opts = {}) {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    method: opts.method || 'GET',
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return res;
}

// Fetch wrapper: on 401 tries one silent refresh, then retries the request once.
export async function api(path, opts = {}) {
  let res = await raw(path, opts);
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    const r = await raw('/auth/refresh', { method: 'POST' });
    if (r.ok) res = await raw(path, opts);
  }
  if (!res.ok) {
    let message = 'Request failed';
    try { message = (await res.json()).error || message; } catch { /* no body */ }
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body });
export const patch = (path, body) => api(path, { method: 'PATCH', body });
export const del = (path) => api(path, { method: 'DELETE' });

// Report downloads open in a new tab (cookies ride along, same origin).
export const reportUrl = (path, params = {}) => {
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v)));
  return `${BASE}${path}${q.toString() ? `?${q}` : ''}`;
};
