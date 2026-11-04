"""Shared helpers for building the Varilumi demo scenes in Blender (bpy module).

Every light that belongs to a controllable group is registered with `register_group`,
so render.py can switch groups on/off per layer and set their colour temperature.
"""
import math
import bpy

GROUPS: dict[str, list] = {}      # group name -> list of (light object | emissive material)
AMBIENT: list = []                # ambient-only items (window glow, world)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    GROUPS.clear()
    AMBIENT.clear()


# ---------------------------------------------------------------- materials
def mat_principled(name, color, rough=0.5, metallic=0.0, sheen=0.0, coat=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metallic
    if sheen:
        b.inputs["Sheen Weight"].default_value = sheen
    if coat:
        b.inputs["Coat Weight"].default_value = coat
    return m


def mat_wood(name="Wood", base=(0.36, 0.22, 0.12), plank=0.18, rough=0.38):
    """Procedural wood planks: stretched noise for grain + brick texture for plank variation."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    n, l = nt.nodes, nt.links
    bsdf = n["Principled BSDF"]
    tc = n.new("ShaderNodeTexCoord")
    mp = n.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.0, 8.0, 1.0)
    noise = n.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 6.0
    noise.inputs["Detail"].default_value = 12.0
    noise.inputs["Distortion"].default_value = 0.6
    brick = n.new("ShaderNodeTexBrick")
    brick.inputs["Scale"].default_value = 1.0
    brick.inputs["Mortar Size"].default_value = 0.002
    brick.inputs["Brick Width"].default_value = 1.2
    brick.inputs["Row Height"].default_value = plank
    brick.inputs["Color1"].default_value = (0.9, 0.9, 0.9, 1)
    brick.inputs["Color2"].default_value = (1.1, 1.05, 1.0, 1)
    brick.inputs["Mortar"].default_value = (0.3, 0.3, 0.3, 1)
    ramp = n.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (base[0] * 0.65, base[1] * 0.62, base[2] * 0.6, 1)
    ramp.color_ramp.elements[1].color = (base[0] * 1.25, base[1] * 1.2, base[2] * 1.15, 1)
    mix = n.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs["Factor"].default_value = 1.0
    l.new(tc.outputs["Object"], mp.inputs["Vector"])
    l.new(mp.outputs["Vector"], noise.inputs["Vector"])
    l.new(tc.outputs["Object"], brick.inputs["Vector"])
    l.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    l.new(ramp.outputs["Color"], mix.inputs["A"])
    l.new(brick.outputs["Color"], mix.inputs["B"])
    l.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Coat Weight"].default_value = 0.15
    bsdf.inputs["Coat Roughness"].default_value = 0.25
    return m


def mat_fabric(name, color, rough=0.85):
    m = mat_principled(name, color, rough=rough, sheen=0.6)
    nt = m.node_tree
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 400.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.08
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], nt.nodes["Principled BSDF"].inputs["Normal"])
    return m


def mat_emissive(name, group, strength=1.0):
    """Emissive surface (lamp diffuser / lens). Colour temperature driven by a Blackbody node."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    bb = nt.nodes.new("ShaderNodeBlackbody")
    bb.inputs["Temperature"].default_value = 4000
    # Off-state look: a slightly grey diffuser, mixed with emission.
    diff = nt.nodes.new("ShaderNodeBsdfPrincipled")
    diff.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
    diff.inputs["Roughness"].default_value = 0.6
    add = nt.nodes.new("ShaderNodeAddShader")
    nt.links.new(bb.outputs["Color"], em.inputs["Color"])
    nt.links.new(em.outputs["Emission"], add.inputs[0])
    nt.links.new(diff.outputs["BSDF"], add.inputs[1])
    nt.links.new(add.outputs["Shader"], out.inputs["Surface"])
    em.inputs["Strength"].default_value = strength
    m["base_strength"] = strength
    if group:
        GROUPS.setdefault(group, []).append(m)
    return m


def assign(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    return obj


# ---------------------------------------------------------------- geometry
def box(name, size, loc, mat=None, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        mod.limit_method = "NONE"
        bpy.ops.object.shade_smooth()
        o.data.shade_smooth() if hasattr(o.data, "shade_smooth") else None
    if mat:
        assign(o, mat)
    return o


def cyl(name, r, depth, loc, mat=None, rot=(0, 0, 0), verts=48, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=depth, location=loc, rotation=rot, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
    bpy.ops.object.shade_smooth()
    if mat:
        assign(o, mat)
    return o


def plane(name, size, loc, rot=(0, 0, 0), mat=None):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    if mat:
        assign(o, mat)
    return o


def sphere(name, r, loc, scale=(1, 1, 1), mat=None, sub=3):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=r, location=loc, subdivisions=sub)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    bpy.ops.object.shade_smooth()
    if mat:
        assign(o, mat)
    return o


def room(w, d, h, wall_mat, ceil_mat, floor_mat, back_mat=None):
    """Closed box room: x in [-w/2, w/2], y in [0, d], z in [0, h]. Camera sits inside near y=0."""
    plane("Floor", (w, d), (0, d / 2, 0), mat=floor_mat)
    plane("Ceiling", (w, d), (0, d / 2, h), rot=(math.pi, 0, 0), mat=ceil_mat)
    plane("WallBack", (w, h), (0, d, h / 2), rot=(math.pi / 2, 0, 0), mat=back_mat or wall_mat)
    plane("WallFront", (w, h), (0, 0, h / 2), rot=(-math.pi / 2, 0, 0), mat=wall_mat)
    plane("WallLeft", (d, h), (-w / 2, d / 2, h / 2), rot=(math.pi / 2, 0, -math.pi / 2), mat=wall_mat)
    plane("WallRight", (d, h), (w / 2, d / 2, h / 2), rot=(math.pi / 2, 0, math.pi / 2), mat=wall_mat)
    # skirting boards
    skirt = mat_principled("Skirting", (0.82, 0.81, 0.79), rough=0.4)
    box("SkirtBack", (w, 0.015, 0.08), (0, d - 0.0075, 0.04), skirt)
    box("SkirtLeft", (0.015, d, 0.08), (-w / 2 + 0.0075, d / 2, 0.04), skirt)
    box("SkirtRight", (0.015, d, 0.08), (w / 2 - 0.0075, d / 2, 0.04), skirt)


# ---------------------------------------------------------------- lights
def light_with_blackbody(light_data):
    light_data.use_nodes = True
    nt = light_data.node_tree
    em = nt.nodes.get("Emission")
    bb = nt.nodes.new("ShaderNodeBlackbody")
    bb.inputs["Temperature"].default_value = 4000
    nt.links.new(bb.outputs["Color"], em.inputs["Color"])


def add_light(name, kind, loc, rot, energy, group, **kw):
    ld = bpy.data.lights.new(name, kind)
    ld.energy = energy
    for k, v in kw.items():
        setattr(ld, k, v)
    light_with_blackbody(ld)
    o = bpy.data.objects.new(name, ld)
    o.location = loc
    o.rotation_euler = rot
    bpy.context.scene.collection.objects.link(o)
    o["base_energy"] = energy
    if group:
        GROUPS.setdefault(group, []).append(o)
    else:
        AMBIENT.append(o)
    return o


def look_rotation(src, dst):
    """Euler rotation that points an object's -Z axis (lights/cameras) from src toward dst."""
    from mathutils import Vector
    d = Vector(dst) - Vector(src)
    return d.to_track_quat("-Z", "Y").to_euler()


# ---------------------------------------------------------------- fixtures (modelled on Varilumi product photos)
_alu = None
_black = None
_white_shell = None


def _mats():
    global _alu, _black, _white_shell
    if _alu is None:
        _alu = mat_principled("BrushedAlu", (0.85, 0.86, 0.87), rough=0.28, metallic=1.0)
        _black = mat_principled("BlackPowder", (0.025, 0.025, 0.027), rough=0.45)
        _white_shell = mat_principled("WhiteShell", (0.88, 0.88, 0.87), rough=0.35)
    return _alu, _black, _white_shell


def recessed_light(name, x, y, ceil_h, group, energy=9.0, cutout=0.09):
    """9cm diffused downlight: aluminium bezel ring + frosted emissive diffuser + wide area light."""
    alu, _, _ = _mats()
    r = cutout / 2 + 0.012
    cyl(f"{name}_ring", r, 0.008, (x, y, ceil_h - 0.004), alu, bevel=0.002)
    em = mat_emissive(f"{name}_diffuser", group, strength=22.0)
    cyl(f"{name}_diffuser", cutout / 2 - 0.004, 0.002, (x, y, ceil_h - 0.0085), em)
    add_light(f"{name}_light", "AREA", (x, y, ceil_h - 0.012), (0, 0, 0), energy, group,
              shape="DISK", size=cutout - 0.01, spread=math.radians(120))


def track_head(name, pos, target, group, energy=140.0, beam_deg=28, shell="black"):
    """Cylindrical COB track spot (like the 15W zoom COB track light), aimed at `target`."""
    alu, black, white = _mats()
    sh = black if shell == "black" else white
    rot = look_rotation(pos, target)
    from mathutils import Vector, Matrix
    # stem from rail down to head
    cyl(f"{name}_stem", 0.008, 0.07, (pos[0], pos[1], pos[2] + 0.05), sh)
    head = cyl(f"{name}_head", 0.038, 0.13, pos, sh, rot=rot, bevel=0.003)
    # lens at the front of the head
    fwd = (rot.to_matrix() @ Vector((0, 0, -1))).normalized()
    lens_pos = Vector(pos) + fwd * 0.066
    em = mat_emissive(f"{name}_lens", group, strength=60.0)
    cyl(f"{name}_lens", 0.026, 0.002, tuple(lens_pos), em, rot=rot)
    add_light(f"{name}_light", "SPOT", tuple(lens_pos + fwd * 0.01), rot, energy, group,
              spot_size=math.radians(beam_deg), spot_blend=0.3, shadow_soft_size=0.02)


def track_rail(name, x0, x1, y, ceil_h):
    _, black, _ = _mats()
    box(name, (abs(x1 - x0), 0.035, 0.018), ((x0 + x1) / 2, y, ceil_h - 0.009), black, bevel=0.002)


def ceiling_light(name, x, y, ceil_h, group, diameter=0.5, energy=160.0):
    """Round ceiling light with opal diffuser (like the Varilumi wall-switch ceiling light)."""
    _, _, white = _mats()
    cyl(f"{name}_base", diameter / 2, 0.05, (x, y, ceil_h - 0.025), white, verts=96, bevel=0.01)
    em = mat_emissive(f"{name}_opal", group, strength=9.0)
    o = sphere(f"{name}_opal", diameter / 2 - 0.01, (x, y, ceil_h - 0.05), scale=(1, 1, 0.14), mat=em, sub=5)
    # keep only lower half visually: the upper half is hidden inside the base
    add_light(f"{name}_light", "AREA", (x, y, ceil_h - 0.09), (0, 0, 0), energy, group,
              shape="DISK", size=diameter * 0.85, spread=math.radians(170))
    return o


def camera(loc, target, lens=18.0):
    cd = bpy.data.cameras.new("Cam")
    cd.lens = lens
    cd.sensor_width = 36
    o = bpy.data.objects.new("Cam", cd)
    o.location = loc
    o.rotation_euler = look_rotation(loc, target)
    bpy.context.scene.collection.objects.link(o)
    bpy.context.scene.camera = o
    return o


def world(color=(0.01, 0.012, 0.018), strength=1.0):
    w = bpy.data.worlds.new("World")
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (*color, 1)
    bg.inputs["Strength"].default_value = strength
    bpy.context.scene.world = w
    return w


def window_with_curtains(wall_x, y_center, z_center, width, height, room_h, sky_strength=0.35, gap=0.06):
    """Window on a side wall (x = wall_x) seen through closed sheer curtains with a centre gap.
    Sky glow is an ambient-only emitter, so it lives in the base layer only."""
    import random
    side = 1 if wall_x < 0 else -1
    # Dusk sky = a rectangular area light in the window opening, facing into the room.
    ld = bpy.data.lights.new("SkyLight", "AREA")
    ld.shape = "RECTANGLE"
    ld.size, ld.size_y = width, height
    ld.color = (0.32, 0.45, 0.85)
    ld.energy = 60.0 * sky_strength / 0.35
    lo = bpy.data.objects.new("SkyLight", ld)
    lo.location = (wall_x + side * 0.03, y_center, z_center)
    lo.rotation_euler = (0, -side * math.pi / 2, 0)   # -Z axis points into the room
    bpy.context.scene.collection.objects.link(lo)
    AMBIENT.append(lo)
    glass = mat_principled("NightGlass", (0.015, 0.02, 0.035), rough=0.05)
    plane("Window", (width, height), (wall_x + side * 0.004, y_center, z_center),
          rot=(math.pi / 2, 0, side * math.pi / 2), mat=glass)
    frame = mat_principled("WinFrame", (0.14, 0.14, 0.14), rough=0.4, metallic=0.6)
    for dy in (-width / 2, width / 2):
        box("WinJamb", (0.05, 0.04, height + 0.04), (wall_x + side * 0.02, y_center + dy, z_center), frame)
    for dz in (-height / 2, height / 2):
        box("WinRail", (0.05, width + 0.04, 0.04), (wall_x + side * 0.02, y_center, z_center + dz), frame)
    # curtain rod + two sheer panels made of soft folds, leaving a gap in the middle
    rod_mat = mat_principled("Rod", (0.12, 0.12, 0.12), rough=0.3, metallic=1.0)
    cx = wall_x + side * 0.12
    box("CurtainRod", (0.02, width + 0.9, 0.02), (cx, y_center, room_h - 0.12), rod_mat)
    sheer = mat_principled("Sheer", (0.86, 0.84, 0.80), rough=0.9)
    b = sheer.node_tree.nodes["Principled BSDF"]
    b.inputs["Transmission Weight"].default_value = 0.55
    b.inputs["Subsurface Weight"].default_value = 0.0
    random.seed(7)
    panel = (width + 0.9 - gap) / 2
    for s in (-1, 1):
        start = y_center + s * gap / 2
        n = int(panel / 0.07)
        for k in range(n):
            y = start + s * (k * 0.07 + 0.035)
            cyl(f"Fold{s}{k}", 0.042, room_h - 0.2, (cx + random.uniform(-0.012, 0.012), y, (room_h - 0.16) / 2 + 0.02),
                sheer, verts=12)
