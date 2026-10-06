"""Render every cached impact frame for a matched motion review, without rebaking.

Run against each terrain-textured.blend. This is a qualitative enlarged impact
study; the scene is not calibrated to real raindrop size or elapsed field time.
"""
import argparse
from pathlib import Path
import sys
import bpy

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--width', type=int, default=1000)
parser.add_argument('--samples', type=int, default=24)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
args.out.mkdir(parents=True, exist_ok=True)
scene = bpy.context.scene
scene.render.resolution_x = args.width
scene.render.resolution_y = round(args.width * 676 / 1200)  # Pad odd heights when encoding H.264.
scene.render.resolution_percentage = 100
scene.cycles.samples = args.samples
scene.render.fps = 24
for frame in range(20, 57):
    target = args.out / f'{frame:04}.png'
    if target.exists():
        continue
    scene.frame_set(frame)
    scene.render.filepath = str(target)
    bpy.ops.render.render(write_still=True)
print('TERRAIN_MOTION_FINISHED', flush=True)
