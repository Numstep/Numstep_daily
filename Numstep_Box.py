import random
from datetime import date

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from functools import lru_cache


# ============================================================
# SETTINGS
# ============================================================

# Cube size.
# n = 4 gives 6 * 4 * 4 = 96 surface squares.
N = 4 

# Minimum proportion of the cube surface that the walk must cover.
COVERAGE_THRESHOLD = 0.6

# Output file.
OUTPUT_FILENAME = (
    f"Numstep_Cube_Unique_{date.today().strftime('%Y-%m-%d')}.pdf"
)

# Stop the uniqueness search as soon as two solutions are found.
MAX_SOLUTIONS = 2

# Clues shown to the player: 1 and multiples of 10.
CLUE_INTERVAL = 10


# ============================================================
# CUBE GEOMETRY
# ============================================================

# Faces are arranged as a conventional cube net:
#
#                 TOP
#                  |
#          LEFT - FRONT - RIGHT - BACK
#                  |
#                BOTTOM
#
# Each face contains n x n squares.
#
# IMPORTANT:
# The net is ONLY a drawing convention.  The adjacency graph below
# represents the actual surface of a folded cube.

FACES = (
    "TOP",
    "BOTTOM",
    "LEFT",
    "FRONT",
    "RIGHT",
    "BACK",
)

# Position of each face in the printed net, in face-width units.
NET_POSITIONS = {
    "TOP":    (1, 0),
    "LEFT":   (0, 1),
    "FRONT":  (1, 1),
    "RIGHT":  (2, 1),
    "BACK":   (3, 1),
    "BOTTOM": (1, 2),
}


def cube_surface_cells(n):
    """Return every surface square as (face, row, col)."""
    return [
        (face, row, col)
        for face in FACES
        for row in range(n)
        for col in range(n)
    ]


def add_edge_adjacency(neighbours, a, b):
    """Add an undirected edge to the cube-surface graph."""
    neighbours[a].append(b)
    neighbours[b].append(a)


def build_cube_neighbours(n):
    """
    Build the true adjacency graph of the surface of an n x n x n cube.

    Cells are represented as:
        (face, row, col)

    The four directions on each face are:
        up    = row - 1
        down  = row + 1
        left  = col - 1
        right = col + 1

    When movement reaches a face boundary, the corresponding edge
    is joined to the physically adjacent edge of the cube.

    The mapping is written explicitly below so that the generator,
    solver and renderer all use the same cube model.
    """
    cells = cube_surface_cells(n)
    neighbours = {cell: [] for cell in cells}

    # --------------------------------------------------------
    # Connections within each individual face.
    # --------------------------------------------------------

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

    # --------------------------------------------------------
    # Face-to-face edge mappings.
    #
    # Each mapping gives corresponding cells along two touching
    # cube edges.  The order is reversed where the physical fold
    # requires it.
    # --------------------------------------------------------

    # FRONT <-> TOP
    for col in range(n):
        add_edge_adjacency(
            neighbours,
            ("FRONT", 0, col),
            ("TOP", n - 1, col),
        )

    # FRONT <-> BOTTOM
    for col in range(n):
        add_edge_adjacency(
            neighbours,
            ("FRONT", n - 1, col),
            ("BOTTOM", 0, col),
        )

    # FRONT <-> LEFT
    for row in range(n):
        add_edge_adjacency(
            neighbours,
            ("FRONT", row, 0),
            ("LEFT", row, n - 1),
        )

    # FRONT <-> RIGHT
    for row in range(n):
        add_edge_adjacency(
            neighbours,
            ("FRONT", row, n - 1),
            ("RIGHT", row, 0),
        )

    # LEFT <-> TOP
    for row in range(n):
        add_edge_adjacency(
            neighbours,
            ("LEFT", 0, row),
            ("TOP", row, 0),
        )

    # LEFT <-> BOTTOM
    for row in range(n):
        add_edge_adjacency(
            neighbours,
            ("LEFT", n - 1, row),
            ("BOTTOM", n - 1 - row, 0),
        )

    # RIGHT <-> TOP
    for row in range(n):
        add_edge_adjacency(
            neighbours,
            ("RIGHT", 0, row),
            ("TOP", row, n - 1),
        )

    # RIGHT <-> BOTTOM
    for row in range(n):
        add_edge_adjacency(
            neighbours,
            ("RIGHT", n - 1, row),
            ("BOTTOM", row, n - 1),
        )

    # BACK <-> TOP
    for col in range(n):
        add_edge_adjacency(
            neighbours,
            ("BACK", 0, col),
            ("TOP", 0, n - 1 - col),
        )

    # BACK <-> BOTTOM
    for col in range(n):
        add_edge_adjacency(
            neighbours,
            ("BACK", n - 1, col),
            ("BOTTOM", n - 1, col),
        )

    # LEFT <-> BACK
    for row in range(n):
        add_edge_adjacency(
            neighbours,
            ("LEFT", row, n - 1),
            ("BACK", row, 0),
        )

    # RIGHT <-> BACK
    for row in range(n):
        add_edge_adjacency(
            neighbours,
            ("RIGHT", row, n - 1),
            ("BACK", row, n - 1),
        )

    # Remove duplicate neighbours (edge mappings are deliberately
    # added after the within-face links).
    for cell in neighbours:
        neighbours[cell] = list(dict.fromkeys(neighbours[cell]))

    return neighbours


