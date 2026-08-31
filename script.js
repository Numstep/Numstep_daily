
// ============================================================
// NUMSTEP
// Daily Puzzle
// ============================================================


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let puzzle = null;

let size = 0;
let solution = [];
let clues = [];

let grid = null;
let timerDisplay = null;
let message = null;
let resetButton = null;
let attemptsDisplay = null;

let path = [];

let started = false;
let completed = false;

let startTime = null;
let dragging = false;

let attempts = 0;

// The clue from which the current run started.
let startingClue = null;

// The next milestone the player must reach.
let nextMilestone = null;

// Number of MOVES made since the current clue.
let movesSinceClue = 0;


// ============================================================
// 12-COLOUR PALETTE
// ============================================================

const colourPalette = [
    "#4E79A7",
    "#59A14F",
    "#F28E2B",
    "#E15759",
    "#B07AA1",
    "#76B7B2",
    "#EDC948",
    "#9C755F",
    "#AF7AA1",
    "#86BCB6",
    "#FF9DA7",
    "#79706E"
];


// ============================================================
// GET TODAY'S DATE
// ============================================================

function getToday() {

    const today = new Date();

    const year =
        today.getFullYear();

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
            throw new Error(
                `Puzzle file not found: ${filename}`
            );
        }

        puzzle =
            await response.json();

        size =
            puzzle.size;

        solution =
            puzzle.solution;

        clues =
            puzzle.clues;

        // ----------------------------------------------------
        // GET PAGE ELEMENTS
        // ----------------------------------------------------

        grid =
            document.getElementById("grid");

        timerDisplay =
            document.getElementById("timer");

        message =
            document.getElementById("message");

        resetButton =
            document.getElementById("resetButton");

        attemptsDisplay =
            document.getElementById("attempts");


        // ----------------------------------------------------
        // CREATE PUZZLE
        // ----------------------------------------------------

        createGrid();

        updateAttemptsDisplay();


        // ----------------------------------------------------
        // RESET BUTTON
        // ----------------------------------------------------

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
// DETERMINE COLOUR FOR A NUMBER
// ============================================================
//
// 1-9   → clue 1
// 10-19 → clue 10
// 20-29 → clue 20
// 30-39 → clue 30
//
// etc.
//
// This means every section of the walk has a consistent colour.
// ============================================================

function getColourForNumber(number) {

    if (number === 0) {
        return null;
    }

    let clueNumber;

    if (number < 10) {
        clueNumber = 1;
    }
    else {
        clueNumber =
            Math.floor(number / 10) * 10;
    }

    const clueIndex =
        clues.indexOf(clueNumber);

    if (clueIndex === -1) {
        return colourPalette[0];
    }

    return colourPalette[
        clueIndex % colourPalette.length
    ];
}


// ============================================================
// CREATE GRID
// ============================================================

function createGrid() {

    grid.innerHTML = "";

    for (
        let position = 0;
        position < solution.length;
        position++
    ) {

        const number =
            solution[position];

        const square =
            document.createElement("div");

        square.className =
            "square";

        square.dataset.position =
            position;


        // ----------------------------------------------------
        // BLACK / UNUSED CELLS
        // ----------------------------------------------------

        if (number === 0) {

            square.classList.add("unused");

        }


        // ----------------------------------------------------
        // COLOUR WHITE CELLS
        // ----------------------------------------------------

        else {

            const colour =
                getColourForNumber(number);

            square.style.setProperty(
                "--numstep-colour",
                colour
            );

        }


        // ----------------------------------------------------
        // DISPLAY CLUE
        // ----------------------------------------------------

        if (
            number !== 0 &&
            clues.includes(number)
        ) {

            square.textContent =
                number;

            square.classList.add("clue");

        }


        // ----------------------------------------------------
        // MOUSE
        // ----------------------------------------------------

        square.addEventListener(
            "mousedown",
            function(event) {

                event.preventDefault();

                dragging = true;

                handleMove(position);
            }
        );


        // ----------------------------------------------------
        // TOUCH
        // ----------------------------------------------------

        square.addEventListener(
            "touchstart",
            function(event) {

                event.preventDefault();

                dragging = true;

                handleMove(position);

            },
            { passive: false }
        );


        grid.appendChild(square);
    }
}


