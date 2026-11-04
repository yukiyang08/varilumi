"""Room details that make a scene read as a real Taiwanese home: doors, wall switches and sockets,
wave-pleated sheer curtains, leafy plants and small everyday objects. All geometry is procedural."""
import math
import random

import bmesh
import bpy
import common as C


# ---------------------------------------------------------------- shared materials
_cache: dict = {}


def _m(key, factory):
    if key not in _cache or _cache[key].name not in bpy.data.materials:
        _cache[key] = factory()
    return _cache[key]


def white_plastic():
    return _m("plastic", lambda: C.mat_principled("SwitchPlastic", (0.88, 0.87, 0.85), rough=0.32, coat=0.2))


def door_paint():
    return _m("doorpaint", lambda: C.mat_principled("DoorPaint", (0.83, 0.81, 0.77), rough=0.45))


def brushed_steel():
    return _m("steel", lambda: C.mat_principled("Steel", (0.75, 0.75, 0.74), rough=0.3, metallic=1.0))


def reset():
    _cache.clear()


# ---------------------------------------------------------------- walls: switch, socket, door
def _on_right_wall(W, y, z, depth, size_y, size_z):
    """Location of a box mounted flat on the right wall (x = W/2), protruding `depth` into the room."""
    return (W / 2 - depth / 2, y, z), (depth, size_y, size_z)


def wall_switch(W, y, z=1.2, gangs=2):
    """Wide-plate rocker switch, the common style in Taiwanese homes (plate 7 × 12 cm)."""
    loc, size = _on_right_wall(W, y, z, 0.008, 0.072, 0.12)
    C.box("SwitchPlate", size, loc, white_plastic(), bevel=0.003)
    for g in range(gangs):
        gy = y + (g - (gangs - 1) / 2) * 0.026
        C.box("SwitchRocker", (0.006, 0.022, 0.085), (W / 2 - 0.011, gy, z), white_plastic(), bevel=0.002)
        # orange locator light at the top of each rocker
        C.box("SwitchLocator", (0.002, 0.008, 0.003), (W / 2 - 0.0145, gy, z + 0.03),
              _m("locator", lambda: C.mat_principled("Locator", (0.9, 0.45, 0.1), rough=0.3)))


def socket(W, y, z=0.3):
    loc, size = _on_right_wall(W, y, z, 0.008, 0.072, 0.12)
    C.box("SocketPlate", size, loc, white_plastic(), bevel=0.003)
    dark = _m("slot", lambda: C.mat_principled("SocketSlot", (0.05, 0.05, 0.05), rough=0.6))
    for dz in (-0.025, 0.025):
        for dy in (-0.007, 0.007):
            C.box("SocketSlot", (0.002, 0.003, 0.009), (W / 2 - 0.0085, y + dy, z + dz), dark)


def socket_back(D, x, z=0.3):
    """Socket on the back wall (y = D)."""
    C.box("SocketPlate", (0.072, 0.008, 0.12), (x, D - 0.004, z), white_plastic(), bevel=0.003)
    dark = _m("slot", lambda: C.mat_principled("SocketSlot", (0.05, 0.05, 0.05), rough=0.6))
    for dz in (-0.025, 0.025):
        for dx in (-0.007, 0.007):
            C.box("SocketSlot", (0.003, 0.002, 0.009), (x + dx, D - 0.0085, z + dz), dark)


def door(W, y_center, width=0.9, height=2.1):
    """Interior door on the right wall: architrave, recessed panelled leaf, lever handle."""
    paint = door_paint()
    t = 0.07  # architrave width
    xw = W / 2
    C.box("DoorCasingL", (0.018, t, height + t), (xw - 0.009, y_center - width / 2 - t / 2, (height + t) / 2), paint, bevel=0.003)
    C.box("DoorCasingR", (0.018, t, height + t), (xw - 0.009, y_center + width / 2 + t / 2, (height + t) / 2), paint, bevel=0.003)
    C.box("DoorCasingTop", (0.018, width + 2 * t, t), (xw - 0.009, y_center, height + t / 2), paint, bevel=0.003)
    C.box("DoorLeaf", (0.04, width - 0.01, height - 0.01), (xw - 0.005, y_center, height / 2), paint, bevel=0.002)
    # two raised panels on the leaf
    for zc, h in ((height * 0.72, height * 0.38), (height * 0.27, height * 0.38)):
        C.box("DoorPanel", (0.006, width - 0.2, h), (xw - 0.027, y_center, zc), paint, bevel=0.004)
    steel = brushed_steel()
    hy = y_center - width / 2 + 0.08
    C.cyl("DoorRose", 0.026, 0.01, (xw - 0.03, hy, 1.0), steel, rot=(0, math.pi / 2, 0))
    C.box("DoorLever", (0.018, 0.13, 0.018), (xw - 0.05, hy + 0.06, 1.0), steel, bevel=0.006)


