const size = puzzle.size;
const solution = puzzle.solution;
const clues = puzzle.clues;

const grid = document.getElementById("grid");

let path = [];
let started = false;


// ============================================================
// CREATE THE GRID
// ============================================================

for (let i = 0; i < solution.length; i++) {

    const square = document.createElement("div");

    square.className = "square";

    square.dataset.position = i;

    // Only show the official clues.
    if (clues.includes(solution[i])) {
        square.textContent = solution[i];
    }

    square.addEventListener("click", () => {

        handleMove(i);

    });

    grid.appendChild(square);
}


// ============================================================
// PLAYER MOVE
// ============================================================

function handleMove(position) {

    // The puzzle must start at 1.
    if (!started) {

        if (solution[position] !== 1) {
            return;
        }

        started = true;

        addMove(position);

        return;
    }


    // Don't revisit a square.
    if (path.includes(position)) {
        return;
    }


    // The new square must be adjacent.
    const previous = path[path.length - 1];

    if (!isAdjacent(previous, position)) {
        return;
    }


    addMove(position);


    // Puzzle completed.
    if (path.length === solution.length) {

        puzzleComplete();

    }
}


// ============================================================
// ADD MOVE
// ============================================================

function addMove(position) {

    path.push(position);

    const square =
        document.querySelector(
            `[data-position="${position}"]`
        );

    square.classList.add("selected");

    square.textContent = solution[position];
}


// ============================================================
// CHECK ADJACENCY
// ============================================================

function isAdjacent(a, b) {

    const rowA = Math.floor(a / size);
    const colA = a % size;

    const rowB = Math.floor(b / size);
    const colB = b % size;

    return (
        Math.abs(rowA - rowB) +
        Math.abs(colA - colB)
    ) === 1;
}


// ============================================================
// PUZZLE COMPLETE
// ============================================================

function puzzleComplete() {

    alert("Congratulations! You solved today's Numstep!");
}
