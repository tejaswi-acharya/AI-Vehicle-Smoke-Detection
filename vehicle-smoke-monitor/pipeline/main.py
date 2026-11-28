import argparse
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import cv2
import numpy as np
import requests

from pipeline.association.matcher import associate_smoke_to_vehicles
from pipeline.evidence.storage import save_incident_evidence
from pipeline.plates.plate_detector import PlateReader
from pipeline.smoke.detector import SmokeDetector
from pipeline.stream_server import start_stream_server, publish_frame


ROOT = Path(__file__).resolve().parents[1]


def _source_value(value):
    return int(value) if value.isdecimal() else value


def _is_snapshot_url(source):
    parsed = urlparse(source) if isinstance(source, str) else None
    return bool(
        parsed
        and parsed.scheme in {"http", "https"}
        and Path(parsed.path).suffix.lower() in {".jpg", ".jpeg", ".png"}
    )


def _optional_float(name):
    value = os.getenv(name)
    return float(value) if value else None


def _detections_by_label(detections, label):
    return [detection for detection in detections if detection.label == label]


def run(source, camera_id, location, backend_url, cooldown, show_preview):
    model_path = Path(
        os.getenv("SMOKE_MODEL_PATH", str(ROOT / "models" / "weights" / "smoke_best.pt"))
    )
    confidence = float(os.getenv("SMOKE_CONFIDENCE", "0.5"))
    image_size = int(os.getenv("YOLO_IMAGE_SIZE", "640"))
    evidence_directory = ROOT / "storage" / "incidents"

    detector = SmokeDetector(model_path, confidence, image_size)
    plate_reader = PlateReader()

    # Serve annotated frames to the dashboard
    start_stream_server(int(os.getenv("STREAM_PORT", "5001")))

    snapshot_session = requests.Session() if _is_snapshot_url(source) else None
    capture = None if snapshot_session else cv2.VideoCapture(source)
    if capture is not None and not capture.isOpened():
        raise RuntimeError(f"Could not open video source: {source}")

    last_saved_at = 0.0
    try:
        while True:
            if snapshot_session is not None:
                response = snapshot_session.get(
                    source,
                    params={"t": int(time.time() * 1000)},
                    timeout=4,
                )
                response.raise_for_status()
                frame = cv2.imdecode(
                    np.frombuffer(response.content, dtype=np.uint8),
                    cv2.IMREAD_COLOR,
                )
                if frame is None:
                    raise ValueError(f"Camera returned an invalid image: {source}")
                success = True
            else:
                success, frame = capture.read()
            if not success or frame is None:
                if isinstance(source, int):
                    raise RuntimeError("Camera stopped returning frames")
                break

            detections, annotated = detector.process(frame)

            # Send boxed frame to dashboard on EVERY frame
            publish_frame(annotated)

            smoke_detections = _detections_by_label(detections, "smoke")
            vehicle_detections = _detections_by_label(detections, "smoking_vehicle")
            now = time.monotonic()
            used_vehicle_indices = set()

            for smoke in smoke_detections:
                match = associate_smoke_to_vehicles(smoke.box, vehicle_detections)
                if match is None or now - last_saved_at < cooldown:
                    continue
                vehicle_index, vehicle, association_confidence = match
                if vehicle_index in used_vehicle_indices:
                    continue

                x1, y1, x2, y2 = (int(value) for value in vehicle.box)
                height, width = frame.shape[:2]
                x1, y1 = max(x1, 0), max(y1, 0)
                x2, y2 = min(x2, width), min(y2, height)
                vehicle_crop = frame[y1:y2, x1:x2]
                plate = plate_reader.read(vehicle_crop) if vehicle_crop.size else None
                plate_image = plate["image"] if plate else None
                media = save_incident_evidence(
                    frame, annotated, vehicle.box, plate_image, evidence_directory
                )

                payload = {
                    "cameraId": camera_id,
                    "location": {
                        "name": location,
                        "lat": _optional_float("CAMERA_LAT"),
                        "lng": _optional_float("CAMERA_LNG"),
                    },
                    "detectedAt": datetime.now(timezone.utc).isoformat(),
                    "vehicleType": "other",
                    "smokeType": "other",
                    "smokeConfidence": smoke.confidence,
                    "associationConfidence": association_confidence,
                    "plateNumber": plate["plate_number"] if plate else None,
                    "plateConfidence": plate["confidence"] if plate else None,
                    "media": media,
                }
                response = requests.post(
                    f"{backend_url.rstrip('/')}/api/incidents",
                    json=payload,
                    timeout=10,
                )
                response.raise_for_status()
                incident = response.json()
                last_saved_at = time.monotonic()
                used_vehicle_indices.add(vehicle_index)
                print(
                    f"[incident] saved {incident.get('_id', '(no id)')} "
                    f"plate={payload['plateNumber'] or 'unread'} "
                    f"smoke={smoke.confidence:.0%} "
                    f"association={association_confidence:.0%}"
                )

            if show_preview:
                cv2.imshow("Vehicle smoke monitor (q to quit)", annotated)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            if snapshot_session is not None:
                time.sleep(float(os.getenv("POLL_INTERVAL", "0.2")))
    finally:
        if capture is not None:
            capture.release()
        if snapshot_session is not None:
            snapshot_session.close()
        if show_preview:
            cv2.destroyAllWindows()


def main():
    from dotenv import load_dotenv

    load_dotenv(ROOT / ".env")
    parser = argparse.ArgumentParser(
        description="Detect visible vehicle smoke, associate a vehicle, and save evidence."
    )
    parser.add_argument(
        "--source",
        default=os.getenv("CAMERA_SOURCE", ""),
        help="Video file, camera index, or authorized camera stream URL",
    )
    parser.add_argument("--no-preview", action="store_true")
    args = parser.parse_args()
    if not args.source:
        parser.error("Set CAMERA_SOURCE or pass --source.")

    run(
        source=_source_value(args.source),
        camera_id=os.getenv("CAMERA_ID", "camera-1"),
        location=os.getenv("CAMERA_LOCATION", "Unspecified location"),
        backend_url=os.getenv("BACKEND_URL", "http://localhost:5000"),
        cooldown=float(os.getenv("SNAPSHOT_COOLDOWN", "3")),
        show_preview=not args.no_preview,
    )


if __name__ == "__main__":
    main()