// ============================================================
// MOUSE DRAGGING
// ============================================================

document.addEventListener(
    "mousemove",
    function(event) {

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

        if (
            !element.classList.contains("square")
        ) {
            return;
        }

        const position =
            Number(
                element.dataset.position
            );

        handleMove(position);
    }
);


// ============================================================
// TOUCH DRAGGING
// ============================================================

document.addEventListener(
    "touchmove",
    function(event) {

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

        if (
            !element.classList.contains("square")
        ) {
            return;
        }

        const position =
            Number(
                element.dataset.position
            );

        handleMove(position);

    },
    { passive: false }
);


// ============================================================
// END DRAG
// ============================================================

document.addEventListener(
    "mouseup",
    function() {

        dragging = false;

    }
);


document.addEventListener(
    "touchend",
    function() {

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


    const number =
        solution[position];


    // --------------------------------------------------------
    // BLACK / UNUSED CELL
    // --------------------------------------------------------

    if (number === 0) {
        return;
    }


    // --------------------------------------------------------
    // STARTING A NEW RUN
    // --------------------------------------------------------

    if (!started) {

        if (!clues.includes(number)) {

            showMessage(
                "Start on a coloured clue."
            );

            return;
        }


        // ----------------------------------------------------
        // START FROM ANY CLUE
        // ----------------------------------------------------

        started = true;

        startingClue =
            number;

        nextMilestone =
            getNextMilestone(
                startingClue
            );

        movesSinceClue = 0;

        startTimer();

        addMove(position);

        return;
    }


    // --------------------------------------------------------
    // DON'T VISIT A CELL TWICE
    // --------------------------------------------------------

    if (path.includes(position)) {
        return;
    }


    // --------------------------------------------------------
    // MUST BE ADJACENT
    // --------------------------------------------------------

    const previous =
        path[path.length - 1];

    if (!isAdjacent(previous, position)) {
        return;
    }


    // --------------------------------------------------------
    // ADD MOVE
    // --------------------------------------------------------

    addMove(position);

    movesSinceClue++;


    // --------------------------------------------------------
    // CHECK MILESTONE
    // --------------------------------------------------------

    if (
        clues.includes(number)
    ) {

        if (
            number !== nextMilestone
        ) {

            failAttempt(
                "You reached a clue at the wrong point."
            );

            return;
        }


        // ----------------------------------------------------
        // CORRECT MILESTONE
        // ----------------------------------------------------

        startingClue =
            number;

        nextMilestone =
            getNextMilestone(
                startingClue
            );

        movesSinceClue = 0;
    }


    // --------------------------------------------------------
    // CHECK WHETHER THE PUZZLE IS COMPLETE
    // --------------------------------------------------------

    if (isPuzzleComplete()) {

        completePuzzle();

        return;
    }


    // --------------------------------------------------------
    // CHECK FOR DEAD END
    // --------------------------------------------------------

    if (hasNoLegalMoves()) {

        const remaining =
            countRemainingWhiteSquares();

        if (remaining > 0) {

            failAttempt(
                "Dead end! There are still squares remaining."
            );

        }
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


    // --------------------------------------------------------
    // Show the number once the player visits it.
    // --------------------------------------------------------

    if (
        solution[position] !== 0
    ) {

        square.textContent =
            solution[position];
    }
}


// ============================================================
// FIND NEXT MILESTONE
// ============================================================

function getNextMilestone(currentClue) {

    const currentIndex =
        clues.indexOf(currentClue);

    if (currentIndex === -1) {
        return null;
    }

    if (
        currentIndex + 1 >= clues.length
    ) {

        return null;
    }

    return clues[
        currentIndex + 1
    ];
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
// FIND LEGAL NEXT MOVES
// ============================================================

function getLegalMoves() {

    if (path.length === 0) {
        return [];
    }

    const current =
        path[path.length - 1];

    const row =
        Math.floor(current / size);

    const col =
        current % size;

    const possibleMoves = [

        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1]

    ];

    const legalMoves = [];


    for (
        const [newRow, newCol]
        of possibleMoves
    ) {

        if (
            newRow < 0 ||
            newRow >= size ||
            newCol < 0 ||
            newCol >= size
        ) {
            continue;
        }


        const position =
            newRow * size + newCol;

        const number =
            solution[position];


        // ----------------------------------------------------
        // Black cell
        // ----------------------------------------------------

        if (number === 0) {
            continue;
        }


        // ----------------------------------------------------
        // Already visited
        // ----------------------------------------------------

        if (path.includes(position)) {
            continue;
        }


        // ----------------------------------------------------
        // Milestone rule
        // ----------------------------------------------------

        if (
            clues.includes(number) &&
            number !== nextMilestone
        ) {

            continue;
        }


        legalMoves.push(position);
    }

    return legalMoves;
}


// ============================================================
// DEAD-END CHECK
// ============================================================

function hasNoLegalMoves() {

    return (
        getLegalMoves().length === 0
    );
}


// ============================================================
// COUNT REMAINING WHITE SQUARES
// ============================================================

function countRemainingWhiteSquares() {

    let totalWhite = 0;

    for (
        const number of solution
    ) {

        if (number !== 0) {
            totalWhite++;
        }
    }

    return (
        totalWhite - path.length
    );
}


// ============================================================
// CHECK COMPLETION
// ============================================================

function isPuzzleComplete() {

    const totalWhite =
        solution.filter(
            number => number !== 0
        ).length;

    return (
        path.length === totalWhite
    );
}


// ============================================================
// FAILED ATTEMPT
// ============================================================

function failAttempt(text) {

    attempts++;

    updateAttemptsDisplay();

    stopTimer();

    started = false;

    path = [];

    startingClue = null;

    nextMilestone = null;

    movesSinceClue = 0;

    clearGrid();

    showMessage(
        `${text} Attempt ${attempts}.`
    );

    timerDisplay.textContent =
        "00:00";
}


// ============================================================
// CLEAR PLAYER PATH
// ============================================================

function clearGrid() {

    const squares =
        document.querySelectorAll(
            ".square"
        );

    squares.forEach(
        function(square) {

            square.classList.remove(
                "selected"
            );

            const position =
                Number(
                    square.dataset.position
                );

            const number =
                solution[position];

            if (
                clues.includes(number)
            ) {

                square.textContent =
                    number;

            }
            else {

                square.textContent =
                    "";

            }
        }
    );
}


// ============================================================
// SUCCESS
// ============================================================

function completePuzzle() {

    stopTimer();

    completed = true;

    showMessage(
        `🎉 Numstep complete!`
    );
}


// ============================================================
// TIMER
// ============================================================

function startTimer() {

    if (startTime !== null) {
        return;
    }

    startTime =
        Date.now();

    updateTimer();
}


function updateTimer() {

    if (
        startTime === null ||
        completed
    ) {

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

    requestAnimationFrame(
        updateTimer
    );
}


function stopTimer() {

    startTime = null;
}


// ============================================================
// RESET PUZZLE
// ============================================================

function resetPuzzle() {

    stopTimer();

    path = [];

    started = false;

    completed = false;

    dragging = false;

    startingClue = null;

    nextMilestone = null;

    movesSinceClue = 0;

    timerDisplay.textContent =
        "00:00";

    message.textContent =
        "";

    createGrid();
}


// ============================================================
// ATTEMPTS DISPLAY
// ============================================================

function updateAttemptsDisplay() {

    if (!attemptsDisplay) {
        return;
    }

    attemptsDisplay.textContent =
        `Attempts: ${attempts}`;
}


// ============================================================
// MESSAGE
// ============================================================

function showMessage(text) {

    message.textContent =
        text;

    setTimeout(
        function() {

            if (!completed) {

                message.textContent =
                    "";

            }

        },
        3000
    );
}


// ============================================================
// START
// ============================================================

loadPuzzle();

