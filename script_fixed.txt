// ============================================================
// NUMSTEP
// Daily Puzzle Game
// ============================================================

let puzzle = null;
let size = 0;
let solution = [];
let clueNumbers = [];
let cluePositions = {};
let clueColours = {};

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
let currentClue = null;
let nextClue = null;
let chainLength = 0;

const colourPalette = [
    "#4E79A7", "#59A14F", "#F28E2B", "#E15759",
    "#B07AA1", "#76B7B2", "#EDC948", "#9C755F",
    "#86BCB6", "#FF9DA7", "#79706E", "#A0CBE8"
];

function getToday() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

async function loadPuzzle() {
    try {
        const today = getToday();
        const filename = `numstep_5_${today}.json`;
        const response = await fetch(filename);

        if (!response.ok) {
            throw new Error(`Could not load ${filename}`);
        }

        puzzle = await response.json();

        size = puzzle.size;
        solution = puzzle.solution;

        // IMPORTANT:
        // The existing JSON stores clues as NUMBERS, e.g. [20, 1, 10].
        // Do not treat this array as a 25-cell clue grid.
        clueNumbers = Array.isArray(puzzle.clues)
            ? puzzle.clues.filter(number => number !== 0)
            : [];

        buildCluePositions();

        grid = document.getElementById("grid");
        timerDisplay = document.getElementById("timer");
        message = document.getElementById("message");
        resetButton = document.getElementById("resetButton");
        attemptsDisplay = document.getElementById("attempts");

        assignClueColours();
        createGrid();
        updateAttemptsDisplay();

        if (resetButton) {
            resetButton.addEventListener("click", resetPuzzle);
        }
    } catch (error) {
        console.error(error);

        grid = document.getElementById("grid");

        if (grid) {
            grid.innerHTML =
                "<p>Unable to load today's Numstep puzzle.</p>";
        }
    }
}

// The JSON gives us clue NUMBERS, not their grid positions.
// Find the position of each clue number in the solution.
function buildCluePositions() {
    cluePositions = {};

    for (const clueNumber of clueNumbers) {
        const position = solution.indexOf(clueNumber);

        if (position !== -1) {
            cluePositions[position] = clueNumber;
        }
    }
}

function getClueNumbers() {
    return [...clueNumbers].sort((a, b) => a - b);
}

function getClueAtPosition(position) {
    return Object.prototype.hasOwnProperty.call(
        cluePositions,
        position
    )
        ? cluePositions[position]
        : null;
}

function assignClueColours() {
    clueColours = {};

    const numbers = getClueNumbers();
    const colours = [...colourPalette];

    for (let i = colours.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colours[i], colours[j]] =
            [colours[j], colours[i]];
    }

    for (let i = 0; i < numbers.length; i++) {
        clueColours[numbers[i]] =
            colours[i % colours.length];
    }
}

function isCluePosition(position) {
    return Object.prototype.hasOwnProperty.call(
        cluePositions,
        position
    );
}

function createGrid() {
    if (!grid) return;

    grid.innerHTML = "";

    for (let position = 0; position < solution.length; position++) {
        const solutionNumber = solution[position];

        const square = document.createElement("div");
        square.className = "square";
        square.dataset.position = position;

        if (solutionNumber === 0) {
            square.classList.add("unused");
        } else {
            square.classList.add("white-cell");
        }

        if (isCluePosition(position)) {
            const clueNumber = getClueAtPosition(position);

            square.textContent = clueNumber;
            square.classList.add("clue");

            square.style.setProperty(
                "background-color",
                clueColours[clueNumber],
                "important"
            );
        }

        square.addEventListener("mousedown", function(event) {
            event.preventDefault();
            dragging = true;
            handleMove(position);
        });

        square.addEventListener("touchstart", function(event) {
            event.preventDefault();
            dragging = true;
            handleMove(position);
        }, { passive: false });

        grid.appendChild(square);
    }
}

document.addEventListener("mousemove", function(event) {
    if (!dragging) return;

    const element = document.elementFromPoint(
        event.clientX,
        event.clientY
    );

    if (!element || !element.classList.contains("square")) {
        return;
    }

    handleMove(Number(element.dataset.position));
});

document.addEventListener("touchmove", function(event) {
    if (!dragging) return;

    event.preventDefault();

    const touch = event.touches[0];

    const element = document.elementFromPoint(
        touch.clientX,
        touch.clientY
    );

    if (!element || !element.classList.contains("square")) {
        return;
    }

    handleMove(Number(element.dataset.position));
}, { passive: false });

document.addEventListener("mouseup", function() {
    dragging = false;
});

document.addEventListener("touchend", function() {
    dragging = false;
});

