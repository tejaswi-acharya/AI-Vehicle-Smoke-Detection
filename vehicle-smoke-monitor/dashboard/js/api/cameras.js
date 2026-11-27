import { CONFIG } from '../config.js';
import { api } from './client.js';
import { DEMO_CAMERAS } from '../utils/demo-data.js';

const normalize = (c) => ({
  id: c.cameraId || c.id || c._id,
  location: c.location?.name || c.location || '',
  status: c.status || 'offline',
  streamUrl: c.streamUrl || '',
  demo: false,
});

/** Returns { cameras, demo }. Falls back to labelled demo cameras only if the route is missing. */
export async function listCameras() {
  try {
    const data = await api.get(CONFIG.ENDPOINTS.cameras);
    const rows = Array.isArray(data) ? data : data?.items || [];
    return { cameras: rows.map(normalize), demo: false };
  } catch (err) {
    if (CONFIG.DEMO_MODE && (err.isNetworkError || err.status === 404)) {
      return { cameras: DEMO_CAMERAS, demo: true };
    }
    throw err;
  }
}