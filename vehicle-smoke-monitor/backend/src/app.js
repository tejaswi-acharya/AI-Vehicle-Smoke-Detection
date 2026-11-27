const express = require("express");
const cors = require("cors");
const path = require("path");

const incidentRoutes = require("./routes/incidents.routes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(express.json());

// Serve evidence images/clips saved by the Python pipeline
app.use("/media", express.static(path.join(__dirname, "../../storage/incidents")));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/incidents", incidentRoutes);

app.use(express.static(path.join(__dirname, "../../dashboard")));
app.use("/officer", express.static(path.join(__dirname, "../dashboard")));

app.use((req, res) => res.status(404).json({ message: "Route not found" }));
app.use(errorHandler);

module.exports = app;