# ============================================================
# COUNT PUZZLE SOLUTIONS
# ============================================================

def count_solutions(grid, neighbours, max_solutions=2):
    """
    Count complete paths satisfying the displayed clues.

    grid is a dictionary:
        (face, row, col) -> step number
    or 0 for a non-walk cell.

    In this cube version every surface square belongs to the walk,
    so all surface cells are normally non-zero.
    """
    white_cells = [
        cell for cell, number in grid.items()
        if number != 0
    ]

    total_steps = len(white_cells)

    # --------------------------------------------------------
    # CREATE CLUE LOOKUPS
    # --------------------------------------------------------

    clue_positions = {}
    cell_clues = {}

    for cell, number in grid.items():
        if number == 1 or number % CLUE_INTERVAL == 0:
            clue_positions[number] = cell
            cell_clues[cell] = number

    if 1 not in clue_positions:
        return 0

    start_cell = clue_positions[1]

    # --------------------------------------------------------
    # RECURSIVE SEARCH
    # --------------------------------------------------------

    solutions_found = 0
    visited = {start_cell}

    # A small cache is useful for dead states, but we must not cache
    # the number of solutions globally because we stop after two and
    # because the clue constraints are incorporated into the state.
    @lru_cache(maxsize=None)
    def can_finish(cell, step, visited_frozen):
        """
        Return the number of completions from this state, capped at 2.

        This helper is deliberately kept separate from the outer search
        so the solver can reuse dead-end states.
        """
        if step == total_steps:
            return 1

        visited_local = set(visited_frozen)
        next_step = step + 1
        count = 0

        for new_cell in neighbours[cell]:
            if new_cell in visited_local:
                continue

            # Fixed clue on the destination cell.
            if new_cell in cell_clues:
                if cell_clues[new_cell] != next_step:
                    continue

            # If next_step has a clue, we must land on it.
            if next_step in clue_positions:
                if new_cell != clue_positions[next_step]:
                    continue

            visited_local.add(new_cell)

            subtotal = can_finish(
                new_cell,
                next_step,
                tuple(sorted(visited_local)),
            )

            visited_local.remove(new_cell)

            count += subtotal

            if count >= max_solutions:
                return max_solutions

        return count

    # The tuple representation makes the cache key deterministic.
    result = can_finish(
        start_cell,
        1,
        tuple(sorted(visited)),
    )

    return min(result, max_solutions)


# ============================================================
# GENERATE SELF-AVOIDING WALK ON CUBE SURFACE
# ============================================================

def generate_walk(n, threshold=0.70):
    """
    Generate a self-avoiding walk on the surface of an n-cube.

    There are 6*n*n surface squares.

    The walk may cross from one face to another whenever the two
    squares share an actual cube edge.
    """
    total_cells = 6 * n * n
    required_steps = threshold * total_cells

    neighbours = build_cube_neighbours(n)
    attempts = 0

    while True:
        attempts += 1

        # 0 = not part of walk
        # positive number = step number
        grid = {
            cell: 0
            for cell in cube_surface_cells(n)
        }

        # Random starting surface square.
        start = random.choice(list(grid))
        current = start

        grid[current] = 1
        steps = 1
        visited = {current}

        # --------------------------------------------------------
        # GENERATE RANDOM SELF-AVOIDING WALK
        # --------------------------------------------------------

        while True:
            possible_moves = [
                cell
                for cell in neighbours[current]
                if cell not in visited
            ]

            if not possible_moves:
                break

            # Randomly choose one of the currently available
            # surface neighbours.
            current = random.choice(possible_moves)

            steps += 1
            grid[current] = steps
            visited.add(current)

        # --------------------------------------------------------
        # CHECK COVERAGE
        # --------------------------------------------------------

        if steps < required_steps:
            continue

        print(
            f"Checking {n} x {n} cube candidate "
            f"with {steps}/{total_cells} surface squares "
            f"({steps / total_cells * 100:.1f}%)..."
        )

        # --------------------------------------------------------
        # CHECK UNIQUENESS
        # --------------------------------------------------------

        solution_count = count_solutions(
            grid,
            neighbours,
            max_solutions=MAX_SOLUTIONS,
        )

        print(f"  Solutions found: {solution_count}")

        # --------------------------------------------------------
        # ACCEPT ONLY UNIQUE PUZZLES
        # --------------------------------------------------------

        if solution_count == 1:
            print(
                f"  Unique cube puzzle found "
                f"after {attempts} attempts."
            )
            return grid, steps


