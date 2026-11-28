const assert = require("node:assert/strict");
const test = require("node:test");
const Incident = require("../src/models/Incident");
const app = require("../src/app");

test("serves the integrated monitoring dashboard at the backend root", async () => {
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(html, /Vehicle Smoke Monitor/);
    assert.match(html, /css\/smokai\.css/);
    assert.match(html, /id="view-incidents"/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

test("accepts incident data emitted by the detection pipeline", async () => {
  const incident = new Incident({
    cameraId: "camera-1",
    location: { name: "Test location", lat: 27.7, lng: 85.3 },
    detectedAt: new Date("2026-11-28T00:00:00.000Z"),
    vehicleType: "other",
    smokeType: "other",
    smokeConfidence: 0.87,
    associationConfidence: 0.72,
    plateNumber: null,
    plateConfidence: null,
    media: {
      snapshotImage: "snapshot_test.jpg",
      vehicleImage: "vehicle_test.jpg",
    },
  });

  await incident.validate();
  assert.equal(incident.reviewStatus, "pending");
  assert.equal(incident.media.snapshotImage, "snapshot_test.jpg");
});

test("rejects confidence values outside the unit interval", async () => {
  const incident = new Incident({
    cameraId: "camera-1",
    location: { name: "Test location" },
    detectedAt: new Date(),
    smokeConfidence: 1.5,
  });

  await assert.rejects(incident.validate(), (error) =>
    Boolean(error.errors.smokeConfidence)
  );
});