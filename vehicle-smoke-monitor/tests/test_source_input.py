import unittest

from pipeline.main import _is_snapshot_url


class SourceInputTests(unittest.TestCase):
    def test_recognizes_http_snapshot_endpoints_with_query_parameters(self):
        self.assertTrue(_is_snapshot_url("http://camera.local/shot.jpg?token=abc"))
        self.assertTrue(_is_snapshot_url("https://camera.local/frame.png"))

    def test_does_not_treat_video_streams_or_camera_indices_as_snapshots(self):
        self.assertFalse(_is_snapshot_url("http://camera.local/video"))
        self.assertFalse(_is_snapshot_url(0))


if __name__ == "__main__":
    unittest.main()