# ============================================================
# DRAW CUBE-NET PUZZLE
# ============================================================

def draw_cube_net(
    c,
    grid,
    n,
    x_start,
    y_start,
    cell_size,
):
    """
    Draw the six faces as a cube net.

    x_start, y_start refer to the bottom-left corner of the
    complete net's bounding box.

    The internal grid remains a cube-surface graph; this function
    is only responsible for displaying it as a flat net.
    """

    face_size = n * cell_size

    # Determine bounding box of the net.
    min_net_x = min(x for x, y in NET_POSITIONS.values())
    max_net_x = max(x for x, y in NET_POSITIONS.values())
    min_net_y = min(y for x, y in NET_POSITIONS.values())
    max_net_y = max(y for x, y in NET_POSITIONS.values())

    net_width = (max_net_x - min_net_x + 1) * face_size
    net_height = (max_net_y - min_net_y + 1) * face_size

    def face_origin(face):
        net_x, net_y = NET_POSITIONS[face]

        # Flip net-y so the dictionary's row 0 is at the top.
        x = x_start + (net_x - min_net_x) * face_size
        y = (
            y_start
            + (max_net_y - net_y) * face_size
        )
        return x, y


   

    # --------------------------------------------------------
    # BLACK CELLS
    # --------------------------------------------------------

    c.setFillColorRGB(0, 0, 0)

    for face in FACES:
        face_x, face_y = face_origin(face)

        for row in range(n):
            for col in range(n):
                number = grid[(face, row, col)]

                if number != 0:
                    continue

                x = face_x + col * cell_size
                y = face_y + (n - row - 1) * cell_size

                c.rect(
                    x,
                    y,
                    cell_size,
                    cell_size,
                    fill=1,
                    stroke=0,
                )

    # --------------------------------------------------------
    # FACE GRID LINES
    # --------------------------------------------------------

    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(
        max(0.35, min(0.8, cell_size / 30))
    )

    for face in FACES:
        face_x, face_y = face_origin(face)

        for i in range(n + 1):
            x = face_x + i * cell_size
            c.line(
                x,
                face_y,
                x,
                face_y + face_size,
            )

            y = face_y + i * cell_size
            c.line(
                face_x,
                y,
                face_x + face_size,
                y,
            )

    # Slightly heavier outer edge around each face.
    c.setLineWidth(
        max(1.5, min(1.2, cell_size / 18))
    )
    
    c.setStrokeColorRGB(50, 0, 0)

    for face in FACES:
        face_x, face_y = face_origin(face)

        c.rect(
            face_x,
            face_y,
            face_size,
            face_size,
            fill=0,
            stroke=1,
        )

    # --------------------------------------------------------
    # CLUES
    # --------------------------------------------------------

    font_size = max(
        5,
        min(15, cell_size * 0.34),
    )

    c.setFont(
        "Helvetica-Bold",
        font_size,
    )

    c.setFillColorRGB(0, 0, 0)

    for face in FACES:
        face_x, face_y = face_origin(face)

        for row in range(n):
            for col in range(n):
                number = grid[(face, row, col)]

                if not (
                    number == 1
                    or number % CLUE_INTERVAL == 0
                ):
                    continue

                x = (
                    face_x
                    + col * cell_size
                    + cell_size / 2
                )

                y = (
                    face_y
                    + (n - row - 1) * cell_size
                    + cell_size / 2
                )

                text = str(number)

                text_width = c.stringWidth(
                    text,
                    "Helvetica-Bold",
                    font_size,
                )

                c.drawString(
                    x - text_width / 2,
                    y - font_size * 0.35,
                    text,
                )


