import { CONFIG } from '../config.js';
import { brandHtml, icon, escapeHtml } from '../utils/dom.js';
import { logout } from '../api/auth.js';
import { openModal } from './modal.js';

const NAV = [
  { id: 'overview', label: 'Live monitoring', href: '/pages/overview.html', icon: 'video' },
  { id: 'tasks', label: 'Officer tasks', href: '/pages/tasks.html', icon: 'tasks' },
  { id: 'recorded', label: 'Recorded incidents', href: '/pages/recorded-incidents.html', icon: 'records' },
];

const HELP_HTML = `
  <p>SmokAI flags vehicles that emit visible smoke. Every flag needs human verification.</p>
  <ul>
    <li>Visible smoke is an AI indication, not a measured emissions result.</li>
    <li>Check the preserved footage and confirm the plate before any enforcement action.</li>
    <li>Use <strong>Dismiss</strong> for false detections such as steam, dust or fog.</li>
    <li>Use <strong>Needs further inspection</strong> to recommend a formal emission test.</li>
    <li>Reports are restricted to authorized personnel.</li>
  </ul>`;

export function getSelectedLocation() {
  return sessionStorage.getItem(CONFIG.LOCATION_KEY) || CONFIG.LOCATIONS[0];
}

/** Updates the system status box. Call with real numbers once /api/cameras exists. */
export function setSystemStatus(online, total) {
  const text = document.getElementById('camStatusText');
  const dot = document.getElementById('sysDot');
  if (!text || !dot) return;
  text.textContent = `${online} of ${total} cameras online`;
  dot.classList.toggle('is-off', online === 0);
}

export function renderSidebar(el, { active }) {
  const selected = getSelectedLocation();

  el.innerHTML = `
    ${brandHtml()}

    <div>
      <p class="side-label">Location</p>
      <select id="locationSelect" class="side-select" aria-label="Select location">
        ${CONFIG.LOCATIONS.map((l) =>
          `<option value="${escapeHtml(l)}" ${l === selected ? 'selected' : ''}>${escapeHtml(l)}</option>`
        ).join('')}
      </select>
    </div>

    <div>
      <p class="side-label">Workspace</p>
      <nav class="side-nav" aria-label="Workspace">
        ${NAV.map((n) => `
          <a class="nav-link ${n.id === active ? 'is-active' : ''}" href="${n.href}"
             ${n.id === active ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${n.label}</span></a>`
        ).join('')}
      </nav>
    </div>

    <div class="side-status">
      <div class="status-row"><span class="dot" id="sysDot"></span><strong>System operational</strong></div>
      <div class="status-row"><span id="camStatusText">4 of 4 cameras online</span></div>
    </div>

    <div class="side-spacer"></div>

    <div class="side-nav">
      <button class="nav-link" type="button" id="helpBtn">${icon('help')}<span>Help &amp; guidelines</span></button>
      <button class="nav-link" type="button" id="logoutBtn">${icon('logout')}<span>Logout</span></button>
    </div>`;

  // Elements are re-created on every render, so these listeners can never stack up.
  el.querySelector('#locationSelect').addEventListener('change', (e) => {
    sessionStorage.setItem(CONFIG.LOCATION_KEY, e.target.value);
    document.dispatchEvent(new CustomEvent('smokai:location-change', { detail: e.target.value }));
  });
  el.querySelector('#helpBtn').addEventListener('click', () =>
    openModal({ title: 'Help &amp; guidelines', html: HELP_HTML }));
  el.querySelector('#logoutBtn').addEventListener('click', logout);

  // Mobile scrim (create once)
  if (!document.querySelector('.scrim')) {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.addEventListener('click', () => document.body.classList.remove('nav-open'));
    document.body.appendChild(scrim);
  }
}