# ---------------------------------------------------------------- curtains
def wave_curtains(wall_x, y_center, width, room_h, gap=0.06):
    """Two sheer panels hung in an S-wave pleat (replaces the old cylinder folds)."""
    side = 1 if wall_x < 0 else -1
    cx = wall_x + side * 0.12
    sheer = _m("sheer", lambda: _sheer())
    total = width + 0.9
    panel = (total - gap) / 2
    height = room_h - 0.2
    for s in (-1, 1):
        me = bpy.data.meshes.new(f"Curtain{s}")
        bm = bmesh.new()
        nu, nv = 120, 24
        verts = []
        y0 = y_center + s * gap / 2
        for j in range(nv + 1):
            z = 0.04 + height * j / nv
            row = []
            for i in range(nu + 1):
                u = i / nu
                y = y0 + s * panel * u
                # pleat wave ~14 cm, slightly deeper near the floor where the fabric hangs free
                amp = 0.032 + 0.008 * (1 - j / nv)
                x = cx + amp * math.sin(2 * math.pi * (y - y0) / 0.14)
                row.append(bm.verts.new((x, y, z)))
            verts.append(row)
        for j in range(nv):
            for i in range(nu):
                bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True
        o = bpy.data.objects.new(f"Curtain{s}", me)
        bpy.context.scene.collection.objects.link(o)
        me.materials.append(sheer)
        sol = o.modifiers.new("thick", "SOLIDIFY")
        sol.thickness = 0.0015
    rod = _m("rod", lambda: C.mat_principled("Rod", (0.12, 0.12, 0.12), rough=0.3, metallic=1.0))
    C.cyl("CurtainRod", 0.01, total, (cx, y_center, room_h - 0.12), rod, rot=(math.pi / 2, 0, 0))


def _sheer():
    # linen-look sheer: lets a soft glow through, but stays a fabric rather than a light panel
    m = C.mat_principled("Sheer", (0.80, 0.77, 0.72), rough=0.9)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Transmission Weight"].default_value = 0.3
    # faint vertical weave
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.bands_direction = "Z"
    wave.inputs["Scale"].default_value = 260.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.05
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], b.inputs["Normal"])
    return m


# ---------------------------------------------------------------- plants
def _leaf_mesh(name, length=0.2, width=0.085):
    """A teardrop leaf with a slight lengthwise curl, built once and instanced."""
    if name in bpy.data.meshes:
        return bpy.data.meshes[name]
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    n = 10
    left, right = [], []
    for i in range(n + 1):
        t = i / n
        w = width * math.sin(math.pi * t) * (1 - 0.35 * t)
        z = 0.035 * math.sin(math.pi * t)  # curl
        x = length * t
        left.append(bm.verts.new((x, -w / 2, z - 0.01 * (w / width))))
        right.append(bm.verts.new((x, w / 2, z - 0.01 * (w / width))))
    mid = [bm.verts.new((length * i / n, 0, 0.035 * math.sin(math.pi * i / n) + 0.004)) for i in range(n + 1)]
    for i in range(n):
        bm.faces.new((left[i], left[i + 1], mid[i + 1], mid[i]))
        bm.faces.new((mid[i], mid[i + 1], right[i + 1], right[i]))
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    return me


def plant(name, x, y, height=1.6, seed=4, pot_r=0.17):
    """Fiddle-leaf-fig-like plant: tapered pot, a few stems, teardrop leaves facing outward and up."""
    pot = C.mat_principled(f"{name}Pot", (0.30, 0.29, 0.28), rough=0.75)
    C.lathe(f"{name}Pot", [(0.0, 0.0), (pot_r * 0.8, 0.0), (pot_r, 0.42), (pot_r * 0.92, 0.42), (pot_r * 0.92, 0.39), (0.0, 0.39)], (x, y, 0), pot)
    soil = C.mat_principled(f"{name}Soil", (0.08, 0.06, 0.04), rough=0.95)
    C.cyl(f"{name}Soil", pot_r * 0.9, 0.01, (x, y, 0.385), soil)
    leaf_mat = C.mat_principled(f"{name}Leaf", (0.05, 0.15, 0.05), rough=0.45, coat=0.25)
    stem_mat = C.mat_principled(f"{name}Stem", (0.12, 0.09, 0.05), rough=0.7)
    random.seed(seed)
    me = _leaf_mesh("LeafMesh")
    for s in range(3):
        sx, sy = x + random.uniform(-0.04, 0.04), y + random.uniform(-0.04, 0.04)
        h = height * random.uniform(0.75, 1.0)
        lean = random.uniform(-0.12, 0.12)
        C.cyl(f"{name}Stem{s}", 0.009, h - 0.4, (sx + lean / 2, sy, 0.4 + (h - 0.4) / 2), stem_mat, rot=(0, math.atan2(lean, h - 0.4), 0))
        for k in range(14):
            t = random.uniform(0.25, 1.0)
            px, pz = sx + lean * t, 0.4 + (h - 0.4) * t
            o = bpy.data.objects.new(f"{name}Leaf{s}_{k}", me)
            bpy.context.scene.collection.objects.link(o)
            if not me.materials:
                me.materials.append(leaf_mat)
            ang = random.uniform(0, 2 * math.pi)
            sc = random.uniform(0.8, 1.25) * (1.1 - 0.3 * t)
            o.location = (px, sy, pz)
            o.rotation_euler = (random.uniform(-0.3, 0.3), -random.uniform(0.2, 0.9), ang)
            o.scale = (sc, sc, sc)


