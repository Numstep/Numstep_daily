import random
from datetime import date

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4


# ============================================================
# SETTINGS
# ============================================================

COVERAGE_THRESHOLD = 0.80

# Starting cube size
N = 3

# Output filename
OUTPUT_FILENAME = f"numstep_cube_{N}x{N}x{N}.pdf"


# ============================================================
# GENERATE 3D SELF-AVOIDING WALK
# ============================================================

def generate_walk(n, threshold=COVERAGE_THRESHOLD):

    total_cubes = n * n * n
    required_cubes = int(total_cubes * threshold) + 1

    while True:

        # ----------------------------------------------------
        # 3D GRID
        #
        # grid[layer][row][column]
        #
        # 0 = not visited
        # positive number = step number
        # ----------------------------------------------------

        grid = [
            [
                [0 for _ in range(n)]
                for _ in range(n)
            ]
            for _ in range(n)
        ]

        # ----------------------------------------------------
        # RANDOM STARTING POSITION
        # ----------------------------------------------------

        layer = random.randrange(n)
        row = random.randrange(n)
        col = random.randrange(n)

        grid[layer][row][col] = 1

        steps = 1

        # ----------------------------------------------------
        # SIX POSSIBLE DIRECTIONS
        #
        # Four directions within a layer
        # + one layer up
        # + one layer down
        # ----------------------------------------------------

        directions = [
            (0, -1, 0),   # left
            (0, 1, 0),    # right
            (0, 0, -1),   # up
            (0, 0, 1),    # down
            (-1, 0, 0),   # previous layer
            (1, 0, 0)     # next layer
        ]

        # ----------------------------------------------------
        # CONTINUE UNTIL THE WALK IS TRAPPED
        # ----------------------------------------------------

        while True:

            possible_moves = []

            for dl, dr, dc in directions:

                new_layer = layer + dl
                new_row = row + dr
                new_col = col + dc

                if (
                    0 <= new_layer < n
                    and 0 <= new_row < n
                    and 0 <= new_col < n
                    and grid[new_layer][new_row][new_col] == 0
                ):
                    possible_moves.append(
                        (
                            new_layer,
                            new_row,
                            new_col
                        )
                    )

            # ------------------------------------------------
            # NO POSSIBLE MOVE
            # The walk is genuinely trapped.
            # ------------------------------------------------

            if not possible_moves:
                break

            # ------------------------------------------------
            # RANDOMLY CHOOSE ONE OF THE AVAILABLE CUBES
            # ------------------------------------------------

            layer, row, col = random.choice(
                possible_moves
            )

            steps += 1

            grid[layer][row][col] = steps

        # ----------------------------------------------------
        # TEST COVERAGE ONLY AFTER THE WALK HAS ENDED
        # ----------------------------------------------------

        coverage = steps / total_cubes

        if coverage >= threshold:

            return grid, steps


# ============================================================
# COUNT SOLUTIONS
# ============================================================

