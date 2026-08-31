import random
import json
from datetime import date

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.pagesizes import A5

from functools import lru_cache


# ============================================================
# COUNT PUZZLE SOLUTIONS
# ============================================================

def count_solutions(grid, max_solutions=2):

    n = len(grid)

    # --------------------------------------------------------
    # COLLECT WHITE CELLS
    # --------------------------------------------------------

    white_cells = []

    for row in range(n):
        for col in range(n):

            if grid[row][col] != 0:
                white_cells.append((row, col))

    total_steps = len(white_cells)

    # --------------------------------------------------------
    # CREATE CLUE LOOKUPS
    # --------------------------------------------------------

    # step number -> required position
    clue_positions = {}

    # position -> required step number
    cell_clues = {}

    for row in range(n):
        for col in range(n):

            number = grid[row][col]

            # These are the clues shown to the player
            if number == 1 or number % 10 == 0:

                clue_positions[number] = (row, col)
                cell_clues[(row, col)] = number

    # Starting position must exist
    if 1 not in clue_positions:
        return 0

    start_row, start_col = clue_positions[1]

    # --------------------------------------------------------
    # NEIGHBOUR LOOKUP
    # --------------------------------------------------------

    directions = [
        (-1, 0),
        (1, 0),
        (0, -1),
        (0, 1)
    ]

    neighbours = {}

    for row, col in white_cells:

        cell_neighbours = []

        for dr, dc in directions:

            new_row = row + dr
            new_col = col + dc

            if (
                0 <= new_row < n
                and 0 <= new_col < n
                and grid[new_row][new_col] != 0
            ):
                cell_neighbours.append(
                    (new_row, new_col)
                )

        neighbours[(row, col)] = cell_neighbours

    # --------------------------------------------------------
    # RECURSIVE SEARCH
    # --------------------------------------------------------

    solutions_found = 0

    visited = {
        (start_row, start_col)
    }

    def search(row, col, step):

        nonlocal solutions_found

        # Stop as soon as we know the puzzle
        # is not unique
        if solutions_found >= max_solutions:
            return

        # ----------------------------------------------------
        # COMPLETE PATH
        # ----------------------------------------------------

        if step == total_steps:

            solutions_found += 1
            return

        next_step = step + 1

        # ----------------------------------------------------
        # TRY VALID NEIGHBOURS
        # ----------------------------------------------------

        for new_row, new_col in neighbours[(row, col)]:

            new_cell = (
                new_row,
                new_col
            )

            if new_cell in visited:
                continue

            # ------------------------------------------------
            # CHECK FIXED CLUES
            # ------------------------------------------------

            if new_cell in cell_clues:

                required_step = cell_clues[new_cell]

                if required_step != next_step:
                    continue

            # If the next step itself has a clue,
            # we must move directly to that clue.
            if next_step in clue_positions:

                if new_cell != clue_positions[next_step]:
                    continue

            # ------------------------------------------------
            # VISIT CELL
            # ------------------------------------------------

            visited.add(new_cell)

            search(
                new_row,
                new_col,
                next_step
            )

            visited.remove(new_cell)

            # Stop immediately after finding
            # the requested maximum
            if solutions_found >= max_solutions:
                return

    # Start search at clue 1
    search(
        start_row,
        start_col,
        1
    )

    return solutions_found

page_width, page_height = A5


# ============================================================
# GENERATE SELF-AVOIDING WALK
# ============================================================

def generate_walk(n, threshold=0.80):

    total_cells = n * n
    required_steps = threshold * total_cells

    attempts = 0

    while True:

        attempts += 1

        # 0 = not part of walk
        # positive number = step number
        grid = [
            [0 for _ in range(n)]
            for _ in range(n)
        ]

        # Random starting square
        row = random.randrange(n)
        col = random.randrange(n)

        grid[row][col] = 1
        steps = 1

        # Orthogonal movement only
        directions = [
            (-1, 0),
            (1, 0),
            (0, -1),
            (0, 1)
        ]

        # ----------------------------------------------------
        # GENERATE RANDOM SELF-AVOIDING WALK
        # ----------------------------------------------------

        while True:

            possible_moves = []

            for dr, dc in directions:

                new_row = row + dr
                new_col = col + dc

                if (
                    0 <= new_row < n
                    and 0 <= new_col < n
                    and grid[new_row][new_col] == 0
                ):
                    possible_moves.append(
                        (new_row, new_col)
                    )

            if not possible_moves:
                break

            row, col = random.choice(
                possible_moves
            )

            steps += 1
            grid[row][col] = steps

        # ----------------------------------------------------
        # CHECK COVERAGE
        # ----------------------------------------------------

        if steps < required_steps:
            continue

        print(
            f"Checking {n} x {n} candidate "
            f"with {steps} cells..."
        )

        # ----------------------------------------------------
        # CHECK UNIQUENESS
        # ----------------------------------------------------

        solution_count = count_solutions(
            grid,
            max_solutions=2
        )

        print(
            f"  Solutions found: {solution_count}"
        )

        # ----------------------------------------------------
        # ACCEPT ONLY UNIQUE PUZZLES
        # ----------------------------------------------------

        if solution_count == 1:

            print(
                f"  Unique puzzle found "
                f"after {attempts} attempts."
            )

            return grid, steps



