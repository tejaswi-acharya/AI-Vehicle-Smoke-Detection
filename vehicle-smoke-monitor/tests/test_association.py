import unittest
from dataclasses import dataclass

from pipeline.association.matcher import (
    associate_smoke_to_vehicles,
    association_score,
)


@dataclass
class Vehicle:
    box: tuple[float, float, float, float]
    confidence: float


class AssociationTests(unittest.TestCase):
    def test_overlapping_smoke_and_vehicle_score_as_direct_match(self):
        self.assertEqual(
            association_score((10, 10, 40, 35), (20, 20, 90, 70)),
            1.0,
        )

    def test_distant_vehicle_is_not_associated(self):
        self.assertIsNone(
            association_score((0, 0, 15, 15), (300, 300, 400, 360))
        )

    def test_closest_plausible_vehicle_is_selected(self):
        vehicles = [
            Vehicle((0, 0, 100, 50), 0.8),
            Vehicle((180, 0, 280, 50), 0.95),
        ]
        match = associate_smoke_to_vehicles((65, 10, 90, 35), vehicles)

        self.assertIsNotNone(match)
        index, vehicle, score = match
        self.assertEqual(index, 0)
        self.assertIs(vehicle, vehicles[0])
        self.assertGreater(score, 0)


if __name__ == "__main__":
    unittest.main()