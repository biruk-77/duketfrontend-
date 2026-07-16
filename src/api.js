const BASE = (import.meta.env.VITE_API_BASE || '') + '/api/v1';

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
  const url = BASE + path;
  console.log(`[API] ${opts.method || 'GET'} ${url}`, opts.body ? opts.body : '');

  let res = await raw(path, opts);
  console.log(`[API] Response status: ${res.status} ${res.statusText} — url: ${url}`);

  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/refresh') {
    console.log('[API] 401 received, attempting silent token refresh…');
    const r = await raw('/auth/refresh', { method: 'POST' });
    console.log(`[API] Refresh response: ${r.status} ${r.statusText}`);
    if (r.ok) res = await raw(path, opts);
  }

  if (!res.ok) {
    let rawText = '';
    let message = 'Request failed';
    try {
      rawText = await res.text();
      console.error(`[API] Error raw response body: ${rawText}`);
      const parsed = JSON.parse(rawText);
      message = parsed.error || parsed.message || message;
    } catch {
      console.error('[API] Could not parse error response body:', rawText);
    }
    const err = new Error(message);
    err.status = res.status;
    err.rawResponse = rawText;
    throw err;
  }

  if (res.status === 204) return null;
  const data = await res.json();
  console.log(`[API] Success response:`, data);
  return data;
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
