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

# Explicit 3x3 cube adjacency derived from the supplied Box net numbering.
# The net is:
#
#                 1  2  3
#                 4  5  6
#                 7  8  9
#  19 20 21       28 29 30       37 38 39       46 47 48
#  22 23 24       31 32 33       40 41 42       49 50 51
#  25 26 27       34 35 36       43 44 45       52 53 54
#                 10 11 12
#                 13 14 15
#                 16 17 18
#

# This lookup is the source of truth for the generator. It contains both
# same-face neighbours and the folded edge neighbours implied by the supplied
# cube net. Every cell has exactly four unique neighbours and every relationship
# is reciprocal.
CELL_ADJACENCY = {
    1: (2, 4, 19, 48), 2: (1, 3, 5, 47), 3: (2, 6, 39, 46),
    4: (1, 5, 7, 20), 5: (2, 4, 6, 8), 6: (3, 5, 9, 38),
    7: (4, 8, 21, 28), 8: (5, 7, 9, 29), 9: (6, 8, 30, 37),
    10: (11, 13, 37, 34), 11: (10, 12, 14, 35), 12: (11, 15, 36, 43),
    13: (10, 14, 16, 26), 14: (11, 13, 15, 17), 15: (12, 14, 18, 44),
    16: (13, 17, 25, 54), 17: (14, 16, 18, 53), 18: (15, 17, 45, 52),
    19: (1, 20, 22, 48), 20: (4, 19, 21, 23), 21: (7, 20, 24, 28),
    22: (19, 23, 25, 51), 23: (20, 22, 24, 26), 24: (21, 23, 27, 31),
    25: (16, 22, 26, 54), 26: (13, 23, 25, 27), 27: (10, 24, 26, 34),
    28: (7, 21, 29, 31), 29: (8, 28, 30, 32), 30: (9, 29, 33, 37),
    31: (24, 28, 32, 34), 32: (29, 31, 33, 35), 33: (30, 32, 36, 40),
    34: (10, 27, 31, 35), 35: (11, 32, 34, 36), 36: (12, 33, 35, 43),
    37: (9, 30, 38, 40), 38: (6, 37, 39, 41), 39: (3, 38, 42, 46),
    40: (33, 37, 41, 43), 41: (38, 40, 42, 44), 42: (39, 41, 45, 49),
    43: (12, 36, 40, 44), 44: (15, 41, 43, 45), 45: (18, 42, 44, 52),
    46: (3, 39, 47, 49), 47: (2, 46, 48, 50), 48: (1, 19, 47, 51),
    49: (42, 46, 50, 52), 50: (47, 49, 51, 53), 51: (22, 48, 50, 54),
    52: (18, 45, 49, 53), 53: (17, 50, 52, 54), 54: (16, 25, 51, 53),
}

FACE_OFFSETS = {
    "TOP": 0,
    "BOTTOM": 9,
    "LEFT": 18,
    "FRONT": 27,
    "RIGHT": 36,
    "BACK": 45,
}


def cell_id(face, row, col):
    return FACE_OFFSETS[face] + row * N + col + 1


def cube_surface_cells(n):
    return [(face, row, col) for face in FACES for row in range(n) for col in range(n)]


def validate_cell_adjacency():
    expected_ids = set(range(1, 55))
    if set(CELL_ADJACENCY) != expected_ids:
        raise ValueError("CELL_ADJACENCY must contain exactly cell IDs 1 through 54")

    for cell, neighbours in CELL_ADJACENCY.items():
        if len(neighbours) != 4 or len(set(neighbours)) != 4:
            raise ValueError(f"Cell {cell} must have exactly four unique neighbours")
        if any(neighbour not in expected_ids for neighbour in neighbours):
            raise ValueError(f"Cell {cell} contains an invalid neighbour ID")
        for neighbour in neighbours:
            if cell not in CELL_ADJACENCY[neighbour]:
                raise ValueError(f"Adjacency is not reciprocal between {cell} and {neighbour}")


def build_cube_neighbours(n):
    if n != N:
        raise ValueError("The Box adjacency lookup is defined for a 3x3 cube only")

    validate_cell_adjacency()
    neighbours = {}
    for face, row, col in cube_surface_cells(n):
        neighbours[(face, row, col)] = [
            (FACES[(neighbour - 1) // 9], ((neighbour - 1) % 9) // 3, (neighbour - 1) % 3)
            for neighbour in CELL_ADJACENCY[cell_id(face, row, col)]
        ]
    return neighbours


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
