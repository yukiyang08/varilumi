"""Convert linear EXR light layers into compact WebP files for the web compositor.

Encoding (decoded in src/render/compositor.ts):
    y   = L / (1 + L)          # reversible Reinhard squeeze, keeps lamp highlights (L >> 1)
    enc = y ** (1 / 2.2)       # gamma for better precision in the darks (1% night light)
    decode: y = enc ** 2.2 ; L = y / (1 - y)

Also writes layers.json with each layer's mean luminance (used for eye adaptation).

Usage (bpy venv python, which has numpy + Pillow):
  python blender/encode_layers.py blender/out/final/living public/renders/living [--width 1500]
"""
import json
import os
import sys

import numpy as np
from PIL import Image


def read_exr(path):
    import bpy
    img = bpy.data.images.load(os.path.abspath(path))
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return np.flipud(px.reshape(h, w, 4)[:, :, :3])


def encode(lin):
    lin = np.clip(lin, 0, None)
    y = lin / (1.0 + lin)
    enc = np.power(y, 1 / 2.2)
    return (np.clip(enc, 0, 1) * 255 + 0.5).astype(np.uint8)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    width = int(sys.argv[sys.argv.index("--width") + 1]) if "--width" in sys.argv else None
    os.makedirs(dst, exist_ok=True)
    meta = {"layers": {}}
    for f in sorted(os.listdir(src)):
        if not f.endswith(".exr") or f == "check.exr":
            continue
        name = f[:-4]
        lin = read_exr(os.path.join(src, f))
        lum = float((lin @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)).mean())
        im = Image.fromarray(encode(lin))
        if width and im.width != width:
            im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
        out = os.path.join(dst, f"{name}.webp")
        im.save(out, "WEBP", quality=92, method=6)
        meta["layers"][name] = {"meanLum": round(lum, 5)}
        meta["width"], meta["height"] = im.width, im.height
        print(f"{out}  {os.path.getsize(out) // 1024}KB  meanLum={lum:.4f}")
    with open(os.path.join(dst, "layers.json"), "w") as fh:
        json.dump(meta, fh, indent=2)


if __name__ == "__main__":
    main()
