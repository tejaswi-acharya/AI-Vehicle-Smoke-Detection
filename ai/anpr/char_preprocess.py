import cv2
import numpy as np
import torch


def preprocess_char(bgr_crop):
    """Same steps as the original ANNPR processImage. Values stay 0 or 255."""
    gray = cv2.cvtColor(bgr_crop, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 125, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    blur = cv2.medianBlur(thresh, 3)
    small = cv2.resize(blur, (32, 32))
    # no /255 on purpose: the CNN was trained on 0/255 values
    return torch.from_numpy(small.astype(np.float32)).reshape(1, 1, 32, 32)