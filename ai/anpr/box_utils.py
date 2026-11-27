def overlap_ratio(a, b):
    """Overlap area divided by the SMALLER box area. 0 = apart, 1 = one inside other."""
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(ix2 - ix1, 0) * max(iy2 - iy1, 0)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    smaller = min(area_a, area_b)
    return inter / smaller if smaller > 0 else 0.0


def remove_doubles(boxes, threshold=0.5):
    """boxes: list of [x1, y1, x2, y2, conf]. Keep best conf, drop overlapping doubles."""
    kept = []
    for b in sorted(boxes, key=lambda b: b[4], reverse=True):
        if all(overlap_ratio(b, k) < threshold for k in kept):
            kept.append(b)
    return kept

def sort_reading_order(boxes):
    """boxes: [x1, y1, x2, y2, conf]. Rows top to bottom, each row left to right."""
    if len(boxes) < 2:
        return list(boxes)
    by_y = sorted(boxes, key=lambda b: (b[1] + b[3]) / 2)
    centers = [(b[1] + b[3]) / 2 for b in by_y]
    heights = sorted(b[3] - b[1] for b in boxes)
    median_h = heights[len(heights) // 2]
    gaps = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]
    biggest = max(range(len(gaps)), key=lambda i: gaps[i])
    if gaps[biggest] > 0.5 * median_h:
        rows = [by_y[:biggest + 1], by_y[biggest + 1:]]
    else:
        rows = [by_y]
    out = []
    for row in rows:
        out.extend(sorted(row, key=lambda b: b[0]))
    return out