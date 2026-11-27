import { escapeHtml } from '../utils/dom.js';

const MAP = {
  pending: ['Pending', 'pending'],
  confirmed: ['Verified', 'verified'],
  rejected: ['Dismissed', 'dismissed'],
  inspection: ['Inspection', 'inspection'],
};

export function statusBadge(status) {
  const [label, cls] = MAP[status] || [status || 'Unknown', 'pending'];
  return `<span class="status status-${cls}">${escapeHtml(label)}</span>`;
}