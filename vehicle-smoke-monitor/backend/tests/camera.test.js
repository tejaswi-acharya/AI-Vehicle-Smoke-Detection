const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const test = require("node:test");

const createCameraController = require("../src/controllers/camera.controller");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("proxies an MJPEG stream and reports camera metadata without its URL", async () => {
  const frame = "--frame\r\nContent-Type: image/jpeg\r\n\r\nmock-frame\r\n";
  const camera = http.createServer((_req, res) => {
    res.writeHead(200, {
      "Content-Type": "multipart/x-mixed-replace; boundary=frame",
    });
    res.end(frame);
  });
  const cameraPort = await listen(camera);
  const controller = createCameraController({
    cameraSource: `http://127.0.0.1:${cameraPort}/video`,
    cameraId: "phone-camera",
    cameraLocation: "Test location",
  });
  const app = express();
  app.get("/status", controller.status);
  app.get("/live", controller.live);
  const server = http.createServer(app);
  const serverPort = await listen(server);

  try {
    const statusResponse = await fetch(`http://127.0.0.1:${serverPort}/status`);
    const status = await statusResponse.json();
    assert.deepEqual(status, {
      configured: true,
      cameraId: "phone-camera",
      location: "Test location",
      snapshot: false,
    });

    const streamResponse = await fetch(`http://127.0.0.1:${serverPort}/live`);
    assert.equal(streamResponse.status, 200);
    assert.match(streamResponse.headers.get("content-type"), /^multipart\/x-mixed-replace/);
    assert.equal(await streamResponse.text(), frame);
  } finally {
    await close(server);
    await close(camera);
  }
});

test("reports an unconfigured source and does not start a proxy request", async () => {
  const controller = createCameraController({
    cameraSource: "",
    cameraId: "camera-1",
    cameraLocation: "Unspecified location",
  });
  const app = express();
  app.get("/status", controller.status);
  app.get("/live", controller.live);
  const server = http.createServer(app);
  const port = await listen(server);

  try {
    const statusResponse = await fetch(`http://127.0.0.1:${port}/status`);
    assert.equal((await statusResponse.json()).configured, false);

    const streamResponse = await fetch(`http://127.0.0.1:${port}/live`);
    assert.equal(streamResponse.status, 503);
  } finally {
    await close(server);
  }
});