# ---------------------------------------------------------------- small objects
def books(name, x, y, z, n=4, rot=0.0, seed=1):
    random.seed(seed)
    palette = [(0.55, 0.18, 0.12), (0.18, 0.30, 0.42), (0.82, 0.74, 0.55), (0.25, 0.35, 0.25), (0.85, 0.82, 0.76)]
    zz = z
    for i in range(n):
        t = random.uniform(0.018, 0.035)
        w, d = random.uniform(0.17, 0.24), random.uniform(0.12, 0.17)
        C.box(f"{name}{i}", (w, d, t), (x + random.uniform(-0.01, 0.01), y + random.uniform(-0.01, 0.01), zz + t / 2),
              C.mat_principled(f"{name}C{i}", random.choice(palette), rough=0.6), bevel=0.002, rot=(0, 0, rot + random.uniform(-0.12, 0.12)))
        zz += t
    return zz


def mug(name, x, y, z, color=(0.9, 0.88, 0.84)):
    m = C.mat_principled(f"{name}Glaze", color, rough=0.15, coat=0.6)
    C.lathe(f"{name}", [(0.0, 0.0), (0.038, 0.0), (0.04, 0.09), (0.036, 0.09), (0.034, 0.008), (0.0, 0.008)], (x, y, z), m)
    C.cyl(f"{name}Handle", 0.022, 0.008, (x + 0.05, y, z + 0.045), m, rot=(math.pi / 2, 0, 0), verts=24)


def glass(name, x, y, z):
    g = _m("glass", lambda: _glass())
    C.lathe(name, [(0.0, 0.0), (0.032, 0.0), (0.036, 0.12), (0.034, 0.12), (0.030, 0.006), (0.0, 0.006)], (x, y, z), g)


def _glass():
    m = C.mat_principled("Glass", (0.95, 0.97, 0.98), rough=0.02)
    m.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 1.0
    m.node_tree.nodes["Principled BSDF"].inputs["IOR"].default_value = 1.45
    return m


def table_lamp(name, x, y, z, height=0.45):
    """Decorative lamp (never lit in the demo): ceramic base, linen shade."""
    base = C.mat_principled(f"{name}Base", (0.78, 0.74, 0.66), rough=0.25, coat=0.4)
    shade = C.mat_fabric(f"{name}Shade", (0.92, 0.89, 0.83))
    C.lathe(f"{name}Body", [(0.0, 0.0), (0.06, 0.0), (0.085, height * 0.25), (0.06, height * 0.55), (0.015, height * 0.6), (0.0, height * 0.6)], (x, y, z), base)
    C.lathe(f"{name}Shade", [(0.09, height * 0.58), (0.14, height * 0.58), (0.11, height), (0.07, height)], (x, y, z), shade)


def throw_blanket(name, x, y, z, w=0.55, d=0.45, color=(0.72, 0.62, 0.48)):
    m = C.mat_fabric(f"{name}Knit", color)
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = 60.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.4
    nt.links.new(tc.outputs["Object"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    C.box(name, (w, d, 0.03), (x, y, z), m, bevel=0.012, rot=(0.05, -0.08, 0.15))


def side_table(name, x, y, h=0.55, r=0.24):
    top = C.mat_wood(f"{name}Top", base=(0.50, 0.34, 0.20), plank=0.6, rough=0.3)
    steel = _m("blacksteel", lambda: C.mat_principled("BlackSteel", (0.03, 0.03, 0.03), rough=0.4, metallic=0.6))
    C.cyl(f"{name}Top", r, 0.025, (x, y, h), top, verts=64, bevel=0.005)
    C.cyl(f"{name}Post", 0.015, h - 0.02, (x, y, h / 2), steel)
    C.cyl(f"{name}Foot", r * 0.7, 0.012, (x, y, 0.006), steel, verts=48)
    return h + 0.0125


def rug_pattern(mat, scale=6.0, contrast=0.12):
    """Add a woven border/stripe pattern to an existing rug material."""
    nt = mat.node_tree
    b = nt.nodes["Principled BSDF"]
    tc = nt.nodes.new("ShaderNodeTexCoord")
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.inputs["Scale"].default_value = scale
    wave.inputs["Distortion"].default_value = 1.5
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = contrast
    mix.inputs["A"].default_value = b.inputs["Base Color"].default_value
    nt.links.new(tc.outputs["Generated"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Color"], mix.inputs["B"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
