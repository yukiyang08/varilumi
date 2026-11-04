"""Place one fixture type into a room layout (see rooms.Layout). Light group name = fixture id."""
import math

import bpy
import common as C

COVE_DROP = 0.30      # soffit drops 30 cm below the main ceiling
COVE_WIDTH = 0.45     # soffit depth from the wall
COVE_LIP = 0.08       # upturned lip that hides the strip


def place(fixture, L):
    if fixture == "recessed":
        for i, (x, y) in enumerate(L.recessed):
            C.recessed_light(f"Rec{i}", x, y, L.H, "recessed")
    elif fixture == "track":
        for r, ((x0, x1, y), heads) in enumerate(L.rails):
            C.track_rail(f"Rail{r}", x0, x1, y, L.H)
            for i, (hx, target, beam) in enumerate(heads):
                C.track_head(f"Track{r}_{i}", (hx, y, L.H - 0.12), target, "track", beam_deg=beam)
    elif fixture == "ceiling":
        x, y, d, e = L.ceiling
        C.ceiling_light("Ceil", x, y, L.H, "ceiling", diameter=d, energy=e)
    elif fixture == "cove":
        cove(L.W, L.D, L.H)
    else:
        raise ValueError(fixture)


def cove(W, D, H, group="cove"):
    """Taiwanese-style cove (間照): a soffit drops around the room's edge; on its inner edge an upturned lip
    hides an LED strip / T5 batten that throws light up onto the main ceiling."""
    ceil_mat = bpy.data.materials["CeilingPaint"]
    z0 = H - COVE_DROP                 # soffit underside
    t = 0.10                           # soffit board thickness
    b = COVE_WIDTH
    # soffit boards (the camera wall y=0 too, so the room reads as a full ring when reflected)
    C.box("SoffitBack", (W, b, t), (0, D - b / 2, z0 + t / 2), ceil_mat)
    C.box("SoffitFront", (W, b, t), (0, b / 2, z0 + t / 2), ceil_mat)
    C.box("SoffitLeft", (b, D - 2 * b, t), (-W / 2 + b / 2, D / 2, z0 + t / 2), ceil_mat)
    C.box("SoffitRight", (b, D - 2 * b, t), (W / 2 - b / 2, D / 2, z0 + t / 2), ceil_mat)
    # upturned lips on the inner edge
    lt = 0.02
    zl = z0 + t + COVE_LIP / 2
    C.box("LipBack", (W - 2 * b, lt, COVE_LIP), (0, D - b + lt / 2, zl), ceil_mat)
    C.box("LipFront", (W - 2 * b, lt, COVE_LIP), (0, b - lt / 2, zl), ceil_mat)
    C.box("LipLeft", (lt, D - 2 * b, COVE_LIP), (-W / 2 + b - lt / 2, D / 2, zl), ceil_mat)
    C.box("LipRight", (lt, D - 2 * b, COVE_LIP), (W / 2 - b + lt / 2, D / 2, zl), ceil_mat)
    # the strip: a thin emissive bar just behind each lip, plus a long area light aimed up and inward
    strip = C.mat_emissive("CoveStrip", group, strength=14.0)
    zs = z0 + t + 0.012
    inset = 0.06
    runs = [
        ("Back", (W - 2 * b, 0.012), (0, D - b - inset, zs), (0, 1)),
        ("Front", (W - 2 * b, 0.012), (0, b + inset, zs), (0, -1)),
        ("Left", (0.012, D - 2 * b), (-W / 2 + b + inset, D / 2, zs), (-1, 0)),
        ("Right", (0.012, D - 2 * b), (W / 2 - b - inset, D / 2, zs), (1, 0)),
    ]
    for name, size, loc, (nx, ny) in runs:
        C.box(f"Strip{name}", (size[0], size[1], 0.006), loc, strip)
        length = max(size)
        along_x = size[0] > size[1]
        # Area lights emit along local -Z. Euler (pi, 0, 0) points it straight up; then lean it
        # `tilt` toward the room centre (away from the wall at (nx, ny)) so the glow spreads over the ceiling.
        tilt = math.radians(25)
        rot = (math.pi + tilt * ny, 0, 0) if ny else (math.pi, -tilt * nx, 0)
        C.add_light(f"Cove{name}", "AREA", (loc[0], loc[1], loc[2] + 0.01), rot, 22.0 * length, group,
                    shape="RECTANGLE", size=length if along_x else 0.03, size_y=0.03 if along_x else length,
                    spread=math.radians(150))
