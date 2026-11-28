import tempfile
import unittest
from pathlib import Path

import cv2
import numpy as np

from pipeline.evidence.storage import save_incident_evidence


class EvidenceStorageTests(unittest.TestCase):
    def test_saves_snapshot_vehicle_and_plate_images(self):
        frame = np.zeros((80, 120, 3), dtype=np.uint8)
        with tempfile.TemporaryDirectory() as temporary_directory:
            media = save_incident_evidence(
                frame,
                frame,
                (10, 10, 70, 60),
                frame[20:40, 30:80],
                temporary_directory,
            )

            self.assertEqual(
                set(media),
                {"snapshotImage", "vehicleImage", "plateImage"},
            )
            for filename in media.values():
                image_path = Path(temporary_directory) / filename
                self.assertTrue(image_path.is_file())
                self.assertIsNotNone(cv2.imread(str(image_path)))


if __name__ == "__main__":
    unittest.main()
