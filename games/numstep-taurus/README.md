# Numstep: Taurus

Puzzle resources for the toroidal Numstep variant.

The grid is topologically a **torus**: moving off the top edge enters from the bottom, moving off the bottom enters from the top, and the same wrapping rule applies left-to-right.

## Structure

- `data/` — daily web puzzle JSON, grouped by grid size.
- `printables/` — daily printable PDFs.
- `index.html` — future Taurus game page.

The generator lives in `tools/numstep-taurus/generate_daily.py` and is a copy of the Classic generator with toroidal adjacency applied to both walk generation and uniqueness checking.
