# Vehicle Smoke Monitor

This local prototype combines the trained YOLO smoke detector with a video/camera
pipeline, evidence snapshots, an incident API, and a human-review dashboard.

## What it does

- Detects the smoke and smoking-vehicle classes in video or authorized live camera
  footage using the checkpoint in `models/weights/smoke_best.pt`.
- Associates a smoke box with the nearest `smoking_vehicle` detection and records
  the match confidence for review.
- Saves the annotated frame and vehicle crop in `storage/incidents`, then records
  the incident, timestamp, camera/location metadata, and evidence paths in MongoDB.
- Runs the supplied ANPR detector/OCR when its trained weights are available.
  Until then, incidents are still saved with an unread plate and a startup warning.
- Serves a dashboard at the backend root for incident filtering and human review.

Smoke-to-vehicle matching is a proximity heuristic, not proof of causation.
Visible smoke detection is not an emissions test; incidents are created as
**pending** and require human verification. The system does not issue fines.

## Requirements

- Windows, Python 3.10+, Node.js 18+, and MongoDB 7+ (or Docker Desktop)
- A camera/video view where both exhaust smoke and vehicle are visible

### Start MongoDB and the backend

From the project directory:

```powershell
Copy-Item .env.example .env
docker compose up -d mongo
npm --prefix backend install
npm --prefix backend start
```

Open `http://localhost:5000`. To run MongoDB without Docker, start a local MongoDB
service; `MONGO_URI` can point to another authorized MongoDB instance. The backend
loads `.env` from the project root first, then `backend/.env` for any settings not
already defined.

### Install Python dependencies and run detection

Create a virtual environment and install the dependencies. Install the PyTorch
build appropriate for your CPU/GPU first if the default pip build is unsuitable:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
$env:CAMERA_SOURCE = "C:\path\to\road-video.mp4"
python -m pipeline.main
```

`CAMERA_SOURCE` may be a video path, a camera index such as `0`, an authorized
video stream URL, or a JPEG/PNG snapshot URL such as an IP Webcam `/shot.jpg`
endpoint. Alternatively, pass `--source "C:\path\to\road-video.mp4"`.
Press `q` to stop the preview; add `--no-preview` for headless operation.
To show an IP Webcam stream in the dashboard, set `CAMERA_SOURCE` in the
project-root `.env` to its `/video` URL, start the backend and camera pipeline,
and open `http://localhost:5000` (not the dashboard file directly). The
dashboard proxies the configured MJPEG stream; `/shot.jpg` displays refreshed
still images instead of continuous video. For example:

```text
CAMERA_SOURCE=http://192.168.1.42:8080/video
CAMERA_ID=phone-camera-1
```

Replace the example phone IP and port with the server address shown by the
IP Webcam app. The same `CAMERA_SOURCE` is used by the dashboard stream and
the Python detection pipeline.

Configuration can be set in the project-root `.env` file:

| Variable | Default | Description |
|---|---|---|
| `CAMERA_SOURCE` | empty | Video path, camera index, or camera stream URL |
| `CAMERA_ID` | `camera-1` | Identifier stored with each incident |
| `CAMERA_LOCATION` | `Unspecified location` | Camera location label |
| `CAMERA_LAT`, `CAMERA_LNG` | empty | Optional coordinates |
| `BACKEND_URL` | `http://localhost:5000` | Incident API base URL |
| `SMOKE_CONFIDENCE` | `0.5` | Minimum YOLO confidence |
| `YOLO_IMAGE_SIZE` | `640` | Inference image size |
| `SNAPSHOT_COOLDOWN` | `3` | Minimum seconds between incident snapshots |
| `POLL_INTERVAL` | `0.2` | Delay between requests to a still-image camera URL |

## Number-plate model files

ANPR source code and model configuration from `AI-Vehicle-Smoke-Detection` are
included. The source project did not contain the trained ANPR weight files.
For OCR, place the corresponding trained files at:

- `models/plate_detection/ANNPR.weights`
- `models/character_separation/Character_separation.weights`
- `models/character_recognition/model_lenet_200_25.h5`

The pipeline reports any missing files and continues to save smoke incidents.
Without them, `plateNumber` remains unread; the dashboard allows an authorized
reviewer to enter a corrected plate.

## Evidence and data

Each incident stores JPEG evidence in `storage/incidents` and references those
files from the database. The API serves evidence from `/media/<filename>`.
Camera access and footage must be authorized, and local privacy/data-use
requirements should be followed.

## Validation

Run the backend tests with `npm --prefix backend test` and the Python unit tests
with `python -m unittest discover -s tests`.