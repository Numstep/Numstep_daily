
// ============================================================
// NUMSTEP
// Daily Puzzle
// ============================================================


// ============================================================
// GAME DATA
// ============================================================

let puzzle = null;

let size = 0;
let solution = [];
let clueGrid = [];

let grid = null;
let timerDisplay = null;
let message = null;
let resetButton = null;
let attemptsDisplay = null;

let path = [];

let started = false;
let completed = false;

let startTime = null;
let attempts = 0;

let dragging = false;

// The clue where the current attempt began.
let currentClue = null;

// The next clue that must be reached.
let nextClue = null;


// ============================================================
// COLOUR PALETTE
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
    "#86BCB6",
    "#FF9DA7",
    "#79706E",
    "#A0CBE8"
];


// Each clue number gets one colour.
let clueColours = {};


// ============================================================
// TODAY'S DATE
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
// LOAD PUZZLE
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
                `Could not load ${filename}`
            );
        }

        puzzle =
            await response.json();

        size =
            puzzle.size;

        solution =
            puzzle.solution;

        clueGrid =
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
        // ASSIGN COLOURS TO CLUES
        // ----------------------------------------------------

        assignClueColours();


        // ----------------------------------------------------
        // CREATE GRID
        // ----------------------------------------------------

        createGrid();


        // ----------------------------------------------------
        // ATTEMPTS
        // ----------------------------------------------------

        updateAttemptsDisplay();


        // ----------------------------------------------------
        // RESET BUTTON
        // ----------------------------------------------------

        if (resetButton) {

            resetButton.addEventListener(
                "click",
                resetPuzzle
            );
        }

    }

    catch (error) {

        console.error(error);

        if (grid) {

            grid.innerHTML =
                "<p>Unable to load today's Numstep puzzle.</p>";
        }
    }
}


// ============================================================
// FIND ALL CLUES
// ============================================================
//
// clueGrid contains the same number of cells as solution.
// A non-zero value means that cell is a clue.
//
// Example:
//
// clues:
// [10, 0, 0, 20, 0, ...]
//
// Therefore the clues are 10 and 20 at those positions.
// ============================================================

function getClueNumbers() {

    const clueNumbers = [];

    for (
        let i = 0;
        i < clueGrid.length;
        i++
    ) {

        const number =
            clueGrid[i];

        if (
            number !== 0 &&
            !clueNumbers.includes(number)
        ) {

            clueNumbers.push(number);
        }
    }

    clueNumbers.sort(
        (a, b) => a - b
    );

    return clueNumbers;
}


// ============================================================
// ASSIGN RANDOM COLOURS TO CLUES
// ============================================================

function assignClueColours() {

    clueColours = {};

    const clueNumbers =
        getClueNumbers();

    // Shuffle palette.
    const colours =
        [...colourPalette];

    for (
        let i = colours.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            colours[i],
            colours[j]
        ] =
        [
            colours[j],
            colours[i]
        ];
    }


    for (
        let i = 0;
        i < clueNumbers.length;
        i++
    ) {

        clueColours[
            clueNumbers[i]
        ] =
            colours[
                i % colours.length
            ];
    }
}


// ============================================================
// GET COLOUR FOR A NUMBER
// ============================================================
//
// 1-9   → colour of clue 1
// 10-19 → colour of clue 10
// 20-29 → colour of clue 20
// 30-39 → colour of clue 30
// etc.
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


    return clueColours[clueNumber]
        || colourPalette[0];
}


// ============================================================
// IS THIS POSITION A CLUE?
// ============================================================

function isCluePosition(position) {

    return (
        clueGrid[position] !== 0
    );
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
        // BLACK CELL
        // ----------------------------------------------------

        if (number === 0) {

            square.classList.add(
                "unused"
            );
        }


        // ----------------------------------------------------
        // COLOURED CELL
        // ----------------------------------------------------

        else {

            const colour =
                getColourForNumber(number);

            square.style.backgroundColor =
                colour;
        }


        // ----------------------------------------------------
        // CLUE
        // ----------------------------------------------------

        if (
            isCluePosition(position)
        ) {

            square.textContent =
                number;

            square.classList.add(
                "clue"
            );
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
// MOUSE DRAG
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
            !element.classList.contains(
                "square"
            )
        ) {

            return;
        }

        handleMove(
            Number(
                element.dataset.position
            )
        );
    }
);


// ============================================================
// TOUCH DRAG
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
            !element.classList.contains(
                "square"
            )
        ) {

            return;
        }

        handleMove(
            Number(
                element.dataset.position
            )
        );

    },
    { passive: false }
);


