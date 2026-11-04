"""Bedroom: one round ceiling light (group 'ceiling')."""
import math
import common as C

W, D, H = 3.8, 5.0, 2.7


def build():
    C.reset_scene()
    wall = C.mat_principled("WallPaint", (0.80, 0.78, 0.75), rough=0.92)
    accent = C.mat_principled("AccentWall", (0.42, 0.47, 0.50), rough=0.95)   # calm blue-grey bedroom wall
    ceil = C.mat_principled("CeilingPaint", (0.86, 0.86, 0.85), rough=0.95)
    floor = C.mat_wood("OakFloor", base=(0.46, 0.32, 0.19))
    C.room(W, D, H, wall, ceil, floor, back_mat=accent)

    # ---- bed (headboard against back wall)
    wood = C.mat_wood("BedWood", base=(0.22, 0.14, 0.08), plank=0.6, rough=0.35)
    linen = C.mat_fabric("Linen", (0.86, 0.85, 0.82))
    throw = C.mat_fabric("Throw", (0.70, 0.56, 0.40))
    by = D - 1.1
    C.box("BedFrame", (1.7, 2.1, 0.22), (0, by, 0.16), wood, bevel=0.015)
    C.box("Headboard", (1.8, 0.08, 1.0), (0, D - 0.05, 0.6), C.mat_fabric("Headboard", (0.62, 0.58, 0.52)), bevel=0.04)
    C.box("Mattress", (1.62, 2.0, 0.22), (0, by, 0.46), linen, bevel=0.05)
    C.box("Duvet", (1.7, 1.35, 0.08), (0, by - 0.36, 0.6), linen, bevel=0.04)
    C.box("Throw", (1.72, 0.45, 0.085), (0, by - 0.78, 0.615), throw, bevel=0.03)
    for i, x in enumerate((-0.42, 0.42)):
        C.box(f"Pillow{i}", (0.62, 0.36, 0.14), (x, D - 0.32, 0.66), linen, bevel=0.06, rot=(math.radians(-25), 0, 0))

    # ---- nightstands with (unlit, decorative) lamps
    ns = C.mat_principled("NightStand", (0.84, 0.83, 0.80), rough=0.35)
    lamp = C.mat_principled("LampShade", (0.92, 0.9, 0.85), rough=0.8)
    for s in (-1, 1):
        x = s * 1.22
        C.box("NightStand", (0.48, 0.42, 0.5), (x, D - 0.25, 0.25), ns, bevel=0.008)
        C.cyl("LampBase", 0.05, 0.25, (x, D - 0.25, 0.63), C.mat_principled("Brass", (0.8, 0.6, 0.3), rough=0.3, metallic=1.0))
        C.cyl("LampShade", 0.13, 0.2, (x, D - 0.25, 0.85), lamp)

    # ---- wardrobe on the right wall
    wd = C.mat_principled("Wardrobe", (0.80, 0.79, 0.76), rough=0.4)
    C.box("Wardrobe", (0.6, 1.6, 2.3), (W / 2 - 0.3, 1.3, 1.15), wd, bevel=0.006)
    handle = C.mat_principled("Handle", (0.1, 0.1, 0.1), rough=0.3, metallic=1.0)
    for dy in (-0.05, 0.05):
        C.box("Handle", (0.02, 0.012, 0.3), (W / 2 - 0.605, 1.3 + dy, 1.1), handle)

    # ---- window behind sheer curtains on the left wall (ambient only)
    C.window_with_curtains(-W / 2, 2.4, 1.45, 1.3, 1.5, H, sky_strength=0.3)

    C.box("Rug", (2.2, 1.4, 0.012), (0, by - 1.3, 0.006), C.mat_fabric("Rug", (0.66, 0.62, 0.57), rough=0.95))

    # ---- fixture
    C.ceiling_light("Ceil", 0, 2.6, H, "ceiling")

    C.world((0.004, 0.005, 0.009), 1.0)
    C.camera((0.3, 0.35, 1.45), (-0.05, D, 1.62), lens=16.0)