def count_solutions(grid, n, max_solutions=2):

    total_cells = n * n * n

    # --------------------------------------------------------
    # FIND ALL WHITE CELLS
    # --------------------------------------------------------

    white_cells = []

    for layer in range(n):
        for row in range(n):
            for col in range(n):

                if grid[layer][row][col] != 0:
                    white_cells.append(
                        (layer, row, col)
                    )

    path_length = len(white_cells)

    # --------------------------------------------------------
    # FIND THE CLUE POSITIONS
    #
    # 1, 10, 20, 30, etc.
    # --------------------------------------------------------

    clues = {}

    for layer in range(n):

        for row in range(n):

            for col in range(n):

                number = grid[layer][row][col]

                if (
                    number != 0
                    and (
                        number == 1
                        or number % 10 == 0
                    )
                ):
                    clues[number] = (
                        layer,
                        row,
                        col
                    )

    # --------------------------------------------------------
    # STARTING POSITION
    # --------------------------------------------------------

    if 1 not in clues:
        return 0

    start = clues[1]

    # --------------------------------------------------------
    # SIX ORTHOGONAL DIRECTIONS
    # --------------------------------------------------------

    directions = [
        (1, 0, 0),
        (-1, 0, 0),
        (0, 1, 0),
        (0, -1, 0),
        (0, 0, 1),
        (0, 0, -1)
    ]

    # --------------------------------------------------------
    # SET OF ALREADY VISITED CELLS
    # --------------------------------------------------------

    visited = {start}

    # --------------------------------------------------------
    # STORE SOLUTIONS FOUND
    # --------------------------------------------------------

    solutions_found = 0

    # --------------------------------------------------------
    # MANHATTAN DISTANCE
    # --------------------------------------------------------

    def distance(a, b):

        return (
            abs(a[0] - b[0])
            + abs(a[1] - b[1])
            + abs(a[2] - b[2])
        )

    # --------------------------------------------------------
    # FIND NEXT CLUE
    # --------------------------------------------------------

    def next_clue(step):

        for clue_number in sorted(clues):

            if clue_number > step:
                return clue_number, clues[clue_number]

        return None, None

    # --------------------------------------------------------
    # DEPTH-FIRST SEARCH
    # --------------------------------------------------------

    def search(
            current,
            step):

        nonlocal solutions_found

        # Stop once we know the puzzle isn't unique
        if solutions_found >= max_solutions:
            return

        # ----------------------------------------------------
        # COMPLETE SOLUTION
        # ----------------------------------------------------

        if step == path_length:

            solutions_found += 1
            return

        # ----------------------------------------------------
        # CHECK WHETHER THERE IS A FUTURE CLUE
        # ----------------------------------------------------

        clue_number, clue_position = next_clue(step)

        # Number of moves from the current step
        # until the clue
        if clue_position is not None:

            moves_available = (
                clue_number - step
            )

            required_distance = distance(
                current,
                clue_position
            )

            # The clue is physically unreachable
            if required_distance > moves_available:
                return

            # On a grid with orthogonal movement,
            # parity must also match.
            if (
                required_distance % 2
                != moves_available % 2
            ):
                return

        # ----------------------------------------------------
        # FIND POSSIBLE NEXT MOVES
        # ----------------------------------------------------

        possible_moves = []

        for dl, dr, dc in directions:

            new_position = (
                current[0] + dl,
                current[1] + dr,
                current[2] + dc
            )

            new_layer = new_position[0]
            new_row = new_position[1]
            new_col = new_position[2]

            # Outside cube
            if not (
                0 <= new_layer < n
                and 0 <= new_row < n
                and 0 <= new_col < n
            ):
                continue

            # Black cell
            if grid[
                new_layer
            ][
                new_row
            ][
                new_col
            ] == 0:
                continue

            # Already visited
            if new_position in visited:
                continue

            possible_moves.append(
                new_position
            )

        # ----------------------------------------------------
        # RANDOMISE SEARCH ORDER
        #
        # This isn't necessary for correctness, but means
        # different puzzles don't always get searched in
        # exactly the same order.
        # ----------------------------------------------------

        random.shuffle(possible_moves)

        # ----------------------------------------------------
        # TEST EACH MOVE
        # ----------------------------------------------------

        for new_position in possible_moves:

            next_step = step + 1

            # ------------------------------------------------
            # IF THIS IS A CLUE, IT MUST BE THE RIGHT CELL
            # ------------------------------------------------

            if next_step in clues:

                if new_position != clues[next_step]:
                    continue

            # ------------------------------------------------
            # ADD CELL TO PATH
            # ------------------------------------------------

            visited.add(new_position)

            search(
                new_position,
                next_step
            )

            visited.remove(new_position)

            # ------------------------------------------------
            # STOP IF TWO SOLUTIONS FOUND
            # ------------------------------------------------

            if solutions_found >= max_solutions:
                return

    # --------------------------------------------------------
    # START SEARCH
    # --------------------------------------------------------

    search(
        start,
        1
    )

    return solutions_found

# ============================================================
# DRAW ONE 2D LAYER OF THE CUBE
# ============================================================