// ============================================================
// STOP DRAG
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
    // BLACK CELL
    // --------------------------------------------------------

    if (number === 0) {
        return;
    }


    // --------------------------------------------------------
    // STARTING A NEW ATTEMPT
    // --------------------------------------------------------

    if (!started) {

        // Player may start on ANY clue.
        if (
            !isCluePosition(position)
        ) {

            showMessage(
                "Start on a coloured clue."
            );

            return;
        }


        started = true;

        currentClue =
            number;

        nextClue =
            getNextClue(
                currentClue
            );

        startTimer();

        addMove(position);

        return;
    }


    // --------------------------------------------------------
    // ALREADY VISITED
    // --------------------------------------------------------

    if (
        path.includes(position)
    ) {

        return;
    }


    // --------------------------------------------------------
    // MUST BE ADJACENT
    // --------------------------------------------------------

    const previous =
        path[path.length - 1];

    if (
        !isAdjacent(
            previous,
            position
        )
    ) {

        return;
    }


    // --------------------------------------------------------
    // MILESTONE RULE
    // --------------------------------------------------------
    //
    // If the player enters a clue square,
    // it MUST be the next clue.
    //
    // Otherwise the attempt fails.
    // --------------------------------------------------------

    if (
        isCluePosition(position)
    ) {

        if (
            number !== nextClue
        ) {

            failAttempt(
                "You reached the wrong clue."
            );

            return;
        }
    }


    // --------------------------------------------------------
    // ADD MOVE
    // --------------------------------------------------------

    addMove(position);


    // --------------------------------------------------------
    // CORRECT CLUE REACHED
    // --------------------------------------------------------

    if (
        isCluePosition(position)
    ) {

        currentClue =
            number;

        nextClue =
            getNextClue(
                currentClue
            );
    }


    // --------------------------------------------------------
    // CHECK COMPLETE
    // --------------------------------------------------------

    if (
        isPuzzleComplete()
    ) {

        completePuzzle();

        return;
    }


    // --------------------------------------------------------
    // CHECK DEAD END
    // --------------------------------------------------------

    if (
        hasNoLegalMoves()
    ) {

        const remaining =
            countRemainingWhiteSquares();

        if (remaining > 0) {

            failAttempt(
                "Dead end! Try again."
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

    square.classList.add(
        "selected"
    );

    square.textContent =
        solution[position];
}


// ============================================================
// GET NEXT CLUE
// ============================================================

function getNextClue(currentClue) {

    const clueNumbers =
        getClueNumbers();

    const index =
        clueNumbers.indexOf(
            currentClue
        );


    if (index === -1) {
        return null;
    }


    if (
        index + 1 >= clueNumbers.length
    ) {

        return null;
    }


    return clueNumbers[
        index + 1
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
// LEGAL MOVES
// ============================================================

function getLegalMoves() {

    if (
        path.length === 0
    ) {

        return [];
    }


    const current =
        path[path.length - 1];

    const row =
        Math.floor(current / size);

    const col =
        current % size;


    const possible = [

        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1]

    ];


    const legal = [];


    for (
        const [r, c]
        of possible
    ) {

        if (
            r < 0 ||
            r >= size ||
            c < 0 ||
            c >= size
        ) {

            continue;
        }


        const position =
            r * size + c;

        const number =
            solution[position];


        // Black.
        if (number === 0) {
            continue;
        }


        // Already visited.
        if (
            path.includes(position)
        ) {

            continue;
        }


        // Wrong clue.
        if (
            isCluePosition(position) &&
            number !== nextClue
        ) {

            continue;
        }


        legal.push(position);
    }


    return legal;
}


// ============================================================
// DEAD END
// ============================================================

function hasNoLegalMoves() {

    return (
        getLegalMoves().length === 0
    );
}


// ============================================================
// REMAINING WHITE CELLS
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
// COMPLETION
// ============================================================

function isPuzzleComplete() {

    const totalWhite =
        countTotalWhiteSquares();

    return (
        path.length === totalWhite
    );
}


function countTotalWhiteSquares() {

    let total = 0;

    for (
        const number of solution
    ) {

        if (number !== 0) {
            total++;
        }
    }

    return total;
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

    currentClue = null;

    nextClue = null;

    clearPlayerPath();

    timerDisplay.textContent =
        "00:00";

    showMessage(
        `${text} Attempt ${attempts}.`
    );
}


// ============================================================
// CLEAR PLAYER PATH
// ============================================================

function clearPlayerPath() {

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
                isCluePosition(position)
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
        "🎉 Congratulations! You solved today's Numstep!"
    );
}


// ============================================================
// TIMER
// ============================================================

function startTimer() {

    if (
        startTime !== null
    ) {

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
            (
                Date.now() -
                startTime
            ) / 1000
        );


    const minutes =
        Math.floor(
            elapsed / 60
        );

    const seconds =
        elapsed % 60;


    timerDisplay.textContent =
        String(minutes).padStart(
            2,
            "0"
        ) +
        ":" +
        String(seconds).padStart(
            2,
            "0"
        );


    requestAnimationFrame(
        updateTimer
    );
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

    currentClue = null;

    nextClue = null;

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
