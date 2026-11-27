import { CONFIG } from '../config.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

const ICONS = {
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  tasks: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 14l2 2 4-4"/>',
  records: '<path d="M3 7h18v13H3z"/><path d="M3 7l2-3h14l2 3"/><path d="M9 12h6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.500 9.500a2.500 2.500 0 015 .5c0 1.500-2.500 2-2.500 3.500"/><path d="M12 17h.01"/>',
  logout: '<path d="M9 4H5v16h4"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M3 3l18 18"/><path d="M10.600 6.100A9.800 9.800 0 0112 6c6 0 10 6 10 6a17 17 0 01-3.200 3.900M6.500 7.500C3.900 9.300 2 12 2 12s4 7 10 7c1.500 0 2.900-.4 4.100-1"/>',
  pin: '<path d="M12 21s7-6.200 7-11a7 7 0 10-14 0c0 4.800 7 11 7 11z"/><circle cx="12" cy="10" r="2.500"/>',
};

export const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export const brandHtml = () => `
  <div class="brand">
    <img class="brand-logo" src="${CONFIG.LOGO_SRC}" alt="Nepal Traffic Police logo" />
    <div class="brand-text">
      <strong>SmokAI</strong>
      <span>VEHICLE EMISSION MONITORING</span>
      <span>NEPAL TRAFFIC POLICE</span>
    </div>
  </div>`;