# ============================================================
# EXPORT PUZZLE FOR WEBSITE
# ============================================================

def export_web_puzzle(grid, steps, filename):

    n = len(grid)

    # --------------------------------------------------------
    # Determine which numbers should be displayed as clues.
    # --------------------------------------------------------

    clues = []

    for row in grid:
        for number in row:

            if number == 1 or number % 10 == 0:
                clues.append(number)

    # --------------------------------------------------------
    # Flatten the grid into a single list.
    # --------------------------------------------------------

    solution = []

    for row in grid:
        for number in row:

            solution.append(number)

    # --------------------------------------------------------
    # Create the web puzzle data.
    # --------------------------------------------------------

    puzzle_data = {
        "date": str(date.today()),
        "size": n,
        "steps": steps,
        "clues": clues,
        "solution": solution
    }

    # --------------------------------------------------------
    # Write JSON file.
    # --------------------------------------------------------

    with open(
        filename,
        "w",
        encoding="utf-8"
    ) as f:

        json.dump(
            puzzle_data,
            f,
            indent=4
        )

    print(
        f"  Web puzzle saved as: {filename}"
    )

# ============================================================
# DRAW PUZZLE
# ============================================================

def draw_puzzle(
        c,
        grid,
        x_start,
        y_start,
        grid_size):

    n = len(grid)
    cell_size = grid_size / n

    # --------------------------------------------------------
    # TITLE
    # --------------------------------------------------------

    c.setFillColorRGB(0, 0, 0)

    title_size = max(
        7,
        min(13, grid_size / 12)
    )

    c.setFont(
        "Helvetica-Bold",
        title_size
    )

    c.drawCentredString(
        x_start + grid_size / 2,
        y_start + grid_size + 9,
        f"{n} x {n}"
    )

    # --------------------------------------------------------
    # BLACK CELLS
    # --------------------------------------------------------

    c.setFillColorRGB(0, 0, 0)

    for row in range(n):

        for col in range(n):

            if grid[row][col] == 0:

                x = (
                    x_start
                    + col * cell_size
                )

                y = (
                    y_start
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
    # GRID
    # --------------------------------------------------------

    c.setStrokeColorRGB(0, 0, 0)

    c.setLineWidth(
        max(
            0.25,
            min(0.7, grid_size / 500)
        )
    )

    for i in range(n + 1):

        # Vertical
        x = (
            x_start
            + i * cell_size
        )

        c.line(
            x,
            y_start,
            x,
            y_start + grid_size
        )

        # Horizontal
        y = (
            y_start
            + i * cell_size
        )

        c.line(
            x_start,
            y,
            x_start + grid_size,
            y
        )

    # --------------------------------------------------------
    # CLUES
    # 1 AND MULTIPLES OF 10
    # --------------------------------------------------------

    font_size = max(
        4,
        min(16, cell_size * 0.35)
    )

    c.setFont(
        "Helvetica-Bold",
        font_size
    )

    c.setFillColorRGB(0, 0, 0)

    for row in range(n):

        for col in range(n):

            number = grid[row][col]

            if (
                number == 1
                or number % 10 == 0
            ):

                x = (
                    x_start
                    + col * cell_size
                    + cell_size / 2
                )

                y = (
                    y_start
                    + (n - row - 1)
                    * cell_size
                    + cell_size / 2
                )

                text = str(number)

                text_width = c.stringWidth(
                    text,
                    "Helvetica-Bold",
                    font_size
                )

                c.drawString(
                    x - text_width / 2,
                    y - font_size * 0.35,
                    text
                )


# ============================================================
# DRAW UPSIDE-DOWN SOLUTION
# ============================================================

def draw_solution(
        c,
        grid,
        x_start,
        y_start,
        grid_size):

    n = len(grid)
    cell_size = grid_size / n

    c.saveState()

    # Centre of solution
    centre_x = (
        x_start
        + grid_size / 2
    )

    centre_y = (
        y_start
        + grid_size / 2
    )

    # Rotate 180Â°
    c.translate(
        centre_x,
        centre_y
    )

    c.rotate(180)

    # --------------------------------------------------------
    # BLACK CELLS
    # --------------------------------------------------------

    c.setFillColorRGB(0, 0, 0)

    for row in range(n):

        for col in range(n):

            if grid[row][col] == 0:

                x = (
                    -grid_size / 2
                    + col * cell_size
                )

                y = (
                    -grid_size / 2
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
    # GRID
    # --------------------------------------------------------

    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.2)

    for i in range(n + 1):

        x = (
            -grid_size / 2
            + i * cell_size
        )

        c.line(
            x,
            -grid_size / 2,
            x,
            grid_size / 2
        )

        y = (
            -grid_size / 2
            + i * cell_size
        )

        c.line(
            -grid_size / 2,
            y,
            grid_size / 2,
            y
        )

    # --------------------------------------------------------
    # ALL SOLUTION NUMBERS
    # --------------------------------------------------------

    font_size = max(
        1.2,
        min(4, cell_size * 0.25)
    )

    c.setFont(
        "Helvetica",
        font_size
    )

    c.setFillColorRGB(0, 0, 0)

    for row in range(n):

        for col in range(n):

            number = grid[row][col]

            if number == 0:
                continue

            x = (
                -grid_size / 2
                + col * cell_size
                + cell_size / 2
            )

            y = (
                -grid_size / 2
                + (n - row - 1)
                * cell_size
                + cell_size / 2
            )

            text = str(number)

            text_width = c.stringWidth(
                text,
                "Helvetica",
                font_size
            )

            c.drawString(
                x - text_width / 2,
                y - font_size * 0.35,
                text
            )

    c.restoreState()


# ============================================================
# CREATE PAGE
# ============================================================

def create_page(
        grids,
        steps_list,
        starting_n,
        filename):

    page_width, page_height = A4

    c = canvas.Canvas(
        filename,
        pagesize=A4
    )

    # ========================================================
    # PAGE MARGINS
    # ========================================================

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
        "Numstep"
    )

    # Date
    today = date.today()

    c.setFont(
        "Helvetica",
        8
    )

    c.drawCentredString(
        page_width / 2,
        page_height - margin - 13,
        today.strftime("%d %B %Y")
    )

    # ========================================================
    # RULES
    # ========================================================

    rules_top = page_height - margin - 30

    c.setFont(
        "Helvetica-Bold",
        10
    )

    c.drawCentredString(
        page_width / 2,
        rules_top,
        "HOW TO PLAY"
    )

    rules = [
        "Complete the continuous path through every white square.",
        "The path begins at 1 and proceeds through consecutive numbers.",
        "Each number must be directly adjacent to the previous number.",
        "Move horizontally or vertically only, never diagonally.",
        "Every white square must be used exactly once.",
        "Black squares cannot be entered."
    ]

    c.setFont(
        "Helvetica",
        9
    )

    for i, rule in enumerate(rules):

        c.drawCentredString(
            page_width / 2,
            rules_top - 10 - i * 9,
            rule
        )

    # ========================================================
    # AVAILABLE VERTICAL SPACE
    # ========================================================

    rules_bottom = (
        rules_top
        - 10
        - len(rules) * 7
    )

    # Solutions occupy the bottom
    solution_area_height = 55

    # Gap between puzzles
    puzzle_gap = 22

    # ========================================================
    # LARGE PUZZLE
    # ========================================================

    # The large puzzle is approximately twice
    # the AREA of each small puzzle.
    #
    # Therefore:
    #
    # large_size â‰ˆ sqrt(2) Ã— small_size

    available_bottom = (
        solution_area_height
        + 20
    )

    large_max_height = (
        rules_bottom
        - available_bottom
        - puzzle_gap
        - 10
    )

    large_max_width = (
        page_width
        - 2 * margin
    )

    large_size = min(
        large_max_width,
        large_max_height
    )

    # ========================================================
    # SMALL PUZZLES
    # ========================================================

    # Make each small puzzle approximately half
    # the AREA of the large puzzle.
    small_size = large_size / (2 ** 0.5)

    # Make sure they fit horizontally
    maximum_small_width = (
        page_width
        - 2 * margin
        - 20
    ) / 2

    small_size = min(
        small_size,
        maximum_small_width
    )

    # ========================================================
    # VERTICAL POSITIONS
    # ========================================================

    # Large puzzle sits above solutions
    large_y = (
        available_bottom
        + puzzle_gap
    )

    # Small puzzles sit above large puzzle
    small_y = (
        large_y
        + large_size
        + puzzle_gap
    )

    # ========================================================
    # CHECK WHETHER EVERYTHING FITS
    # ========================================================

    required_height = (
        small_y
        + small_size
        + 20
    )

    if required_height > rules_bottom:

        # Scale both down proportionally
        scale = (
            rules_bottom
            - large_y
            - puzzle_gap
        ) / (
            large_size
            + puzzle_gap
            + small_size
        )

        large_size *= scale
        small_size *= scale

        # Recalculate positions
        large_y = (
            available_bottom
            + puzzle_gap
        )

        small_y = (
            large_y
            + large_size
            + puzzle_gap
        )

    # ========================================================
    # X POSITIONS FOR SMALL PUZZLES
    # ========================================================

    small_gap = 20

    small_total_width = (
        2 * small_size
        + small_gap
    )

    small_left_x = (
        page_width
        - small_total_width
    ) / 2

    small_right_x = (
        small_left_x
        + small_size

    # ========================================================
    # DRAW SMALL PUZZLES
    # ========================================================

    draw_puzzle(
        c,
        grids[0],
        small_left_x,
        small_y,
        small_size
    )

    draw_puzzle(
        c,
        grids[1],
        small_right_x,
        small_y,
        small_size
    )

    # ========================================================
    # DRAW LARGE PUZZLE
    # ========================================================

    large_x = (
        page_width
        - large_size
    ) / 2

    draw_puzzle(
        c,
        grids[2],
        large_x,
        large_y,
        large_size
    )

    # ========================================================
# ========================================================
    # SOLUTIONS + WEBSITE TEXT BOX
    # ========================================================
    
    solution_size = 80
    solution_gap = 15
    
    total_solution_width = (
        3 * solution_size
        + 2 * solution_gap
    )
    
    # Right-align the solution grids
    solution_margin = 25
    
    solution_x = (
        page_width
        - solution_margin
        - total_solution_width -50
    )
    
    solution_y = 12
    
    # --------------------------------------------------------
    # TEXT BOX ON LEFT
    # --------------------------------------------------------
    
    text_box_x = 100
    text_box_width = (
        solution_x
        - text_box_x
        - 60
    )
    
    text_box_height = 45
    
    text_box_y = (
        solution_y
        + (solution_size - text_box_height) / 2
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
    
    # --------------------------------------------------------
    # SOLUTION GRIDS
    # --------------------------------------------------------
    
    for i in range(3):
    
        x = (
            solution_x
            + i * (
                solution_size
                + solution_gap
            )
        )
    
        draw_solution(
            c,
            grids[i],
            x,
            solution_y,
            solution_size
        )
    # ========================================================
    # SAVE
    # ========================================================

    c.save()


# ============================================================
# MAIN PROGRAM
# ============================================================

#n = int(
#    input("Enter starting grid size N: ")
#)

n=5

# Generate N, N+2 and N+4
sizes = [
    n,
    n + 2,
    n + 4
]

grids = []
steps_list = []

for size in sizes:

    print(
        f"Generating {size} x {size}..."
    )

    grid, steps = generate_walk(size)
    
    web_filename = (
    f"numstep_{size}_{date.today()}.json"
)

    export_web_puzzle(
    grid,
    steps,
    web_filename
)

    grids.append(grid)
    steps_list.append(steps)

    print(
        f"  {steps} squares visited "
        f"({steps / (size * size) * 100:.1f}%)"
    )


# ============================================================
# CREATE PDF
# ============================================================

filename = (
    f"Numstep_Daily_Unique_{date.today().strftime('%Y-%m-%d')}.pdf"
)

create_page(
    grids,
    steps_list,
    n,
    filename
)

print()
print(f"PDF created: {filename}")

