import { renderLayout, esc, mediaUrl, code, badge, dateStr, timeStr, plateOf } from "../layout.js";
import { getIncidents } from "../api/incidents.js";
import { CAMERAS } from "../config.js";

renderLayout("recorded", "Recorded incidents");
const $ = (id) => document.getElementById(id);
let page = 1, timer;

$("camera").innerHTML += CAMERAS.map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join("");

function filters() {
  const days = $("range").value;
  return {
    plate: $("search").value.trim(),
    cameraId: $("camera").value,
    status: $("status").value,
    from: days ? new Date(Date.now() - days * 864e5).toISOString() : "",
  };
}

async function load() {
  try {
    const r = await getIncidents({ ...filters(), page, limit: 6 });
    $("rows").innerHTML = r.data.map((i) => `
      <tr>
        <td>${i.media?.vehicleImage ? `<img class="thumb" src="${mediaUrl(i.media.vehicleImage)}" alt="">` : `<div class="thumb"></div>`}</td>
        <td><b>${esc(plateOf(i))}</b><small>${code(i)}</small></td>
        <td>${esc(i.cameraId)}<small>${esc(i.location?.name)}</small></td>
        <td>${dateStr(i.detectedAt)}<small>${timeStr(i.detectedAt)}</small></td>
        <td>${Math.round(i.smokeConfidence * 100)}%</td>
        <td>${badge(i.reviewStatus)}</td>
        <td><a href="tasks.html?id=${i._id}" title="Open incident" style="font-size:1.3rem">↗</a></td>
      </tr>`).join("") || `<tr><td colspan="7" class="muted">No incidents found.</td></tr>`;

    const start = r.total ? (r.page - 1) * r.limit + 1 : 0;
    $("count").textContent = `Showing ${start}–${Math.min(r.page * r.limit, r.total)} of ${r.total} incidents`;
    $("prev").disabled = page <= 1;
    $("next").disabled = page >= r.totalPages;
  } catch (e) {
    $("rows").innerHTML = `<tr><td colspan="7">Could not load: ${esc(e.message)}</td></tr>`;
  }
}

// Export current filters as a CSV file (opens in Excel)
$("export").onclick = async () => {
  const r = await getIncidents({ ...filters(), limit: 100 });
  const rows = [["Incident", "Plate", "Camera", "Location", "Detected at", "Smoke confidence", "Status"],
    ...r.data.map((i) => [code(i), plateOf(i, ""), i.cameraId, i.location?.name,
      `${dateStr(i.detectedAt)} ${timeStr(i.detectedAt)}`, Math.round(i.smokeConfidence * 100) + "%", i.reviewStatus])];
  const csv = rows.map((row) => row.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "smoke-incidents.csv";
  a.click();
};

["range", "camera", "status"].forEach((id) => ($(id).onchange = () => { page = 1; load(); }));
$("search").oninput = () => { clearTimeout(timer); timer = setTimeout(() => { page = 1; load(); }, 400); };
$("prev").onclick = () => { page--; load(); };
$("next").onclick = () => { page++; load(); };
load();