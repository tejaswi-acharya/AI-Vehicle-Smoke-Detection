import { requireAuth, isDemoSession } from '../utils/auth-guard.js';
import { renderSidebar, setSystemStatus, getSelectedLocation } from '../components/sidebar.js';
import { renderNavbar } from '../components/navbar.js';
import { renderEvidence } from '../components/evidence-viewer.js';
import { statusBadge } from '../components/status-badge.js';
import { initUploadTester } from '../components/upload-tester.js';
import { listCameras } from '../api/cameras.js';
import { listIncidents, reviewIncident } from '../api/incidents.js';
import { DEMO_INCIDENTS } from '../utils/demo-data.js';
import { $, escapeHtml, icon } from '../utils/dom.js';
import { formatNPTDateTime, formatNPTTime } from '../utils/format-date.js';

const user = requireAuth();

const state = { cameras: [], activeCam: null, incidents: [], selectedId: null, useDemo: false };
let clockTimer = null;
let hls = null;

if (user) init();

async function init() {
  renderSidebar($('#sidebar'), { active: 'overview' });
  renderNavbar($('#navbar'), { title: 'Live monitoring', user });
  $('#demoBadge').hidden = !isDemoSession();
  initUploadTester($('#tester'), { user });

  // Delegated listeners on static elements: attached once.
  $('#camTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cam]');
    if (!btn) return;
    state.activeCam = btn.dataset.cam;
    renderTabs();
    renderPlayer();
  });
  $('#timeline').addEventListener('click', (e) => {
    if (e.target.closest('[data-retry]')) return loadTimeline();
    const row = e.target.closest('[data-id]');
    if (!row) return;
    state.selectedId = row.dataset.id;
    renderTimeline();
    renderEvidencePanel();
  });
  $('#demoToggle').addEventListener('click', () => { state.useDemo = !state.useDemo; loadTimeline(); });
  document.addEventListener('smokai:location-change', onLocationChange);

  await loadCameras();
  await loadTimeline();
}

/* ---------- Cameras ---------- */

async function loadCameras() {
  try {
    const { cameras } = await listCameras();
    state.cameras = cameras;
  } catch (err) {
    $('#player').innerHTML = `<div class="state-box">Could not load cameras. ${escapeHtml(err.message)}</div>`;
    return;
  }
  if (!state.cameras.length) {
    $('#player').innerHTML = '<div class="state-box">No cameras are registered yet.</div>';
    setSystemStatus(0, 0);
    return;
  }
  setSystemStatus(state.cameras.filter((c) => c.status === 'online').length, state.cameras.length);
  const loc = getSelectedLocation();
  state.activeCam = (state.cameras.find((c) => c.location === loc) || state.cameras[0]).id;
  renderTabs();
  renderPlayer();
}

function renderTabs() {
  $('#camTabs').innerHTML = state.cameras.map((c) => `
    <button type="button" class="tab ${c.id === state.activeCam ? 'is-active' : ''}" data-cam="${escapeHtml(c.id)}"
      aria-pressed="${c.id === state.activeCam}">
      <span class="dot ${c.status === 'online' ? '' : 'is-off'}"></span>${escapeHtml(c.id)} - ${escapeHtml(c.location)}
    </button>`).join('');
}

function screenMessage(el, title, text) {
  el.innerHTML = `<div class="screen-msg">${icon('video')}<strong>${title}</strong><p>${text}</p></div>`;
}

const destroyHls = () => { if (hls) { hls.destroy(); hls = null; } };

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.Hls) return resolve();
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Supports MP4/WebM and HLS (.m3u8). RTSP and raw IP Webcam streams must be converted by the backend. */
async function attachStream(video, url, screen) {
  const fail = () => screenMessage(screen, 'Stream unavailable', 'The video source could not be played. Check the stream URL.');
  video.addEventListener('error', fail);
  try {
    if (/\.m3u8($|\?)/i.test(url) && !video.canPlayType('application/vnd.apple.mpegurl')) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.8/hls.min.js');
      if (window.Hls?.isSupported()) {
        hls = new window.Hls();
        hls.on(window.Hls.Events.ERROR, (_, data) => { if (data.fatal) fail(); });
        hls.loadSource(url);
        hls.attachMedia(video);
        return;
      }
    }
    video.src = url;
  } catch {
    fail();
  }
}

