/**
 * Numstep Daily - rebuilt script.js
 *
 * Combines:
 * - script.js loading, validation, timer and reachability/error logic
 * - script4.js clue-chain colour palette and coloured path rendering
 *
 * Puzzle JSON:
 * {
 *   date: "YYYY-MM-DD",
 *   size: 7,
 *   steps: 41,
 *   clues: [1, 10, 20, 30, 40],
 *   solution: [ ... flattened size x size array ... ]
 * }
 *
 * A solution value of 0 is a blocked/black square.
 */

"use strict";

// ------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------

const PUZZLE_SIZE = 7;

const STORAGE_KEY_ATTEMPTS = "numstep-attempts";
const STORAGE_KEY_TIMER = "numstep-timer";

const DIRECTIONS = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 }
];

const COLOUR_PALETTE = [
    "#4E79A7", "#59A14F", "#F28E2B", "#E15759",
    "#B07AA1", "#76B7B2", "#EDC948", "#9C755F",
    "#86BCB6", "#FF9DA7", "#79706E", "#A0CBE8"
];

// ------------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------------

let puzzleData = null;
let solution = [];
let grid = [];

let clues = [];
let clueColours = new Map();

let currentPath = [];
let isSolved = false;
let attempts = 0;

let timerInterval = null;
let startTime = null;
let totalElapsedBeforeCurrentAttempt = 0;

let dragging = false;

// ------------------------------------------------------------
// STARTUP
// ------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    setupResetButton();
    setupDragControls();
    loadDailyPuzzle();
});

// ------------------------------------------------------------
// DAILY PUZZLE LOADING
// ------------------------------------------------------------

