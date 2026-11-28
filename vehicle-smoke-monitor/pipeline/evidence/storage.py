from pathlib import Path
from uuid import uuid4

import cv2


def _write_image(path: Path, image):
    if not cv2.imwrite(str(path), image, [int(cv2.IMWRITE_JPEG_QUALITY), 92]):
        raise OSError(f"Could not save evidence image: {path}")


def save_incident_evidence(frame, annotated_frame, vehicle_box, plate_image, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    incident_id = uuid4().hex

    height, width = frame.shape[:2]
    x1, y1, x2, y2 = (int(value) for value in vehicle_box)
    x1, y1 = max(x1, 0), max(y1, 0)
    x2, y2 = min(x2, width), min(y2, height)
    if x2 <= x1 or y2 <= y1:
        raise ValueError("Vehicle detection produced an invalid evidence crop")

    snapshot_name = f"snapshot_{incident_id}.jpg"
    vehicle_name = f"vehicle_{incident_id}.jpg"
    _write_image(directory / snapshot_name, annotated_frame)
    _write_image(directory / vehicle_name, frame[y1:y2, x1:x2])

    plate_name = None
    if plate_image is not None:
        plate_name = f"plate_{incident_id}.jpg"
        _write_image(directory / plate_name, plate_image)

    media = {
        "snapshotImage": snapshot_name,
        "vehicleImage": vehicle_name,
    }
    if plate_name:
        media["plateImage"] = plate_name
    return media