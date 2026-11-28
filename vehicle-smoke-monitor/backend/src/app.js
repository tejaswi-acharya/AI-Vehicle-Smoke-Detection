const express = require("express");
const cors = require("cors");
const path = require("path");

const createCameraController = require("./controllers/camera.controller");
const { cameraSource, cameraId, cameraLocation } = require("./config");
const incidentRoutes = require("./routes/incidents.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();
const cameraController = createCameraController({
  cameraSource,
  cameraId,
  cameraLocation,
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) =>
  res.sendFile(path.resolve(__dirname, "../../dashboard/index.html"))
);
app.use(express.static(path.resolve(__dirname, "../../dashboard")));

// Serve evidence images/clips saved by the Python pipeline
app.use("/media", express.static(path.join(__dirname, "../../storage/incidents")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/camera/status", cameraController.status);
app.get("/api/camera/live", cameraController.live);
app.use("/api/incidents", incidentRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorHandler);

module.exports = app;