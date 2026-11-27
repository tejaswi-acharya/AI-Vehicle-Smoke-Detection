import { renderLayout, esc, mediaUrl, code, badge, dateStr, timeStr, plateOf } from "../layout.js";
import { getIncidents, reviewIncident } from "../api/incidents.js";
import { CAMERAS } from "../config.js";

renderLayout("live", "Live monitoring");
const $ = (id) => document.getElementById(id);
let cam = CAMERAS[0];
let lastSrc = null;
$("online").textContent = `● ${CAMERAS.length} cameras`;

function tabs() {
  $("cam-tabs").innerHTML = CAMERAS.map((c) =>
    `<button class="${c.id === cam.id ? "active" : ""}" data-id="${esc(c.id)}">${esc(c.label)}</button>`).join("");
  $("cam-tabs").querySelectorAll("button").forEach((b) => (b.onclick = () => {
    cam = CAMERAS.find((c) => c.id === b.dataset.id);
    tabs();
    load();
  }));
}

async function load() {
  try {
    const { data } = await getIncidents({ cameraId: cam.id, limit: 5 });
    const latest = data[0];
    $("feed-label").textContent = `${cam.label} / ${latest ? `${dateStr(latest.detectedAt)} ${timeStr(latest.detectedAt)}` : "no detections yet"}`;

    // Live stream if configured, otherwise the latest evidence image
    const src = cam.stream || mediaUrl(latest?.media?.vehicleImage);
    if (src !== lastSrc) {
      $("feed-media").innerHTML = src ? `<img src="${esc(src)}" alt="Camera feed">` : `<div class="empty">No footage yet</div>`;
      lastSrc = src;
    }

    $("timeline").innerHTML = data.map((i) => `
      <div class="row"><small>${timeStr(i.detectedAt)}</small><b>Smoke detected</b>
      <span>${esc(plateOf(i))}</span><small>${Math.round(i.smokeConfidence * 100)}% confidence</small></div>`).join("")
      || `<p class="muted">No detections from this camera.</p>`;

    evidence(latest);
  } catch (e) {
    $("timeline").innerHTML = `<p class="muted">Could not load: ${esc(e.message)}</p>`;
  }
}

function evidence(i) {
  if (!i) { $("evidence").innerHTML = `<h2>Vehicle evidence</h2><p class="muted">No detections yet.</p>`; return; }
  const pc = i.plateConfidence ? Math.round(i.plateConfidence * 100) : 0;
  $("evidence").innerHTML = `
    ${i.reviewStatus === "pending" ? `<span class="badge pending">NEW DETECTION</span>` : badge(i.reviewStatus)}
    <h2 class="mt">Vehicle evidence</h2><p class="muted">Incident ${code(i)}</p>
    <div class="plate-box"><span class="label">AI-suggested number plate</span><strong>${esc(plateOf(i))}</strong></div>
    <p>Plate recognition <b style="float:right">${pc}%</b></p><div class="bar"><div style="width:${pc}%"></div></div>
    <div class="info">
      <p><small>Location</small>${esc(i.location?.name)}</p>
      <p><small>Camera</small>${esc(i.cameraId)}</p>
      <p><small>Detected at</small>${dateStr(i.detectedAt)}, ${timeStr(i.detectedAt)}</p>
      <p><small>Evidence clip</small>${i.media?.smokeClip ? "Preserved" : "Not available"}</p>
    </div>
    <div class="warn"><b>Officer verification required</b><br>Visible smoke is an AI flag, not a measured
      emissions result. Verify footage and plate before taking enforcement action.</div>
    <div class="stack">
      <button id="assign">Assign for officer review →</button>
      <button class="ghost" id="false">Mark as false detection</button>
    </div>`;
  $("assign").onclick = () => review(i._id, "needs_inspection");
  $("false").onclick = () => review(i._id, "rejected");
}

async function review(id, status) {
  await reviewIncident(id, { reviewStatus: status });
  load();
}

tabs();
load();
setInterval(load, 10000); // check for new detections every 10 seconds