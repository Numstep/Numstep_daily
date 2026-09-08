import argparse
import json
import random
from datetime import date
from pathlib import Path

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4


ROOT = Path(__file__).resolve().parents[2]


def generate_walk(n, threshold=0.70):
    """Generate the same 3-D self-avoiding walk used by NumstepCube.py."""
    total_cubes = n * n * n
    required_cubes = int(total_cubes * threshold) + 1

    while True:
        grid = [[[0 for _ in range(n)] for _ in range(n)] for _ in range(n)]
        layer = row = col = 0
        grid[layer][row][col] = 1
        steps = 1

        while steps < total_cubes:
            neighbours = []
            for dl, dr, dc in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
                nl, nr, nc = layer + dl, row + dr, col + dc
                if 0 <= nl < n and 0 <= nr < n and 0 <= nc < n and grid[nl][nr][nc] == 0:
                    neighbours.append((nl, nr, nc))

            if not neighbours:
                break

            layer, row, col = random.choice(neighbours)
            steps += 1
            grid[layer][row][col] = steps

        if steps >= required_cubes:
            return grid, steps


def count_solutions(grid, n, max_solutions=2):
    """Count paths following the numbered cells, stopping at max_solutions."""
    target = max(value for layer in grid for row in layer for value in row)
    solutions = 0

    def neighbours(position):
        layer, row, col = position
        for dl, dr, dc in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            nl, nr, nc = layer + dl, row + dr, col + dc
            if 0 <= nl < n and 0 <= nr < n and 0 <= nc < n:
                yield nl, nr, nc

    def dfs(position, step, visited):
        nonlocal solutions
        if solutions >= max_solutions:
            return
        if step == target:
            solutions += 1
            return
        for nxt in neighbours(position):
            if nxt in visited:
                continue
            if grid[nxt[0]][nxt[1]][nxt[2]] == step + 1:
                visited.add(nxt)
                dfs(nxt, step + 1, visited)
                visited.remove(nxt)

    dfs((0, 0, 0), 1, {(0, 0, 0)})
    return solutions


def create_pdf(grid, steps, filename, puzzle_date):
    """Render the four Cube layers in a printable 2x2 layout."""
    c = canvas.Canvas(filename, pagesize=A4)
    width, height = A4
    margin = 40
    layer_size = 120
    cell_size = layer_size / len(grid[0])
    positions = [
        (margin, height - margin - layer_size),
        (width - margin - layer_size, height - margin - layer_size),
        (margin, margin),
        (width - margin - layer_size, margin),
    ]

    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height - 25, "NUMSTEP: CUBE")
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, height - 38, puzzle_date.isoformat())

    for layer_index, (x0, y0) in enumerate(positions):
        c.setFont("Helvetica-Bold", 9)
        c.drawString(x0, y0 + layer_size + 6, f"LAYER {layer_index + 1}")
        for row in range(len(grid[layer_index])):
            for col in range(len(grid[layer_index][row])):
                x = x0 + col * cell_size
                y = y0 + (len(grid[layer_index]) - 1 - row) * cell_size
                value = grid[layer_index][row][col]
                if value == 0:
                    c.setFillColorRGB(0, 0, 0)
                    c.rect(x, y, cell_size, cell_size, fill=1, stroke=0)
                else:
                    c.setFillColorRGB(1, 1, 1)
                    c.rect(x, y, cell_size, cell_size, fill=1, stroke=1)
                    if value == 1 or value % 10 == 0:
                        c.setFillColorRGB(0, 0, 0)
                        c.setFont("Helvetica-Bold", 12)
                        c.drawCentredString(x + cell_size / 2, y + cell_size / 2 - 4, str(value))

    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, height / 2, f"Coverage: {steps}/64")
    c.save()


def export_json(grid, steps, puzzle_date, filename):
    data = {"date": puzzle_date.isoformat(), "size": len(grid), "steps": steps, "solution": grid}
    filename.parent.mkdir(parents=True, exist_ok=True)
    filename.write_text(json.dumps(data, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Generate the daily Numstep Cube puzzle.")
    parser.add_argument("--date", default=None)
    parser.add_argument("--size", type=int, default=4)
    parser.add_argument("--output-root", default="games/numstep-cube")
    args = parser.parse_args()

    if args.size != 4:
        raise SystemExit("Numstep Cube currently supports only a 4 x 4 x 4 cube.")

    puzzle_date = date.fromisoformat(args.date) if args.date else date.today()
    random.seed(f"numstep-cube:{puzzle_date.isoformat()}:{args.size}")

    while True:
        grid, steps = generate_walk(args.size)
        solution_count = count_solutions(grid, args.size, max_solutions=2)
        print(f"Cube candidate: {steps}/{args.size ** 3} cells, solutions={solution_count}")
        if solution_count == 1:
            break

    output_root = Path(args.output_root)
    json_path = output_root / "data" / f"{puzzle_date.isoformat()}.json"
    pdf_path = output_root / "printables" / f"{puzzle_date.isoformat()}.pdf"
    export_json(grid, steps, puzzle_date, json_path)
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    create_pdf(grid, steps, str(pdf_path), puzzle_date)
    print(f"Cube JSON created: {json_path}")
    print(f"Cube PDF created: {pdf_path}")


if __name__ == "__main__":
    main()
