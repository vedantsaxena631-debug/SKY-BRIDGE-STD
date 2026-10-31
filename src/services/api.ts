// Thin fetch wrapper. Attaches the token, surfaces the server's own error
// message rather than a generic one, and flags expired sessions so the app can
// send the user back to the login page.

export function getApiBaseUrl(): string {
  const envUrl = ((import.meta as any).env?.VITE_API_URL || '').trim().replace(/\/+$/, '');
  if (!envUrl) return '/api/v1';
  if (!envUrl.endsWith('/api/v1')) {
    if (envUrl.endsWith('/api')) {
      return `${envUrl}/v1`;
    }
    return `${envUrl}/api/v1`;
  }
  return envUrl;
}

const BASE_URL = getApiBaseUrl();

let token: string | null = null;

interface RequestOptions {
  method?: string;
  body?: any;
  signal?: AbortSignal;
}

async function request(path: string, { method = 'GET', body, signal }: RequestOptions = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const targetUrl = `${BASE_URL}${cleanPath}`;

  let response: Response;
  try {
    response = await fetch(targetUrl, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    // Network-level failure: backend is not running or unreachable
    const err: any = new Error('Cannot reach the SkyBridge server.');
    err.code = 'NETWORK';
    err.isServerUnavailable = true;
    throw err;
  }

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    // If a static host or Live Server returns index.html or 405 for missing /api endpoints
    const text = await response.text().catch(() => '');
    if (response.status === 405 || response.status === 404 || text.trim().startsWith('<')) {
      const err: any = new Error(
        response.status === 405
          ? 'Live Server / static host does not support POST requests (405 Method Not Allowed). Run full-stack backend via npm run dev on port 3000.'
          : response.status === 404
          ? 'SkyBridge backend route not found (404).'
          : 'SkyBridge backend unavailable (received HTML from static host).'
      );
      err.status = response.status;
      err.code = response.status === 405 ? 'METHOD_NOT_ALLOWED' : 'SERVER_UNAVAILABLE';
      err.isServerUnavailable = true;
      throw err;
    }
  }

  if (!response.ok) {
    const is405 = response.status === 405;
    const err: any = new Error(
      is405
        ? 'Live Server / static host does not accept POST requests (405 Method Not Allowed).'
        : (data?.error || `Request failed (${response.status})`)
    );
    err.status = response.status;
    err.code = is405 ? 'METHOD_NOT_ALLOWED' : (data?.code || (response.status >= 500 ? 'SERVER_ERROR' : 'REQUEST_FAILED'));
    err.isServerUnavailable = is405 || response.status >= 502;
    throw err;
  }
  return data;
}

export const api = {
  setToken: (value: string | null) => {
    token = value;
  },
  getToken: () => token,
  get: (path: string, opts?: RequestOptions) => request(path, { ...opts, method: 'GET' }),
  post: (path: string, body?: any, opts?: RequestOptions) => request(path, { ...opts, method: 'POST', body }),
  patch: (path: string, body?: any, opts?: RequestOptions) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path: string, opts?: RequestOptions) => request(path, { ...opts, method: 'DELETE' }),
};

export default api;
