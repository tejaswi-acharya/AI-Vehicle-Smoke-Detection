import cv2
import torch

from ai.anpr.box_utils import remove_doubles, sort_reading_order
from ai.anpr.char_preprocess import preprocess_char
from ai.anpr.model_loader import load_models
from pytorch_YOLOv4.tool.torch_utils import do_detect


LABELS = [str(i) for i in range(10)] + ["ba", "pa", "cha"]


def _detect(model, image, size, confidence, use_cuda):
    resized = cv2.resize(image, (size, size))
    rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
    return do_detect(model, rgb, confidence, 0.6, use_cuda=use_cuda)[0]


def detect_plate_and_read(vehicle_image, models=None):
    """Detect the best plate in a vehicle crop and OCR its characters."""
    models = models or load_models()
    use_cuda = models["device"].type == "cuda"
    height, width = vehicle_image.shape[:2]

    plates = _detect(models["plate_detector"], vehicle_image, 512, 0.4, use_cuda)
    if not plates:
        return None

    candidates = []
    for plate in sorted(plates, key=lambda box: float(box[4]), reverse=True):
        x1n, y1n, x2n, y2n = (float(value) for value in plate[:4])
        pad_x = (x2n - x1n) * 0.05
        pad_y = (y2n - y1n) * 0.05
        x1 = max(int((x1n - pad_x) * width), 0)
        y1 = max(int((y1n - pad_y) * height), 0)
        x2 = min(int((x2n + pad_x) * width), width)
        y2 = min(int((y2n + pad_y) * height), height)
        plate_image = vehicle_image[y1:y2, x1:x2].copy()
        if plate_image.size == 0:
            continue

        raw_characters = _detect(
            models["character_detector"], plate_image, 256, 0.1, use_cuda
        )
        plate_height, plate_width = plate_image.shape[:2]
        characters = [
            [
                max(int(box[0] * plate_width), 0),
                max(int(box[1] * plate_height), 0),
                min(int(box[2] * plate_width), plate_width),
                min(int(box[3] * plate_height), plate_height),
                float(box[4]),
            ]
            for box in raw_characters
        ]
        characters = sort_reading_order(remove_doubles(characters))
        text = []
        confidences = []
        for x1c, y1c, x2c, y2c, _ in characters:
            character_image = plate_image[y1c:y2c, x1c:x2c]
            if character_image.size == 0:
                continue
            character_tensor = preprocess_char(character_image).to(models["device"])
            with torch.no_grad():
                probabilities = models["character_recognizer"](character_tensor)[0]
            class_id = int(probabilities.argmax().item())
            text.append(LABELS[class_id])
            confidences.append(float(probabilities[class_id].item()))

        candidates.append(
            {
                "plate_number": "".join(text) or None,
                "confidence": (
                    sum(confidences) / len(confidences) if confidences else None
                ),
                "image": plate_image,
                "detector_confidence": float(plate[4]),
            }
        )

    if not candidates:
        return None
    return max(
        candidates,
        key=lambda item: (
            item["plate_number"] is not None,
            item["detector_confidence"],
        ),
    )
