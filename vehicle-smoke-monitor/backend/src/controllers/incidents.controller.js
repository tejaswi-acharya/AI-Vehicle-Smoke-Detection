const Incident = require("../models/Incident");

// POST /api/incidents  (called by the Python pipeline)
exports.createIncident = async (req, res, next) => {
  try {
    const incident = await Incident.create(req.body);
    res.status(201).json(incident);
  } catch (err) {
    next(err);
  }
};

// GET /api/incidents?status=&vehicleType=&cameraId=&location=&plate=&from=&to=&page=&limit=
exports.getIncidents = async (req, res, next) => {
  try {
    const { status, vehicleType, cameraId, location, plate, from, to } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const filter = {};
    if (status) filter.reviewStatus = status;
    if (vehicleType) filter.vehicleType = vehicleType;
    if (cameraId) filter.cameraId = cameraId;
    if (location) filter["location.name"] = location;
    if (plate) filter.plateNumber = { $regex: plate, $options: "i" };
    if (from || to) {
      filter.detectedAt = {};
      if (from) filter.detectedAt.$gte = new Date(from);
      if (to) filter.detectedAt.$lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      Incident.find(filter).sort({ detectedAt: -1 }).skip((page - 1) * limit).limit(limit),
      Incident.countDocuments(filter),
    ]);

    res.json({ data, page, limit, total, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

// GET /api/incidents/:id
exports.getIncidentById = async (req, res, next) => {
  try {
    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ message: "Incident not found" });
    res.json(incident);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/incidents/:id/review  (human reviewer decision)
exports.reviewIncident = async (req, res, next) => {
  try {
    const { reviewStatus, reviewNotes, correctedPlate } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { reviewStatus, reviewNotes, correctedPlate, reviewedAt: new Date() },
      { new: true, runValidators: true }
    );
    if (!incident) return res.status(404).json({ message: "Incident not found" });
    res.json(incident);
  } catch (err) {
    next(err);
  }
};