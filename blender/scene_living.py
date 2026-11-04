"""Living room: 6 recessed downlights (group 'recessed') + 2 track spots on a painting (group 'track')."""
import math
import common as C

W, D, H = 4.6, 5.2, 2.8


def build():
    C.reset_scene()
    wall = C.mat_principled("WallPaint", (0.80, 0.78, 0.75), rough=0.92)
    accent = C.mat_principled("AccentWall", (0.50, 0.46, 0.41), rough=0.95)
    ceil = C.mat_principled("CeilingPaint", (0.86, 0.86, 0.85), rough=0.95)
    floor = C.mat_wood("OakFloor", base=(0.42, 0.28, 0.16))
    C.room(W, D, H, wall, ceil, floor, back_mat=accent)

    # ---- sofa against the back wall
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
    pillow = C.mat_fabric("Pillow", (0.72, 0.52, 0.30))
    C.box("Pillow1", (0.42, 0.14, 0.42), (-0.85, D - 0.42, 0.72), pillow, bevel=0.07, rot=(math.radians(-15), 0, math.radians(8)))
    C.box("Pillow2", (0.42, 0.14, 0.42), (0.9, D - 0.42, 0.72), C.mat_fabric("Pillow2", (0.30, 0.36, 0.33)), bevel=0.07, rot=(math.radians(-15), 0, math.radians(-6)))

    # ---- rug + round coffee table
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

    # ---- painting above sofa (track light target)
    frame = C.mat_principled("Frame", (0.04, 0.04, 0.04), rough=0.4)
    py, pz = D - 0.02, 1.62
    C.box("PaintFrame", (1.3, 0.03, 0.85), (0, py, pz), frame, bevel=0.004)
    canvas = C.mat_principled("Canvas", (0.8, 0.7, 0.55), rough=0.8)
    nt = canvas.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "RINGS"
    wave.inputs["Scale"].default_value = 0.9
    wave.inputs["Distortion"].default_value = 9.0
    wave.inputs["Detail"].default_value = 6.0
    wave.inputs["Detail Scale"].default_value = 2.5
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].color = (0.85, 0.55, 0.22, 1)
    els[1].color = (0.15, 0.25, 0.30, 1)
    mid = els.new(0.5)
    mid.color = (0.92, 0.86, 0.74, 1)
    nt.links.new(tc.outputs["Generated"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
    C.box("Canvas", (1.24, 0.01, 0.79), (0, py - 0.017, pz), canvas)

    # ---- plant in corner + side cabinet on the right
    pot = C.mat_principled("Pot", (0.28, 0.27, 0.26), rough=0.7)
    C.cyl("Pot", 0.17, 0.42, (1.85, D - 0.45, 0.21), pot, bevel=0.01)
    leaf = C.mat_principled("Leaf", (0.06, 0.16, 0.06), rough=0.55)
    import random
    random.seed(4)
    stem = C.mat_principled("Stem", (0.10, 0.07, 0.04), rough=0.7)
    C.cyl("PlantStem", 0.012, 1.2, (1.85, D - 0.45, 0.95), stem)
    for i in range(46):
        h = random.uniform(0.55, 1.6)
        ang = random.uniform(0, 6.283)
        rr = random.uniform(0.08, 0.32) * (1.15 - (h - 0.55) / 1.6)
        o = C.sphere(f"Leaf{i}", 0.085, (1.85 + rr * math.cos(ang), D - 0.45 + rr * math.sin(ang), h),
                     scale=(1.0, 0.12, 0.42), mat=leaf, sub=2)
        o.rotation_euler = (random.uniform(-0.6, 0.6), random.uniform(-0.6, 0.6), ang)
    C.box("Cabinet", (0.42, 1.1, 0.5), (W / 2 - 0.22, 3.2, 0.25), C.mat_principled("CabWhite", (0.84, 0.83, 0.8), rough=0.35), bevel=0.006)
    C.cyl("CabVase", 0.07, 0.3, (W / 2 - 0.22, 3.0, 0.65), ceramic, bevel=0.01)

    # ---- window on the left wall behind sheer curtains (ambient only)
    C.window_with_curtains(-W / 2, 2.7, 1.4, 1.6, 1.7, H)

    # ---- fixtures
    for i, (x, y) in enumerate([(-1.2, 2.85), (0, 2.85), (1.2, 2.85), (-1.2, 3.85), (0, 3.85), (1.2, 3.85)]):
        C.recessed_light(f"Rec{i}", x, y, H, "recessed")
    C.track_rail("TrackRail", -0.9, 0.9, D - 0.8, H)
    for i, x in enumerate((-0.42, 0.42)):
        C.track_head(f"Track{i}", (x, D - 0.8, H - 0.12), (x * 0.55, D - 0.03, 1.6), "track")

    C.world((0.004, 0.005, 0.009), 1.0)
    C.camera((0.35, 0.75, 1.30), (0.0, D, 1.45), lens=16.0)
