import { CONFIG } from '../config.js';
import { getToken, clearSession } from '../utils/auth-guard.js';

export class ApiError extends Error {
  constructor(message, status = 0, data = null, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

async function request(path, { method = 'GET', body, headers = {}, skipAuthRedirect = false } = {}) {
  const finalHeaders = { Accept: 'application/json', ...headers };
  const token = getToken();
  if (token) finalHeaders.Authorization = `Bearer ${token}`;

  let payload;
  if (body instanceof FormData) {
    payload = body; // browser sets the multipart boundary itself
  } else if (body !== undefined) {
    finalHeaders['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${CONFIG.API_BASE_URL}${path}`, { method, headers: finalHeaders, body: payload });
  } catch {
    throw new ApiError('Cannot reach the server.', 0, null, true);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && !skipAuthRedirect) {
      clearSession();
      window.location.replace(CONFIG.LOGIN_URL);
    }
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  upload: (path, formData, opts) => request(path, { ...opts, method: 'POST', body: formData }),
};