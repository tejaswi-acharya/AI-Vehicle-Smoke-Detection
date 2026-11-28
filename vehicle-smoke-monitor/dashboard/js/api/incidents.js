import { request } from "./client.js";

export function getIncidents(params = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  const qs = new URLSearchParams(clean).toString();
  return request(`/api/incidents${qs ? `?${qs}` : ""}`);
}

export const getIncident = (id) => request(`/api/incidents/${id}`);

export const reviewIncident = (id, body) =>
  request(`/api/incidents/${id}/review`, { method: "PATCH", body: JSON.stringify(body) });