import { getOfficer, logout, requireLogin } from "./auth.js";
import { API_URL, CAMERAS } from "./config.js";

const S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const NAV = [
  ["live", "Live monitoring", "live.html", S('<rect x="2" y="6" width="14" height="12" rx="2"/><path d="m16 10 6-3v10l-6-3"/>')],
  ["tasks", "Officer tasks", "tasks.html", S('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 13l2 2 4-4"/>')],
  ["recorded", "Recorded incidents", "recorded.html", S('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>')],
];

export function renderLayout(active, pageName) {
  requireLogin();
  document.getElementById("sidebar").innerHTML = `
    <div class="brand">SmokAI<small>Vehicle emission monitoring</small></div>
    <select class="location"><option>Bhaktapur</option><option>Kathmandu</option><option>Lalitpur</option></select>
    <p class="nav-label">Workspace</p>
    <nav>${NAV.map(([k, label, href, icon]) =>
      `<a href="${href}" class="${k === active ? "active" : ""}">${icon}<span>${label}</span></a>`).join("")}</nav>
    <div class="status-box"><b>● System operational</b><span>${CAMERAS.length} cameras configured</span></div>
    <a href="#" id="logout" class="nav-bottom">${S('<path d="M9 21H5V3h4M16 17l5-5-5-5M21 12H9"/>')}<span>Logout</span></a>`;

  document.getElementById("topbar").innerHTML = `
    <p class="crumb">Traffic Police <span>/ ${pageName}</span></p>
    <p class="clock" id="clock"></p>
    <div class="officer"><b id="officer-name"></b><small>Traffic officer</small></div>`;

  document.getElementById("officer-name").textContent = getOfficer();
  document.getElementById("logout").onclick = (e) => { e.preventDefault(); logout(); };
  const tick = () => (document.getElementById("clock").textContent =
    npt(new Date(), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) + " NPT");
  tick();
  setInterval(tick, 30000);
}

// Helpers
export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const npt = (d, opts) => new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kathmandu", ...opts });
export const dateStr = (d) => npt(d, { day: "numeric", month: "short", year: "numeric" });
export const timeStr = (d) => npt(d, { hour: "2-digit", minute: "2-digit", hour12: true });
export const mediaUrl = (p) => (p ? `${API_URL}/media/${p}` : "");
export const code = (i) => "#" + i._id.slice(-6).toUpperCase();
export const plateOf = (i, fallback = "Plate not read") => i.correctedPlate || i.plateNumber || fallback;

const STATUS = { pending: ["Pending", "pending"], needs_inspection: ["Inspection", "inspect"],
                 confirmed: ["Reviewed", "reviewed"], rejected: ["Dismissed", "dismissed"] };
export const badge = (s) => `<span class="badge ${STATUS[s][1]}">${STATUS[s][0]}</span>`;