import { CONFIG } from '../config.js';
import { api, ApiError } from './client.js';
import { saveSession, clearSession } from '../utils/auth-guard.js';

/**
 * Tries the real backend first. Adapt the field names below to the backend's actual
 * request/response once /api/auth/login exists.
 */
export async function login(officerName, pin) {
  try {
    const data = await api.post(
      CONFIG.ENDPOINTS.login,
      { officerName, pin },
      { skipAuthRedirect: true }
    );
    const token = data?.token || data?.accessToken || null;
    const user = data?.user || data?.officer;
    if (!user) throw new ApiError('Unexpected login response from server.', 500, data);
    saveSession({ token, user, demo: false });
    return user;
  } catch (err) {
    const backendMissing = err.isNetworkError || err.status === 404;
    if (CONFIG.DEMO_MODE && backendMissing) return demoLogin(officerName, pin);
    throw err;
  }
}

// DEMO ONLY: no credentials are checked or stored. Remove by setting CONFIG.DEMO_MODE = false.
function demoLogin(officerName, pin) {
  if (pin.length < 4) {
    throw new ApiError('Demo mode: use an access PIN of at least 4 characters.', 400);
  }
  const user = { name: officerName, division: 'Bhaktapur Traffic Division', role: 'officer' };
  saveSession({ token: null, user, demo: true });
  return user;
}

export async function logout() {
  try {
    await api.post(CONFIG.ENDPOINTS.logout, undefined, { skipAuthRedirect: true });
  } catch {
    /* backend logout is optional; always clear locally */
  }
  clearSession();
  window.location.replace(CONFIG.LOGIN_URL);
}