async function loadDailyPuzzle() {
    try {
        const today = getLocalDateString();
        const filename = `numstep_${PUZZLE_SIZE}_${today}.json`;

        console.log(`Loading today's Numstep puzzle: ${filename}`);

        const response = await fetch(filename, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Could not load ${filename}. HTTP status: ${response.status}`
            );
        }

        const data = await response.json();

        validatePuzzleData(data, today);

        puzzleData = data;
        initializePuzzle(data);

    } catch (err) {
        console.error("Failed to load today's Numstep puzzle:", err);
        showLoadError(err);
    }
}

function getLocalDateString() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function validatePuzzleData(data, today) {
    if (!data || typeof data !== "object") {
        throw new Error("Puzzle JSON is empty or invalid.");
    }

    if (data.date !== today) {
        throw new Error(
            `Puzzle date mismatch. Expected ${today}, received ${data.date}.`
        );
    }

    if (Number(data.size) !== PUZZLE_SIZE) {
        throw new Error(
            `Puzzle size mismatch. Expected ${PUZZLE_SIZE}, received ${data.size}.`
        );
    }

    if (!Array.isArray(data.solution)) {
        throw new Error("Puzzle JSON does not contain a solution array.");
    }

    const expectedLength = PUZZLE_SIZE * PUZZLE_SIZE;

    if (data.solution.length !== expectedLength) {
        throw new Error(
            `Solution has ${data.solution.length} cells; expected ${expectedLength}.`
        );
    }

    if (!Array.isArray(data.clues) || data.clues.length === 0) {
        throw new Error("Puzzle JSON does not contain a valid clues array.");
    }

    const playableValues = data.solution
        .filter(value => Number(value) > 0)
        .map(Number);

    if (playableValues.length === 0) {
        throw new Error("Puzzle contains no playable cells.");
    }

    const uniqueValues = new Set(playableValues);

    if (uniqueValues.size !== playableValues.length) {
        throw new Error("Solution contains duplicate step numbers.");
    }

    const maxStep = Math.max(...playableValues);

    for (let step = 1; step <= maxStep; step++) {
        if (!uniqueValues.has(step)) {
            throw new Error(
                `Solution is missing step ${step}.`
            );
        }
    }

    for (const clue of data.clues) {
        const clueNumber = Number(clue);

        if (!Number.isInteger(clueNumber) || clueNumber <= 0) {
            throw new Error(`Invalid clue value: ${clue}.`);
        }

        if (!uniqueValues.has(clueNumber)) {
            throw new Error(
                `Clue ${clueNumber} does not exist in the solution.`
            );
        }
    }
}

// ------------------------------------------------------------
// PUZZLE INITIALISATION
// ------------------------------------------------------------

function initializePuzzle(data) {
    stopTimer(false);

    solution = data.solution.map(Number);
    grid = buildGridFromSolution(data);

    clues = buildClueList(data);
    assignClueColours();

    currentPath = [];
    isSolved = false;
    dragging = false;

    attempts = getStoredAttempts(data.date);

    const gridElement = document.getElementById("grid");

    if (!gridElement) {
        throw new Error("Could not find #grid in index.html.");
    }

    gridElement.innerHTML = "";
    gridElement.style.gridTemplateColumns =
        `repeat(${data.size}, 1fr)`;

    buildBoard(gridElement, data.size);

    totalElapsedBeforeCurrentAttempt = 0;
    startTime = null;

    const timerElement = document.getElementById("timer");

    if (timerElement) {
        timerElement.textContent = "00:00";
    }

    updateAttemptsDisplay();
    showMessage("Start from clue 1.");

    console.log("Numstep puzzle loaded successfully:", data);
}

function buildGridFromSolution(data) {
    const size = Number(data.size);
    const result = [];

    for (let r = 0; r < size; r++) {
        const row = [];

        for (let c = 0; c < size; c++) {
            const value = Number(solution[r * size + c]);

            row.push(value === 0 ? -1 : value);
        }

        result.push(row);
    }

    return result;
}

function buildClueList(data) {
    const supplied = Array.isArray(data.clues)
        ? data.clues.map(Number)
        : [];

    const unique = [...new Set(
        supplied.filter(
            value =>
                Number.isInteger(value) &&
                value > 0 &&
                solution.includes(value)
        )
    )];

    // Ensure the start clue is always present.
    if (!unique.includes(1) && solution.includes(1)) {
        unique.push(1);
    }

    unique.sort((a, b) => a - b);

    return unique.map(value => {
        const position = solution.indexOf(value);

        return {
            value,
            position,
            r: Math.floor(position / data.size),
            c: position % data.size
        };
    });
}

function assignClueColours() {
    clueColours = new Map();

    const colours = [...COLOUR_PALETTE];

    // Shuffle palette so each daily puzzle gets a fresh colour ordering.
    for (let i = colours.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colours[i], colours[j]] = [colours[j], colours[i]];
    }

    clues.forEach((clue, index) => {
        clueColours.set(
            clue.value,
            colours[index % colours.length]
        );
    });
}

function buildBoard(gridElement, size) {
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            const position = r * size + c;
            const value = grid[r][c];

            const cell = document.createElement("div");

            // Support both the current CSS naming and script4 naming.
            cell.classList.add("cell", "square");

            cell.dataset.r = r;
            cell.dataset.c = c;
            cell.dataset.position = position;

            if (value === -1) {
                cell.classList.add("black", "unused");

                cell.style.setProperty(
                    "background-color",
                    "#000000",
                    "important"
                );

                cell.style.setProperty(
                    "color",
                    "#FFFFFF",
                    "important"
                );

            } else {
                cell.classList.add("white-cell");

                cell.style.setProperty(
                    "background-color",
                    "#FFFFFF",
                    "important"
                );

                cell.style.setProperty(
                    "color",
                    "#000000",
                    "important"
                );

                if (isClueValue(value)) {
                    renderClueCell(cell, value);
                }
            }

            cell.addEventListener("click", () => {
                handleCellClick(r, c);
            });

            cell.addEventListener("mousedown", event => {
                event.preventDefault();

                if (isSolved) {
                    return;
                }

                dragging = true;
                handleCellClick(r, c);
            });

            cell.addEventListener(
                "touchstart",
                event => {
                    event.preventDefault();

                    if (isSolved) {
                        return;
                    }

                    dragging = true;
                    handleCellClick(r, c);
                },
                { passive: false }
            );

            gridElement.appendChild(cell);
        }
    }
}

function renderClueCell(cell, clueValue) {
    cell.classList.add("clue");

    cell.textContent = clueValue;

    const colour = getColourForNumber(clueValue);

    cell.style.setProperty(
        "background-color",
        colour,
        "important"
    );

    cell.style.setProperty(
        "color",
        "#FFFFFF",
        "important"
    );
}

// ------------------------------------------------------------
// COLOUR CHAIN LOGIC
// ------------------------------------------------------------

function isClueValue(value) {
    return clues.some(clue => clue.value === value);
}

function getColourGroupForNumber(number) {
    const clueValues = clues.map(clue => clue.value);

    // Each clue owns its chain until the next clue begins.
    // Example:
    // clue 1  -> colours 1 through 9
    // clue 10 -> colours 10 through 19
    // clue 20 -> colours 20 through 29
    //
    // This also works with non-standard clue spacing because it uses
    // the actual clue list rather than assuming every 10 steps.
    let group = clueValues[0] ?? 1;

    for (const clueValue of clueValues) {
        if (clueValue <= number) {
            group = clueValue;
        } else {
            break;
        }
    }

    return group;
}

function getColourForNumber(number) {
    const group = getColourGroupForNumber(number);

    return clueColours.get(group) || COLOUR_PALETTE[0];
}

function colourPathCell(r, c, value) {
    const cell = getCellElement(r, c);

    if (!cell) {
        return;
    }

    cell.classList.add("active", "selected");

    cell.textContent = value;

    cell.style.setProperty(
        "background-color",
        getColourForNumber(value),
        "important"
    );

    cell.style.setProperty(
        "color",
        "#FFFFFF",
        "important"
    );
}

// ------------------------------------------------------------
// PLAYER INTERACTION
// ------------------------------------------------------------

function setupDragControls() {
    document.addEventListener("mousemove", event => {
        if (!dragging || isSolved) {
            return;
        }

        const element = document.elementFromPoint(
            event.clientX,
            event.clientY
        );

        if (!element || !element.classList.contains("cell")) {
            return;
        }

        handleCellClick(
            Number(element.dataset.r),
            Number(element.dataset.c)
        );
    });

    document.addEventListener(
        "touchmove",
        event => {
            if (!dragging || isSolved) {
                return;
            }

            event.preventDefault();

            const touch = event.touches[0];

            const element = document.elementFromPoint(
                touch.clientX,
                touch.clientY
            );

            if (!element || !element.classList.contains("cell")) {
                return;
            }

            handleCellClick(
                Number(element.dataset.r),
                Number(element.dataset.c)
            );
        },
        { passive: false }
    );

    document.addEventListener("mouseup", () => {
        dragging = false;
    });

    document.addEventListener("touchend", () => {
        dragging = false;
    });

    document.addEventListener("touchcancel", () => {
        dragging = false;
    });
}

function handleCellClick(r, c) {
    if (isSolved) {
        return;
    }

    if (!isInsideBoard(r, c)) {
        return;
    }

    const value = grid[r][c];

    // --------------------------------------------------------
    // FIRST MOVE
    // --------------------------------------------------------

 if (currentPath.length === 0) {

    // The player may start from ANY clue.
    if (!isClueValue(value)) {
        showMessage("Start from any coloured clue.");
        return;
    }

    startTimer();

    addToPath(r, c);

    return;
}

    const last = currentPath[currentPath.length - 1];

    // Ignore repeated dragging over the same square.
    if (last.r === r && last.c === c) {
        return;
    }

    // --------------------------------------------------------
    // NON-ADJACENT MOVE
    // --------------------------------------------------------

    if (!isAdjacent(last.r, last.c, r, c)) {
        showMessage("That square is not adjacent.");
        return;
    }

    // --------------------------------------------------------
    // ALREADY VISITED
    // --------------------------------------------------------

    if (isInPath(r, c)) {
        showMessage("You cannot revisit a square.");
        return;
    }

    // --------------------------------------------------------
    // BLACK SQUARE
    // --------------------------------------------------------

    if (value === -1) {
        showMessage("That square is blocked.");
        return;
    }

    // --------------------------------------------------------
    // EXACT STEP CHECK
    //
    // This keeps the robust failure logic from script.js while
    // enforcing the hidden consecutive Numstep path.
    // --------------------------------------------------------

  const lastValue = grid[last.r][last.c];

  const expectedValue = lastValue + 1;

  if (value !== expectedValue) {
      handleFailure(
          `Wrong step. You need ${expectedValue}      next.`
      );
      return;
  }

    // --------------------------------------------------------
    // VALID MOVE
    // --------------------------------------------------------

    addToPath(r, c);
    checkGameState(r, c);
}

function addToPath(r, c) {
    const value = grid[r][c];

    currentPath.push({ r, c });

    colourPathCell(r, c, value);

    showMessage("");
}

// ------------------------------------------------------------
// GAME STATE / FAILURE DETECTION
// ------------------------------------------------------------

function checkGameState(r, c) {
    const value = grid[r][c];

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    if (currentPath.length === countPlayableCells()) {
        handleWin();
        return;
    }

    // --------------------------------------------------------
    // CHECKPOINT / CHAIN TRANSITION
    //
    // If this is the end of a colour chain, the next clue must
    // remain reachable. This preserves the reachability-based
    // error detection philosophy from the original script.js.
    // --------------------------------------------------------

    const nextClue = getNextClueToReach();

    if (nextClue && isEndOfColourChain(value)) {
        if (!isReachable(
            { r, c },
            { r: nextClue.r, c: nextClue.c }
        )) {
            handleFailure(
                "You have reached the end of this chain, but the next clue is no longer reachable."
            );
            return;
        }
    }

    // --------------------------------------------------------
    // TRAPPED / CANNOT CONTINUE
    //
    // Exact-step logic gives a stronger test than generic movement:
    // there must be a reachable path to the next required number.
    // --------------------------------------------------------

    const nextPosition = findPositionForValue(
        currentPath.length + 1
    );

    if (nextPosition) {
        if (!isReachable(
            { r, c },
            nextPosition,
            true
        )) {
            handleFailure(
                "You cannot continue from here. The next step is no longer reachable."
            );
        }
    }
}

function isEndOfColourChain(value) {
    const nextValue = value + 1;

    return isClueValue(value) &&
        clues.some(clue => clue.value === nextValue) === false &&
        clues.some(
            clue =>
                clue.value > value &&
                clue.value <= nextValue
        ) === false;
}

function getNextClueToReach() {
    const highestReached = currentPath.length;

    return clues.find(
        clue => clue.value > highestReached
    ) || null;
}

function findPositionForValue(value) {
    const index = solution.indexOf(value);

    if (index === -1) {
        return null;
    }

    return {
        r: Math.floor(index / PUZZLE_SIZE),
        c: index % PUZZLE_SIZE
    };
}

// ------------------------------------------------------------
// REACHABILITY / ERROR LOGIC
// ------------------------------------------------------------

function isReachable(start, target, requireExactNext = false) {
    const queue = [start];
    const visited = new Set([
        `${start.r},${start.c}`
    ]);

    while (queue.length > 0) {
        const current = queue.shift();

        if (
            current.r === target.r &&
            current.c === target.c
        ) {
            return true;
        }

        for (const dir of DIRECTIONS) {
            const nr = current.r + dir.r;
            const nc = current.c + dir.c;

            if (
                isValidMoveForSearch(
                    nr,
                    nc,
                    visited,
                    target,
                    requireExactNext
                )
            ) {
                visited.add(`${nr},${nc}`);
                queue.push({ r: nr, c: nc });
            }
        }
    }

    return false;
}

function isValidMoveForSearch(
    r,
    c,
    searchVisited,
    target,
    requireExactNext
) {
    if (!isInsideBoard(r, c)) {
        return false;
    }

    if (grid[r][c] === -1) {
        return false;
    }

    if (searchVisited.has(`${r},${c}`)) {
        return false;
    }

    // Do not route through already used squares.
    if (isInPath(r, c)) {
        return false;
    }

    // For the exact-next-step test, only the target itself is useful.
    // The solution is a Hamiltonian-style consecutive path, so allowing
    // arbitrary unused squares would incorrectly hide dead ends.
    if (requireExactNext) {
        return r === target.r && c === target.c;
    }

    return true;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

function isInsideBoard(r, c) {
    return (
        r >= 0 &&
        r < grid.length &&
        c >= 0 &&
        c < grid[0].length
    );
}

function isAdjacent(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);

    return (
        (dr === 1 && dc === 0) ||
        (dr === 0 && dc === 1)
    );
}

function isInPath(r, c) {
    return currentPath.some(
        position =>
            position.r === r &&
            position.c === c
    );
}

function getCellElement(r, c) {
    return document.querySelector(
        `.cell[data-r="${r}"][data-c="${c}"]`
    );
}

function countPlayableCells() {
    return solution.filter(value => value > 0).length;
}

function showMessage(text) {
    const messageElement = document.getElementById("message");

    if (messageElement) {
        messageElement.textContent = text;
    }
}

function showLoadError(error) {
    const gridElement = document.getElementById("grid");

    if (gridElement) {
        gridElement.innerHTML = "";
    }

    showMessage(
        `Unable to load today's puzzle: ${error.message}`
    );
}

// ------------------------------------------------------------
// TIMER
// ------------------------------------------------------------

function startTimer() {
    if (timerInterval) {
        return;
    }

    startTime = Date.now();

    timerInterval = setInterval(
        updateTimerDisplay,
        100
    );
}

function stopTimer(addCurrentSession = true) {
    if (!timerInterval) {
        return;
    }

    clearInterval(timerInterval);
    timerInterval = null;

    if (
        addCurrentSession &&
        startTime !== null
    ) {
        totalElapsedBeforeCurrentAttempt +=
            Date.now() - startTime;
    }

    startTime = null;
}

function updateTimerDisplay() {
    if (startTime === null) {
        return;
    }

    const currentSession =
        Date.now() - startTime;

    const totalMs =
        totalElapsedBeforeCurrentAttempt +
        currentSession;

    const seconds =
        Math.floor((totalMs / 1000) % 60);

    const minutes =
        Math.floor(totalMs / (1000 * 60));

    const timerElement =
        document.getElementById("timer");

    if (timerElement) {
        timerElement.textContent =
            `${String(minutes).padStart(2, "0")}:` +
            `${String(seconds).padStart(2, "0")}`;
    }
}

// ------------------------------------------------------------
// FAILURE / RESET
// ------------------------------------------------------------

function handleFailure(message) {
    attempts++;

    saveAttempts();
    updateAttemptsDisplay();

    // Keep the timer running, matching the original script.js
    // behaviour: failures reset the path, not the overall solve time.
    resetPathState();

    showMessage(
        `${message} Attempt ${attempts}.`
    );
}

function resetPathState() {
    currentPath = [];
    dragging = false;

    document
        .querySelectorAll(".cell")
        .forEach(cell => {
            restoreCellAppearance(cell);
        });
}

function restoreCellAppearance(cell) {
    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const value = grid[r][c];

    cell.classList.remove("active", "selected");

    if (value === -1) {
        cell.classList.add("black", "unused");

        cell.textContent = "";

        cell.style.setProperty(
            "background-color",
            "#000000",
            "important"
        );

        cell.style.setProperty(
            "color",
            "#FFFFFF",
            "important"
        );

        return;
    }

    cell.classList.remove("black", "unused");

    cell.style.setProperty(
        "background-color",
        "#FFFFFF",
        "important"
    );

    cell.style.setProperty(
        "color",
        "#000000",
        "important"
    );

    cell.textContent = "";

    if (isClueValue(value)) {
        renderClueCell(cell, value);
    }
}

function setupResetButton() {
    const resetButton =
        document.getElementById("resetButton");

    if (!resetButton) {
        return;
    }

    resetButton.addEventListener("click", () => {
        if (isSolved) {
            return;
        }

        resetPathState();
        showMessage("Path cleared. Start again from clue 1.");
    });
}

// ------------------------------------------------------------
// WIN
// ------------------------------------------------------------

function handleWin() {
    isSolved = true;
    dragging = false;

    stopTimer(true);

    showMessage(
        "Congratulations! You solved today's Numstep!"
    );
}

// ------------------------------------------------------------
// ATTEMPT STORAGE
// ------------------------------------------------------------

function getAttemptStorageKey() {
    if (!puzzleData || !puzzleData.date) {
        return STORAGE_KEY_ATTEMPTS;
    }

    return `${STORAGE_KEY_ATTEMPTS}-${puzzleData.date}`;
}

function getStoredAttempts() {
    const raw = localStorage.getItem(
        getAttemptStorageKey()
    );

    const value = Number(raw);

    return Number.isFinite(value) && value >= 0
        ? value
        : 0;
}

function saveAttempts() {
    localStorage.setItem(
        getAttemptStorageKey(),
        String(attempts)
    );
}

function updateAttemptsDisplay() {
    const attemptsElement =
        document.getElementById("attempts");

    if (attemptsElement) {
        attemptsElement.textContent = attempts;
    }
}
