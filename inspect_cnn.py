from pathlib import Path
import h5py

path = Path(__file__).resolve().parent / "models/character_recognition/model_lenet_200_25.h5"

def show(name, obj):
    if isinstance(obj, h5py.Dataset):
        print(name, obj.shape)

with h5py.File(path, "r") as f:
    print("top keys:", list(f.keys()))
    f.visititems(show)