def draw_layer(
        c,
        grid,
        layer_number,
        x_start,
        y_start,
        grid_size,
        upside_down=False):

    n = len(grid)

    cell_size = grid_size / n

    # --------------------------------------------------------
    # SAVE GRAPHICS STATE
    # --------------------------------------------------------

    c.saveState()

    # --------------------------------------------------------
    # UPSIDE-DOWN SOLUTION
    # --------------------------------------------------------

    if upside_down:

        centre_x = (
            x_start
            + grid_size / 2
        )

        centre_y = (
            y_start
            + grid_size / 2
        )

        c.translate(
            centre_x,
            centre_y
        )

        c.rotate(180)

        draw_x = -grid_size / 2
        draw_y = -grid_size / 2

    else:

        draw_x = x_start
        draw_y = y_start

    # --------------------------------------------------------
    # BLACK CUBES
    # --------------------------------------------------------

    c.setFillColorRGB(0, 0, 0)

    for row in range(n):

        for col in range(n):

            number = grid[layer_number][row][col]

            if number == 0:

                x = (
                    draw_x
                    + col * cell_size
                )

                y = (
                    draw_y
                    + (n - row - 1)
                    * cell_size
                )

                c.rect(
                    x,
                    y,
                    cell_size,
                    cell_size,
                    fill=1,
                    stroke=0
                )

    # --------------------------------------------------------
    # GRID LINES
    # --------------------------------------------------------

    c.setStrokeColorRGB(0, 0, 0)

    if upside_down:

        c.setLineWidth(0.25)

    else:

        c.setLineWidth(
            max(
                0.25,
                min(0.7, grid_size / 500)
            )
        )

    for i in range(n + 1):

        x = (
            draw_x
            + i * cell_size
        )

        c.line(
            x,
            draw_y,
            x,
            draw_y + grid_size
        )

        y = (
            draw_y
            + i * cell_size
        )

        c.line(
            draw_x,
            y,
            draw_x + grid_size,
            y
        )

    # --------------------------------------------------------
    # NUMBERS
    # --------------------------------------------------------

    if upside_down:

        font_size = max(
            2,
            min(5, cell_size * 0.25)
        )

        font_name = "Helvetica"

    else:

        font_size = max(
            5,
            min(16, cell_size * 0.35)
        )

        font_name = "Helvetica-Bold"

    c.setFont(
        font_name,
        font_size
    )

    c.setFillColorRGB(0, 0, 0)

    for row in range(n):

        for col in range(n):

            number = grid[layer_number][row][col]

            # Solution shows everything
            #
            # Puzzle shows only 1 and multiples of 10
            # ------------------------------------------------

            if upside_down:

                if number == 0:
                    continue

            else:

                if (
                    number != 1
                    and number % 10 != 0
                ):
                    continue

            x = (
                draw_x
                + col * cell_size
                + cell_size / 2
            )

            y = (
                draw_y
                + (n - row - 1)
                * cell_size
                + cell_size / 2
            )

            text = str(number)

            text_width = c.stringWidth(
                text,
                font_name,
                font_size
            )

            c.drawString(
                x - text_width / 2,
                y - font_size * 0.35,
                text
            )

    # --------------------------------------------------------
    # RESTORE GRAPHICS STATE
    # --------------------------------------------------------

    c.restoreState()


# ============================================================
# DRAW LAYER TITLE
# ============================================================

def draw_layer_title(
        c,
        x,
        y,
        layer_number,
        n,
        upside_down=False):

    c.setFillColorRGB(0, 0, 0)

    if upside_down:

        font_size = 6

    else:

        font_size = 8

    c.setFont(
        "Helvetica-Bold",
        font_size
    )

    position = ""

    if layer_number == 0:
        position = " (Top)"

    elif layer_number == n - 1:
        position = " (Bottom)"

    c.drawCentredString(
        x,
        y,
        f"LAYER {layer_number + 1}{position}"
    )


# ============================================================
# CREATE PDF
# ============================================================

