const size = puzzle.size;
const solution = puzzle.solution;
const clues = puzzle.clues;

const grid = document.getElementById("grid");
const timerDisplay = document.getElementById("timer");
const message = document.getElementById("message");
const resetButton = document.getElementById("resetButton");

let path = [];
let started = false;
let completed = false;

let startTime = null;
let dragging = false;


// ============================================================
// CREATE GRID
// ============================================================

function createGrid() {

    grid.innerHTML = "";

    for (let i = 0; i < solution.length; i++) {

        const square = document.createElement("div");

        square.className = "square";

        square.dataset.position = i;

        // Show only the official clues.
        if (clues.includes(solution[i])) {
            square.textContent = solution[i];
            square.classList.add("clue");
        }

        // Mouse
        square.addEventListener("mousedown", (event) => {

            event.preventDefault();

            dragging = true;

            handleMove(i);

        });

        // Touch
        square.addEventListener("touchstart", (event) => {

            event.preventDefault();

            dragging = true;

            handleMove(i);

        }, { passive: false });

        grid.appendChild(square);
    }
}


// ============================================================
// MOUSE MOVEMENT
// ============================================================

document.addEventListener("mousemove", (event) => {

    if (!dragging) {
        return;
    }

    const element = document.elementFromPoint(
        event.clientX,
        event.clientY
    );

    if (!element) {
        return;
    }

    if (!element.classList.contains("square")) {
        return;
    }

    const position =
        Number(element.dataset.position);

    handleMove(position);
});


// ============================================================
// TOUCH MOVEMENT
// ============================================================

document.addEventListener("touchmove", (event) => {

    if (!dragging) {
        return;
    }

    event.preventDefault();

    const touch = event.touches[0];

    const element = document.elementFromPoint(
        touch.clientX,
        touch.clientY
    );

    if (!element) {
        return;
    }

    if (!element.classList.contains("square")) {
        return;
    }

    const position =
        Number(element.dataset.position);

    handleMove(position);

}, { passive: false });


// ============================================================
// END DRAG
// ============================================================

document.addEventListener("mouseup", () => {

    dragging = false;

});

document.addEventListener("touchend", () => {

    dragging = false;

});


// ============================================================
// PLAYER MOVE
// ============================================================

function handleMove(position) {

    if (completed) {
        return;
    }


    // First move must be 1.
    if (!started) {

        if (solution[position] !== 1) {
            showMessage("Start at 1.");
            return;
        }

        started = true;

        startTimer();

        addMove(position);

        return;
    }


    // Don't revisit a square.
    if (path.includes(position)) {
        return;
    }


    // Must move to an adjacent square.
    const previous =
        path[path.length - 1];

    if (!isAdjacent(previous, position)) {
        return;
    }


    addMove(position);

    checkCompletion();
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
// CHECK COMPLETION
// ============================================================

function checkCompletion() {

    if (path.length !== solution.length) {
        return;
    }

    stopTimer();

    completed = true;

    showMessage(
        "🎉 Congratulations! You solved today's Numstep!"
    );
}


// ============================================================
// TIMER
// ============================================================

function startTimer() {

    startTime = Date.now();

    updateTimer();
}


function updateTimer() {

    if (!startTime || completed) {
        return;
    }

    const elapsed =
        Math.floor(
            (Date.now() - startTime) / 1000
        );

    const minutes =
        Math.floor(elapsed / 60);

    const seconds =
        elapsed % 60;

    timerDisplay.textContent =
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");

    requestAnimationFrame(updateTimer);
}


function stopTimer() {

    startTime = null;
}


// ============================================================
// RESET
// ============================================================

function resetPuzzle() {

    stopTimer();

    path = [];

    started = false;

    completed = false;

    dragging = false;

    timerDisplay.textContent = "00:00";

    message.textContent = "";

    createGrid();
}


resetButton.addEventListener(
    "click",
    resetPuzzle
);


// ============================================================
// MESSAGE
// ============================================================

function showMessage(text) {

    message.textContent = text;

    setTimeout(() => {

        if (!completed) {
            message.textContent = "";
        }

    }, 2000);
}


// ============================================================
// START
// ============================================================

createGrid();
