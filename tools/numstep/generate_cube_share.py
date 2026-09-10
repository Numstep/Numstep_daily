import argparse
import json
import random
from datetime import date
from pathlib import Path

from NumstepCube import generate_walk


def export_share_json(grid, steps, puzzle_date, filename):
    """Export a spoiler-safe sharing puzzle using Classic's JSON shape."""
    clues = []

    for layer in grid:
        for row in layer:
            for value in row:
                if value > 0 and (value == 1 or value % 10 == 0):
                    clues.append(value)

    data = {
        "date": puzzle_date.isoformat(),
        "size": len(grid),
        "steps": steps,
        "clues": sorted(set(clues)),
        "solution": grid,
    }

    filename.parent.mkdir(parents=True, exist_ok=True)
    filename.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"Cube share JSON created: {filename}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate the daily Numstep Cube sharing puzzle."
    )
    parser.add_argument("--date", default=None)
    parser.add_argument("--size", type=int, default=3)
    parser.add_argument("--output-root", default="games/numstep-cube")
    args = parser.parse_args()

    if args.size != 3:
        raise SystemExit("Numstep Cube currently supports only a 3 × 3 × 3 cube.")

    puzzle_date = date.fromisoformat(args.date) if args.date else date.today()

    # Use a distinct deterministic seed so the share graphic represents a
    # separate daily puzzle, just as Classic has a separate _share puzzle.
    random.seed(f"numstep-cube-share:{puzzle_date.isoformat()}:{args.size}")

    # generate_walk already owns the Cube walk generation and uniqueness
    # rules. It accepts the cube size and threshold only; the old
    # require_unique argument was from an earlier generator API and caused
    # the sharing step to fail before writing its JSON.
    grid, steps = generate_walk(args.size)

    output_root = Path(args.output_root)
    filename = output_root / "data" / f"{puzzle_date.isoformat()}_share.json"
    export_share_json(grid, steps, puzzle_date, filename)


if __name__ == "__main__":
    main()
