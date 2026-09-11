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

# Canonical 3x3 cube-face adjacency, independently derived from the face-edge
# geometry used by rubiks-cube-representation. The external reference defines
# each face's N/E/S/W edge mapping and the edge-cell ordering (N: left-to-right,
# E: top-to-bottom, S: right-to-left, W: bottom-to-top).
#
# Reference:
# https://docs.rs/rubiks-cube-representation/latest/src/rubiks_cube_representation/core/cube/geometry/mod.rs.html
#
# Cell IDs are fixed as:
#   TOP    1..9,   BOTTOM 10..18, LEFT 19..27,
#   FRONT 28..36,  RIGHT 37..45,  BACK 46..54.
# Every cell has exactly four neighbours and the table is reciprocal.
CELL_ADJACENCY = {
    1: (2, 4, 21, 54), 2: (1, 3, 5, 53), 3: (2, 6, 37, 52),
    4: (1, 5, 7, 20), 5: (2, 4, 6, 8), 6: (3, 5, 9, 51),
    7: (4, 8, 19, 30), 8: (5, 7, 9, 29), 9: (6, 8, 28, 39),
    10: (11, 13, 30, 49), 11: (10, 12, 14, 50), 12: (11, 15, 31, 51),
    13: (10, 14, 16, 32), 14: (11, 13, 15, 33), 15: (12, 14, 17, 34),
    16: (13, 17, 18, 35), 17: (14, 16, 18, 36), 18: (15, 17, 27, 46),
    19: (7, 20, 22, 48), 20: (4, 19, 21, 23), 21: (1, 20, 24, 54),
    22: (19, 23, 25, 29), 23: (20, 22, 24, 26), 24: (21, 23, 27, 36),
    25: (22, 26, 28, 47), 26: (23, 25, 27, 35), 27: (18, 24, 26, 46),
    28: (9, 25, 29, 31), 29: (8, 22, 28, 30), 30: (7, 10, 29, 33),
    31: (12, 28, 32, 34), 32: (13, 31, 33, 35), 33: (14, 30, 32, 36),
    34: (15, 31, 35, 43), 35: (16, 32, 34, 44), 36: (17, 24, 33, 45),
    37: (3, 38, 40, 52), 38: (6, 37, 39, 41), 39: (9, 38, 42, 48),
    40: (37, 41, 43, 54), 41: (38, 40, 42, 45), 42: (39, 41, 43, 47),
    43: (34, 40, 44, 46), 44: (35, 43, 45, 47), 45: (36, 41, 44, 48),
    46: (18, 19, 47, 49), 47: (25, 42, 46, 48), 48: (19, 39, 47, 51),
    49: (10, 46, 50, 52), 50: (11, 49, 51, 53), 51: (6, 12, 50, 52),
    52: (3, 37, 49, 53), 53: (2, 50, 52, 54), 54: (1, 21, 40, 53),
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
    actual_ids = set(CELL_ADJACENCY)
    if actual_ids != expected_ids:
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
        raise ValueError("The validated Box adjacency lookup is defined for a 3x3 cube only")

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
