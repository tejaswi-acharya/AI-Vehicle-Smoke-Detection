import { escapeHtml, icon } from '../utils/dom.js';
import { formatNPTDateTime } from '../utils/format-date.js';

let clockTimer = null;

export function renderNavbar(el, { title, user }) {
  el.innerHTML = `
    <button class="menu-btn" type="button" id="menuBtn" aria-label="Open menu">${icon('menu')}</button>
    <div class="crumbs"><span>Traffic Police /</span> ${escapeHtml(title)}</div>
    <div class="topbar-spacer"></div>
    <div class="clock" id="clock" aria-label="Current time in Nepal"></div>
    <div class="officer-chip">
      <strong>${escapeHtml(user?.name || 'Officer')}</strong>
      <span>${escapeHtml(user?.division || 'Division not assigned')}</span>
    </div>`;

  el.querySelector('#menuBtn').addEventListener('click', () =>
    document.body.classList.toggle('nav-open'));

  const clock = el.querySelector('#clock');
  const tick = () => { clock.textContent = formatNPTDateTime(); };
  tick();
  clearInterval(clockTimer); // never run two timers
  clockTimer = setInterval(tick, 1000);
}