from dataclasses import dataclass
from pathlib import Path

from ultralytics import YOLO


@dataclass(frozen=True)
class Detection:
    label: str
    confidence: float
    box: tuple[float, float, float, float]


class SmokeDetector:
    def __init__(self, model_path: Path, confidence: float, image_size: int):
        if not model_path.is_file():
            raise FileNotFoundError(f"Smoke model not found: {model_path}")
        self.model = YOLO(str(model_path))
        self.confidence = confidence
        self.image_size = image_size

    def process(self, frame):
        result = self.model.predict(
            frame,
            conf=self.confidence,
            imgsz=self.image_size,
            verbose=False,
        )[0]
        names = result.names
        detections = []
        if result.boxes is not None:
            for box in result.boxes:
                class_id = int(box.cls[0].item())
                label = names[class_id] if isinstance(names, dict) else names[class_id]
                coordinates = tuple(float(value) for value in box.xyxy[0].tolist())
                detections.append(
                    Detection(
                        label=str(label).strip().lower().replace(" ", "_"),
                        confidence=float(box.conf[0].item()),
                        box=coordinates,
                    )
                )
        return detections, result.plot()