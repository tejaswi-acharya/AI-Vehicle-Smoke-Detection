const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env"),
});
require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

module.exports = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "mongodb://127.0.0.1:27017/vehicle-smoke-monitor",
  cameraSource: process.env.CAMERA_SOURCE || "",
  cameraId: process.env.CAMERA_ID || "camera-1",
  cameraLocation: process.env.CAMERA_LOCATION || "Unspecified location",
};