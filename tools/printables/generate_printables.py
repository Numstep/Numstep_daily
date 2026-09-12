import json
from datetime import date
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parents[2]
PAGE_W, PAGE_H = A4
MARGIN = 28
FOOTER = "a puzzle by Ben Cornish"

RULES = {
    "classic": [
        "Start at the coloured clue and follow the numbered chain in order.",
        "Move horizontally or vertically to an adjacent square. Diagonal moves are not allowed. Black squares are blocked, and you cannot use a square more than once.",
        "The highest-numbered clue completes the chain and may be the terminal square.",
        "Adjacency is the ordinary four-way grid. There is no wrap-around at the edges.",
    ],
    "cube": [
        "Start at the coloured clue and follow the numbered chain in order across the cube.",
        "Move between cells that share a face. This includes moving within a layer or between adjacent layers. Diagonal, edge-only and corner-only contacts do not count. Black cells are blocked, and you cannot use a cell more than once.",
        "The highest-numbered clue completes the chain and may be the terminal cell.",
        "Adjacency is three-dimensional six-way face adjacency: above, below, left, right, forward and back.",
    ],
    "torus": [
        "Start at the coloured clue and follow the numbered chain in order.",
        "Move horizontally or vertically to an adjacent square. Diagonal moves are not allowed. Black squares are blocked, and you cannot use a square more than once.",
        "The highest-numbered clue completes the chain and may be the terminal square.",
        "The grid wraps around both directions: the left edge is adjacent to the right edge, and the top edge is adjacent to the bottom edge.",
    ],
    "box": [
        "Start at the coloured clue and follow the numbered chain across the surface of the box.",
        "Move between cells that share an edge on a face, including across a box edge where the surface cells meet. Diagonal moves and moves through the inside of the box are not allowed. Black cells are blocked, and you cannot use a cell more than once.",
        "The highest-numbered clue completes the chain and may be the terminal cell.",
        "Adjacency follows the box surface, not the flattened drawing. Each cell connects to its four surface neighbours, with face-to-face transitions handled at the box edges.",
    ],
}

TITLES = {
    "classic": "Numstep: Classic",
    "cube": "Numstep: Cube",
    "torus": "Numstep: Torus",
    "box": "Numstep: Box",
}


def draw_wrapped(c, text, x, y, width, font="Helvetica", size=7.2, leading=8.5):
    words = text.split()
    lines = []
    line = ""
    for word in words:
        candidate = f"{line} {word}".strip()
        if c.stringWidth(candidate, font, size) <= width:
            line = candidate
        else:
            if line:
                lines.append(line)
            line = word
    if line:
        lines.append(line)
    c.setFont(font, size)
    for line in lines:
        c.drawString(x, y, line)
        y -= leading
    return y


def draw_header(c, title, day):
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(PAGE_W / 2, PAGE_H - MARGIN, title)
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(PAGE_W / 2, PAGE_H - MARGIN - 13, FOOTER)
    c.setFont("Helvetica", 8)
    c.drawCentredString(PAGE_W / 2, PAGE_H - MARGIN - 25, day)


def draw_rules(c, variant, top_y):
    c.setFont("Helvetica-Bold", 9)
    c.drawCentredString(PAGE_W / 2, top_y, "HOW TO PLAY")
    y = top_y - 12
    for rule in RULES[variant]:
        y = draw_wrapped(c, rule, MARGIN + 8, y, PAGE_W - 2 * MARGIN - 16)
        y -= 3
    return y


def draw_footer(c):
    c.setFont("Helvetica-Oblique", 8)
    c.drawCentredString(PAGE_W / 2, 14, FOOTER)


