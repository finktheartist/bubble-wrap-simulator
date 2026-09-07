"""Render the shipped new tools using their actual held-game matrices, without a browser."""
from pathlib import Path
import runpy
ROOT=Path(__file__).resolve().parents[2]
# Reuse the same studio and Three-to-Blender coordinate conversion as the melee review.
runpy.run_path(str(ROOT/'tools/blender/review_swings.py'),init_globals={'POSE_SET':'toybox'})
