import threading
import time
import cv2
from flask import Flask, Response
from flask_cors import CORS

_app = Flask(__name__)
CORS(_app)
_lock = threading.Lock()
_latest_jpeg = None


def publish_frame(frame):
    """Call with the frame AFTER boxes are drawn."""
    global _latest_jpeg
    ok, buf = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 75])
    if ok:
        with _lock:
            _latest_jpeg = buf.tobytes()


def _gen():
    last = None
    while True:
        with _lock:
            jpg = _latest_jpeg
        if jpg is None or jpg is last:
            time.sleep(0.03)
            continue
        last = jpg
        yield b"--frame\r\nContent-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"


@_app.route("/annotated_feed")
def annotated_feed():
    return Response(_gen(), mimetype="multipart/x-mixed-replace; boundary=frame")


def start_stream_server(port=5001):
    threading.Thread(
        target=lambda: _app.run(host="0.0.0.0", port=port, threaded=True, use_reloader=False),
        daemon=True,
    ).start()
    print(f"[STREAM] annotated feed at http://localhost:{port}/annotated_feed")