def draw_grid(c, grid, x, y, size, solution=False, title=None, upside_down=False):
    n = len(grid)
    cell = size / n
    c.saveState()
    if upside_down:
        c.translate(x + size / 2, y + size / 2)
        c.rotate(180)
        x0, y0 = -size / 2, -size / 2
    else:
        x0, y0 = x, y

    if title:
        c.setFont("Helvetica-Bold", 7 if solution else 9)
        c.drawCentredString(x0 + size / 2, y0 + size + (5 if solution else 7), title)

    c.setFillColorRGB(0, 0, 0)
    for row in range(n):
        for col in range(n):
            value = grid[row][col]
            if value == 0:
                c.rect(x0 + col * cell, y0 + (n - row - 1) * cell, cell, cell, fill=1, stroke=0)

    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.2 if solution else 0.5)
    for i in range(n + 1):
        c.line(x0 + i * cell, y0, x0 + i * cell, y0 + size)
        c.line(x0, y0 + i * cell, x0 + size, y0 + i * cell)

    font_size = max(1.5, min(4.2, cell * 0.24)) if solution else max(4, min(15, cell * 0.34))
    font = "Helvetica" if solution else "Helvetica-Bold"
    c.setFont(font, font_size)
    for row in range(n):
        for col in range(n):
            value = grid[row][col]
            if value == 0 or (not solution and value != 1 and value % 10 != 0):
                continue
            cx = x0 + col * cell + cell / 2
            cy = y0 + (n - row - 1) * cell + cell / 2
            text = str(value)
            c.drawString(cx - c.stringWidth(text, font, font_size) / 2, cy - font_size * 0.35, text)
    c.restoreState()


def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def load_planar_data(variant, day):
    directory = ROOT / "games" / ("numstep" if variant == "classic" else "numstep-taurus") / "data"
    grids = []
    for size in (5, 7, 9):
        path = directory / f"{size}x{size}" / f"{day}.json"
        if not path.exists():
            raise FileNotFoundError(f"Missing {variant} daily data: {path}")
        grids.append(load_json(path)["solution"])
    return grids


def render_classic_or_torus(variant, day, output):
    grids = load_planar_data(variant, day)
    c = canvas.Canvas(str(output), pagesize=A4)
    draw_header(c, TITLES[variant], day)
    rules_bottom = draw_rules(c, variant, PAGE_H - MARGIN - 40)

    small_size = 150
    small_gap = 44
    small_y = rules_bottom - small_size - 20
    total_width = 2 * small_size + small_gap
    left = (PAGE_W - total_width) / 2
    draw_grid(c, grids[0], left, small_y, small_size, title="5 x 5")
    draw_grid(c, grids[1], left + small_size + small_gap, small_y, small_size, title="7 x 7")

    large_size = 260
    large_y = small_y - large_size - 58
    draw_grid(c, grids[2], (PAGE_W - large_size) / 2, large_y, large_size, title="9 x 9")

    solution_size = 54
    solution_gap = 12
    solution_y = 30
    start_x = (PAGE_W - (3 * solution_size + 2 * solution_gap)) / 2
    for i, grid in enumerate(grids):
        size = (5, 7, 9)[i]
        draw_grid(c, grid, start_x + i * (solution_size + solution_gap), solution_y, solution_size, solution=True, title=f"{size} x {size}", upside_down=True)
    draw_footer(c)
    c.save()


def render_cube(day, output):
    data = load_json(ROOT / "games/numstep-cube" / "data" / f"{day}.json")
    grid = data["solution"]
    c = canvas.Canvas(str(output), pagesize=A4)
    draw_header(c, TITLES["cube"], day)
    rules_bottom = draw_rules(c, "cube", PAGE_H - MARGIN - 40)

    size = 190
    gap_x = 34
    gap_y = 34
    left = (PAGE_W - 2 * size - gap_x) / 2
    top = rules_bottom - size - 20
    positions = [(left, top), (left + size + gap_x, top), (left, top - size - gap_y), (left + size + gap_x, top - size - gap_y)]
    for layer, (x, y) in enumerate(positions):
        draw_grid(c, grid[layer], x, y, size, title=f"Layer {layer + 1}")

    solution_size = 78
    solution_gap = 12
    solution_x = (PAGE_W - 3 * solution_size - 2 * solution_gap) / 2
    solution_y = 54
    for layer in range(3):
        draw_grid(c, grid[layer], solution_x + layer * (solution_size + solution_gap), solution_y, solution_size, solution=True, title=f"Layer {layer + 1}", upside_down=True)
    draw_footer(c)
    c.save()


