"""The four demo rooms (客廳 / 臥室 / 餐廳 / 書房) and where each fixture type goes in each of them.

`build(room, fixture)` builds one room with exactly one kind of fixture, registered as light group
`fixture` ('recessed' | 'track' | 'ceiling' | 'cove'), ready for render.py.
"""
import math
import random
from dataclasses import dataclass, field

import common as C
import fixtures as F

ROOMS = ("living", "bedroom", "dining", "study")
FIXTURES = ("recessed", "track", "ceiling", "cove")


@dataclass
class Layout:
    """Room size, camera, and the light plan for every fixture type."""
    W: float
    D: float
    H: float
    cam: tuple
    cam_target: tuple
    recessed: list                      # [(x, y)]
    rails: list                         # [((x0, x1, y), [(head_x, target_xyz, beam_deg)])]
    ceiling: tuple                      # (x, y, diameter, energy)
    window: tuple                       # (y_center, z_center, width, height)
    lens: float = 16.0
    extra: dict = field(default_factory=dict)


# ---------------------------------------------------------------- shared furniture
def _painting(name, x, y_wall, z, w, h, colors, scale=0.9, kind="RINGS"):
    frame = C.mat_principled(f"{name}Frame", (0.04, 0.04, 0.04), rough=0.4)
    C.box(f"{name}Frame", (w, 0.03, h), (x, y_wall - 0.015, z), frame, bevel=0.004)
    canvas = C.mat_principled(f"{name}Canvas", (0.8, 0.7, 0.55), rough=0.8)
    nt = canvas.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = kind
    wave.inputs["Scale"].default_value = scale
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 6.0
    wave.inputs["Detail Scale"].default_value = 2.5
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].color = (*colors[0], 1)
    els[1].color = (*colors[1], 1)
    mid = els.new(0.5)
    mid.color = (*colors[2], 1)
    nt.links.new(tc.outputs["Generated"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    C.box(f"{name}Canvas", (w - 0.06, 0.01, h - 0.06), (x, y_wall - 0.032, z), canvas)


def _plant(name, x, y, height=1.6, seed=4):
    pot = C.mat_principled(f"{name}Pot", (0.28, 0.27, 0.26), rough=0.7)
    C.cyl(f"{name}Pot", 0.17, 0.42, (x, y, 0.21), pot, bevel=0.01)
    leaf = C.mat_principled(f"{name}Leaf", (0.06, 0.16, 0.06), rough=0.55)
    stem = C.mat_principled(f"{name}Stem", (0.10, 0.07, 0.04), rough=0.7)
    C.cyl(f"{name}Stem", 0.012, height - 0.4, (x, y, 0.4 + (height - 0.4) / 2), stem)
    random.seed(seed)
    for i in range(46):
        h = random.uniform(0.55, height)
        ang = random.uniform(0, 6.283)
        rr = random.uniform(0.08, 0.32) * (1.15 - (h - 0.55) / height)
        o = C.sphere(f"{name}Leaf{i}", 0.085, (x + rr * math.cos(ang), y + rr * math.sin(ang), h),
                     scale=(1.0, 0.12, 0.42), mat=leaf, sub=2)
        o.rotation_euler = (random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6), ang)


def _base_room(W, D, H, accent_rgb, floor_rgb):
    wall = C.mat_principled("WallPaint", (0.80, 0.78, 0.75), rough=0.92)
    accent = C.mat_principled("AccentWall", accent_rgb, rough=0.95)
    ceil = C.mat_principled("CeilingPaint", (0.86, 0.86, 0.85), rough=0.95)
    floor = C.mat_wood("OakFloor", base=floor_rgb)
    C.room(W, D, H, wall, ceil, floor, back_mat=accent)
    return ceil


# ---------------------------------------------------------------- rooms
def living():
    W, D, H = 4.6, 5.2, 2.8
    _base_room(W, D, H, (0.50, 0.46, 0.41), (0.42, 0.28, 0.16))
    fabric = C.mat_fabric("SofaFabric", (0.46, 0.43, 0.39))
    cushion = C.mat_fabric("Cushion", (0.58, 0.55, 0.50))
    leg = C.mat_principled("Walnut", (0.12, 0.07, 0.04), rough=0.4)
    sy = D - 0.5
    C.box("SofaBase", (2.4, 0.95, 0.24), (0, sy, 0.22), fabric, bevel=0.03)
    C.box("SofaBack", (2.4, 0.22, 0.48), (0, D - 0.13, 0.55), fabric, bevel=0.05)
    C.box("SofaArmL", (0.2, 0.95, 0.38), (-1.2, sy, 0.43), fabric, bevel=0.05)
    C.box("SofaArmR", (0.2, 0.95, 0.38), (1.2, sy, 0.43), fabric, bevel=0.05)
    for i, x in enumerate((-0.55, 0.55)):
        C.box(f"Seat{i}", (1.08, 0.72, 0.16), (x, sy - 0.08, 0.42), cushion, bevel=0.05)
        C.box(f"BackCush{i}", (1.05, 0.2, 0.42), (x, D - 0.3, 0.66), cushion, bevel=0.07, rot=(math.radians(-10), 0, 0))
    for x in (-1.15, 1.15):
        for y in (sy - 0.4, sy + 0.4):
            C.cyl("SofaLeg", 0.02, 0.1, (x, y, 0.05), leg)
    C.box("Pillow1", (0.42, 0.14, 0.42), (-0.85, D - 0.42, 0.72), C.mat_fabric("Pillow", (0.72, 0.52, 0.30)), bevel=0.07,
          rot=(math.radians(-15), 0, math.radians(8)))
    C.box("Pillow2", (0.42, 0.14, 0.42), (0.9, D - 0.42, 0.72), C.mat_fabric("Pillow2", (0.30, 0.36, 0.33)), bevel=0.07,
          rot=(math.radians(-15), 0, math.radians(-6)))
    C.box("Rug", (2.8, 2.0, 0.012), (0, sy - 1.3, 0.006), C.mat_fabric("Rug", (0.70, 0.66, 0.60), rough=0.95))
    oak = C.mat_wood("TableOak", base=(0.55, 0.38, 0.22), plank=0.6, rough=0.3)
    ty = sy - 1.45
    C.cyl("TableTop", 0.45, 0.035, (0, ty, 0.42), oak, verts=96, bevel=0.008)
    for a in range(3):
        ang = a * 2 * math.pi / 3
        C.cyl("TableLeg", 0.018, 0.4, (0.28 * math.cos(ang), ty + 0.28 * math.sin(ang), 0.2), leg)
    ceramic = C.mat_principled("Ceramic", (0.9, 0.88, 0.84), rough=0.15, coat=0.6)
    C.cyl("Vase", 0.06, 0.2, (0.15, ty, 0.54), ceramic, bevel=0.01)
    C.box("Book", (0.24, 0.17, 0.03), (-0.15, ty + 0.05, 0.455), C.mat_principled("BookCover", (0.55, 0.18, 0.12), rough=0.5), rot=(0, 0, 0.3))
    _painting("Paint", 0, D, 1.62, 1.3, 0.85, [(0.85, 0.55, 0.22), (0.15, 0.25, 0.30), (0.92, 0.86, 0.74)])
    _plant("Plant", 1.85, D - 0.45)
    C.box("Cabinet", (0.42, 1.1, 0.5), (W / 2 - 0.22, 3.2, 0.25), C.mat_principled("CabWhite", (0.84, 0.83, 0.8), rough=0.35), bevel=0.006)
    C.cyl("CabVase", 0.07, 0.3, (W / 2 - 0.22, 3.0, 0.65), ceramic, bevel=0.01)
    return Layout(
        W, D, H, cam=(0.35, 0.75, 1.30), cam_target=(0.0, D, 1.45),
        recessed=[(-1.45, 2.85), (0, 2.85), (1.45, 2.85), (-1.45, 3.85), (0, 3.85), (1.45, 3.85)],
        rails=[
            ((-0.9, 0.9, D - 0.8), [(-0.42, (-0.33, D - 0.03, 1.66), 34), (0.42, (0.33, D - 0.03, 1.66), 34)]),
            ((-1.2, 1.2, 2.9), [(-0.9, (-0.9, 3.6, 0.45), 40), (0.0, (0.0, 3.3, 0.42), 40), (0.9, (0.9, 3.6, 0.45), 40)]),
        ],
        ceiling=(0, 3.2, 0.6, 250.0),
        window=(2.7, 1.4, 1.6, 1.7),
    )


def bedroom():
    W, D, H = 3.8, 5.0, 2.7
    _base_room(W, D, H, (0.42, 0.47, 0.50), (0.46, 0.32, 0.19))
    wood = C.mat_wood("BedWood", base=(0.22, 0.14, 0.08), plank=0.6, rough=0.35)
    linen = C.mat_fabric("Linen", (0.86, 0.85, 0.82))
    by = D - 1.1
    C.box("BedFrame", (1.7, 2.1, 0.22), (0, by, 0.16), wood, bevel=0.015)
    C.box("Headboard", (1.8, 0.08, 1.0), (0, D - 0.05, 0.6), C.mat_fabric("Headboard", (0.62, 0.58, 0.52)), bevel=0.04)
    C.box("Mattress", (1.62, 2.0, 0.22), (0, by, 0.46), linen, bevel=0.05)
    C.box("Duvet", (1.7, 1.35, 0.08), (0, by - 0.36, 0.6), linen, bevel=0.04)
    C.box("Throw", (1.72, 0.45, 0.085), (0, by - 0.78, 0.615), C.mat_fabric("Throw", (0.70, 0.56, 0.40)), bevel=0.03)
    for i, x in enumerate((-0.42, 0.42)):
        C.box(f"Pillow{i}", (0.62, 0.36, 0.14), (x, D - 0.32, 0.66), linen, bevel=0.06, rot=(math.radians(-25), 0, 0))
    ns = C.mat_principled("NightStand", (0.84, 0.83, 0.80), rough=0.35)
    lamp = C.mat_principled("LampShade", (0.92, 0.9, 0.85), rough=0.8)
    brass = C.mat_principled("Brass", (0.8, 0.6, 0.3), rough=0.3, metallic=1.0)
    for s in (-1, 1):
        x = s * 1.22
        C.box("NightStand", (0.48, 0.42, 0.5), (x, D - 0.25, 0.25), ns, bevel=0.008)
        C.cyl("LampBase", 0.05, 0.25, (x, D - 0.25, 0.63), brass)
        C.cyl("LampShade", 0.13, 0.2, (x, D - 0.25, 0.85), lamp)
    wd = C.mat_principled("Wardrobe", (0.80, 0.79, 0.76), rough=0.4)
    C.box("Wardrobe", (0.6, 1.6, 2.2), (W / 2 - 0.3, 1.3, 1.1), wd, bevel=0.006)
    handle = C.mat_principled("Handle", (0.1, 0.1, 0.1), rough=0.3, metallic=1.0)
    for dy in (-0.05, 0.05):
        C.box("Handle", (0.02, 0.012, 0.3), (W / 2 - 0.605, 1.3 + dy, 1.1), handle)
    C.box("Rug", (2.2, 1.4, 0.012), (0, by - 1.3, 0.006), C.mat_fabric("Rug", (0.66, 0.62, 0.57), rough=0.95))
    _painting("BedArt", 0, D, 1.65, 0.9, 0.5, [(0.55, 0.62, 0.66), (0.86, 0.82, 0.74), (0.70, 0.58, 0.45)], scale=0.6, kind="BANDS")
    return Layout(
        W, D, H, cam=(0.3, 0.35, 1.45), cam_target=(-0.05, D, 1.62),
        recessed=[(-0.95, 2.3), (0.95, 2.3), (-0.95, 3.6), (0.95, 3.6)],
        rails=[((-0.9, 0.9, 3.3), [(-0.6, (-0.55, 4.2, 0.6), 40), (0.0, (0.0, D - 0.05, 1.5), 30), (0.6, (0.55, 4.2, 0.6), 40)])],
        ceiling=(0, 2.6, 0.5, 160.0),
        window=(2.4, 1.45, 1.3, 1.5),
        extra={"sky": 0.3},
    )


def dining():
    W, D, H = 4.0, 4.8, 2.8
    _base_room(W, D, H, (0.56, 0.50, 0.42), (0.40, 0.27, 0.15))
    oak = C.mat_wood("DiningOak", base=(0.52, 0.36, 0.21), plank=0.5, rough=0.28)
    leg = C.mat_principled("BlackSteel", (0.03, 0.03, 0.03), rough=0.4, metallic=0.6)
    ty = 3.05
    C.box("TableTop", (1.7, 0.9, 0.04), (0, ty, 0.75), oak, bevel=0.006)
    for x in (-0.75, 0.75):
        for y in (ty - 0.36, ty + 0.36):
            C.box("TableLeg", (0.05, 0.05, 0.73), (x, y, 0.365), leg)
    seat = C.mat_fabric("ChairFabric", (0.62, 0.56, 0.48))
    for i, (x, y, flip) in enumerate([(-0.45, ty - 0.62, 1), (0.45, ty - 0.62, 1), (-0.45, ty + 0.62, -1), (0.45, ty + 0.62, -1)]):
        C.box(f"Seat{i}", (0.44, 0.44, 0.06), (x, y, 0.46), seat, bevel=0.02)
        C.box(f"Back{i}", (0.44, 0.05, 0.42), (x, y - flip * 0.2, 0.7), seat, bevel=0.02)
        for dx in (-0.18, 0.18):
            for dy in (-0.18, 0.18):
                C.cyl(f"ChairLeg{i}", 0.014, 0.44, (x + dx, y + dy, 0.22), leg)
    ceramic = C.mat_principled("Ceramic", (0.9, 0.88, 0.84), rough=0.15, coat=0.6)
    for i, x in enumerate((-0.45, 0.45)):
        C.cyl(f"Plate{i}a", 0.13, 0.012, (x, ty - 0.25, 0.776), ceramic, verts=64)
        C.cyl(f"Plate{i}b", 0.13, 0.012, (x, ty + 0.25, 0.776), ceramic, verts=64)
    C.cyl("Bowl", 0.16, 0.08, (0, ty, 0.81), C.mat_principled("BowlGlaze", (0.32, 0.40, 0.36), rough=0.2, coat=0.5), verts=64)
    for i, (dx, c) in enumerate([(-0.05, (0.85, 0.45, 0.10)), (0.06, (0.75, 0.12, 0.08)), (0.0, (0.90, 0.75, 0.15))]):
        C.sphere(f"Fruit{i}", 0.045, (dx, ty + (i - 1) * 0.05, 0.87), mat=C.mat_principled(f"Fruit{i}", c, rough=0.35))
    side = C.mat_wood("SideboardWood", base=(0.30, 0.20, 0.12), plank=0.4, rough=0.35)
    C.box("Sideboard", (1.8, 0.45, 0.8), (0, D - 0.23, 0.4), side, bevel=0.008)
    C.cyl("SideVase", 0.08, 0.35, (0.6, D - 0.25, 0.975), ceramic, bevel=0.01)
    _painting("DinArt", 0, D, 1.7, 1.2, 0.7, [(0.20, 0.32, 0.30), (0.88, 0.80, 0.62), (0.75, 0.42, 0.22)], scale=0.7)
    _plant("Plant", W / 2 - 0.35, D - 0.4, height=1.5, seed=9)
    return Layout(
        W, D, H, cam=(0.25, 0.4, 1.4), cam_target=(0.0, D, 1.25),
        recessed=[(-0.65, 2.6), (0.65, 2.6), (-0.65, 3.5), (0.65, 3.5)],
        rails=[((-0.9, 0.9, ty), [(-0.6, (-0.5, ty, 0.77), 36), (0.0, (0.0, ty, 0.77), 36), (0.6, (0.5, ty, 0.77), 36)])],
        ceiling=(0, ty, 0.55, 220.0),
        window=(2.4, 1.45, 1.3, 1.5),
    )


def study():
    W, D, H = 3.6, 4.4, 2.8
    _base_room(W, D, H, (0.38, 0.42, 0.40), (0.44, 0.30, 0.18))
    oak = C.mat_wood("DeskOak", base=(0.55, 0.38, 0.22), plank=0.5, rough=0.3)
    white = C.mat_principled("ShelfWhite", (0.84, 0.83, 0.80), rough=0.4)
    leg = C.mat_principled("BlackSteel", (0.03, 0.03, 0.03), rough=0.4, metallic=0.6)
    # desk against the back wall
    C.box("DeskTop", (1.5, 0.7, 0.035), (0.35, D - 0.36, 0.74), oak, bevel=0.005)
    for x in (-0.36, 1.06):
        C.box("DeskLeg", (0.04, 0.65, 0.72), (x, D - 0.36, 0.36), leg)
    C.box("Monitor", (0.62, 0.03, 0.38), (0.35, D - 0.12, 1.08), C.mat_principled("Screen", (0.02, 0.02, 0.025), rough=0.15))
    C.box("MonitorStand", (0.04, 0.04, 0.16), (0.35, D - 0.12, 0.83), leg)
    C.box("Keyboard", (0.42, 0.14, 0.02), (0.35, D - 0.5, 0.768), C.mat_principled("Keys", (0.85, 0.85, 0.84), rough=0.4))
    C.box("Notebook", (0.21, 0.29, 0.015), (0.85, D - 0.45, 0.765), C.mat_principled("NoteCover", (0.20, 0.30, 0.45), rough=0.5), rot=(0, 0, 0.2))
    chair = C.mat_fabric("ChairFabric", (0.20, 0.22, 0.25))
    C.box("ChairSeat", (0.48, 0.48, 0.08), (0.35, D - 1.05, 0.48), chair, bevel=0.03)
    C.box("ChairBack", (0.46, 0.06, 0.5), (0.35, D - 1.3, 0.8), chair, bevel=0.03)
    C.cyl("ChairPost", 0.025, 0.4, (0.35, D - 1.05, 0.24), leg)
    # bookshelf on the left part of the back wall
    bx = -1.25
    C.box("ShelfSideL", (0.03, 0.35, 2.1), (bx - 0.45, D - 0.18, 1.05), white)
    C.box("ShelfSideR", (0.03, 0.35, 2.1), (bx + 0.45, D - 0.18, 1.05), white)
    C.box("ShelfBack", (0.9, 0.02, 2.1), (bx, D - 0.01, 1.05), white)
    random.seed(3)
    palette = [(0.55, 0.18, 0.12), (0.18, 0.30, 0.42), (0.80, 0.70, 0.50), (0.25, 0.35, 0.25), (0.85, 0.82, 0.76), (0.40, 0.28, 0.20)]
    for s in range(6):
        z = 0.05 + s * 0.38
        C.box(f"Shelf{s}", (0.87, 0.33, 0.025), (bx, D - 0.18, z), white)
        if s == 5:
            continue
        x = bx - 0.4
        while x < bx + 0.38:
            t = random.uniform(0.025, 0.05)
            h = random.uniform(0.22, 0.31)
            if random.random() < 0.12:
                x += 0.06
                continue
            C.box(f"Book{s}", (t, 0.22, h), (x + t / 2, D - 0.2, z + 0.0125 + h / 2), C.mat_principled(f"Book{s}{x:.2f}", random.choice(palette), rough=0.6))
            x += t + 0.003
    _plant("Plant", W / 2 - 0.32, D - 1.35, height=1.3, seed=11)
    _painting("StudyArt", 1.2, D, 1.75, 0.5, 0.65, [(0.85, 0.80, 0.70), (0.25, 0.32, 0.35), (0.70, 0.50, 0.30)], scale=0.5, kind="BANDS")
    return Layout(
        W, D, H, cam=(0.2, 0.35, 1.45), cam_target=(-0.1, D, 1.3),
        recessed=[(-0.8, 2.3), (0.8, 2.3), (-0.8, 3.4), (0.8, 3.4)],
        rails=[((-1.0, 1.0, D - 1.0), [(-0.8, (-1.25, D - 0.2, 1.1), 40), (0.15, (0.35, D - 0.4, 0.76), 36), (0.75, (0.6, D - 0.1, 1.5), 34)])],
        ceiling=(0, 2.4, 0.5, 170.0),
        window=(2.2, 1.45, 1.3, 1.5),
    )


BUILDERS = {"living": living, "bedroom": bedroom, "dining": dining, "study": study}


def build(room, fixture):
    assert room in ROOMS and fixture in FIXTURES, (room, fixture)
    C.reset_scene()
    L = BUILDERS[room]()
    eff_h = L.H - F.COVE_DROP if fixture == "cove" else L.H   # curtains stop under the cove soffit
    y, z, w, h = L.window
    C.window_with_curtains(-L.W / 2, y, z, w, h, eff_h, sky_strength=L.extra.get("sky", 0.35))
    F.place(fixture, L)
    C.cut_ceiling_holes(L.H)
    C.world((0.004, 0.005, 0.009), 1.0)
    C.camera(L.cam, L.cam_target, lens=L.lens)
    return L
