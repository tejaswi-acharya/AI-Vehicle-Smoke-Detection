import { renderLayout, esc, mediaUrl, code, badge, dateStr, timeStr, plateOf } from "../layout.js";
import { getIncidents, getIncident, reviewIncident } from "../api/incidents.js";

renderLayout("tasks", "Officer tasks");
const $ = (id) => document.getElementById(id);
let all = [], range = "week", selected = null;

const day = (ago) => dateStr(Date.now() - ago * 864e5);
const RANGES = {
  today: ["Today", (i) => dateStr(i.detectedAt) === day(0)],
  yesterday: ["Yesterday", (i) => dateStr(i.detectedAt) === day(1)],
  week: ["Last 7 days", () => true],
};

async function loadQueue() {
  const from = new Date(Date.now() - 7 * 864e5).toISOString();
  const res = await Promise.all(["pending", "needs_inspection"].map((s) => getIncidents({ status: s, from, limit: 100 })));
  all = res.flatMap((r) => r.data).sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
  renderQueue();
}

function renderQueue() {
  $("range-tabs").innerHTML = Object.entries(RANGES).map(([k, [label, fn]]) =>
    `<button class="${k === range ? "active" : ""}" data-k="${k}">${label} (${all.filter(fn).length})</button>`).join("");
  $("range-tabs").querySelectorAll("button").forEach((b) => (b.onclick = () => { range = b.dataset.k; renderQueue(); }));

  const list = all.filter(RANGES[range][1]);
  $("queue").innerHTML = list.map((i) => `
    <tr class="${i._id === selected ? "selected" : ""}">
      <td><b>Smoke detected · ${code(i)}</b><small>${esc(plateOf(i))}</small></td>
      <td>${esc(i.cameraId)}</td>
      <td>${dateStr(i.detectedAt)}<small>${timeStr(i.detectedAt)}</small></td>
      <td>${badge(i.reviewStatus)}</td>
      <td><button class="${i._id === selected ? "" : "ghost"}" data-id="${i._id}">${i._id === selected ? "Opened" : "View →"}</button></td>
    </tr>`).join("") || `<tr><td colspan="5" class="muted">No incidents waiting for review.</td></tr>`;
  $("queue").querySelectorAll("button").forEach((b) => (b.onclick = () => openIncident(b.dataset.id)));
}

async function openIncident(id) {
  selected = id;
  renderQueue();
  const i = await getIncident(id);
  const img = mediaUrl(i.media?.vehicleImage), clip = mediaUrl(i.media?.smokeClip);
  $("detail").innerHTML = `
    <div class="panel-head"><h2>Incident ${code(i)}</h2>${badge(i.reviewStatus)}</div>
    <div class="feed">${clip ? `<video src="${clip}" poster="${img}" controls></video>`
      : img ? `<img src="${img}" alt="Evidence">` : `<div class="empty">No footage</div>`}</div>
    ${img ? `<p style="margin-top:12px"><a href="${img}" target="_blank" style="color:var(--primary)">Review original footage ↗</a></p>` : ""}
    <p class="label mt">Number plate (edit if wrong)</p>
    <input id="plate" value="${esc(plateOf(i, ""))}" style="width:100%;font-size:1.4rem;font-weight:700;margin-top:6px">
    <p class="muted" style="margin-top:8px">${esc(i.cameraId)} · ${esc(i.location?.name)} · ${timeStr(i.detectedAt)}</p>
    <h2 class="mt">Verification checklist</h2>
    ${["Vehicle and smoke are clearly linked", "Number plate matches the footage", "Footage reviewed in full"]
      .map((t) => `<label class="check"><input type="checkbox" class="chk"> ${t}</label>`).join("")}
    <div class="stack mt">
      <button id="complete" disabled>Record outcome &amp; complete →</button>
      <button class="ghost" id="dismiss">Mark as false detection</button>
    </div>`;

  const checks = [...document.querySelectorAll(".chk")];
  checks.forEach((c) => (c.onchange = () => ($("complete").disabled = !checks.every((x) => x.checked))));
  $("complete").onclick = () => finish(id, "confirmed");
  $("dismiss").onclick = () => finish(id, "rejected");
}

async function finish(id, status) {
  await reviewIncident(id, { reviewStatus: status, correctedPlate: $("plate").value.trim() });
  selected = null;
  $("detail").innerHTML = `<p class="muted">Review saved. Select the next incident.</p>`;
  loadQueue();
}

// Opened from Recorded incidents with ?id=...
const startId = new URLSearchParams(location.search).get("id");
loadQueue()
  .then(() => startId && openIncident(startId))
  .catch((e) => ($("queue").innerHTML = `<tr><td colspan="5">Could not load: ${esc(e.message)}</td></tr>`));