function renderPlayer() {
  destroyHls();
  clearInterval(clockTimer);
  const el = $('#player');
  const cam = state.cameras.find((c) => c.id === state.activeCam);
  if (!cam) return;

  const online = cam.status === 'online';
  const hasStream = online && cam.streamUrl;

  el.innerHTML = `
    <div class="player-meta">
      <div><strong>${escapeHtml(cam.id)}</strong> <span class="muted">- ${escapeHtml(cam.location)}</span></div>
      <div class="player-status">
        <span class="dot ${online ? '' : 'is-off'}"></span>${online ? 'Online' : 'Offline'}
        ${hasStream ? '<span class="live">LIVE</span>' : ''}
      </div>
    </div>
    <div class="player-screen" id="screen"></div>
    <div class="player-foot">
      <span class="muted" id="camTime"></span>
      ${cam.demo ? '<span class="badge badge-demo">Demo preview</span>' : ''}
    </div>`;

  const screen = $('#screen');
  if (hasStream) {
    const video = document.createElement('video');
    Object.assign(video, { muted: true, autoplay: true, playsInline: true, controls: true });
    screen.appendChild(video);
    attachStream(video, cam.streamUrl, screen);
  } else if (online) {
    screenMessage(screen, 'No stream connected',
      'Demo preview. Connect an HLS, WebRTC or backend-converted stream URL to show live video here.');
  } else {
    screenMessage(screen, 'Camera offline', 'This camera is not sending video.');
  }

  const tick = () => { const t = $('#camTime'); if (t) t.textContent = formatNPTDateTime(); };
  tick();
  clockTimer = setInterval(tick, 1000);
}

function onLocationChange() {
  const cam = state.cameras.find((c) => c.location === getSelectedLocation());
  if (cam) state.activeCam = cam.id;
  renderTabs();
  renderPlayer();
  loadTimeline();
}

/* ---------- Detection timeline ---------- */

async function loadTimeline() {
  const box = $('#timeline');
  $('#demoToggle').textContent = state.useDemo ? 'Use live data' : 'Show demo data';
  box.innerHTML = '<div class="state-box">Loading detections...</div>';

  try {
    if (state.useDemo) {
      state.incidents = DEMO_INCIDENTS.map((i) => ({ ...i }));
    } else {
      state.incidents = (await listIncidents({ limit: 8, location: getSelectedLocation() })).items;
    }
  } catch (err) {
    state.incidents = [];
    state.selectedId = null;
    box.innerHTML = `<div class="state-box">Could not load detections. ${escapeHtml(err.message)}
      <div style="margin-top:10px"><button type="button" class="btn btn-ghost" data-retry>Try again</button></div></div>`;
    renderEvidencePanel();
    return;
  }

  state.selectedId = state.incidents[0]?.id ?? null;
  renderTimeline();
  renderEvidencePanel();
}

function renderTimeline() {
  const box = $('#timeline');
  if (!state.incidents.length) {
    box.innerHTML = `<div class="state-box">No detections for ${escapeHtml(getSelectedLocation())} yet.
      New incidents appear here when the AI service reports them.</div>`;
    return;
  }
  box.innerHTML = `
    ${state.useDemo ? '<p class="alert alert-info"><span class="badge badge-demo">Demo data</span> Sample records, not real detections.</p>' : ''}
    <div class="tl-list">${state.incidents.map((i) => `
      <button type="button" class="tl-row ${i.id === state.selectedId ? 'is-selected' : ''}" data-id="${escapeHtml(i.id)}">
        <span class="tl-time">${i.detectedAt ? formatNPTTime(i.detectedAt) : 'Unknown'}</span>
        <span class="tl-main">
          <strong>Visible smoke${i.smokeType ? ` (${escapeHtml(i.smokeType)})` : ''}</strong>
          <span class="tl-meta">${i.plateNumber ? escapeHtml(i.plateNumber) : 'Plate unread'}
            · Track ${i.trackId ?? 'n/a'} · ${escapeHtml(i.cameraId || 'Unknown camera')}</span>
        </span>
        <span class="tl-side">${i.smokeConfidence != null ? `${Math.round(i.smokeConfidence * 100)}%` : 'n/a'}${statusBadge(i.reviewStatus)}</span>
      </button>`).join('')}</div>`;
}

/* ---------- Evidence panel ---------- */

async function handleAction(inc, kind) {
  const status = kind === 'assign' ? 'pending' : 'rejected';
  const note = kind === 'assign' ? 'Assigned for officer review' : 'Marked as false detection from live monitoring';

  if (inc.demo) {
    inc.reviewStatus = status;
    renderTimeline();
    return 'Demo record updated on screen only. Nothing was saved.';
  }
  const updated = await reviewIncident(inc.id, { reviewStatus: status, reviewedBy: user.name, reviewNotes: note });
  inc.reviewStatus = updated.reviewStatus;
  renderTimeline();
  return kind === 'assign' ? 'Assigned for officer review.' : 'Marked as false detection.';
}

function renderEvidencePanel() {
  const inc = state.incidents.find((i) => i.id === state.selectedId) || null;
  renderEvidence($('#evidence'), inc, {
    onAssign: (i) => handleAction(i, 'assign'),
    onDismiss: (i) => handleAction(i, 'dismiss'),
  });
}