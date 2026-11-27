#!/usr/bin/env python3
"""
DhuwaWatch - Camera Agent v1 (smoke watch, preview only)
=========================================================
Same pattern as ForestGuard: poll the phone's /shot.jpg, run YOLO, drop empty frames.
Differences: a FAST poll (vehicles cross the view in 1-2 s) and a live preview window.

v1 does NOT read plates and does NOT talk to the backend. It only proves:
phone -> laptop -> smoke model works, and shows real confidence numbers.

Run (Windows CMD, from the DhuwaFic folder, venv on):
    set PHONE_URL=http://172.16.20.214:8080/shot.jpg
    python camera\camera_agent.py

Optional settings (set them the same way before running):
    POLL_INTERVAL   seconds between frames        default 0.15
    SHOW_CONF       lowest confidence to draw     default 0.25
    TRIGGER_CONF    confidence that counts as smoke  default 0.50
    MODEL_PATH      path to best.pt               default models\smoke_detection\best.pt
Press q in the preview window to quit.
"""

import os
import time
from collections import deque
from pathlib import Path

import cv2
import numpy as np
import requests

# -- CONFIG ---------------------------------------------------------------
ROOT = Path(__file__).resolve().parent.parent
PHONE_URL = os.getenv("PHONE_URL", "")
POLL_INTERVAL = float(os.getenv("POLL_INTERVAL", "0.15"))
SHOW_CONF = float(os.getenv("SHOW_CONF", "0.25"))
TRIGGER_CONF = float(os.getenv("TRIGGER_CONF", "0.50"))
YOLO_IMAGE_SIZE = int(os.getenv("YOLO_IMAGE_SIZE", "640"))
MODEL_PATH = os.getenv("MODEL_PATH", str(ROOT / "ai" / "smoke_detection" / "best.pt"))
BUFFER_SECONDS = 2.0   # kept for the next step: frames from just before the trigger
# -------------------------------------------------------------------------


class FrameBuffer:
    """Keeps the last few seconds of frames. Not used for plates yet (next step)."""

    def __init__(self, seconds):
        self.seconds = seconds
        self.items = deque()  # (timestamp, frame)

    def add(self, frame):
        now = time.time()
        self.items.append((now, frame))
        while self.items and now - self.items[0][0] > self.seconds:
            self.items.popleft()

    def __len__(self):
        return len(self.items)


def grab_frame(session):
    """Same idea as ForestGuard: one JPEG from the phone."""
    resp = session.get(f"{PHONE_URL}?t={int(time.time() * 1000)}", timeout=4)
    resp.raise_for_status()
    frame = cv2.imdecode(np.frombuffer(resp.content, np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise ValueError("Could not decode image from phone")
    return frame


def main():
    if not PHONE_URL:
        raise SystemExit("PHONE_URL is empty. In CMD run:  set PHONE_URL=http://YOUR_IP:8080/shot.jpg")
    if not Path(MODEL_PATH).is_file():
        raise SystemExit(f"best.pt not found: {MODEL_PATH}")

    import torch
    from ultralytics import YOLO

    device = 0 if torch.cuda.is_available() else "cpu"
    model = YOLO(MODEL_PATH)
    print("=" * 60)
    print("  DhuwaWatch - Camera Agent v1 (preview only)")
    print(f"  Phone    : {PHONE_URL}")
    print(f"  Classes  : {model.names}")
    print(f"  Device   : {device}")
    print(f"  Trigger  : smoking_vehicle >= {TRIGGER_CONF:.0%}  (draws from {SHOW_CONF:.0%})")
    print("=" * 60)

    session = requests.Session()
    buffer = FrameBuffer(BUFFER_SECONDS)
    last_tick = time.time()
    fails = 0

    while True:
        try:
            frame = grab_frame(session)
            fails = 0
        except Exception as e:
            fails += 1
            print(f"[agent] Phone error ({fails}): {e}")
            print(f"[agent]   Check IP Webcam is running ({PHONE_URL})")
            time.sleep(2)
            continue

        buffer.add(frame)
        result = model.predict(frame, conf=SHOW_CONF, imgsz=YOLO_IMAGE_SIZE,
                               device=device, verbose=False)[0]

        triggered = False
        for box in result.boxes:
            name = model.names[int(box.cls[0])]
            conf = float(box.conf[0])
            hit = name == "smoking_vehicle" and conf >= TRIGGER_CONF
            triggered = triggered or hit
            print(f"[yolo] {name:<16} {conf:.0%}" + ("   <-- TRIGGER" if hit else ""))

        now = time.time()
        fps = 1.0 / max(now - last_tick, 1e-6)
        last_tick = now
        shown = result.plot()
        cv2.putText(shown, f"{fps:.1f} fps | buffer {len(buffer)} frames",
                    (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        if triggered:
            cv2.putText(shown, "TRIGGER", (10, 55), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 255), 3)
        cv2.imshow("DhuwaWatch camera agent", shown)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break
        time.sleep(POLL_INTERVAL)

    cv2.destroyAllWindows()
    print("[agent] Stopped.")


if __name__ == "__main__":
    main()