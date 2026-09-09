import json
import random
from datetime import date
from functools import lru_cache
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

N = 3
COVERAGE_THRESHOLD = 0.60
CLUE_INTERVAL = 10
MAX_SOLUTIONS = 2

FACES = ("TOP", "BOTTOM", "LEFT", "FRONT", "RIGHT", "BACK")
NET_POSITIONS = {
    "TOP": (1, 0),
    "LEFT": (0, 1),
    "FRONT": (1, 1),
    "RIGHT": (2, 1),
    "BACK": (3, 1),
    "BOTTOM": (1, 2),
}

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "games" / "numstep-box" / "data"
PRINTABLE_DIR = ROOT / "games" / "numstep-box" / "printables"
SHARE_DIR = ROOT / "games" / "numstep-box" / "share"


def cube_surface_cells(n):
    return [(face, row, col) for face in FACES for row in range(n) for col in range(n)]


def add_edge_adjacency(neighbours, a, b):
    neighbours[a].append(b)
    neighbours[b].append(a)


def build_cube_neighbours(n):
    neighbours = {cell: [] for cell in cube_surface_cells(n)}

    for face in FACES:
        for row in range(n):
            for col in range(n):
                cell = (face, row, col)
                if row > 0:
                    neighbours[cell].append((face, row - 1, col))
                if row < n - 1:
                    neighbours[cell].append((face, row + 1, col))
                if col > 0:
                    neighbours[cell].append((face, row, col - 1))
                if col < n - 1:
                    neighbours[cell].append((face, row, col + 1))

    for col in range(n):
        add_edge_adjacency(neighbours, ("FRONT", 0, col), ("TOP", n - 1, col))
        add_edge_adjacency(neighbours, ("FRONT", n - 1, col), ("BOTTOM", 0, col))
        add_edge_adjacency(neighbours, ("BACK", 0, col), ("TOP", 0, n - 1 - col))
        add_edge_adjacency(neighbours, ("BACK", n - 1, col), ("BOTTOM", n - 1, col))

    for row in range(n):
        add_edge_adjacency(neighbours, ("FRONT", row, 0), ("LEFT", row, n - 1))
        add_edge_adjacency(neighbours, ("FRONT", row, n - 1), ("RIGHT", row, 0))
        add_edge_adjacency(neighbours, ("LEFT", 0, row), ("TOP", row, 0))
        add_edge_adjacency(neighbours, ("LEFT", n - 1, row), ("BOTTOM", n - 1 - row, 0))
        add_edge_adjacency(neighbours, ("RIGHT", 0, row), ("TOP", row, n - 1))
        add_edge_adjacency(neighbours, ("RIGHT", n - 1, row), ("BOTTOM", row, n - 1))
        add_edge_adjacency(neighbours, ("LEFT", row, n - 1), ("BACK", row, 0))
        add_edge_adjacency(neighbours, ("RIGHT", row, n - 1), ("BACK", row, n - 1))

    return {cell: list(dict.fromkeys(values)) for cell, values in neighbours.items()}


def count_solutions(grid, neighbours, max_solutions=MAX_SOLUTIONS):
    white_cells = [cell for cell, number in grid.items() if number]
    total_steps = len(white_cells)
    clue_positions = {}
    cell_clues = {}

    for cell, number in grid.items():
        if number == 1 or number % CLUE_INTERVAL == 0:
            clue_positions[number] = cell
            cell_clues[cell] = number

    if 1 not in clue_positions:
        return 0

    @lru_cache(maxsize=None)
    def can_finish(cell, step, visited_frozen):
        if step == total_steps:
            return 1

        visited = set(visited_frozen)
        next_step = step + 1
        count = 0

        for new_cell in neighbours[cell]:
            if new_cell in visited:
                continue
            if new_cell in cell_clues and cell_clues[new_cell] != next_step:
                continue
            if next_step in clue_positions and new_cell != clue_positions[next_step]:
                continue

            visited.add(new_cell)
            count += can_finish(new_cell, next_step, tuple(sorted(visited)))
            visited.remove(new_cell)

            if count >= max_solutions:
                return max_solutions

        return count

    start = clue_positions[1]
    return min(can_finish(start, 1, (start,)), max_solutions)


def generate_walk(n=N, threshold=COVERAGE_THRESHOLD, require_unique=True):
    total_cells = 6 * n * n
    required_steps = threshold * total_cells
    neighbours = build_cube_neighbours(n)
    attempts = 0

    while True:
        attempts += 1
        grid = {cell: 0 for cell in cube_surface_cells(n)}
        current = random.choice(list(grid))
        grid[current] = 1
        visited = {current}
        steps = 1

        while True:
            moves = [cell for cell in neighbours[current] if cell not in visited]
            if not moves:
                break
            current = random.choice(moves)
            steps += 1
            grid[current] = steps
            visited.add(current)

        if steps < required_steps:
            continue

        if not require_unique:
            return grid, steps

        solution_count = count_solutions(grid, neighbours)
        print(f"Checking Box candidate: {steps}/{total_cells} cells; solutions={solution_count}")
        if solution_count == 1:
            print(f"Unique Box puzzle found after {attempts} attempts.")
            return grid, steps