def create_pdf(
        grid,
        steps,
        n,
        filename):

    page_width, page_height = A4

    c = canvas.Canvas(
        filename,
        pagesize=A4
    )

    margin = 25

    # ========================================================
    # HEADER
    # ========================================================

    c.setFillColorRGB(0, 0, 0)

    c.setFont(
        "Helvetica-Bold",
        22
    )

    c.drawCentredString(
        page_width / 2,
        page_height - margin,
        "NUMSTEP: CUBE"
    )

    c.setFont(
        "Helvetica-Oblique",
        8
    )

    c.drawCentredString(
        page_width / 2,
        page_height - margin - 13,
        "a Puzzle by Ben Cornish"
    )

    today = date.today()

    c.setFont(
        "Helvetica",
        7
    )

    c.drawCentredString(
        page_width / 2,
        page_height - margin - 25,
        today.strftime("%d %B %Y")
    )

    # ========================================================
    # RULES
    # ========================================================

    rules_top = page_height - margin - 42

    c.setFont(
        "Helvetica-Bold",
        8
    )

    c.drawCentredString(
        page_width / 2,
        rules_top,
        "HOW TO PLAY"
    )

    rules = [
        "Complete the continuous path through every white cube.",
        "The path begins at 1 and proceeds through consecutive numbers.",
        "Each number must be directly connected to the previous number.",
        "You may move horizontally, vertically, or between adjacent layers.",
        "Every white cube must be used exactly once.",
        "Black cubes cannot be entered.",
        "The numbered clues (1 and multiples of 10) are fixed and cannot be moved."
    ]

    c.setFont(
        "Helvetica",
        6
    )

    line_height = 7

    for i, rule in enumerate(rules):

        c.drawCentredString(
            page_width / 2,
            rules_top
            - 10
            - i * line_height,
            rule
        )

    # ========================================================
    # PUZZLE LAYERS
    # ========================================================

    puzzle_top = (
        rules_top
        - 10
        - len(rules) * line_height
        - 18
    )

    # Four layers in a 2 × 2 arrangement
    grid_size = 200

    horizontal_gap = 35
    vertical_gap = 30

    total_width = (
        2 * grid_size
        + horizontal_gap
    )

    left_x = (
        page_width
        - total_width
    ) / 2

    right_x = (
        left_x
        + grid_size
        + horizontal_gap
    )

    top_y = (
        puzzle_top
        - grid_size
        - 12
    )

    bottom_y = (
        top_y
        - grid_size
        - vertical_gap
        - 12
    )

    positions = [
        (left_x, top_y),
        (right_x, top_y),
        (left_x, bottom_y),
        (right_x, bottom_y)
    ]

    # --------------------------------------------------------
    # DRAW FOUR PUZZLE LAYERS
    # --------------------------------------------------------

    for layer in range(n):

        x, y = positions[layer]

        draw_layer_title(
            c,
            x + grid_size / 2,
            y + grid_size + 8,
            layer,
            n
        )

        draw_layer(
            c,
            grid,
            layer,
            x,
            y,
            grid_size,
            upside_down=False
        )

    # ========================================================
    # SOLUTIONS
    # ========================================================

    solution_title_y = (
        bottom_y
        - 150
    )

    c.setFont(
        "Helvetica-Bold",
        8
    )

    c.drawCentredString(
        page_width / 2,
        solution_title_y,
        "SOLUTIONS"
    )

    # --------------------------------------------------------
    # FOUR SMALL SOLUTION GRIDS
    # --------------------------------------------------------

    solution_size = 100

    solution_gap = 15

    total_solution_width = (
        4 * solution_size
        + 3 * solution_gap
    )

    solution_x_start = (
        page_width
        - total_solution_width
    ) / 2

    solution_y = 120

    for layer in range(n):

        x = (
            solution_x_start
            + layer * (
                solution_size
                + solution_gap
            )
        )

        # Layer title
        draw_layer_title(
            c,
            x + solution_size / 2,
            solution_y + solution_size + 7,
            layer,
            n,
            upside_down=True
        )

        # Solution
        draw_layer(
            c,
            grid,
            layer,
            x,
            solution_y,
            solution_size,
            upside_down=True
        )

    # ========================================================
    # MORE PUZZLES BOX
    # ========================================================

    box_width = 130
    box_height = 45

    box_x = margin
    box_y = 12

    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.5)

    c.rect(
        box_x,
        box_y,
        box_width,
        box_height,
        fill=0,
        stroke=1
    )

    c.setFont(
        "Helvetica-Bold",
        7
    )

    c.drawString(
        box_x + 7,
        box_y + box_height - 13,
        "For more puzzles visit:"
    )

    c.setFont(
        "Helvetica",
        7
    )

    c.drawString(
        box_x + 7,
        box_y + box_height - 25,
        "www.ko-fi.com/numstep"
    )

    c.drawString(
        box_x + 7,
        box_y + box_height - 36,
        "Web App Coming Soon!"
    )


    # ========================================================
    # SAVE
    # ========================================================

    c.save()


## ============================================================
# GENERATE A UNIQUE PUZZLE
# ============================================================

n = int(
    input("Enter cube size N: ")
)

attempt = 0

while True:

    attempt += 1

    print()
    print(
        f"Generating puzzle "
        f"(attempt {attempt})..."
    )

    # --------------------------------------------------------
    # Generate a complete self-avoiding walk
    # --------------------------------------------------------

    grid, steps = generate_walk(n)

    coverage = (
        steps
        / (n * n * n)
        * 100
    )

    print(
        f"Coverage: {coverage:.1f}%"
    )

    # --------------------------------------------------------
    # Test uniqueness
    # --------------------------------------------------------

    print(
        "Testing uniqueness..."
    )

    number_of_solutions = count_solutions(
        grid,
        n,
        max_solutions=2
    )

    # --------------------------------------------------------
    # UNIQUE
    # --------------------------------------------------------

    if number_of_solutions == 1:

        print(
            "SUCCESS: exactly one solution found."
        )

        break

    # --------------------------------------------------------
    # MULTIPLE SOLUTIONS
    # --------------------------------------------------------

    elif number_of_solutions >= 2:

        print(
            "Rejected: multiple solutions."
        )

    # --------------------------------------------------------
    # NO SOLUTIONS
    # --------------------------------------------------------

    else:

        print(
            "Rejected: no valid solution found."
        )
total_cubes = n * n * n
coverage = steps / total_cubes * 100

print()
print("NUMSTEP: CUBE generated")
print(
    f"Cube: {n} × {n} × {n}"
)
print(
    f"Steps: {steps}"
)
print(
    f"Coverage: {coverage:.1f}%"
)

filename = (
    f"numstep_cube_{date.today().strftime('%Y-%m-%d')}.pdf"
)

create_pdf(
    grid,
    steps,
    n,
    filename
)

print()
print(f"PDF created: {filename}")