function handleMove(position) {
    if (completed) return;

    const solutionNumber = solution[position];

    if (solutionNumber === 0) {
        return;
    }

    if (!started) {
        if (!isCluePosition(position)) {
            showMessage("Start on a coloured clue.");
            return;
        }

        started = true;
        currentClue = getClueAtPosition(position);
        nextClue = getNextClue(currentClue);
        chainLength = 1;

        startTimer();
        addMove(position);

        return;
    }

    if (path.includes(position)) {
        return;
    }

    const previous = path[path.length - 1];

    if (!isAdjacent(previous, position)) {
        return;
    }

    if (isCluePosition(position)) {
        const enteredClue = getClueAtPosition(position);

        // Reached the next clue.
        if (enteredClue === nextClue) {
            const requiredLength =
                getRequiredChainLength(currentClue);

            if (chainLength !== requiredLength) {
                failAttempt(
                    "You reached the clue at the wrong point."
                );
                return;
            }
        } else {
            failAttempt("Wrong clue.");
            return;
        }
    }

    chainLength++;
    addMove(position);

    if (isCluePosition(position)) {
        currentClue = getClueAtPosition(position);
        nextClue = getNextClue(currentClue);
        chainLength = 1;
    }

    if (isPuzzleComplete()) {
        completePuzzle();
        return;
    }

    if (hasNoLegalMoves()) {
        const remaining = countRemainingWhiteSquares();

        if (remaining > 0) {
            failAttempt("Dead end! Try again.");
        }
    }
}

function addMove(position) {
    path.push(position);

    const square = document.querySelector(
        `[data-position="${position}"]`
    );

    if (!square) return;

    square.classList.add("selected");

    const clueNumber = getClueAtPosition(position);

    if (path.length === 1 || clueNumber !== null) {
        square.textContent = clueNumber;
    } else {
        square.textContent =
            currentClue + chainLength - 1;
    }

    const colour = clueColours[currentClue];

    square.style.setProperty(
        "background-color",
        colour,
        "important"
    );
}

function getRequiredChainLength(clue) {
    // The existing game uses 9 for clue 1 and 10 for other clues.
    // Keep that behaviour, while allowing the JSON "steps" value
    // to describe the overall puzzle size.
    if (clue === 1) {
        return 9;
    }

    return 10;
}

function getNextClue(currentClue) {
    const numbers = getClueNumbers();
    const index = numbers.indexOf(currentClue);

    if (index === -1) {
        return null;
    }

    if (index + 1 >= numbers.length) {
        return null;
    }

    return numbers[index + 1];
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
    if (path.length === 0) {
        return [];
    }

    const current = path[path.length - 1];

    const row = Math.floor(current / size);
    const col = current % size;

    const possible = [
        [row - 1, col],
        [row + 1, col],
        [row, col - 1],
        [row, col + 1]
    ];

    const legal = [];

    for (const [r, c] of possible) {
        if (
            r < 0 ||
            r >= size ||
            c < 0 ||
            c >= size
        ) {
            continue;
        }

        const position = r * size + c;

        if (solution[position] === 0) {
            continue;
        }

        if (path.includes(position)) {
            continue;
        }

        legal.push(position);
    }

    return legal;
}

function hasNoLegalMoves() {
    return getLegalMoves().length === 0;
}

function countRemainingWhiteSquares() {
    let totalWhite = 0;

    for (const number of solution) {
        if (number !== 0) {
            totalWhite++;
        }
    }

    return totalWhite - path.length;
}

function isPuzzleComplete() {
    return path.length === countTotalWhiteSquares();
}

function countTotalWhiteSquares() {
    let total = 0;

    for (const number of solution) {
        if (number !== 0) {
            total++;
        }
    }

    return total;
}

function failAttempt(text) {
    attempts++;

    updateAttemptsDisplay();

    stopTimer();

    started = false;
    path = [];

    currentClue = null;
    nextClue = null;
    chainLength = 0;

    clearPlayerPath();

    if (timerDisplay) {
        timerDisplay.textContent = "00:00";
    }

    showMessage(`${text} Attempt ${attempts}.`);
}

function clearPlayerPath() {
    const squares = document.querySelectorAll(".square");

    squares.forEach(function(square) {
        square.classList.remove("selected");

        const position =
            Number(square.dataset.position);

        const clueNumber = getClueAtPosition(position);

        if (clueNumber !== null) {
            square.textContent = clueNumber;

            square.style.setProperty(
                "background-color",
                clueColours[clueNumber],
                "important"
            );
        } else if (solution[position] !== 0) {
            square.textContent = "";

            square.style.setProperty(
                "background-color",
                "#FFFFFF",
                "important"
            );
        }
    });
}

function completePuzzle() {
    stopTimer();

    completed = true;

    showMessage(
        "🎉 Congratulations! You solved today's Numstep!"
    );
}

function startTimer() {
    if (startTime !== null) {
        return;
    }

    startTime = Date.now();
    updateTimer();
}

function updateTimer() {
    if (startTime === null || completed) {
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

function resetPuzzle() {
    stopTimer();

    path = [];

    started = false;
    completed = false;
    dragging = false;

    currentClue = null;
    nextClue = null;
    chainLength = 0;

    if (timerDisplay) {
        timerDisplay.textContent = "00:00";
    }

    if (message) {
        message.textContent = "";
    }

    createGrid();
}

function updateAttemptsDisplay() {
    if (!attemptsDisplay) {
        return;
    }

    attemptsDisplay.textContent =
        `Attempts: ${attempts}`;
}

function showMessage(text) {
    if (!message) return;

    message.textContent = text;

    setTimeout(function() {
        if (!completed) {
            message.textContent = "";
        }
    }, 3000);
}

loadPuzzle();
