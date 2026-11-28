from pathlib import Path

import h5py
import torch
import torch.nn as nn

CNN_H5 = Path(__file__).resolve().parents[2] / "models/character_recognition/model_lenet_200_25.h5"

class CharCNN(nn.Module):
    """Same layers as model_lenet_200_25.json. Input: (N, 1, 32, 32)."""

    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 60, 5)
        self.conv2 = nn.Conv2d(60, 60, 5)
        self.conv3 = nn.Conv2d(60, 30, 3)
        self.conv4 = nn.Conv2d(30, 30, 3)
        self.pool = nn.MaxPool2d(2)
        self.fc1 = nn.Linear(480, 500)
        self.fc2 = nn.Linear(500, 13)

    def forward(self, x):
        x = torch.relu(self.conv1(x))
        x = self.pool(torch.relu(self.conv2(x)))
        x = torch.relu(self.conv3(x))
        x = self.pool(torch.relu(self.conv4(x)))
        # Keras flattens as (H, W, C), so reorder first
        x = x.permute(0, 2, 3, 1).flatten(1)
        x = torch.relu(self.fc1(x))
        return torch.softmax(self.fc2(x), dim=1)  # dropout is off at inference


def load_cnn(device="cpu"):
    model = CharCNN()
    with h5py.File(CNN_H5, "r") as f:
        def conv(layer, name):
            k = torch.from_numpy(f[name][name]["kernel:0"][()]).permute(3, 2, 0, 1)
            b = torch.from_numpy(f[name][name]["bias:0"][()])
            layer.weight.data.copy_(k)
            layer.bias.data.copy_(b)

        def dense(layer, name):
            k = torch.from_numpy(f[name][name]["kernel:0"][()]).T
            b = torch.from_numpy(f[name][name]["bias:0"][()])
            layer.weight.data.copy_(k)
            layer.bias.data.copy_(b)

        conv(model.conv1, "conv2d")
        conv(model.conv2, "conv2d_1")
        conv(model.conv3, "conv2d_2")
        conv(model.conv4, "conv2d_3")
        dense(model.fc1, "dense")
        dense(model.fc2, "dense_1")
    return model.to(device).eval()


if __name__ == "__main__":
    device = "cuda" if torch.cuda.is_available() else "cpu"
    cnn = load_cnn(device)
    with torch.no_grad():
        out = cnn(torch.rand(2, 1, 32, 32, device=device))
    print("output shape:", tuple(out.shape))
    print("row sums:", out.sum(dim=1).tolist())