def serialise_solution(grid):
    return {
        face: [[grid[(face, row, col)] for col in range(N)] for row in range(N)]
        for face in FACES
    }


def puzzle_json(day, grid, steps):
    return {
        "date": day,
        "size": N,
        "steps": steps,
        "clues": [1] + list(range(CLUE_INTERVAL, steps + 1, CLUE_INTERVAL)),
        "faces": list(FACES),
        "net": NET_POSITIONS,
        "solution": serialise_solution(grid),
    }


def draw_box_net(pdf_path, grid, day):
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    page_w, page_h = A4
    cell = min((page_w - 72) / (4 * N), (page_h - 170) / (3 * N))
    face_size = N * cell
    origin_x = (page_w - 4 * face_size) / 2
    origin_y = 150

    c.setFont("Helvetica-Bold", 18)
    c.drawCentredString(page_w / 2, page_h - 48, "NUMSTEP: BOX")
    c.setFont("Helvetica", 10)
    c.drawCentredString(page_w / 2, page_h - 65, day)

    for face in FACES:
        nx, ny = NET_POSITIONS[face]
        fx = origin_x + nx * face_size
        fy = origin_y + (2 - ny) * face_size

        for row in range(N):
            for col in range(N):
                value = grid[(face, row, col)]
                x = fx + col * cell
                y = fy + (N - row - 1) * cell
                if value == 0:
                    c.setFillColorRGB(0, 0, 0)
                    c.rect(x, y, cell, cell, fill=1, stroke=0)
                c.setStrokeColorRGB(0, 0, 0)
                c.rect(x, y, cell, cell, fill=0, stroke=1)
                if value == 1 or value % CLUE_INTERVAL == 0:
                    c.setFillColorRGB(0, 0, 0)
                    c.setFont("Helvetica-Bold", max(6, min(14, cell * 0.34)))
                    c.drawCentredString(x + cell / 2, y + cell * 0.36, str(value))

    c.setFont("Helvetica", 9)
    c.drawCentredString(page_w / 2, 88, f"{steps_label(grid)} steps — connect consecutive numbers across the folded box")
    c.save()


def steps_label(grid):
    return max(grid.values())


def draw_share_svg(path, grid, day):
    cell = 42
    face = N * cell
    width = 4 * face + 80
    height = 3 * face + 120
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
        '<rect width="100%" height="100%" fill="white"/>',
        '<style>.cell{stroke:#000;stroke-width:1}.clue{font:700 14px sans-serif;dominant-baseline:middle;text-anchor:middle}.title{font:700 22px sans-serif;text-anchor:middle}.date{font:14px sans-serif;text-anchor:middle}</style>',
        f'<text class="title" x="{width/2}" y="34">NUMSTEP: BOX</text>',
        f'<text class="date" x="{width/2}" y="56">{day}</text>',
    ]

    for face_name in FACES:
        nx, ny = NET_POSITIONS[face_name]
        ox = 40 + nx * face
        oy = 72 + ny * face
        for row in range(N):
            for col in range(N):
                value = grid[(face_name, row, col)]
                x = ox + col * cell
                y = oy + row * cell
                fill = "#000" if value == 0 else "#fff"
                parts.append(f'<rect class="cell" x="{x}" y="{y}" width="{cell}" height="{cell}" fill="{fill}"/>')
                if value == 1 or value % CLUE_INTERVAL == 0:
                    parts.append(f'<text class="clue" x="{x + cell/2}" y="{y + cell/2}">{value}</text>')

    parts.append(f'<text class="date" x="{width/2}" y="{height - 24}">{steps_label(grid)} steps</text>')
    parts.append('</svg>')
    path.write_text("\n".join(parts), encoding="utf-8")


def generate_for_date(day=None):
    day = day or date.today().isoformat()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PRINTABLE_DIR.mkdir(parents=True, exist_ok=True)
    SHARE_DIR.mkdir(parents=True, exist_ok=True)

    daily_grid, daily_steps = generate_walk(require_unique=True)
    share_grid, share_steps = generate_walk(require_unique=False)

    daily = puzzle_json(day, daily_grid, daily_steps)
    share = puzzle_json(day, share_grid, share_steps)

    (DATA_DIR / f"{day}.json").write_text(json.dumps(daily, indent=2) + "\n", encoding="utf-8")
    (DATA_DIR / f"{day}_share.json").write_text(json.dumps(share, indent=2) + "\n", encoding="utf-8")
    draw_box_net(PRINTABLE_DIR / f"{day}.pdf", daily_grid, day)
    draw_share_svg(SHARE_DIR / f"{day}.svg", share_grid, day)

    print(f"Generated Box puzzle resources for {day}")


if __name__ == "__main__":
    generate_for_date()