# ============================================================
# DRAW CUBE-NET SOLUTION
# ============================================================

def draw_cube_net_solution(
    c,
    grid,
    n,
    x_start,
    y_start,
    cell_size,
):
    """
    Draw the complete numbered solution as the same cube net.

    It is rotated 180 degrees so it can be printed at the bottom
    of a page for the usual upside-down solution convention.
    """

    face_size = n * cell_size

    min_net_x = min(x for x, y in NET_POSITIONS.values())
    max_net_x = max(x for x, y in NET_POSITIONS.values())
    min_net_y = min(y for x, y in NET_POSITIONS.values())
    max_net_y = max(y for x, y in NET_POSITIONS.values())

    net_width = (max_net_x - min_net_x + 1) * face_size
    net_height = (max_net_y - min_net_y + 1) * face_size

    c.saveState()

    centre_x = x_start + net_width / 2
    centre_y = y_start + net_height / 2

    c.translate(centre_x, centre_y)
    c.rotate(180)

    def face_origin_local(face):
        net_x, net_y = NET_POSITIONS[face]

        x = (
            -net_width / 2
            + (net_x - min_net_x) * face_size
        )

        y = (
            -net_height / 2
            + (max_net_y - net_y) * face_size
        )

        return x, y

    # Black cells
    c.setFillColorRGB(0, 0, 0)

    for face in FACES:
        face_x, face_y = face_origin_local(face)

        for row in range(n):
            for col in range(n):
                if grid[(face, row, col)] == 0:
                    x = face_x + col * cell_size
                    y = face_y + (n - row - 1) * cell_size

                    c.rect(
                        x,
                        y,
                        cell_size,
                        cell_size,
                        fill=1,
                        stroke=0,
                    )

    # Grid
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.25)

    for face in FACES:
        face_x, face_y = face_origin_local(face)

        for i in range(n + 1):
            x = face_x + i * cell_size
            c.line(
                x,
                face_y,
                x,
                face_y + face_size,
            )

            y = face_y + i * cell_size
            c.line(
                face_x,
                y,
                face_x + face_size,
                y,
            )

    # Solution numbers
    font_size = max(
        2,
        min(6, cell_size * 0.25),
    )

    c.setFont(
        "Helvetica",
        font_size,
    )

    c.setFillColorRGB(0, 0, 0)

    for face in FACES:
        face_x, face_y = face_origin_local(face)

        for row in range(n):
            for col in range(n):
                number = grid[(face, row, col)]

                if number == 0:
                    continue

                x = (
                    face_x
                    + col * cell_size
                    + cell_size / 2
                )

                y = (
                    face_y
                    + (n - row - 1) * cell_size
                    + cell_size / 2
                )

                text = str(number)

                text_width = c.stringWidth(
                    text,
                    "Helvetica",
                    font_size,
                )

                c.drawString(
                    x - text_width / 2,
                    y - font_size * 0.35,
                    text,
                )

    c.restoreState()


# ============================================================
# CREATE PAGE
# ============================================================

