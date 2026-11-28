"use strict";

const $ = (id) => document.getElementById(id);
const API_URL = window.location.origin;
const PAGE_SIZE = 10;

const state = {
  view: "live",
  range: "week",
  selectedId: null,
  cameraId: "",
  location: "",
  incidentPage: 1,
  recent: [],
  tasks: [],
  camera: {
    configured: false,
    cameraId: "",
    location: "",
    snapshot: false,
    online: false,
    error: false,
    feedActive: false
  },
  incidents: { data: [], page: 1, total: 0, totalPages: 1 }
};

let snapshotRefreshTimer = null;
let cameraReconnectTimer = null;

const VIEW_TITLES = {
  live: "Monitoring",
  tasks: "Review queue",
  incidents: "Recorded incidents"
};
const RANGE_LABELS = {
  today: "Today",
  yesterday: "Yesterday",
  week: "Last 7 days"
};
const STATUS_DETAILS = {
  pending: { label: "Pending", className: "Pending" },
  confirmed: { label: "Confirmed", className: "Confirmed" },
  rejected: { label: "Rejected", className: "Rejected" },
  needs_inspection: { label: "Needs inspection", className: "Needs_inspection" }
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function statusDetails(status) {
  return STATUS_DETAILS[status] || { label: "Unknown", className: "Dismissed" };
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function timeOf(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kathmandu",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
}

function relativeDay(value) {
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Infinity : Math.floor((Date.now() - timestamp) / 86400000);
}

function evidenceUrl(incident, preferred = "snapshotImage") {
  const filename = incident?.media?.[preferred]
    || incident?.media?.snapshotImage
    || incident?.media?.vehicleImage;
  return filename ? `${API_URL}/media/${encodeURIComponent(filename)}` : "";
}

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Request failed (${response.status})`);
  }
  return data;
}

function queryString(values) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== "" && value != null) params.set(key, value);
  });
  return params.toString();
}

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.hidden = false;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { element.hidden = true; }, 3200);
}

function setView(view) {
  if (!Object.prototype.hasOwnProperty.call(VIEW_TITLES, view)) return;
  state.view = view;
  document.querySelectorAll(".view").forEach((section) => {
    section.hidden = section.id !== `view-${view}`;
  });
  document.querySelectorAll(".nav[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  $("crumb").textContent = VIEW_TITLES[view];
}

function setOptions(select, values, allLabel, selectedValue) {
  const options = [new Option(allLabel, "")];
  values.forEach((value) => options.push(new Option(value, value)));
  select.replaceChildren(...options);
  select.value = values.includes(selectedValue) ? selectedValue : "";
}

function populateFilters() {
  const locations = [...new Set([
    ...state.recent.map((item) => item.location?.name),
    state.camera.configured ? state.camera.location : ""
  ].filter(Boolean))].sort();
  const cameras = [...new Set([
    ...state.recent.map((item) => item.cameraId),
    state.camera.configured ? state.camera.cameraId : ""
  ].filter(Boolean))].sort();
  if (state.location && !locations.includes(state.location)) state.location = "";
  if (state.cameraId && !cameras.includes(state.cameraId)) state.cameraId = "";
  setOptions($("loc"), locations, "All locations", state.location);
  setOptions($("oLoc"), locations, "All locations", state.location);
  setOptions($("fCam"), cameras, "All cameras", $("fCam").value);
}

function filteredRecent() {
  return state.recent.filter((incident) =>
    (!state.location || incident.location?.name === state.location)
    && (!state.cameraId || incident.cameraId === state.cameraId)
  );
}

function cameraFeedUrl() {
  return `${API_URL}/api/camera/live?refresh=${Date.now()}`;
}

function startCameraFeed() {
  if (!state.camera.configured || state.camera.feedActive) return;
  state.camera.feedActive = true;
  state.camera.online = false;
  state.camera.error = false;
  $("cameraFeedStatus").textContent = "Connecting to camera";
  $("liveCameraImage").src = cameraFeedUrl();
}

function stopCameraFeed() {
  window.clearTimeout(snapshotRefreshTimer);
  window.clearTimeout(cameraReconnectTimer);
  snapshotRefreshTimer = null;
  cameraReconnectTimer = null;
  if (state.camera.feedActive) {
    $("liveCameraImage").removeAttribute("src");
    state.camera.feedActive = false;
    state.camera.online = false;
  }
}

function renderCameraFeedStatus() {
  $("cameraFeedStatus").textContent = state.camera.online
    ? (state.camera.snapshot ? "Camera snapshot connected" : "Live camera connected")
    : state.camera.error
      ? "Camera unavailable · retrying"
      : state.camera.configured
        ? "Connecting to camera"
        : "No live camera configured";
}

function renderCameras() {
  const cameraMap = new Map(
    filteredRecent()
      .filter((incident) => incident.cameraId)
      .map((incident) => [incident.cameraId, incident.location?.name || "Location not set"])
  );
  if (
    state.camera.configured
    && (!state.cameraId || state.cameraId === state.camera.cameraId)
    && (!state.location || state.location === state.camera.location)
  ) {
    cameraMap.set(state.camera.cameraId, state.camera.location || "Live stream");
  }
  const cameras = [...cameraMap];
  const tabs = $("camTabs");
  tabs.replaceChildren();

  if (!cameras.length) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "Set CAMERA_SOURCE in the project-root .env to connect an IP Webcam.";
    tabs.append(empty);
    $("camTag").textContent = "No camera activity";
    return;
  }

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = state.cameraId ? "" : "on";
  allButton.dataset.camera = "";
  allButton.textContent = "All cameras";
  tabs.append(allButton);
  cameras.forEach(([cameraId]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.cameraId === cameraId ? "on" : "";
    button.dataset.camera = cameraId;
    button.textContent = cameraId;
    tabs.append(button);
  });
  $("camTag").textContent = state.cameraId || `${cameras.length} camera${cameras.length === 1 ? "" : "s"}`;
}

function renderTimeline(incidents) {
  const timeline = $("timeline");
  if (!incidents.length) {
    timeline.innerHTML = '<p class="muted">No activity for the selected camera or location.</p>';
    return;
  }
  timeline.innerHTML = incidents.slice(0, 5).map((incident) => {
    const status = statusDetails(incident.reviewStatus);
    return `<div class="tl-row">
      <i class="dot ${incident.reviewStatus === "pending" ? "amber" : "blue"}"></i>
      <span>${escapeHTML(timeOf(incident.detectedAt))}</span>
      <b>${escapeHTML(incident.plateNumber || "Plate unread")}</b>
      <span>${escapeHTML(incident.cameraId)} · ${escapeHTML(incident.location?.name || "Location not set")}</span>
      <small>${escapeHTML(status.label)}</small>
    </div>`;
  }).join("");
}

function renderLive() {
  const incidents = filteredRecent();
  const latest = incidents[0];
  renderCameras();
  renderTimeline(incidents);
  const image = $("stageImage");
  const liveImage = $("liveCameraImage");
  const message = $("stageMessage");
  const assign = $("assign");
  const reject = $("falseDet");
  const liveSelected = state.camera.configured
    && (!state.cameraId || state.cameraId === state.camera.cameraId);

  if (liveSelected) {
    image.hidden = true;
    liveImage.hidden = false;
    $("stageMode").textContent = state.camera.snapshot
      ? "CAMERA SNAPSHOT · AUTO-REFRESH"
      : "LIVE CAMERA STREAM";
    $("stageTag").textContent = state.camera.snapshot ? "CAMERA SNAPSHOT" : "LIVE CAMERA";
    $("playerStatus").textContent = state.camera.snapshot ? "REFRESHING" : "LIVE";
    renderCameraFeedStatus();
    if (state.camera.error) {
      message.innerHTML = "<strong>Camera stream unavailable</strong><small>Check the phone's IP, port, and /video URL.</small>";
      message.hidden = false;
    } else if (state.camera.online) {
      message.hidden = true;
    } else {
      message.innerHTML = "<strong>Connecting to IP Webcam</strong><small>The live image will appear when the stream responds.</small>";
      message.hidden = false;
    }
    startCameraFeed();
  } else {
    stopCameraFeed();
    liveImage.hidden = true;
    $("stageMode").textContent = "LATEST SAVED EVIDENCE · NOT LIVE VIDEO";
    $("stageTag").textContent = "LATEST EVIDENCE";
    $("playerStatus").textContent = "CAPTURED";
    $("cameraFeedStatus").textContent = state.camera.configured
      ? "Select the configured camera for live video"
      : "No live camera configured";
    const url = latest ? evidenceUrl(latest) : "";
    image.hidden = !url;
    if (url && image.src !== url) image.src = url;
    message.hidden = Boolean(url);
    message.innerHTML = latest
      ? "<strong>Evidence image unavailable</strong><small>This incident has no saved snapshot.</small>"
      : "<strong>No incidents recorded yet</strong><small>Set CAMERA_SOURCE in the project-root .env to view your IP Webcam stream.</small>";
  }

  if (!latest) {
    $("latestStatus").textContent = "NO INCIDENT";
    $("latestIncidentId").textContent = "Waiting for a saved incident";
    $("latestPlate").textContent = "Unread";
    $("latestConfidence").textContent = "—";
    $("confidenceBar").style.width = "0%";
    $("evLoc").textContent = "—";
    $("evCam").textContent = "—";
    $("evTime").textContent = "—";
    $("evAssociation").textContent = "—";
    $("cameraTime").textContent = "--:--";
    assign.disabled = true;
    reject.disabled = true;
    state.selectedId = null;
    return;
  }

  const status = statusDetails(latest.reviewStatus);
  $("latestStatus").textContent = status.label.toUpperCase();
  $("latestStatus").className = `pill ${latest.reviewStatus === "pending" ? "amber" : ""}`;
  $("latestIncidentId").textContent = `Incident ${latest._id}`;
  $("latestPlate").textContent = latest.correctedPlate || latest.plateNumber || "Unread";
  $("latestConfidence").textContent = `${Math.round((latest.smokeConfidence || 0) * 100)}%`;
  $("confidenceBar").style.width = `${Math.max(0, Math.min(100, (latest.smokeConfidence || 0) * 100))}%`;
  $("evLoc").textContent = latest.location?.name || "Location not set";
  $("evCam").textContent = latest.cameraId || "—";
  $("evTime").textContent = formatDate(latest.detectedAt);
  $("evAssociation").textContent = latest.associationConfidence == null
    ? "—"
    : `${Math.round(latest.associationConfidence * 100)}%`;
  $("cameraTime").textContent = timeOf(latest.detectedAt);
  assign.disabled = false;
  reject.disabled = latest.reviewStatus !== "pending";
  $("latestIncidentId").dataset.incidentId = latest._id;
}

function tasksForRange() {
  const pending = state.tasks.filter((incident) =>
    (!state.location || incident.location?.name === state.location)
    && (!state.cameraId || incident.cameraId === state.cameraId)
  );
  const age = { today: 1, yesterday: 2, week: 7 }[state.range];
  return pending.filter((incident) => relativeDay(incident.detectedAt) < age);
}

function renderTasks() {
  const pending = state.tasks.filter((incident) =>
    (!state.location || incident.location?.name === state.location)
    && (!state.cameraId || incident.cameraId === state.cameraId)
  );
  const tabs = $("rangeTabs");
  tabs.replaceChildren();
  Object.entries(RANGE_LABELS).forEach(([key, label]) => {
    const age = { today: 1, yesterday: 2, week: 7 }[key];
    const count = pending.filter((incident) => relativeDay(incident.detectedAt) < age).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.range === key ? "on" : "";
    button.dataset.range = key;
    button.textContent = `${label} (${count})`;
    tabs.append(button);
  });

  const filtered = tasksForRange();
  if (!filtered.some((incident) => incident._id === state.selectedId)) {
    state.selectedId = filtered[0]?._id || null;
  }
  $("taskBody").innerHTML = filtered.map((incident) => {
    const status = statusDetails(incident.reviewStatus);
    const selected = incident._id === state.selectedId;
    return `<tr class="${selected ? "sel" : ""}">
      <td><b>${escapeHTML(incident._id)}</b><small>${escapeHTML(incident.correctedPlate || incident.plateNumber || "Plate unread")}</small></td>
      <td>${escapeHTML(incident.cameraId)}</td>
      <td><b>${escapeHTML(formatDate(incident.detectedAt))}</b></td>
      <td><span class="st ${status.className}">${escapeHTML(status.label)}</span></td>
      <td><button class="act ${selected ? "on" : ""}" type="button" data-task="${escapeHTML(incident._id)}">${selected ? "Selected" : "Review"}</button></td>
    </tr>`;
  }).join("") || '<tr><td colspan="5" class="muted">No pending incidents in this range.</td></tr>';

  $("navCount").textContent = String(pending.length);
  $("queueCount").textContent = `${pending.length} pending`;
  $("queueDiv").textContent = state.location || "All locations";
  renderTaskDetail();
}

function findIncident(id) {
  return [...state.tasks, ...state.recent, ...state.incidents.data]
    .find((incident) => incident._id === id);
}

function renderTaskDetail() {
  const detail = $("detail");
  const incident = state.selectedId ? findIncident(state.selectedId) : null;
  if (!incident) {
    detail.innerHTML = '<p class="muted">No pending incidents to review.</p>';
    return;
  }
  const status = statusDetails(incident.reviewStatus);
  const image = evidenceUrl(incident);
  detail.innerHTML = `
    <div class="top2"><h2>Incident review</h2><span class="st ${status.className}">${escapeHTML(status.label)}</span></div>
    <small class="muted">#${escapeHTML(incident._id)}</small>
    ${image
      ? `<img class="task-image" src="${escapeHTML(image)}" alt="Saved incident evidence">`
      : '<div class="clip">No saved snapshot available</div>'}
    <p class="plate-label">PLATE RESULT</p>
    <div class="plate-edit">${escapeHTML(incident.correctedPlate || incident.plateNumber || "Unread")}<small class="blue">${incident.plateConfidence == null ? "No OCR result" : `${Math.round(incident.plateConfidence * 100)}% confidence`}</small></div>
    <small class="muted">${escapeHTML(incident.cameraId)} · ${escapeHTML(incident.location?.name || "Location not set")} · ${escapeHTML(formatDate(incident.detectedAt))}</small>
    <dl>
      <dt>Smoke confidence</dt><dd>${Math.round((incident.smokeConfidence || 0) * 100)}%</dd>
      <dt>Smoke-to-vehicle association</dt><dd>${incident.associationConfidence == null ? "—" : `${Math.round(incident.associationConfidence * 100)}%`}</dd>
    </dl>
    <label class="review-label" for="reviewPlate">Corrected plate (optional)</label>
    <input id="reviewPlate" value="${escapeHTML(incident.correctedPlate || incident.plateNumber || "")}">
    <label class="review-label" for="reviewNotes">Review notes</label>
    <textarea id="reviewNotes" rows="3">${escapeHTML(incident.reviewNotes || "")}</textarea>
    <div class="review-actions">
      <button class="btn primary" type="button" data-review="confirmed">Confirm</button>
      <button class="btn outline" type="button" data-review="needs_inspection">Needs inspection</button>
      <button class="btn outline" type="button" data-review="rejected">Reject</button>
    </div>`;
}

function renderIncidents() {
  const records = state.incidents.data;
  $("incBody").innerHTML = records.map((incident) => {
    const status = statusDetails(incident.reviewStatus);
    const image = evidenceUrl(incident);
    return `<tr>
      <td>${image ? `<img class="thumb" src="${escapeHTML(image)}" alt="Incident snapshot">` : '<div class="th">No image</div>'}</td>
      <td><b>${escapeHTML(incident.correctedPlate || incident.plateNumber || "Unread")}</b><small>${escapeHTML(incident._id)}</small></td>
      <td>${escapeHTML(incident.cameraId)}<small>${escapeHTML(incident.location?.name || "Location not set")}</small></td>
      <td>${escapeHTML(formatDate(incident.detectedAt))}</td>
      <td>${Math.round((incident.smokeConfidence || 0) * 100)}%</td>
      <td><span class="st ${status.className}">${escapeHTML(status.label)}</span></td>
      <td><button class="act" type="button" data-open-task="${escapeHTML(incident._id)}">Review</button></td>
    </tr>`;
  }).join("") || '<tr><td colspan="7" class="muted">No incidents match these filters.</td></tr>';

  const start = records.length ? (state.incidentPage - 1) * PAGE_SIZE + 1 : 0;
  const end = Math.min(state.incidentPage * PAGE_SIZE, state.incidents.total);
  $("showing").textContent = state.incidents.total
    ? `Showing ${start}–${end} of ${state.incidents.total} incidents`
    : "No incidents found";
  $("pageNumber").textContent = `Page ${state.incidents.page || 1} of ${state.incidents.totalPages || 1}`;
  $("prevPage").disabled = state.incidentPage <= 1;
  $("nextPage").disabled = state.incidentPage >= (state.incidents.totalPages || 1);
}

async function loadIncidentPage() {
  const query = queryString({
    page: state.incidentPage,
    limit: PAGE_SIZE,
    plate: $("search").value.trim(),
    cameraId: $("fCam").value,
    status: $("fStatus").value,
    location: state.location
  });
  state.incidents = await request(`/api/incidents?${query}`);
  renderIncidents();
}

async function refreshData() {
  $("connectionStatus").textContent = "Loading incidents…";
  $("liveMessage").textContent = "Loading incident records…";
  try {
    const [recent, pending] = await Promise.all([
      request("/api/incidents?page=1&limit=100"),
      request("/api/incidents?status=pending&page=1&limit=100")
    ]);
    state.recent = recent.data || [];
    state.tasks = pending.data || [];
    populateFilters();
    $("connectionStatus").textContent = "Connected";
    $("liveMessage").textContent = "";
    $("appError").hidden = true;
    renderLive();
    renderTasks();
    await loadIncidentPage();
  } catch (error) {
    $("connectionStatus").textContent = "Unavailable";
    $("liveMessage").textContent = `Could not load incidents: ${error.message}`;
    $("taskMessage").textContent = `Could not load incidents: ${error.message}`;
    $("incidentMessage").textContent = `Could not load incidents: ${error.message}`;
  }
}

async function loadCameraSettings() {
  if (window.location.protocol === "file:") {
    $("cameraFeedStatus").textContent = "Open dashboard at http://localhost:5000";
    $("stageMessage").innerHTML = "<strong>Open the dashboard through the backend</strong><small>Use http://localhost:5000 instead of opening index.html directly.</small>";
    return;
  }

  try {
    state.camera = {
      ...state.camera,
      ...await request("/api/camera/status")
    };
    populateFilters();
    renderLive();
  } catch (error) {
    $("cameraFeedStatus").textContent = "Camera settings unavailable";
    $("liveMessage").textContent = `Could not load camera settings: ${error.message}`;
  }
}

async function saveReview(incidentId, reviewStatus, reviewNotes = "", correctedPlate = "") {
  await request(`/api/incidents/${encodeURIComponent(incidentId)}/review`, {
    method: "PATCH",
    body: JSON.stringify({
      reviewStatus,
      reviewNotes: reviewNotes.trim(),
      correctedPlate: correctedPlate.trim() || null
    })
  });
  await refreshData();
  toast(`Incident marked ${statusDetails(reviewStatus).label.toLowerCase()}.`);
}

function setLocation(location) {
  state.location = location;
  $("loc").value = location;
  $("oLoc").value = location;
  $("division").textContent = location || "All locations";
  state.incidentPage = 1;
  refreshData();
}

function showApp(name, location) {
  $("login").hidden = true;
  $("app").hidden = false;
  $("officerName").textContent = name;
  setLocation(location);
}

function logout() {
  sessionStorage.removeItem("smokai.name");
  sessionStorage.removeItem("smokai.location");
  $("app").hidden = true;
  $("login").hidden = false;
  $("loginForm").reset();
  $("loginErr").hidden = true;
  $("oName").focus();
}

function exportCurrentPage() {
  const columns = [
    "incident_id", "plate_number", "camera_id", "location", "detected_at",
    "vehicle_type", "smoke_confidence", "association_confidence", "review_status"
  ];
  const rows = state.incidents.data.map((incident) => [
    incident._id,
    incident.correctedPlate || incident.plateNumber || "",
    incident.cameraId,
    incident.location?.name || "",
    incident.detectedAt,
    incident.vehicleType,
    incident.smokeConfidence,
    incident.associationConfidence ?? "",
    incident.reviewStatus
  ]);
  const csv = [columns, ...rows]
    .map((row) => row.map((field) => `"${String(field ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `vehicle-smoke-incidents-page-${state.incidentPage}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function updateClock() {
  const now = new Date();
  const date = now.toLocaleDateString("en-GB", {
    timeZone: "Asia/Kathmandu",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
  const time = now.toLocaleTimeString("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "2-digit",
    minute: "2-digit"
  });
  $("clock").textContent = `${date} · ${time} NPT`;
}

document.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;

  const navigation = target.closest("[data-view]");
  if (navigation) {
    setView(navigation.dataset.view);
    if (navigation.dataset.view === "tasks") renderTasks();
    return;
  }

  const cameraButton = target.closest("[data-camera]");
  if (cameraButton) {
    state.cameraId = cameraButton.dataset.camera;
    $("fCam").value = state.cameraId;
    state.incidentPage = 1;
    renderLive();
    renderTasks();
    loadIncidentPage().catch((error) => {
      $("incidentMessage").textContent = `Could not load incidents: ${error.message}`;
    });
    return;
  }

  const rangeButton = target.closest("[data-range]");
  if (rangeButton) {
    state.range = rangeButton.dataset.range;
    renderTasks();
    return;
  }

  const taskButton = target.closest("[data-task]");
  if (taskButton) {
    state.selectedId = taskButton.dataset.task;
    renderTasks();
    return;
  }

  const reviewButton = target.closest("[data-review]");
  if (reviewButton) {
    const incident = state.selectedId ? findIncident(state.selectedId) : null;
    if (!incident) return;
    reviewButton.disabled = true;
    try {
      await saveReview(
        incident._id,
        reviewButton.dataset.review,
        $("reviewNotes").value,
        $("reviewPlate").value
      );
    } catch (error) {
      toast(`Could not save review: ${error.message}`);
      reviewButton.disabled = false;
    }
    return;
  }

  if (target.closest("#assign")) {
    if (!state.selectedId) {
      const latest = filteredRecent()[0];
      state.selectedId = latest?._id || null;
    }
    setView("tasks");
    renderTasks();
    return;
  }

  if (target.closest("#falseDet")) {
    const latest = filteredRecent()[0];
    if (!latest) return;
    try {
      await saveReview(latest._id, "rejected", "Rejected from monitoring view.");
    } catch (error) {
      toast(`Could not reject incident: ${error.message}`);
    }
    return;
  }

  const openTask = target.closest("[data-open-task]");
  if (openTask) {
    state.selectedId = openTask.dataset.openTask;
    setView("tasks");
    renderTaskDetail();
    return;
  }

  if (target.closest("#export")) {
    exportCurrentPage();
    return;
  }
  if (target.closest("#logout")) {
    logout();
    return;
  }
  if (target.closest("#help")) {
    toast("Review saved images and confidence values. Visual smoke is not an emissions test.");
  }
});

