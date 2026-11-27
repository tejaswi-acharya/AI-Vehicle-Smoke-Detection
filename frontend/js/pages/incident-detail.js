import { getIncident, reviewIncident } from "../api/incidents.js";
import { formatDate } from "../utils/format-date.js";
import { API_URL } from "../config.js";

const id = new URLSearchParams(window.location.search).get("id");
const message = document.getElementById("message");
const content = document.getElementById("content");
const info = document.getElementById("info");
const evidence = document.getElementById("evidence");
const plateInput = document.getElementById("plate");
const notesInput = document.getElementById("notes");
const reviewMessage = document.getElementById("review-message");

function addInfo(label, value) {
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value ?? "—";
  info.append(dt, dd);
}

function addMedia(label, path, type = "img") {
  const wrap = document.createElement("figure");
  const caption = document.createElement("figcaption");
  caption.textContent = label;

  if (path) {
    const el = document.createElement(type);
    el.src = `${API_URL}/media/${path}`;
    if (type === "video") el.controls = true;
    else el.alt = label;
    wrap.append(el);
  } else {
    const empty = document.createElement("div");
    empty.className = "no-media";
    empty.textContent = "Not available";
    wrap.append(empty);
  }
  wrap.append(caption);
  evidence.append(wrap);
}

function render(inc) {
  info.innerHTML = "";
  evidence.innerHTML = "";

  addInfo("Detected at", formatDate(inc.detectedAt));
  addInfo("Location", inc.location?.name);
  addInfo("Camera", inc.cameraId);
  addInfo("Vehicle type", inc.vehicleType);
  addInfo("Smoke type", inc.smokeType);
  addInfo("Smoke confidence", `${Math.round(inc.smokeConfidence * 100)}%`);
  addInfo("Plate (OCR)", inc.plateNumber || "Unread");
  addInfo("Plate confidence", inc.plateConfidence != null ? `${Math.round(inc.plateConfidence * 100)}%` : null);
  addInfo("Status", inc.reviewStatus.replace("_", " "));
  addInfo("Reviewed at", inc.reviewedAt ? formatDate(inc.reviewedAt) : null);

  addMedia("Vehicle", inc.media?.vehicleImage);
  addMedia("Number plate", inc.media?.plateImage);
  addMedia("Smoke clip", inc.media?.smokeClip, "video");

  plateInput.value = inc.correctedPlate || inc.plateNumber || "";
  notesInput.value = inc.reviewNotes || "";
}

async function load() {
  if (!id) {
    message.textContent = "No incident selected.";
    return;
  }
  message.textContent = "Loading...";
  try {
    const inc = await getIncident(id);
    message.textContent = "";
    content.hidden = false;
    render(inc);
  } catch (err) {
    message.textContent = `Could not load incident: ${err.message}`;
  }
}

document.querySelectorAll(".actions button").forEach((btn) => {
  btn.addEventListener("click", async () => {
    reviewMessage.textContent = "Saving...";
    try {
      const updated = await reviewIncident(id, {
        reviewStatus: btn.dataset.status,
        reviewNotes: notesInput.value.trim(),
        correctedPlate: plateInput.value.trim(),
      });
      render(updated);
      reviewMessage.textContent = "Review saved.";
    } catch (err) {
      reviewMessage.textContent = `Could not save: ${err.message}`;
    }
  });
});

load();