FACES = ("TOP", "BOTTOM", "LEFT", "FRONT", "RIGHT", "BACK")
NET_POSITIONS = {"TOP": (1, 0), "LEFT": (0, 1), "FRONT": (1, 1), "RIGHT": (2, 1), "BACK": (3, 1), "BOTTOM": (1, 2)}


def draw_box_net(c, faces, x, y, face_size, solution=False, upside_down=False):
    c.saveState()
    total_w = 4 * face_size
    total_h = 3 * face_size
    if upside_down:
        c.translate(x + total_w / 2, y + total_h / 2)
        c.rotate(180)
        x0, y0 = -total_w / 2, -total_h / 2
    else:
        x0, y0 = x, y

    cell = face_size / 3
    for face in FACES:
        nx, ny = NET_POSITIONS[face]
        fx = x0 + nx * face_size
        fy = y0 + (2 - ny) * face_size
        grid = faces[face]
        for row in range(3):
            for col in range(3):
                value = grid[row][col]
                px = fx + col * cell
                py = fy + (2 - row) * cell
                if value == 0:
                    c.setFillColorRGB(0, 0, 0)
                    c.rect(px, py, cell, cell, fill=1, stroke=0)
                c.setStrokeColorRGB(0, 0, 0)
                c.setLineWidth(0.2 if solution else 0.5)
                c.rect(px, py, cell, cell, fill=0, stroke=1)
                if value and (solution or value == 1 or value % 10 == 0):
                    font = "Helvetica" if solution else "Helvetica-Bold"
                    font_size = 3.2 if solution else max(5, min(12, cell * 0.34))
                    c.setFont(font, font_size)
                    c.drawCentredString(px + cell / 2, py + cell * 0.34, str(value))
    c.restoreState()


def render_box(day, output):
    data = load_json(ROOT / "games/numstep-box" / "data" / f"{day}.json")
    faces = data["faces"]
    c = canvas.Canvas(str(output), pagesize=A4)
    draw_header(c, TITLES["box"], day)
    rules_bottom = draw_rules(c, "box", PAGE_H - MARGIN - 40)

    face_size = min(126, (PAGE_W - 2 * MARGIN) / 4)
    net_w = 4 * face_size
    net_h = 3 * face_size
    net_x = (PAGE_W - net_w) / 2
    net_y = rules_bottom - net_h - 18
    draw_box_net(c, faces, net_x, net_y, face_size)

    solution_size = 62
    solution_x = (PAGE_W - 4 * solution_size) / 2
    solution_y = 56
    draw_box_net(c, faces, solution_x, solution_y, solution_size, solution=True, upside_down=True)
    c.setFont("Helvetica-Bold", 7)
    c.drawCentredString(PAGE_W / 2, solution_y + 3 * solution_size + 8, "SOLUTION")
    draw_footer(c)
    c.save()


def main():
    day = date.today().isoformat()
    jobs = [
        ("classic", ROOT / "games/numstep/printables" / f"{day}.pdf"),
        ("cube", ROOT / "games/numstep-cube/printables" / f"{day}.pdf"),
        ("torus", ROOT / "games/numstep-taurus/printables" / f"{day}.pdf"),
        ("box", ROOT / "games/numstep-box/printables" / f"{day}.pdf"),
    ]
    for variant, output in jobs:
        output.parent.mkdir(parents=True, exist_ok=True)
        if variant in ("classic", "torus"):
            render_classic_or_torus(variant, day, output)
        elif variant == "cube":
            render_cube(day, output)
        else:
            render_box(day, output)
        print(f"Generated {variant} printable: {output}")


if __name__ == "__main__":
    main()
