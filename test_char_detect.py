from pathlib import Path

import cv2

from ai.anpr.model_loader import load_models
from pytorch_YOLOv4.tool.torch_utils import do_detect

BASE = Path(__file__).resolve().parent
IMG_PATH = BASE / "samples" / "photo1.jpg"
OUT_DIR = BASE / "outputs"
OUT_DIR.mkdir(exist_ok=True)

img = cv2.imread(str(IMG_PATH))
h, w = img.shape[:2]
models = load_models()


def detect(model, bgr, size, conf):
    rgb = cv2.cvtColor(cv2.resize(bgr, (size, size)), cv2.COLOR_BGR2RGB)
    return do_detect(model, rgb, conf, 0.6, use_cuda=1)[0]


# 1. find plate
plates = detect(models["plate_detector"], img, 512, 0.4)
if not plates:
    raise SystemExit("no plate found")
best = max(plates, key=lambda b: float(b[4]))

# 2. crop plate with small padding
pad = 0.05
bw, bh = (best[2] - best[0]), (best[3] - best[1])
x1 = max(int((best[0] - pad * bw) * w), 0)
y1 = max(int((best[1] - pad * bh) * h), 0)
x2 = min(int((best[2] + pad * bw) * w), w)
y2 = min(int((best[3] + pad * bh) * h), h)
crop = img[y1:y2, x1:x2].copy()
cv2.imwrite(str(OUT_DIR / "plate1_crop.jpg"), crop)
ch, cw = crop.shape[:2]
print("crop size:", cw, "x", ch)

# 3. find characters in the crop
chars = detect(models["character_detector"], crop, 256, 0.1)
print("characters found:", len(chars))

vis = crop.copy()
for b in chars:
    cx1, cy1, cx2, cy2 = int(b[0] * cw), int(b[1] * ch), int(b[2] * cw), int(b[3] * ch)
    print("char box:", [cx1, cy1, cx2, cy2], "conf:", round(float(b[4]), 2))
    cv2.rectangle(vis, (cx1, cy1), (cx2, cy2), (0, 0, 255), 1)

vis = cv2.resize(vis, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
cv2.imwrite(str(OUT_DIR / "plate1_chars.jpg"), vis)
print("saved outputs: plate1_crop.jpg, plate1_chars.jpg")