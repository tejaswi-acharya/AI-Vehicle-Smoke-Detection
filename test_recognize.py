from pathlib import Path

import cv2
import torch

from ai.anpr.box_utils import remove_doubles, sort_reading_order
from ai.anpr.char_preprocess import preprocess_char
from ai.anpr.model_loader import load_models
from pytorch_YOLOv4.tool.torch_utils import do_detect

BASE = Path(__file__).resolve().parent
IMG_PATH = BASE / "samples" / "photo1.jpg"
OUT_DIR = BASE / "outputs"
LABELS = [str(i) for i in range(10)] + ["ba", "pa", "cha"]

img = cv2.imread(str(IMG_PATH))
h, w = img.shape[:2]
models = load_models()
device = models["device"]


def detect(model, bgr, size, conf):
    rgb = cv2.cvtColor(cv2.resize(bgr, (size, size)), cv2.COLOR_BGR2RGB)
    return do_detect(model, rgb, conf, 0.6, use_cuda=1)[0]


# plate
plates = detect(models["plate_detector"], img, 512, 0.4)
best = max(plates, key=lambda b: float(b[4]))
pad = 0.05
bw, bh = best[2] - best[0], best[3] - best[1]
x1 = max(int((best[0] - pad * bw) * w), 0)
y1 = max(int((best[1] - pad * bh) * h), 0)
x2 = min(int((best[2] + pad * bw) * w), w)
y2 = min(int((best[3] + pad * bh) * h), h)
crop = img[y1:y2, x1:x2].copy()
ch, cw = crop.shape[:2]

# characters
raw = detect(models["character_detector"], crop, 256, 0.1)
boxes = [[int(b[0] * cw), int(b[1] * ch), int(b[2] * cw), int(b[3] * ch), float(b[4])]
         for b in raw]
boxes = sort_reading_order(remove_doubles(boxes))

# read each character
print("\nchar  label   cnn_conf   top3")
for i, (cx1, cy1, cx2, cy2, dconf) in enumerate(boxes):
    char_img = crop[max(cy1, 0):cy2, max(cx1, 0):cx2]
    x = preprocess_char(char_img).to(device)
    with torch.no_grad():
        p = models["character_recognizer"](x)[0].cpu()
    top = torch.topk(p, 3)
    top3 = ", ".join(f"{LABELS[int(k)]}:{float(v):.2f}" for v, k in zip(top.values, top.indices))
    print(f"{i:>3}   {LABELS[int(top.indices[0])]:<6}  {float(top.values[0]):.2f}       {top3}")
    cv2.imwrite(str(OUT_DIR / f"char_{i}.png"), char_img)