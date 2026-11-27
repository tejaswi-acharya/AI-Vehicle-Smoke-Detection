import { CONFIG } from '../config.js';

export function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(CONFIG.SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  sessionStorage.setItem(CONFIG.SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(CONFIG.SESSION_KEY);
}

export const getToken = () => getSession()?.token || null;
export const getUser = () => getSession()?.user || null;
export const isDemoSession = () => Boolean(getSession()?.demo);
export const isAuthenticated = () => Boolean(getSession()?.user);

/** Call at the top of every protected page. Returns the user, or redirects to login. */
export function requireAuth() {
  if (!isAuthenticated()) {
    window.location.replace(CONFIG.LOGIN_URL);
    return null;
  }
  return getUser();
}