// ============================================================
// NUMSTEP - Daily Puzzle
// ============================================================
//
// The puzzle data contains:
//   - size: grid width/height
//   - solution: the hidden consecutive path; 0 = black square
//   - clues: the numbers that are shown to the player
//
// The player's job is to start at 1 and trace 1, 2, 3 ...
// through every white square exactly once, moving orthogonally.
// Clues are checkpoints: 10, 20, 30, etc. must be reached at
// exactly the corresponding step.
// ============================================================

let puzzle = null;
let size = 0;
let solution = [];
let clueNumbers = [];
let cluePositions = new Map();

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

// Colours are assigned to clue/checkpoint groups.
const colourPalette = [
    "#4E79A7", "#59A14F", "#F28E2B", "#E15759",
    "#B07AA1", "#76B7B2", "#EDC948", "#9C755F",
    "#86BCB6", "#FF9DA7", "#79706E", "#A0CBE8"
];

let clueColours = {};

function getToday() {
    const today = new Date();
    return [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0")
    ].join("-");
}

async function loadPuzzle() {
    try {
        const today = getToday();
        const filename = `numstep_5_${today}.json`;
        const response = await fetch(filename, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Could not load ${filename}`);
        }

        puzzle = await response.json();

        size = puzzle.size;
        solution = Array.isArray(puzzle.solution) ? puzzle.solution : [];

        if (!size || solution.length !== size * size) {
            throw new Error("Invalid puzzle data.");
        }

        // The generator stores clue NUMBERS, not a clue grid.
        // Derive their positions from the hidden solution.
        clueNumbers = getClueNumbersFromPuzzle();
        buildCluePositions();

        grid = document.getElementById("grid");
        timerDisplay = document.getElementById("timer");
        message = document.getElementById("message");
        resetButton = document.getElementById("resetButton");
        attemptsDisplay = document.getElementById("attempts");

        assignClueColours();
        createGrid();
        loadDailyStats();
        updateAttemptsDisplay();

        if (resetButton) {
            resetButton.addEventListener("click", resetPuzzle);
        }
    } catch (error) {
        console.error(error);

        const target = document.getElementById("grid");
        if (target) {
            target.innerHTML =
                "<p>Unable to load today's Numstep puzzle.</p>";
        }
    }
}

// The current puzzle generator exports clue numbers such as
// [1, 10, 20]. They are not positions in the grid.
function getClueNumbersFromPuzzle() {
    const supplied = Array.isArray(puzzle.clues) ? puzzle.clues : [];

    const valid = supplied
        .filter(number => Number.isInteger(number) && number > 0)
        .filter((number, index, array) => array.indexOf(number) === index)
        .filter(number => solution.includes(number));

    // Fall back to the generator's rule if an older puzzle file
    // does not contain a usable clues array.
    if (valid.length === 0) {
        return solution
            .filter(number => number === 1 || number % 10 === 0);
    }

    return valid.sort((a, b) => a - b);
}

function buildCluePositions() {
    cluePositions = new Map();

    clueNumbers.forEach(number => {
        const position = solution.indexOf(number);
        if (position !== -1) {
            cluePositions.set(position, number);
        }
    });
}

function assignClueColours() {
    clueColours = {};
    const colours = [...colourPalette];

    for (let i = colours.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colours[i], colours[j]] = [colours[j], colours[i]];
    }

    clueNumbers.forEach((number, index) => {
        clueColours[number] = colours[index % colours.length];
    });
}

function isBlackPosition(position) {
    return solution[position] === 0;
}

function isCluePosition(position) {
    return cluePositions.has(position);
}

function getClueNumber(position) {
    return cluePositions.get(position) ?? null;
}

function getClueColour(number) {
    return clueColours[number] || colourPalette[0];
}

function createGrid() {
    grid.innerHTML = "";

    for (let position = 0; position < solution.length; position++) {
        const number = solution[position];
        const square = document.createElement("div");

        square.className = "square";
        square.dataset.position = position;

        // IMPORTANT: black squares are part of the puzzle board,
        // not merely empty cells. Explicitly render them as black.
        if (number === 0) {
            square.classList.add("unused");
            square.style.setProperty(
                "background-color",
                "#000000",
                "important"
            );
            square.style.setProperty("color", "#FFFFFF", "important");
        } else {
            square.classList.add("white-cell");
            square.style.setProperty(
                "background-color",
                "#FFFFFF",
                "important"
            );

            if (isCluePosition(position)) {
                const clue = getClueNumber(position);
                square.textContent = clue;
                square.classList.add("clue");
                square.style.setProperty(
                    "background-color",
                    getClueColour(clue),
                    "important"
                );
            }
        }

        square.addEventListener("mousedown", event => {
            event.preventDefault();
            dragging = true;
            handleMove(position);
        });

        square.addEventListener(
            "touchstart",
            event => {
                event.preventDefault();
                dragging = true;
                handleMove(position);
            },
            { passive: false }
        );

        grid.appendChild(square);
    }
}

document.addEventListener("mousemove", event => {
    if (!dragging) return;

    const element = document.elementFromPoint(
        event.clientX,
        event.clientY
    );

    if (!element || !element.classList.contains("square")) return;

    handleMove(Number(element.dataset.position));
});

document.addEventListener(
    "touchmove",
    event => {
        if (!dragging) return;

        event.preventDefault();

        const touch = event.touches[0];
        const element = document.elementFromPoint(
            touch.clientX,
            touch.clientY
        );

        if (!element || !element.classList.contains("square")) return;

        handleMove(Number(element.dataset.position));
    },
    { passive: false }
);

document.addEventListener("mouseup", () => {
    dragging = false;
});

document.addEventListener("touchend", () => {
    dragging = false;
});

function handleMove(position) {
    if (completed || isBlackPosition(position)) return;

    // Numstep is a numbered path. A move is only valid when the
    // selected cell contains the next number in the solution.
    const expectedNumber = path.length + 1;
    const selectedNumber = solution[position];

    if (!started) {
        // The puzzle intentionally begins at 1.
        if (selectedNumber !== 1) {
            showMessage("Start on the 1 clue.");
            return;
        }

        started = true;
        startTimer();
        addMove(position);
        return;
    }

    if (path.includes(position)) return;

    const previous = path[path.length - 1];

    if (!isAdjacent(previous, position)) {
        return;
    }

    if (selectedNumber !== expectedNumber) {
        failAttempt("Wrong step.");
        return;
    }

    // A clue is a visible checkpoint. Reaching it at any other
    // point is impossible once the consecutive-number rule is
    // enforced, but this explicit check keeps the rule clear.
    if (isCluePosition(position)) {
        const clue = getClueNumber(position);

        if (clue !== expectedNumber) {
            failAttempt("You reached a clue at the wrong point.");
            return;
        }
    }

    addMove(position);

    if (isPuzzleComplete()) {
        completePuzzle();
        return;
    }

    if (hasNoLegalMoves()) {
        failAttempt("Dead end! Try again.");
    }
}

function addMove(position) {
    path.push(position);

    const square = document.querySelector(
        `[data-position="${position}"]`
    );

    if (!square) return;

    square.classList.add("selected");

    const number = solution[position];
    square.textContent = number;

    const colour = getClueColourForNumber(number);

    square.style.setProperty(
        "background-color",
        colour,
        "important"
    );

    square.style.setProperty(
        "color",
        "#FFFFFF",
        "important"
    );
}

function getClueColourForNumber(number) {
    // 1-9 belong to the first group; 10-19 to the 10 group;
    // 20-29 to the 20 group, etc. This matches the puzzle design.
    const clue = number === 1
        ? 1
        : Math.floor(number / 10) * 10;

    return getClueColour(clue);
}

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

function getLegalMoves() {
    if (path.length === 0) return [];

    const current = path[path.length - 1];
    const row = Math.floor(current / size);
    const col = current % size;
    const expectedNumber = path.length + 1;

    const possible = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1]
    ];

    const legal = [];

    for (const [r, c] of possible) {
        if (r < 0 || r >= size || c < 0 || c >= size) {
            continue;
        }

        const position = r * size + c;

        if (isBlackPosition(position)) continue;
        if (path.includes(position)) continue;

        // Only the next number can be played.
        if (solution[position] !== expectedNumber) continue;

        legal.push(position);
    }

    return legal;
}

function hasNoLegalMoves() {
    return getLegalMoves().length === 0;
}

function countTotalWhiteSquares() {
    return solution.reduce(
        (total, number) => total + (number !== 0 ? 1 : 0),
        0
    );
}

function countRemainingWhiteSquares() {
    return countTotalWhiteSquares() - path.length;
}

function isPuzzleComplete() {
    return path.length === countTotalWhiteSquares();
}

// ------------------------------------------------------------
// FAILURE TRACKING
// ------------------------------------------------------------
//
// A failed attempt is a genuine broken run: the player reaches
// the wrong numbered cell or creates a dead end. Merely clicking
// a non-adjacent cell or a black cell is ignored and does not
// inflate the failure count.
//
// The count is persisted for today's puzzle in localStorage.
// ------------------------------------------------------------

function failAttempt(text) {
    attempts++;
    saveDailyStats();

    stopTimer();

    started = false;
    path = [];

    clearPlayerPath();

    if (timerDisplay) {
        timerDisplay.textContent = "00:00";
    }

    updateAttemptsDisplay();
    showMessage(`${text} Attempt ${attempts}.`);
}

// ------------------------------------------------------------
// SUCCESS TRACKING
// ------------------------------------------------------------
//
// A successful solve is recorded once per browser/device for
// today's puzzle. This avoids counting refreshes as new solves.
// ------------------------------------------------------------

function completePuzzle() {
    stopTimer();
    completed = true;

    const elapsedSeconds = getElapsedSeconds();

    saveDailyStats({
        solved: true,
        solveTime: elapsedSeconds
    });

    showMessage("🎉 Congratulations! You solved today's Numstep!");
}

function clearPlayerPath() {
    const squares = document.querySelectorAll(".square");

    squares.forEach(square => {
        const position = Number(square.dataset.position);
        const number = solution[position];

        square.classList.remove("selected");
        square.textContent = "";

        // Rebuild the original board state exactly. In particular,
        // black squares must be restored to black after a failure.
        if (number === 0) {
            square.classList.add("unused");
            square.style.setProperty(
                "background-color",
                "#000000",
                "important"
            );
            square.style.setProperty(
                "color",
                "#FFFFFF",
                "important"
            );
            return;
        }

        square.classList.remove("unused");
        square.style.setProperty(
            "background-color",
            "#FFFFFF",
            "important"
        );
        square.style.setProperty(
            "color",
            "#000000",
            "important"
        );

        if (isCluePosition(position)) {
            const clue = getClueNumber(position);
            square.textContent = clue;
            square.classList.add("clue");

            square.style.setProperty(
                "background-color",
                getClueColour(clue),
                "important"
            );
        }
    });
}

// ------------------------------------------------------------
// TIMER
// ------------------------------------------------------------

function startTimer() {
    if (startTime !== null) return;

    startTime = Date.now();
    updateTimer();
}

function getElapsedSeconds() {
    if (startTime === null) return 0;

    return Math.floor((Date.now() - startTime) / 1000);
}

function updateTimer() {
    if (startTime === null || completed) return;

    const elapsed = getElapsedSeconds();
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    if (timerDisplay) {
        timerDisplay.textContent =
            String(minutes).padStart(2, "0") +
            ":" +
            String(seconds).padStart(2, "0");
    }

    requestAnimationFrame(updateTimer);
}

function stopTimer() {
    startTime = null;
}

// ------------------------------------------------------------
// DAILY PERSISTENCE
// ------------------------------------------------------------

function getStatsKey() {
    return `numstep-stats-${getToday()}`;
}

function loadDailyStats() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(getStatsKey()) || "null"
        );

        if (!saved) return;

        attempts = Number.isInteger(saved.attempts)
            ? saved.attempts
            : 0;

        if (saved.solved === true) {
            completed = true;
            showMessage(
                `Already solved today in ${formatTime(saved.solveTime || 0)}.`
            );
        }
    } catch (error) {
        console.warn("Could not load Numstep statistics.", error);
    }
}

function saveDailyStats(extra = {}) {
    try {
        const existing = JSON.parse(
            localStorage.getItem(getStatsKey()) || "{}"
        );

        const stats = {
            attempts,
            solved: existing.solved === true || extra.solved === true,
            solveTime:
                extra.solveTime !== undefined
                    ? extra.solveTime
                    : existing.solveTime || null
        };

        localStorage.setItem(
            getStatsKey(),
            JSON.stringify(stats)
        );
    } catch (error) {
        console.warn("Could not save Numstep statistics.", error);
    }
}

function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0")
    );
}

// ------------------------------------------------------------
// RESET
// ------------------------------------------------------------
//
// Reset clears the current run but deliberately does NOT clear
// the daily attempt count. Resetting is therefore a fresh try,
// not a way to erase failure history.
// ------------------------------------------------------------

function resetPuzzle() {
    stopTimer();

    path = [];
    started = false;
    dragging = false;

    timerDisplay.textContent = "00:00";
    message.textContent = "";

    // If the puzzle has already been solved today, reset should
    // not erase the recorded success.
    if (completed) {
        createGrid();
        showMessage("Today's puzzle is already solved.");
        return;
    }

    createGrid();
    updateAttemptsDisplay();
}

function updateAttemptsDisplay() {
    if (!attemptsDisplay) return;
    attemptsDisplay.textContent = `Attempts: ${attempts}`;
}

function showMessage(text) {
    if (!message) return;

    message.textContent = text;

    setTimeout(() => {
        if (!completed && message) {
            message.textContent = "";
        }
    }, 3000);
}

loadPuzzle();
