const router = require("express").Router();
const c = require("../controllers/incidents.controller");

router.post("/", c.createIncident);
router.get("/", c.getIncidents);
router.get("/:id", c.getIncidentById);
router.patch("/:id/review", c.reviewIncident);

module.exports = router;