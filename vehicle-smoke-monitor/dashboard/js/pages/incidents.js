import { getIncidents } from "../api/incidents.js";
import { formatDate } from "../utils/format-date.js";

const rows = document.getElementById("incident-rows");
const message = document.getElementById("message");
const form = document.getElementById("filters");
const pageInfo = document.getElementById("page-info");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");

let page = 1;
let totalPages = 1;

function cell(text) {
  const td = document.createElement("td");
  td.textContent = text ?? "—";
  return td;
}

function render(incidents) {
  rows.innerHTML = "";
  if (incidents.length === 0) {
    message.textContent = "No incidents found.";
    return;
  }
  message.textContent = "";

  for (const inc of incidents) {
    const tr = document.createElement("tr");
    tr.addEventListener("click", () => {
      window.location.href = `incident-detail.html?id=${inc._id}`;
    });

    tr.append(
      cell(formatDate(inc.detectedAt)),
      cell(inc.location?.name),
      cell(inc.vehicleType),
      cell(inc.correctedPlate || inc.plateNumber || "Unread"),
      cell(inc.smokeType),
      cell(`${Math.round(inc.smokeConfidence * 100)}%`)
    );

    const statusTd = document.createElement("td");
    const badge = document.createElement("span");
    badge.className = `badge badge-${inc.reviewStatus}`;
    badge.textContent = inc.reviewStatus.replace("_", " ");
    statusTd.append(badge);
    tr.append(statusTd);

    rows.append(tr);
  }
}

async function load() {
  message.textContent = "Loading...";
  try {
    const filters = Object.fromEntries(new FormData(form));
    const result = await getIncidents({ ...filters, page });
    totalPages = result.totalPages || 1;
    pageInfo.textContent = `Page ${result.page} of ${totalPages}`;
    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;
    render(result.data);
  } catch (err) {
    message.textContent = `Could not load incidents: ${err.message}`;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  page = 1;
  load();
});
prevBtn.addEventListener("click", () => { page--; load(); });
nextBtn.addEventListener("click", () => { page++; load(); });

load();