def create_page(
    grid,
    n,
    filename,
):
    """
    Create one A4 page containing one cube-net puzzle.

    The solution is included small at the bottom of the same page,
    following the convention of the original generator.
    """

    page_width, page_height = A4

    c = canvas.Canvas(
        filename,
        pagesize=A4,
    )

    margin = 30

    # ========================================================
    # HEADER
    # ========================================================

    c.setFillColorRGB(0, 0, 0)

    c.setFont(
        "Helvetica-Bold",
        24,
    )

    c.drawCentredString(
        page_width / 2,
        page_height - margin,
        "Numstep: Box",
    )

    today = date.today()

    c.setFont(
        "Helvetica",
        8,
    )

    c.drawCentredString(
        page_width / 2,
        page_height - margin - 13,
        today.strftime("%d %B %Y"),
    )

    # ========================================================
    # RULES
    # ========================================================

    rules_top = page_height - margin - 30

    c.setFont(
        "Helvetica-Bold",
        10,
    )

    c.drawCentredString(
        page_width / 2,
        rules_top,
        "HOW TO PLAY",
    )

    rules = [
        "Complete the continuous path through every square on the cube surface.",
        "The path begins at 1 and proceeds through consecutive numbers.",
        "Squares sharing an edge on the cube surface are adjacent.",
        "You may move across an edge from one face of the cube to another.",
        "Move only between adjacent squares; never diagonally.",
        "Every surface square must be used exactly once.",
    ]

    c.setFont(
        "Helvetica",
        8.5,
    )

    for i, rule in enumerate(rules):
        c.drawCentredString(
            page_width / 2,
            rules_top - 21 - i * 9,
            rule,
        )

    # ========================================================
    # PUZZLE NUMBER / COVERAGE
    # ========================================================

    total_cells = 6 * n * n
    visited = sum(
        1 for number in grid.values()
        if number != 0
    )

    info_y = rules_top - 21 - len(rules) * 9 - 8

    c.setFont(
        "Helvetica-Bold",
        9,
    )

    c.drawCentredString(
        page_width / 2,
        info_y,
        f"{n} × {n} × {n} Box :"
        f"{visited} of {total_cells} surface squares",
    )

    # ========================================================
    # LARGE CUBE NET
    # ========================================================

    # The six-face net is 4 face-widths across and 3 face-heights
    # tall.  Work out the largest square-cell size that fits.
    net_face_size_by_width = (
        (page_width - 2 * margin) / 4
    )

    net_face_size_by_height = (
        (page_height * 0.66) / 3
    )

    face_size = min(
        net_face_size_by_width,
        net_face_size_by_height,
    )

    cell_size = face_size / n

    net_width = 4 * face_size
    net_height = 3 * face_size

    puzzle_x = (
        page_width - net_width
    ) / 2

    # Keep a useful gap beneath the rules.
    puzzle_y = (
        info_y
        - 30
        - net_height
    )

    draw_cube_net(
        c,
        grid,
        n,
        puzzle_x,
        puzzle_y,
        cell_size,
    )

        # --------------------------------------------------------
    # TEXT BOX ON LEFT
    # --------------------------------------------------------
    

    # ========================================================
    # SOLUTION
    # ========================================================

    solution_face_size = 75
    solution_cell_size = solution_face_size / n

    solution_net_width = 4 * solution_face_size
    solution_net_height = 3 * solution_face_size

   

    solution_y = 14
    solution_x = (
        page_width - solution_net_width
    ) / 2 +100
    
    text_box_x = 100
    text_box_width = (
        solution_x
        - text_box_x
        - 60
    )
    
    text_box_height = 45
    
    text_box_y = (
        solution_y
        + (solution_face_size*3 - text_box_height) / 2
    )
    
    # Border around text box
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.5)
    
    c.rect(
        text_box_x,
        text_box_y,
        text_box_width,
        text_box_height,
        fill=0,
        stroke=1
    )
    
    # Text inside box
    c.setFillColorRGB(0, 0, 0)
    
    c.setFont(
        "Helvetica-Bold",
        7
    )
    
    c.drawString(
        text_box_x + 7,
        text_box_y + text_box_height - 13,
        "For more puzzles visit:"
    )
    
    c.setFont(
        "Helvetica",
        7
    )
    
    c.drawString(
        text_box_x + 7,
        text_box_y + text_box_height - 25,
        "https://ko-fi.com/numstep"
    )
    
    c.drawString(
        text_box_x + 7,
        text_box_y + text_box_height - 36,
        "WebApp Coming Soon"
    )

    draw_cube_net_solution(
        c,
        grid,
        n,
        solution_x,
        solution_y,
        solution_cell_size,
    )

    # Small label above the solution.
    c.saveState()

    c.setFont(
        "Helvetica",
        8,
    )

    c.setFillColorRGB(0, 0, 0)

    c.drawCentredString(
        page_width / 2 +120,
        solution_y + solution_net_height + 8,
        "SOLUTION",
    )

    c.restoreState()

    c.save()


# ============================================================
# MAIN PROGRAM
# ============================================================

if __name__ == "__main__":

    print(
        f"Generating Numstep cube puzzle: "
        f"{N} x {N} x {N}"
    )

    total_surface = 6 * N * N

    print(
        f"Surface squares: {total_surface}"
    )

    grid, steps = generate_walk(
        N,
        threshold=COVERAGE_THRESHOLD,
    )

    print()
    print(
        f"Final puzzle: {steps}/{total_surface} "
        f"surface squares visited "
        f"({steps / total_surface * 100:.1f}%)"
    )

    print(
        f"Creating PDF: {OUTPUT_FILENAME}"
    )

    create_page(
        grid,
        N,
        OUTPUT_FILENAME,
    )

    print()
    print(
        f"PDF created: {OUTPUT_FILENAME}"
    )
