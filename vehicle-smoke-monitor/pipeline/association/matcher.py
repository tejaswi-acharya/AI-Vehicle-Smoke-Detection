import math
from collections.abc import Sequence


def association_score(
    smoke_box: Sequence[float], vehicle_box: Sequence[float]
) -> float | None:
    """Return a proximity score for a smoke box and candidate vehicle box."""
    sx1, sy1, sx2, sy2 = smoke_box
    vx1, vy1, vx2, vy2 = vehicle_box
    overlap_width = max(min(sx2, vx2) - max(sx1, vx1), 0.0)
    overlap_height = max(min(sy2, vy2) - max(sy1, vy1), 0.0)
    if overlap_width > 0 and overlap_height > 0:
        return 1.0

    smoke_center = ((sx1 + sx2) / 2, (sy1 + sy2) / 2)
    vehicle_center = ((vx1 + vx2) / 2, (vy1 + vy2) / 2)
    distance = math.dist(smoke_center, vehicle_center)
    vehicle_diagonal = math.hypot(max(vx2 - vx1, 0.0), max(vy2 - vy1, 0.0))
    maximum_distance = max(vehicle_diagonal * 1.25, 1.0)
    if distance >= maximum_distance:
        return None
    return 1.0 - distance / maximum_distance


def associate_smoke_to_vehicles(smoke_box, vehicles):
    """Choose the closest plausible vehicle, retaining its input index and score."""
    candidates = []
    for index, vehicle in enumerate(vehicles):
        score = association_score(smoke_box, vehicle.box)
        if score is not None:
            candidates.append((score, vehicle.confidence, index, vehicle))
    if not candidates:
        return None
    score, _, index, vehicle = max(candidates, key=lambda candidate: candidate[:2])
    return index, vehicle, score