import { CONFIG } from '../config.js';
import { api } from './client.js';

/** Maps the backend's record to the shape the UI uses. Adjust here if the schema changes. */
export function normalizeIncident(r) {
  const id = r._id || r.id;
  return {
    id,
    displayId: r.incidentId || (id ? `DW-${String(id).slice(-6).toUpperCase()}` : 'Not available'),
    cameraId: r.cameraId || null,
    location: r.location || {},
    vehicleType: r.vehicleType || null,
    detectedAt: r.detectedAt || r.createdAt || null,
    smokeType: r.smokeType || null,
    smokeConfidence: r.smokeConfidence ?? null,
    plateNumber: r.plateNumber || r.vehiclePlate || null,
    plateConfidence: r.plateConfidence ?? null,
    trackId: r.trackId ?? null,
    reviewStatus: r.reviewStatus || 'pending',
    media: {
      vehicleImage: r.media?.vehicleImage || r.evidence?.imagePath || '',
      plateImage: r.media?.plateImage || r.evidence?.plateImagePath || '',
      smokeClip: r.media?.smokeClip || r.evidence?.videoClipPath || '',
    },
    demo: false,
  };
}

export async function listIncidents(params = {}) {
  const clean = Object.entries(params).filter(([, v]) => v !== '' && v != null);
  const query = new URLSearchParams(clean).toString();
  const data = await api.get(`${CONFIG.ENDPOINTS.incidents}${query ? `?${query}` : ''}`);
  const rows = Array.isArray(data) ? data : data?.items || [];
  return { items: rows.map(normalizeIncident), total: data?.total ?? rows.length };
}

export const reviewIncident = (id, body) =>
  api.patch(`${CONFIG.ENDPOINTS.incidents}/${id}/review`, body);