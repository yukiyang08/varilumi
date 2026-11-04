"""Shared helpers for building the Varilumi demo scenes in Blender (bpy module).

Every light that belongs to a controllable group is registered with `register_group`,
so render.py can switch groups on/off per layer and set their colour temperature.
"""
import math
import bpy

GROUPS: dict[str, list] = {}      # group name -> list of (light object | emissive material)
AMBIENT: list = []                # ambient-only items (window glow, world)


def reset_scene():
    global _alu, _black, _white_shell, _alu_b
    bpy.ops.wm.read_factory_settings(use_empty=True)
    GROUPS.clear()
    AMBIENT.clear()
    CEILING_CUTS.clear()
    _alu = _black = _white_shell = _alu_b = None   # cached materials die with the old scene


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


def lathe(name, profile, loc, mat=None, segments=72):
    """Revolve a (radius, z) profile around the Z axis (z relative to loc). Used for fixture bezels."""
    import bmesh
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    rings = []
    for k in range(segments):
        a = 2 * math.pi * k / segments
        rings.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z)) for r, z in profile])
    for k in range(segments):
        r0, r1 = rings[k], rings[(k + 1) % segments]
        for i in range(len(profile) - 1):
            bm.faces.new((r0[i], r1[i], r1[i + 1], r0[i + 1]))
    bm.to_mesh(me)
    bm.free()
    for poly in me.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    if mat:
        me.materials.append(mat)
    return o


CEILING_CUTS: list = []   # (x, y, radius) holes to cut in the ceiling slab


