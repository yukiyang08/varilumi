"""Build picker thumbnails from the encoded light layers in public/renders/<room>-<fixture>/.

Each thumbnail is the room with its lights on at 4000K, composited exactly like src/render/compositor.ts
(decode → base·0.45 + 0.5·6000K + 0.5·3000K → exposure normalisation → ACES → sRGB).
Writes public/thumbs/<room>-<fixture>.webp and public/thumbs/<room>.webp (the recessed-light version).

  python3 scripts/make_thumbs.py
"""
import json
import os

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..", "public")
BASE_WEIGHT, TARGET_LUM = 0.45, 0.42
SIZE = (480, 320)


def decode(path):
    e = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32) / 255.0
    y = np.minimum(np.power(e, 2.2), 0.996)
    return y / (1.0 - y)


def aces(x):
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    return np.clip((x * (a * x + b)) / (x * (c * x + d) + e), 0, 1)


def srgb(c):
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def main():
    rd = os.path.join(ROOT, "renders")
    out = os.path.join(ROOT, "thumbs")
    os.makedirs(out, exist_ok=True)
    for d in sorted(os.listdir(rd)):
        if "-" not in d:
            continue
        room, fixture = d.split("-", 1)
        meta = json.load(open(os.path.join(rd, d, "layers.json")))["layers"]
        base = decode(os.path.join(rd, d, "base.webp"))
        l6 = decode(os.path.join(rd, d, f"{fixture}_6000.webp"))
        l3 = decode(os.path.join(rd, d, f"{fixture}_3000.webp"))
        lin = BASE_WEIGHT * base + 0.5 * l6 + 0.5 * l3
        ref = BASE_WEIGHT * meta["base"]["meanLum"] + meta[f"{fixture}_6000"]["meanLum"]
        expo = (TARGET_LUM / ref) ** 0.85
        img = srgb(aces(lin * expo * 0.8))
        im = Image.fromarray((np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)).resize(SIZE, Image.LANCZOS)
        im.save(os.path.join(out, f"{d}.webp"), "WEBP", quality=82)
        if fixture == "recessed":
            im.save(os.path.join(out, f"{room}.webp"), "WEBP", quality=82)
        print("thumb", d)


if __name__ == "__main__":
    main()
