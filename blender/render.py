"""Render light layers for a scene.

Usage (with the bpy venv python):
  python blender/render.py --scene living --layers base,recessed_6000,recessed_3000,track_6000,track_3000 \
      --res 1800 1200 --samples 256 --out blender/out/living
  python blender/render.py --scene living --layers preview --res 900 600 --samples 64 --out blender/out/preview

Layer names:
  base             ambient only (dusk window + world), every fixture off
  <group>_<kelvin> only that group on at 100% with the given colour temperature (linear EXR)
  preview          everything on at 4000K + ambient, tone-mapped PNG for quick review
  check            recessed 6000K + track 3000K + ambient, EXR (to validate the web compositor)
Light layers contain no ambient, so  final = base + sum(weight_i * layer_i)  is physically exact.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import common as C  # noqa: E402

SCENES = {"living": "scene_living", "bedroom": "scene_bedroom"}


def set_group(name, on, kelvin=4000):
    for item in C.GROUPS.get(name, []):
        if isinstance(item, bpy.types.Object):
            item.hide_render = not on
            item.data.energy = item["base_energy"] if on else 0.0
            item.data.node_tree.nodes["Blackbody"].inputs["Temperature"].default_value = kelvin
        else:  # emissive material
            nt = item.node_tree
            nt.nodes["Emission"].inputs["Strength"].default_value = item["base_strength"] if on else 0.0
            nt.nodes["Blackbody"].inputs["Temperature"].default_value = kelvin


def set_ambient(on):
    w = bpy.context.scene.world
    w.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0 if on else 0.0
    for item in C.AMBIENT:
        if isinstance(item, bpy.types.Object) and "amb_energy" not in item:
            item["amb_energy"] = item.data.energy
        if isinstance(item, bpy.types.Object):
            item.hide_render = not on
            item.data.energy = item.get("amb_energy", item.data.energy) if on else 0.0
        else:
            em = item.node_tree.nodes.get("Emission")
            if "amb_strength" not in item:
                item["amb_strength"] = em.inputs["Strength"].default_value
            em.inputs["Strength"].default_value = item["amb_strength"] if on else 0.0


def configure(res, samples, exr):
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    s.cycles.use_adaptive_sampling = True
    s.cycles.adaptive_threshold = 0.01
    s.cycles.use_denoising = True
    s.cycles.denoiser = "OPENIMAGEDENOISE"
    s.cycles.max_bounces = 8
    s.cycles.diffuse_bounces = 5
    s.cycles.glossy_bounces = 4
    s.cycles.transmission_bounces = 6
    s.cycles.sample_clamp_indirect = 8.0
    s.render.resolution_x, s.render.resolution_y = res
    s.render.resolution_percentage = 100
    s.render.film_transparent = False
    if exr:
        s.render.image_settings.file_format = "OPEN_EXR"
        s.render.image_settings.color_depth = "16"
        s.render.image_settings.exr_codec = "ZIP"
        s.view_settings.view_transform = "Standard"
    else:
        s.render.image_settings.file_format = "PNG"
        s.view_settings.view_transform = "AgX"
        s.view_settings.look = "AgX - Base Contrast"
        s.view_settings.exposure = 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", required=True, choices=SCENES)
    ap.add_argument("--layers", required=True)
    ap.add_argument("--res", nargs=2, type=int, default=(1800, 1200))
    ap.add_argument("--samples", type=int, default=256)
    ap.add_argument("--out", required=True)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    a = ap.parse_args(argv)

    mod = __import__(SCENES[a.scene])
    mod.build()
    os.makedirs(a.out, exist_ok=True)
    groups = list(C.GROUPS)

    for layer in a.layers.split(","):
        if layer == "preview":
            configure(a.res, a.samples, exr=False)
            set_ambient(True)
            for g in groups:
                set_group(g, True, 4000)
            path = os.path.join(a.out, f"{a.scene}_preview.png")
        elif layer == "check":
            configure(a.res, a.samples, exr=True)
            set_ambient(True)
            for g in groups:
                set_group(g, False)
            on = {"living": [("recessed", 6000), ("track", 3000)], "bedroom": [("ceiling", 4000)]}[a.scene]
            for g, k in on:
                set_group(g, True, k)
            path = os.path.join(a.out, "check.exr")
        elif layer == "base":
            configure(a.res, a.samples, exr=True)
            set_ambient(True)
            for g in groups:
                set_group(g, False)
            path = os.path.join(a.out, "base.exr")
        else:
            g, k = layer.rsplit("_", 1)
            assert g in groups, f"unknown group {g}; have {groups}"
            configure(a.res, a.samples, exr=True)
            set_ambient(False)
            for other in groups:
                set_group(other, other == g, int(k))
            path = os.path.join(a.out, f"{layer}.exr")
        bpy.context.scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print("WROTE", path, flush=True)


if __name__ == "__main__":
    main()
