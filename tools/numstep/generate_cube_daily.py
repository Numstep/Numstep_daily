import argparse
import ast
import json
import random
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
CUBE_SOURCE = ROOT / "tools" / "numstep" / "NumstepCube.py"


def load_cube_functions():
    """Load the puzzle functions from NumstepCube.py without running its CLI."""
    source = CUBE_SOURCE.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(CUBE_SOURCE))

    allowed = (ast.Import, ast.ImportFrom, ast.FunctionDef, ast.AsyncFunctionDef)
    body = [node for node in tree.body if isinstance(node, allowed)]
    module = ast.Module(body=body, type_ignores=[])
    ast.fix_missing_locations(module)

    namespace = {
        "__file__": str(CUBE_SOURCE),
        "__name__": "numstep_cube_generator",
    }
    exec(compile(module, str(CUBE_SOURCE), "exec"), namespace)
    return namespace


def export_web_puzzle(grid, steps, puzzle_date, filename):
    """Write the full 3-D solution plus the visible clues for the web app."""
    n = len(grid)
    clues = []

    for layer in grid:
        for row in layer:
            for number in row:
                if number and (number == 1 or number % 10 == 0):
                    clues.append(number)

    puzzle_data = {
        "date": puzzle_date.isoformat(),
        "size": n,
        "steps": steps,
        "clues": clues,
        "solution": grid,
    }

    filename.parent.mkdir(parents=True, exist_ok=True)
    filename.write_text(
        json.dumps(puzzle_data, indent=2),
        encoding="utf-8",
    )


def main():
    parser = argparse.ArgumentParser(description="Generate the daily Numstep Cube puzzle.")
    parser.add_argument("--date", default=None, help="Puzzle date in YYYY-MM-DD format.")
    parser.add_argument("--size", type=int, default=4, help="Cube edge length.")
    parser.add_argument(
        "--output-root",
        default="games/numstep-cube",
        help="Directory containing data/ and printables/.",
    )
    args = parser.parse_args()

    if args.size != 4:
        raise SystemExit("The current Cube PDF layout supports a 4 x 4 x 4 cube only.")

    puzzle_date = date.fromisoformat(args.date) if args.date else date.today()

    # The original generator uses Python's module-level random functions.
    # Seeding by date makes a rerun for the same day reproducible.
    random.seed(f"numstep-cube:{puzzle_date.isoformat()}:{args.size}")

    namespace = load_cube_functions()
    generate_walk = namespace["generate_walk"]
    count_solutions = namespace["count_solutions"]
    create_pdf = namespace["create_pdf"]

    # create_pdf() uses date.today(), so replace that name only inside the
    # loaded generator namespace when a historical date is requested.
    original_date = namespace["date"]

    class PuzzleDate(original_date):
        @classmethod
        def today(cls):
            return puzzle_date

    namespace["date"] = PuzzleDate

    attempt = 0
    while True:
        attempt += 1
        grid, steps = generate_walk(args.size)
        solution_count = count_solutions(
            grid,
            args.size,
            max_solutions=2,
        )

        print(
            f"Cube candidate {attempt}: {steps}/{args.size ** 3} cells, "
            f"solutions={solution_count}"
        )

        if solution_count == 1:
            break

    output_root = Path(args.output_root)
    json_path = output_root / "data" / f"{puzzle_date.isoformat()}.json"
    pdf_path = output_root / "printables" / f"{puzzle_date.isoformat()}.pdf"

    export_web_puzzle(grid, steps, puzzle_date, json_path)
    create_pdf(grid, steps, args.size, str(pdf_path))

    print(f"Cube JSON created: {json_path}")
    print(f"Cube PDF created: {pdf_path}")


if __name__ == "__main__":
    main()
