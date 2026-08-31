// ============================================================
// NUMSTEP DAILY PUZZLE
// ============================================================

let size;
let solution;
let clues;

let grid;
let timerDisplay;
let message;
let resetButton;

let path = [];
let started = false;
let completed = false;

let startTime = null;
let dragging = false;


// ============================================================
// GET TODAY'S DATE
// ============================================================

function getToday() {

    const today = new Date();

    const year = today.getFullYear();

    const month =
        String(today.getMonth() + 1).padStart(2, "0");

    const day =
        String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


// ============================================================
// LOAD TODAY'S PUZZLE
// ============================================================

async function loadPuzzle() {

    try {

        const today = getToday();

        const filename =
            `numstep_5_${today}.json`;

        const response =
            await fetch(filename);

        if (!response.ok) {
            throw new Error("Puzzle not found");
        }

        const puzzle =
            await response.json();

        size = puzzle.size;
        solution = puzzle.solution;
        clues = puzzle.clues;

        grid =
            document.getElementById("grid");

        timerDisplay =
            document.getElementById("timer");

        message =
            document.getElementById("message");

        resetButton =
            document.getElementById("resetButton");

        createGrid();

        resetButton.addEventListener(
            "click",
            resetPuzzle
        );

    }

    catch (error) {

        console.error(error);

        document.getElementById("grid").innerHTML =
            "<p>Today's Numstep puzzle isn't available yet.</p>";

    }
}


// ============================================================
// CREATE GRID
// ============================================================

function createGrid() {

    grid.innerHTML = "";

    for (let i = 0; i < solution.length; i++) {

        const square =
            document.createElement("div");

        square.className = "square";

        square.dataset.position = i;


        // ----------------------------------------------------
        // DISPLAY CLUES
        // ----------------------------------------------------

        if (clues.includes(solution[i])) {

            square.textContent =
                solution[i];

            square.classList.add("clue");
        }


        // ----------------------------------------------------
        // MOUSE
        // ----------------------------------------------------

        square.addEventListener(
            "mousedown",
            (event) => {

                event.preventDefault();

                dragging = true;

                handleMove(i);
            }
        );


        // ----------------------------------------------------
        // TOUCH
        // ----------------------------------------------------

        square.addEventListener(
            "touchstart",
            (event) => {

                event.preventDefault();

                dragging = true;

                handleMove(i);

            },
            { passive: false }
        );


        grid.appendChild(square);
    }
}


// ============================================================
// MOUSE MOVEMENT
// ============================================================

document.addEventListener(
    "mousemove",
    (event) => {

        if (!dragging) {
            return;
        }

        const element =
            document.elementFromPoint(
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
    }
);


// ============================================================
// TOUCH MOVEMENT
// ============================================================

document.addEventListener(
    "touchmove",
    (event) => {

        if (!dragging) {
            return;
        }

        event.preventDefault();

        const touch =
            event.touches[0];

        const element =
            document.elementFromPoint(
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

    },
    { passive: false }
);


// ============================================================
// END DRAG
// ============================================================

document.addEventListener(
    "mouseup",
    () => {

        dragging = false;

    }
);


document.addEventListener(
    "touchend",
    () => {

        dragging = false;

    }
);


// ============================================================
// PLAYER MOVE
// ============================================================

function handleMove(position) {

    if (completed) {
        return;
    }


    // --------------------------------------------------------
    // FIRST MOVE
    // --------------------------------------------------------

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


    // --------------------------------------------------------
    // PREVENT REVISITING
    // --------------------------------------------------------

    if (path.includes(position)) {
        return;
    }


    // --------------------------------------------------------
    // CHECK ADJACENCY
    // --------------------------------------------------------

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
// ADJACENCY
// ============================================================

function isAdjacent(a, b) {

    const rowA =
        Math.floor(a / size);

    const colA =
        a % size;

    const rowB =
        Math.floor(b / size);

    const colB =
        b % size;

    return (
        Math.abs(rowA - rowB) +
        Math.abs(colA - colB)
    ) === 1;
}


// ============================================================
// COMPLETION
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

loadPuzzle();
