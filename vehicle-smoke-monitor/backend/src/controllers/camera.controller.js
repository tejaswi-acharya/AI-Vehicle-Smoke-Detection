const http = require("node:http");
const https = require("node:https");

function createCameraController({ cameraSource, cameraId, cameraLocation }) {
  let sourceUrl = null;
  try {
    const parsedUrl = new URL(cameraSource);
    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
      sourceUrl = parsedUrl;
    }
  } catch {
    sourceUrl = null;
  }

  const isSnapshot = Boolean(
    sourceUrl && /\.(jpe?g|png)$/i.test(sourceUrl.pathname)
  );

  function status(_req, res) {
    res.json({
      configured: Boolean(sourceUrl),
      cameraId,
      location: cameraLocation,
      snapshot: isSnapshot,
    });
  }

  function live(req, res) {
    if (!sourceUrl) {
      return res.status(503).json({
        message: "Set CAMERA_SOURCE to an HTTP(S) IP Webcam stream URL.",
      });
    }

    const transport = sourceUrl.protocol === "https:" ? https : http;
    const upstreamRequest = transport.get(sourceUrl, (upstream) => {
      const contentType = upstream.headers["content-type"] || "";
      const validImageStream = contentType.toLowerCase().startsWith("image/");
      const validMjpegStream = contentType
        .toLowerCase()
        .startsWith("multipart/x-mixed-replace");

      if (upstream.statusCode !== 200 || (!validImageStream && !validMjpegStream)) {
        upstream.resume();
        return res.status(502).json({
          message: "The configured camera did not return an image or MJPEG stream.",
        });
      }

      res.status(200).set({
        "Content-Type": contentType,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      });
      upstream.on("error", () => res.destroy());
      upstream.pipe(res);
    });

    upstreamRequest.setTimeout(8000, () => {
      upstreamRequest.destroy(new Error("Camera connection timed out"));
    });
    upstreamRequest.on("error", () => {
      if (!res.headersSent) {
        res.status(502).json({ message: "Could not connect to the configured camera." });
      } else {
        res.destroy();
      }
    });
    res.on("close", () => upstreamRequest.destroy());
  }

  return { status, live };
}

module.exports = createCameraController;
