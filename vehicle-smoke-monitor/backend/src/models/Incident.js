const mongoose = require("mongoose");

const incidentSchema = new mongoose.Schema(
  {
    cameraId: { type: String, required: true },
    location: {
      name: { type: String, required: true },
      lat: Number,
      lng: Number,
    },
    detectedAt: { type: Date, required: true },

    vehicleType: {
      type: String,
      enum: ["bus", "truck", "car", "motorcycle", "other"],
      default: "other",
    },
    trackId: Number,

    smokeType: { type: String, enum: ["black", "grey", "other"], default: "black" },
    smokeConfidence: { type: Number, min: 0, max: 1, required: true },
    associationConfidence: { type: Number, min: 0, max: 1, default: null },

    plateNumber: { type: String, default: null },
    plateConfidence: { type: Number, min: 0, max: 1, default: null },

    media: {
      snapshotImage: String,
      vehicleImage: String,
      plateImage: String,
      smokeClip: String,
    },

    reviewStatus: {
      type: String,
      enum: ["pending", "confirmed", "rejected", "needs_inspection"],
      default: "pending",
    },
    reviewNotes: String,
    correctedPlate: String,
    reviewedAt: Date,
  },
  { timestamps: true }
);

incidentSchema.index({ detectedAt: -1 });
incidentSchema.index({ plateNumber: 1 });
incidentSchema.index({ reviewStatus: 1 });

module.exports = mongoose.model("Incident", incidentSchema);