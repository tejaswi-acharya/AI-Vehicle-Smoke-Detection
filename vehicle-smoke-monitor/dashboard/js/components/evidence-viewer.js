import { escapeHtml } from '../utils/dom.js';
import { formatNPTDate, formatNPTTime } from '../utils/format-date.js';
import { statusBadge } from './status-badge.js';

const NA = '<span class="muted">Not available</span>';
const val = (v) => (v == null || v === '' ? NA : escapeHtml(v));
const pct = (n) => (n == null ? NA : `${Math.round(n * 100)}%`);

function mediaHtml(m) {
  if (m.smokeClip) return `<video src="${escapeHtml(m.smokeClip)}" controls></video>`;
  if (m.vehicleImage) return `<img src="${escapeHtml(m.vehicleImage)}" alt="Vehicle evidence" />`;
  return 'No evidence media stored for this incident.';
}

/** handlers: { onAssign(incident), onDismiss(incident) }, each returns a promise resolving to a message. */
export function renderEvidence(el, inc, handlers) {
  if (!inc) {
    el.innerHTML = `<h2>Vehicle evidence</h2>
      <p class="state-box">Select a detection from the timeline to see its evidence.</p>`;
    return;
  }

  const draw = (message = '', isError = false) => {
    el.innerHTML = `
      <div class="section-head">
        <h2>Vehicle evidence</h2>
        <div>${inc.demo ? '<span class="badge badge-demo">Demo data</span> ' : ''}${statusBadge(inc.reviewStatus)}</div>
      </div>
      <div class="ev-media">${mediaHtml(inc.media)}</div>
      <dl class="kv">
        <dt>Incident ID</dt><dd>${val(inc.displayId)}</dd>
        <dt>Vehicle number (OCR)</dt><dd>${val(inc.plateNumber)}</dd>
        <dt>Plate confidence</dt><dd>${pct(inc.plateConfidence)}</dd>
        <dt>Vehicle type</dt><dd>${val(inc.vehicleType)}</dd>
        <dt>Camera ID</dt><dd>${val(inc.cameraId)}</dd>
        <dt>Location</dt><dd>${val(inc.location?.name)}</dd>
        <dt>Detected at</dt><dd>${inc.detectedAt ? `${formatNPTDate(inc.detectedAt)}, ${formatNPTTime(inc.detectedAt)} NPT` : NA}</dd>
        <dt>Smoke type</dt><dd>${val(inc.smokeType)}</dd>
        <dt>Smoke confidence</dt><dd>${pct(inc.smokeConfidence)}</dd>
      </dl>
      <div class="ev-actions">
        <button type="button" class="btn btn-primary" data-act="assign">Assign for officer review</button>
        <button type="button" class="btn btn-danger-ghost" data-act="dismiss">Mark as false detection</button>
      </div>
      <p id="evMsg" class="alert ${isError ? 'alert-error' : 'alert-success'}" role="status" style="margin-top:12px" ${message ? '' : 'hidden'}>${escapeHtml(message)}</p>
      <p class="warn">Visible smoke is an AI flag, not a measured emissions result. Verify footage and plate before taking enforcement action.</p>`;

    el.querySelector('[data-act="assign"]').addEventListener('click', () => run(handlers.onAssign));
    el.querySelector('[data-act="dismiss"]').addEventListener('click', () => run(handlers.onDismiss));
  };

  const run = async (handler) => {
    el.querySelectorAll('[data-act]').forEach((b) => (b.disabled = true));
    try {
      draw(await handler(inc));
    } catch (err) {
      draw(err.message || 'Action failed. Try again.', true);
    }
  };

  draw();
}