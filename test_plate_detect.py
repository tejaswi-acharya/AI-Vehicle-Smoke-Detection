from pathlib import Path

import cv2

from model_loader import load_models
from pytorch_YOLOv4.tool.torch_utils import do_detect

BASE = Path(__file__).resolve().parent
IMG_PATH = BASE / "samples" / "photo1.jpg"
OUT_DIR = BASE / "outputs"
OUT_DIR.mkdir(exist_ok=True)

img = cv2.imread(str(IMG_PATH))
if img is None:
    raise FileNotFoundError(f"Cannot read image: {IMG_PATH}")
h, w = img.shape[:2]
print("image size:", w, "x", h)

models = load_models()
detector = models["plate_detector"]

# model wants 512x512, RGB
resized = cv2.resize(img, (512, 512))
rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)

boxes = do_detect(detector, rgb, 0.4, 0.6, use_cuda=1)[0]
print("plates found:", len(boxes))

for b in boxes:
    print("raw box:", [round(float(v), 3) for v in b])
    x1, y1, x2, y2 = int(b[0] * w), int(b[1] * h), int(b[2] * w), int(b[3] * h)
    conf = float(b[4])
    cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
    cv2.putText(img, f"{conf:.2f}", (x1, max(y1 - 8, 15)),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

out_path = OUT_DIR / "plate1_detected.jpg"
cv2.imwrite(str(out_path), img)
print("saved:", out_path)