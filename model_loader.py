from pathlib import Path

import torch

from pytorch_YOLOv4.tool.darknet2pytorch import Darknet
from cnn_model import load_cnn

BASE_DIR = Path(__file__).resolve().parent
MODELS = BASE_DIR / "models"

PLATE_CFG = MODELS / "plate_detection" / "ANNPR.cfg"
PLATE_WEIGHTS = MODELS / "plate_detection" / "ANNPR.weights"
PLATE_NAMES = MODELS / "plate_detection" / "ANNPR.names"

CHAR_CFG = MODELS / "character_separation" / "Character_separation.cfg"
CHAR_WEIGHTS = MODELS / "character_separation" / "Character_separation.weights"

CNN_H5 = MODELS / "character_recognition" / "model_lenet_200_25.h5"

_cache = None  # models load once, then reuse


def check_model_files():
    required = [PLATE_CFG, PLATE_WEIGHTS, PLATE_NAMES,
                CHAR_CFG, CHAR_WEIGHTS, CNN_H5]
    missing = [str(p) for p in required if not p.is_file()]
    if missing:
        raise FileNotFoundError("Missing model files:\n" + "\n".join(missing))


def _load_yolo(cfg, weights, device):
    model = Darknet(str(cfg))
    model.load_weights(str(weights))
    return model.to(device).eval()


def load_models():
    """Load all three models once. Later calls return the same models."""
    global _cache
    if _cache is not None:
        return _cache

    check_model_files()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Loading models on: {device}")

    _cache = {
        "plate_detector": _load_yolo(PLATE_CFG, PLATE_WEIGHTS, device),
        "character_detector": _load_yolo(CHAR_CFG, CHAR_WEIGHTS, device),
        "character_recognizer": load_cnn(device),
        "device": device,
    }
    print("All three models loaded.")
    return _cache


if __name__ == "__main__":
    load_models()