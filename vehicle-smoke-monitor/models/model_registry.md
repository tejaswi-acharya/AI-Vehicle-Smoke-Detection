# Model registry

| Component | Project path | Classes / purpose | Status |
|---|---|---|---|
| Smoke and smoking-vehicle detector | `models/weights/smoke_best.pt` | `smoke`, `smoking_vehicle` | Integrated from `MyModelDhuwafic` |
| Number-plate detector | `models/plate_detection/` | ANPR plate localization | Source/config integrated; trained weights unavailable |
| Character detector | `models/character_separation/` | Plate character localization | Source/config integrated; trained weights unavailable |
| Character recognizer | `models/character_recognition/` | Nepali plate character OCR | Source integrated; `.h5` trained weights unavailable |

ANPR weights are optional at runtime. See the project README for the required
file names and destinations.