def cut_ceiling_holes(ceil_h):
    """Boolean the registered recessed-light holes out of the ceiling slab."""
    if not CEILING_CUTS:
        return
    ceil = bpy.data.objects["Ceiling"]
    for i, (x, y, r) in enumerate(CEILING_CUTS):
        bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=0.2, location=(x, y, ceil_h), vertices=64)
        c = bpy.context.active_object
        mod = ceil.modifiers.new(f"hole{i}", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = c
        bpy.context.view_layer.objects.active = ceil
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(c, do_unlink=True)
    CEILING_CUTS.clear()


def room(w, d, h, wall_mat, ceil_mat, floor_mat, back_mat=None):
    """Closed box room: x in [-w/2, w/2], y in [0, d], z in [0, h]. Camera sits inside near y=0."""
    plane("Floor", (w, d), (0, d / 2, 0), mat=floor_mat)
    box("Ceiling", (w, d, 0.03), (0, d / 2, h + 0.015), ceil_mat)
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
    """Varilumi 9cm anti-glare diffused downlight, modelled on the product photo:
    brushed-aluminium bezel (rounded outer edge, flat face, chamfered inner lip), a short reflector wall,
    and a frosted diffuser set ~9 mm back into the ceiling so it does not glare at an angle.
    Light: a wide spot with soft cut-off, which paints the typical scallops on nearby walls."""
    alu, _, _ = _mats()
    R = cutout / 2                    # 0.045 for a 9cm cut-out
    # (radius, z) profile; z = 0 is the ceiling surface, negative = below the ceiling
    prof = [
        (R + 0.002, 0.0),  (R + 0.0125, 0.0), (R + 0.0135, -0.0012), (R + 0.0128, -0.0028),  # outer rounded edge
        (R + 0.010, -0.0040), (R + 0.001, -0.0042),                                           # flat face
        (R - 0.001, -0.0034), (R - 0.0025, -0.0012),                                          # chamfered lip
        (R - 0.0030, 0.0040), (R - 0.0034, 0.0092),                                           # reflector wall
    ]
    lathe(f"{name}_bezel", prof, (x, y, ceil_h), _alu_brushed())
    CEILING_CUTS.append((x, y, R))
    em = mat_emissive(f"{name}_diffuser", group, strength=24.0)
    _diffuser_falloff(em)
    cyl(f"{name}_diffuser", R - 0.0032, 0.002, (x, y, ceil_h + 0.0095), em, verts=64)
    # housing behind the diffuser so nothing leaks through the hole
    cyl(f"{name}_can", R + 0.003, 0.05, (x, y, ceil_h + 0.036), _mats()[1], verts=32)
    add_light(f"{name}_light", "SPOT", (x, y, ceil_h + 0.006), (0, 0, 0), energy * 1.9, group,
              spot_size=math.radians(100), spot_blend=0.4, shadow_soft_size=R - 0.006)


_alu_b = None


def _alu_brushed():
    """Satin brushed aluminium with circular (anisotropic) highlights like the real bezel."""
    global _alu_b
    if _alu_b is None:
        m = mat_principled("BezelAlu", (0.86, 0.87, 0.88), rough=0.3, metallic=0.4)
        b = m.node_tree.nodes["Principled BSDF"]
        b.inputs["Anisotropic"].default_value = 0.65
        noise = m.node_tree.nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 900.0
        bump = m.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.03
        m.node_tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
        m.node_tree.links.new(bump.outputs["Normal"], b.inputs["Normal"])
        _alu_b = m
    return _alu_b


def _diffuser_falloff(m):
    """Frosted diffuser: slightly hotter centre, softer edge (as LEDs behind a diffuser look)."""
    nt = m.node_tree
    tc = nt.nodes.new("ShaderNodeTexCoord")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "SPHERICAL"
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (1.15, 1.15, 1.15)
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = 0.72
    ramp.inputs["To Max"].default_value = 1.15
    mul = nt.nodes.new("ShaderNodeMath")
    mul.operation = "MULTIPLY"
    em = nt.nodes["Emission"]
    mul.inputs[1].default_value = m["base_strength"]
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Fac"], ramp.inputs["Value"])
    nt.links.new(ramp.outputs["Result"], mul.inputs[0])
    nt.links.new(mul.outputs["Value"], em.inputs["Strength"])
    m["strength_node"] = mul.name


def track_head(name, pos, target, group, energy=62.0, beam_deg=34, shell="black"):
    """15W COB track spot modelled on the Varilumi product photo: adapter box on the rail, short arm,
    cylindrical head with a front bezel and a lens set ~15 mm back (anti-glare).
    Light: a soft-edged main beam plus a faint wide spill, as real COB reflectors give."""
    alu, black, white = _mats()
    sh = black if shell == "black" else white
    rot = look_rotation(pos, target)
    from mathutils import Vector
    rail_z = pos[2] + 0.12
    # adapter box clipped onto the rail, and the arm down to the head's pivot
    box(f"{name}_adapter", (0.075, 0.036, 0.03), (pos[0], pos[1], rail_z - 0.033), sh, bevel=0.004)
    cyl(f"{name}_arm", 0.007, 0.075, (pos[0], pos[1], rail_z - 0.085), sh)
    cyl(f"{name}_pivot", 0.011, 0.03, (pos[0], pos[1], pos[2] + 0.03), sh, rot=(0, math.pi / 2, 0))
    # head: body + slightly larger front bezel ring
    fwd = (rot.to_matrix() @ Vector((0, 0, -1))).normalized()
    centre = Vector(pos) + fwd * 0.01
    # closed rear body (driver) up to the lens, then an open front tube so the lens sits recessed
    cyl(f"{name}_head", 0.032, 0.09, tuple(centre - fwd * 0.015), sh, rot=rot, bevel=0.003, verts=64)
    lens_pos = centre + fwd * 0.032
    lathe(f"{name}_tube", [(0.032, 0.0), (0.032, -0.028)], (0, 0, 0), sh).matrix_world = _frame(lens_pos, rot)
    lathe(f"{name}_bezel", [(0.024, 0.0), (0.0335, 0.0), (0.0345, -0.004), (0.0335, -0.008), (0.026, -0.008), (0.024, 0.0)],
          (0, 0, 0), sh).matrix_world = _frame(centre + fwd * 0.06, rot)
    # recessed lens with a dark anti-glare baffle in front of it
    em = mat_emissive(f"{name}_lens", group, strength=45.0)
    cyl(f"{name}_lens", 0.021, 0.002, tuple(lens_pos + fwd * 0.002), em, rot=rot, verts=48)
    baffle = mat_principled("Baffle", (0.015, 0.015, 0.016), rough=0.6)
    lathe(f"{name}_baffle", [(0.0215, 0.0), (0.024, -0.028)], (0, 0, 0), baffle).matrix_world = _frame(lens_pos, rot)
    src = tuple(lens_pos + fwd * 0.004)
    add_light(f"{name}_light", "SPOT", src, rot, energy, group,
              spot_size=math.radians(beam_deg), spot_blend=0.85, shadow_soft_size=0.021)
    add_light(f"{name}_spill", "SPOT", src, rot, energy * 0.12, group,
              spot_size=math.radians(95), spot_blend=1.0, shadow_soft_size=0.021)


def _frame(origin, rot):
    """World matrix placing a lathed profile (built around +Z, facing -Z = 'forward') at origin with rotation."""
    from mathutils import Matrix
    return Matrix.Translation(origin) @ rot.to_matrix().to_4x4()


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