$("loc").addEventListener("change", () => setLocation($("loc").value));
$("loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("oName").value.trim();
  if (!name) {
    $("loginErr").hidden = false;
    return;
  }
  const location = $("oLoc").value;
  sessionStorage.setItem("smokai.name", name);
  sessionStorage.setItem("smokai.location", location);
  $("loginErr").hidden = true;
  showApp(name, location);
});

["search", "fCam", "fStatus"].forEach((id) => {
  $(id).addEventListener(id === "search" ? "input" : "change", () => {
    state.incidentPage = 1;
    loadIncidentPage().catch((error) => {
      $("incidentMessage").textContent = `Could not load incidents: ${error.message}`;
    });
  });
});

$("prevPage").addEventListener("click", () => {
  state.incidentPage = Math.max(1, state.incidentPage - 1);
  loadIncidentPage().catch((error) => {
    $("incidentMessage").textContent = `Could not load incidents: ${error.message}`;
  });
});
$("nextPage").addEventListener("click", () => {
  state.incidentPage += 1;
  loadIncidentPage().catch((error) => {
    $("incidentMessage").textContent = `Could not load incidents: ${error.message}`;
  });
});

$("liveCameraImage").addEventListener("load", () => {
  if (!state.camera.feedActive) return;
  state.camera.online = true;
  state.camera.error = false;
  renderCameraFeedStatus();
  $("stageMessage").hidden = true;
  if (state.camera.snapshot && state.camera.feedActive) {
    snapshotRefreshTimer = window.setTimeout(() => {
      if (state.camera.feedActive) $("liveCameraImage").src = cameraFeedUrl();
    }, 1000);
  }
});

$("liveCameraImage").addEventListener("error", () => {
  if (!state.camera.feedActive) return;
  state.camera.online = false;
  state.camera.error = true;
  renderCameraFeedStatus();
  $("stageMessage").innerHTML = "<strong>Camera stream unavailable</strong><small>Check the phone's IP, port, and /video URL.</small>";
  $("stageMessage").hidden = false;
  if (state.camera.feedActive) {
    cameraReconnectTimer = window.setTimeout(() => {
      state.camera.feedActive = false;
      startCameraFeed();
    }, 3000);
  }
});

const savedName = sessionStorage.getItem("smokai.name");
const savedLocation = sessionStorage.getItem("smokai.location") || "";
if (savedName) {
  $("login").hidden = true;
  $("app").hidden = false;
  $("officerName").textContent = savedName;
  $("division").textContent = savedLocation || "All locations";
  state.location = savedLocation;
}

updateClock();
window.setInterval(updateClock, 30000);
loadCameraSettings();
refreshData();
