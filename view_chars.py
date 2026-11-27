from pathlib import Path

import cv2
import numpy as np

from char_preprocess import preprocess_char

OUT_DIR = Path(__file__).resolve().parent / "outputs"
S = 96  # display size

top, bottom = [], []
for i in range(7):
    crop = cv2.imread(str(OUT_DIR / f"char_{i}.png"))
    seen = preprocess_char(crop).reshape(32, 32).numpy().astype(np.uint8)
    top.append(cv2.resize(crop, (S, S)))
    bottom.append(cv2.cvtColor(cv2.resize(seen, (S, S), interpolation=cv2.INTER_NEAREST),
                               cv2.COLOR_GRAY2BGR))

montage = np.vstack([np.hstack(top), np.hstack(bottom)])
cv2.imwrite(str(OUT_DIR / "what_cnn_sees.png"), montage)
print("saved outputs/what_cnn_sees.png")