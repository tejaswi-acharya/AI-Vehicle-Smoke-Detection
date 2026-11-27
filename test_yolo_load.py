from pathlib import Path

import torch
from pytorch_YOLOv4.tool.darknet2pytorch import Darknet

BASE = Path(__file__).resolve().parent

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("device:", device)

jobs = {
    "plate": (
        BASE / "models/plate_detection/ANNPR.cfg",
        BASE / "models/plate_detection/ANNPR.weights",
    ),
      "chars": (
        BASE / "models/character_separation/Character_separation.cfg",
        BASE / "models/character_separation/Character_separation.weights",
    ),
}

for name, (cfg, wts) in jobs.items():
    print(f"\nloading {name}...")
    m = Darknet(str(cfg))
    m.load_weights(str(wts))
    m.to(device).eval()
    print(name, "OK, input size:", m.width, "x", m.height)