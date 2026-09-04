 /* NUMSTEP DAILY - SCRIPT 7 REBUILD
 *
 * Main features:
 *   - Supports 5x5, 7x7 and 9x9 daily puzzles.
 *   - Loads: numstep_[size]_[YYYY-MM-DD].json
 *   - Final clue is treated as a TERMINAL CLUE when it is also the
 *     highest solution value. It is not treated as a chain of one.
 *     Therefore a puzzle ending at 40 is won when 39 is completed.
 *   - Timer runs continuously across chain attempts and stops immediately
 *     when the puzzle is won.
 *   - Win message reports attempts and elapsed time.
 *   - Rules are loaded from optional rules.json, with a built-in fallback.
 *   - Rules popup and size tabs are created/controlled by this script.
 *   - Cell colours are assigned to clues and inherited by their chains.
 *   - Mouse dragging and touch dragging are supported.
 *
 * Expected puzzle JSON:
 * {
 *   "date": "YYYY-MM-DD",
 *   "size": 5,
 *   "steps": 22,
 *   "clues": [1, 10, 20],
 *   "solution": [0, 5, 4, ...]
 * }
 *
 * A clue is the start of a chain.
 * A chain normally runs from its clue to one less than the next clue.
 * If the final clue is also the highest solution value, that final clue
 * is a terminal marker rather than a chain. The preceding chain therefore
 * ends at maxValue - 1 and completing it wins the puzzle.
 */

"use strict";

// ============================================================
// CONFIGURATION
// ============================================================

const AVAILABLE_SIZES = [5, 7, 9];
const DEFAULT_SIZE = 5;

const PUZZLE_FILE_PREFIX = "numstep";
const RULES_FILE = "rules.json";

const STORAGE_KEY_ATTEMPTS = "numstep-attempts";

const DIRECTIONS = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 }
];

// 12-colour palette, retained from the existing Numstep colour logic.
const COLOUR_PALETTE = [
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

const DEFAULT_RULES = {
    title: "How to Play Numstep",
    body: `
        <p><strong>Complete every chain.</strong></p>
        <p>Start on any coloured clue. Move to adjacent squares,
        horizontally or vertically, following the numbers in order.</p>
        <p>Each clue starts its own coloured chain. The colour of the
        clue is used for every square in that chain.</p>
        <p>You cannot move diagonally, revisit a square, or move onto a
        black square.</p>
        <p>When you reach the end of a chain, the next clue must be the
        next appropriate clue. The puzzle is complete when the final
        required square has been reached.</p>
    `
};

// ============================================================
// GLOBAL STATE
// ============================================================

let puzzleData = null;
let solution = [];
let board = [];
let puzzleSize = DEFAULT_SIZE;

let clues = [];
let clueColours = new Map();
let chains = new Map();

let activeChainClue = null;

let attempts = 0;
let isSolved = false;
let dragging = false;

let timerInterval = null;
let puzzleStartTime = null;
let elapsedBeforeStart = 0;
let finalElapsed = 0;

// ============================================================
// STARTUP
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    createInterfaceControls();
    setupDragControls();
    loadRules();
    selectPuzzleSize(DEFAULT_SIZE);
});

// ============================================================
// DATE / FILE LOADING
// ============================================================

function getSelectedDateString() {

    // Use the date selected by index.html
    if (window.selectedDateString) {
        return window.selectedDateString;
    }

    // Fallback to today if no date has been supplied
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getPuzzleFilename(size) {

    const selectedDate = getSelectedDateString();

    return `${PUZZLE_FILE_PREFIX}_${size}_${selectedDate}.json`;
}



async function selectPuzzleSize(size) {
    size = Number(size);

    if (!AVAILABLE_SIZES.includes(size)) {
        return;
    }

    // If the player changes size, that is a new puzzle context.
    stopTimer(false);

    puzzleSize = size;
    puzzleData = null;
    solution = [];
    board = [];
    clues = [];
    clueColours = new Map();
    chains = new Map();
    activeChainClue = null;
    attempts = 0;
    isSolved = false;
    dragging = false;
    elapsedBeforeStart = 0;
    finalElapsed = 0;

    updateSizeTabs();

    showMessage(`Loading the ${size}×${size} puzzle...`);
    resetTimerDisplay();
    updateAttemptsDisplay();

    await loadPuzzle(size);
}

async function loadPuzzle(size) {
    const filename = getPuzzleFilename(size);

    try {
        const response = await fetch(filename, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Could not load ${filename}. HTTP status: ${response.status}`
            );
        }

        const data = await response.json();

        validatePuzzleData(data);

        puzzleData = data;
        initializePuzzle(data);

    } catch (error) {
        console.error("Failed to load Numstep puzzle:", error);
        showLoadError(error);
    }
}

async function loadPuzzleForDate(dateString) {

    // Store the selected date globally
    window.selectedDateString = dateString;

    // Reload the currently selected puzzle size
    await selectPuzzleSize(puzzleSize);
}


function validatePuzzleData(data) {
    if (!data || typeof data !== "object") {
        throw new Error("Puzzle JSON is empty or invalid.");
    }

    const selectedDate = getSelectedDateString();

if (data.date !== selectedDate) {
    throw new Error(
        `Puzzle date mismatch. Expected ${selectedDate}, received ${data.date}.`
    );
}

    if (Number(data.size) !== puzzleSize) {
        throw new Error(
            `Puzzle size mismatch. Expected ${puzzleSize}, received ${data.size}.`
        );
    }

    if (!Array.isArray(data.solution)) {
        throw new Error("Puzzle JSON does not contain a solution array.");
    }

    const expectedLength = puzzleSize * puzzleSize;

    if (data.solution.length !== expectedLength) {
        throw new Error(
            `Solution has ${data.solution.length} cells; expected ${expectedLength}.`
        );
    }

    if (!Array.isArray(data.clues) || data.clues.length === 0) {
        throw new Error("Puzzle JSON does not contain a valid clues array.");
    }

    const values = data.solution
        .map(Number)
        .filter(value => Number.isInteger(value) && value > 0);

    if (values.length === 0) {
        throw new Error("Puzzle contains no playable cells.");
    }

    const uniqueValues = new Set(values);

    if (uniqueValues.size !== values.length) {
        throw new Error("Solution contains duplicate step numbers.");
    }

    const maxStep = Math.max(...values);

    for (let step = 1; step <= maxStep; step++) {
        if (!uniqueValues.has(step)) {
            throw new Error(`Solution is missing step ${step}.`);
        }
    }

    const clueValues = data.clues
        .map(Number)
        .sort((a, b) => a - b);

    for (const clue of clueValues) {
        if (!Number.isInteger(clue) || clue <= 0) {
            throw new Error(`Invalid clue value: ${clue}.`);
        }

        if (!uniqueValues.has(clue)) {
            throw new Error(
                `Clue ${clue} does not exist in the solution.`
            );
        }
    }
}

// ============================================================
// PUZZLE INITIALISATION
// ============================================================

function initializePuzzle(data) {
    stopTimer(false);

    puzzleSize = Number(data.size);
    solution = data.solution.map(Number);

    buildBoardData();
    buildClueData(data);
    assignClueColours();
    initialiseChains();

    activeChainClue = null;
    attempts = getStoredAttempts();
    isSolved = false;
    dragging = false;

    elapsedBeforeStart = 0;
    finalElapsed = 0;
    puzzleStartTime = null;

    const gridElement = document.getElementById("grid");

    if (!gridElement) {
        throw new Error("Could not find #grid in index.html.");
    }

    gridElement.innerHTML = "";
    gridElement.style.gridTemplateColumns =
        `repeat(${puzzleSize}, minmax(45px, 70px))`;

    renderBoard(gridElement);

    updateAttemptsDisplay();
    resetTimerDisplay();

    showMessage("Choose any coloured clue to start a chain.");
}

function buildBoardData() {
    board = [];

    for (let r = 0; r < puzzleSize; r++) {
        const row = [];

        for (let c = 0; c < puzzleSize; c++) {
            row.push(solution[r * puzzleSize + c]);
        }

        board.push(row);
    }
}

function buildClueData(data) {
    const clueValues = [...new Set(
        data.clues.map(Number)
    )]
        .filter(value => solution.includes(value))
        .sort((a, b) => a - b);

    clues = clueValues.map(value => {
        const position = solution.indexOf(value);

        return {
            value,
            r: Math.floor(position / puzzleSize),
            c: position % puzzleSize
        };
    });
}

function assignClueColours() {
    clueColours = new Map();

    clues.forEach((clue, index) => {
        clueColours.set(
            clue.value,
            COLOUR_PALETTE[index % COLOUR_PALETTE.length]
        );
    });
}

function initialiseChains() {
    chains = new Map();

    const playableValues = solution.filter(value => value > 0);
    const maxValue = Math.max(...playableValues);

    clues.forEach((clue, index) => {
        const nextClue = clues[index + 1];

        /*
         * IMPORTANT:
         * If the final clue is also the highest solution value,
         * it is a terminal marker, not a separate chain.
         *
         * Example:
         *   clues = [1, 10, 20, 30, 40]
         *   maxValue = 40
         *
         * Chains are:
         *   1–9
         *   10–19
         *   20–29
         *   30–39
         *
         * The 40 clue is the finish marker.
         */
        if (!nextClue && clue.value === maxValue) {
            return;
        }

        const endValue = nextClue
            ? nextClue.value - 1
            : maxValue;

        chains.set(clue.value, {
            clueValue: clue.value,
            endValue,
            path: [],
            complete: false
        });
    });
}

// ============================================================
// BOARD RENDERING
// ============================================================

function renderBoard(gridElement) {
    for (let r = 0; r < puzzleSize; r++) {
        for (let c = 0; c < puzzleSize; c++) {
            const value = board[r][c];

            const cell = document.createElement("div");

            cell.classList.add("cell", "square");

            cell.dataset.r = r;
            cell.dataset.c = c;

            if (value === 0) {
                renderBlockedCell(cell);
            } else if (isClueValue(value)) {
                renderClueCell(cell, value);
            } else {
                renderEmptyPlayableCell(cell);
            }

            cell.addEventListener("click", () => {
                handleCellSelection(r, c);
            });

            cell.addEventListener("mousedown", event => {
                event.preventDefault();

                if (!isSolved) {
                    dragging = true;
                    handleCellSelection(r, c);
                }
            });

            cell.addEventListener(
                "touchstart",
                event => {
                    event.preventDefault();

                    if (!isSolved) {
                        dragging = true;
                        handleCellSelection(r, c);
                    }
                },
                { passive: false }
            );

            gridElement.appendChild(cell);
        }
    }
}

function renderBlockedCell(cell) {
    cell.classList.remove(
        "clue",
        "active",
        "selected"
    );

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
}

function renderEmptyPlayableCell(cell) {
    cell.classList.remove(
        "black",
        "unused",
        "clue",
        "active",
        "selected"
    );

    cell.textContent = "";

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
}

function renderClueCell(cell, clueValue) {
    cell.classList.remove(
        "black",
        "unused",
        "active",
        "selected"
    );

    cell.classList.add("clue");

    cell.textContent = clueValue;

    cell.style.setProperty(
        "background-color",
        getClueColour(clueValue),
        "important"
    );

    cell.style.setProperty(
        "color",
        "#FFFFFF",
        "important"
    );
}

function renderChainCell(cell, value, clueValue) {
    cell.classList.remove(
        "black",
        "unused",
        "clue"
    );

    cell.classList.add("active", "selected");

    cell.textContent = value;

    cell.style.setProperty(
        "background-color",
        getClueColour(clueValue),
        "important"
    );

    cell.style.setProperty(
        "color",
        "#FFFFFF",
        "important"
    );
}

// ============================================================
// PLAYER INTERACTION
// ============================================================

function handleCellSelection(r, c) {
    if (isSolved) {
        return;
    }

    if (!isInsideBoard(r, c)) {
        return;
    }

    const value = board[r][c];

    if (value === 0) {
        showMessage("That square is blocked.");
        return;
    }

    /*
     * No active chain:
     * only a clue can begin a chain.
     */
    if (activeChainClue === null) {
        if (!isClueValue(value)) {
            showMessage("Start from a clue square.");
            return;
        }

        startOrResumeChain(value);
        return;
    }

    const activeChain = chains.get(activeChainClue);

    if (!activeChain || activeChain.complete) {
        activeChainClue = null;
        showMessage("Choose another unfinished coloured clue.");
        return;
    }

    const path = activeChain.path;

    if (path.length === 0) {
        startOrResumeChain(activeChainClue);
        return;
    }

    const last = path[path.length - 1];

    // Ignore repeated mouse/touch events on the same cell.
    if (last.r === r && last.c === c) {
        return;
    }

    /*
     * Clicking another unfinished clue switches chains.
     * This is deliberately allowed for normal clicks.
     * Dragging across a clue still behaves as a move.
     */
    if (
        isClueValue(value) &&
        value !== activeChainClue &&
        !dragging
    ) {
        const otherChain = chains.get(value);

        if (!otherChain) {
            showMessage("That clue is the terminal finish clue.");
            return;
        }

        if (otherChain.complete) {
            showMessage(
                `The chain starting at ${value} is already complete.`
            );
            return;
        }

        activeChainClue = null;
        startOrResumeChain(value);
        return;
    }

    if (!isAdjacent(last.r, last.c, r, c)) {
        showMessage("That square is not adjacent.");
        return;
    }

    if (isUsedByAnyChain(r, c)) {
        showMessage("That square is already part of a chain.");
        return;
    }

    const expectedValue = getExpectedNextValue(activeChain);

    if (expectedValue > activeChain.endValue) {
        finishActiveChain();
        return;
    }

    if (value !== expectedValue) {
        handleChainFailure(
            activeChain,
            `Wrong step. You need ${expectedValue} next.`
        );
        return;
    }

    addCellToActiveChain(r, c);

    /*
     * This is the key completion check.
     *
     * If the final chain ends at 39 and the terminal clue is 40,
     * reaching 39 completes the puzzle. No attempt is made to
     * connect 40 to 40.
     */
    if (value === activeChain.endValue) {
        finishActiveChain();
    }
}

function startOrResumeChain(clueValue) {
    const chain = chains.get(clueValue);

    /*
     * A terminal final clue is not a chain. It cannot be started.
     * It is reached implicitly by completing the preceding chain.
     */
    if (!chain) {
        const terminalClue = getTerminalClue();

        if (
            terminalClue &&
            terminalClue.value === Number(clueValue)
        ) {
            showMessage(
                `The puzzle finishes when you reach ${terminalClue.value - 1}.`
            );
            return;
        }

        showMessage("That clue does not have a valid chain.");
        return;
    }

    if (chain.complete) {
        showMessage(
            `The chain starting at ${clueValue} is already complete.`
        );
        return;
    }

    if (chain.path.length === 0) {
        const clue = getClueByValue(clueValue);

        if (!clue) {
            showMessage("Could not locate that clue.");
            return;
        }

        if (isUsedByAnotherChain(
            clue.r,
            clue.c,
            clueValue
        )) {
            showMessage(
                "That clue square is already occupied by another chain."
            );
            return;
        }

        chain.path.push({
            r: clue.r,
            c: clue.c
        });

        renderPathPosition(
            clue.r,
            clue.c,
            clueValue,
            clueValue
        );
    }

    activeChainClue = clueValue;

    startTimer();

    showMessage(
        `Chain ${clueValue}–${chain.endValue} is active.`
    );
}

function getExpectedNextValue(chain) {
    if (chain.path.length === 0) {
        return chain.clueValue;
    }

    const last = chain.path[chain.path.length - 1];

    return board[last.r][last.c] + 1;
}

function addCellToActiveChain(r, c) {
    const chain = chains.get(activeChainClue);

    if (!chain) {
        return;
    }

    const value = board[r][c];

    chain.path.push({ r, c });

    renderPathPosition(
        r,
        c,
        value,
        activeChainClue
    );

    showMessage("");
}

// ============================================================
// CHAIN COMPLETION / FAILURE
// ============================================================

function finishActiveChain() {
    const chain = chains.get(activeChainClue);

    if (!chain) {
        return;
    }

    chain.complete = true;

    const completedClue = activeChainClue;
    const completedEnd = chain.endValue;

    activeChainClue = null;

    /*
     * Win is based on the actual chain set, not on a fictional
     * final chain beginning at the terminal clue.
     */
    if (allChainsComplete()) {
        handlePuzzleWin();
        return;
    }

    showMessage(
        `Chain ${completedClue}–${completedEnd} complete! ` +
        "Choose another coloured clue."
    );
}

function allChainsComplete() {
    if (chains.size === 0) {
        return false;
    }

    for (const chain of chains.values()) {
        if (!chain.complete) {
            return false;
        }
    }

    return true;
}

function handleChainFailure(chain, message) {
    attempts++;

    saveAttempts();
    updateAttemptsDisplay();

    clearChainFromBoard(chain);

    chain.path = [];
    chain.complete = false;

    activeChainClue = null;
    dragging = false;

    showMessage(
        `${message} The active chain has been reset.`
    );
}

function clearChainFromBoard(chain) {
    for (const position of chain.path) {
        const value = board[position.r][position.c];
        const cell = getCellElement(position.r, position.c);

        if (!cell) {
            continue;
        }

        if (isClueValue(value)) {
            renderClueCell(cell, value);
        } else {
            renderEmptyPlayableCell(cell);
        }
    }
}

// ============================================================
// REACHABILITY / ERROR CHECKS
// ============================================================

function canContinueActiveChain() {
    if (activeChainClue === null) {
        return true;
    }

    const chain = chains.get(activeChainClue);

    if (!chain || chain.path.length === 0) {
        return true;
    }

    const expected = getExpectedNextValue(chain);

    if (expected > chain.endValue) {
        return true;
    }

    const target = findPositionForValue(expected);

    if (!target) {
        return false;
    }

    const last = chain.path[chain.path.length - 1];

    if (!isAdjacent(
        last.r,
        last.c,
        target.r,
        target.c
    )) {
        return false;
    }

    if (isUsedByAnotherChain(
        target.r,
        target.c,
        activeChainClue
    )) {
        return false;
    }

    return true;
}

/*
 * Called when a drag/mouseup ends. If the player has reached the
 * end of a chain, there must be no additional move: finishActiveChain()
 * has already handled the chain when its final value was selected.
 *
 * We retain this reachability helper so the game can be extended
 * without changing the core board representation.
 */
function isReachable(start, target, ignoreChainClue = null) {
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

        for (const direction of DIRECTIONS) {
            const nr = current.r + direction.r;
            const nc = current.c + direction.c;
            const key = `${nr},${nc}`;

            if (!isInsideBoard(nr, nc)) {
                continue;
            }

            if (visited.has(key)) {
                continue;
            }

            if (board[nr][nc] === 0) {
                continue;
            }

            if (isUsedByAnotherChain(
                nr,
                nc,
                ignoreChainClue
            )) {
                continue;
            }

            visited.add(key);
            queue.push({ r: nr, c: nc });
        }
    }

    return false;
}

// ============================================================
// LOOKUPS
// ============================================================

function isClueValue(value) {
    return clues.some(
        clue => clue.value === Number(value)
    );
}

function getClueByValue(value) {
    return clues.find(
        clue => clue.value === Number(value)
    ) || null;
}

function getTerminalClue() {
    const playableValues = solution.filter(
        value => value > 0
    );

    if (playableValues.length === 0) {
        return null;
    }

    const maxValue = Math.max(...playableValues);
    const lastClue = clues[clues.length - 1];

    if (
        lastClue &&
        lastClue.value === maxValue
    ) {
        return lastClue;
    }

    return null;
}

function getClueColour(clueValue) {
    return (
        clueColours.get(Number(clueValue)) ||
        COLOUR_PALETTE[0]
    );
}

function findPositionForValue(value) {
    const index = solution.indexOf(Number(value));

    if (index === -1) {
        return null;
    }

    return {
        r: Math.floor(index / puzzleSize),
        c: index % puzzleSize
    };
}

function isUsedByAnyChain(r, c) {
    for (const chain of chains.values()) {
        if (chain.path.some(
            position =>
                position.r === r &&
                position.c === c
        )) {
            return true;
        }
    }

    return false;
}

function isUsedByAnotherChain(
    r,
    c,
    allowedChainClue
) {
    for (const [clueValue, chain] of chains.entries()) {
        if (clueValue === Number(allowedChainClue)) {
            continue;
        }

        if (chain.path.some(
            position =>
                position.r === r &&
                position.c === c
        )) {
            return true;
        }
    }

    return false;
}

function renderPathPosition(
    r,
    c,
    value,
    clueValue
) {
    const cell = getCellElement(r, c);

    if (!cell) {
        return;
    }

    renderChainCell(
        cell,
        value,
        clueValue
    );
}

// ============================================================
// DRAG / TOUCH
// ============================================================

function setupDragControls() {
    document.addEventListener("mousemove", event => {
        if (!dragging || isSolved) {
            return;
        }

        const element = document.elementFromPoint(
            event.clientX,
            event.clientY
        );

        if (!isBoardCell(element)) {
            return;
        }

        handleCellSelection(
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

            if (!touch) {
                return;
            }

            const element = document.elementFromPoint(
                touch.clientX,
                touch.clientY
            );

            if (!isBoardCell(element)) {
                return;
            }

            handleCellSelection(
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

function isBoardCell(element) {
    return (
        element &&
        (
            element.classList.contains("cell") ||
            element.classList.contains("square")
        ) &&
        element.dataset.r !== undefined &&
        element.dataset.c !== undefined
    );
}

// ============================================================
// TIMER
// ============================================================

function startTimer() {
    if (isSolved) {
        return;
    }

    if (timerInterval !== null) {
        return;
    }

    puzzleStartTime = Date.now();

    timerInterval = setInterval(
        updateTimerDisplay,
        250
    );
}

function stopTimer(saveElapsed) {
    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    if (
        saveElapsed &&
        puzzleStartTime !== null
    ) {
        elapsedBeforeStart +=
            Date.now() - puzzleStartTime;
    }

    puzzleStartTime = null;
}

function getElapsedMilliseconds() {
    if (puzzleStartTime === null) {
        return elapsedBeforeStart;
    }

    return (
        elapsedBeforeStart +
        (Date.now() - puzzleStartTime)
    );
}

function updateTimerDisplay() {
    const elapsed = isSolved
        ? finalElapsed
        : getElapsedMilliseconds();

    const totalSeconds = Math.floor(
        elapsed / 1000
    );

    const minutes = Math.floor(
        totalSeconds / 60
    );

    const seconds = totalSeconds % 60;

    const timerElement =
        document.getElementById("timer");

    if (timerElement) {
        timerElement.textContent =
            `${String(minutes).padStart(2, "0")}:` +
            `${String(seconds).padStart(2, "0")}`;
    }
}

function resetTimerDisplay() {
    const timerElement =
        document.getElementById("timer");

    if (timerElement) {
        timerElement.textContent = "00:00";
    }
}

function formatElapsedTime(milliseconds) {
    const totalSeconds = Math.floor(
        milliseconds / 1000
    );

    const hours = Math.floor(
        totalSeconds / 3600
    );

    const minutes = Math.floor(
        (totalSeconds % 3600) / 60
    );

    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return (
            `${hours}h ` +
            `${String(minutes).padStart(2, "0")}m ` +
            `${String(seconds).padStart(2, "0")}s`
        );
    }

    if (minutes > 0) {
        return (
            `${minutes}m ` +
            `${String(seconds).padStart(2, "0")}s`
        );
    }

    return `${seconds}s`;
}

// ============================================================
// WIN
// ============================================================

function handlePuzzleWin() {
    if (isSolved) {
        return;
    }

    finalElapsed = getElapsedMilliseconds();

    isSolved = true;
    dragging = false;

    stopTimer(false);

    updateTimerDisplay();

    showMessage(
        `Congratulations! Puzzle complete — ` +
        `${attempts} attempt${attempts === 1 ? "" : "s"} ` +
        `in ${formatElapsedTime(finalElapsed)}.`
    );
}

// ============================================================
// ATTEMPTS
// ============================================================

function getAttemptStorageKey() {
    const date = puzzleData && puzzleData.date
        ? puzzleData.date
        : getLocalDateString();

    return (
        `${STORAGE_KEY_ATTEMPTS}-` +
        `${date}-${puzzleSize}`
    );
}

function getStoredAttempts() {
    const raw = localStorage.getItem(
        getAttemptStorageKey()
    );

    const value = Number(raw);

    return (
        Number.isInteger(value) &&
        value >= 0
    )
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

    if (!attemptsElement) {
        return;
    }

    /*
     * Compatible with both:
     *   <div id="attempts"></div>
     * and the old:
     *   <div id="attempts">Attempts: 0</div>
     */
    attemptsElement.textContent =
        `Attempts: ${attempts}`;
}

// ============================================================
// RESET
// ============================================================

function resetEntirePuzzle() {
    if (isSolved) {
        return;
    }

    for (const chain of chains.values()) {
        chain.path = [];
        chain.complete = false;
    }

    activeChainClue = null;
    dragging = false;

    rerenderBoard();

    showMessage(
        "All chains cleared. Choose any coloured clue to begin."
    );
}

function setupResetButton() {
    const resetButton =
        document.getElementById("resetButton");

    if (!resetButton) {
        return;
    }

    resetButton.addEventListener(
        "click",
        resetEntirePuzzle
    );
}

// ============================================================
// SIZE TABS / RULES UI
// ============================================================

function createInterfaceControls() {
    const grid = document.getElementById("grid");

    if (!grid) {
        return;
    }

    setupResetButton();

    createSizeTabs(grid);
    createRulesButton();
    createRulesModal();
}

function createSizeTabs(grid) {
    let tabs = document.getElementById("sizeTabs");

    if (!tabs) {
        tabs = document.createElement("div");
        tabs.id = "sizeTabs";
        tabs.setAttribute(
            "role",
            "tablist"
        );

        grid.parentNode.insertBefore(
            tabs,
            grid
        );
    }

    tabs.innerHTML = "";

    AVAILABLE_SIZES.forEach(size => {
        const button =
            document.createElement("button");

        button.type = "button";
        button.className = "sizeTab";
        button.dataset.size = size;
        button.textContent = `${size}×${size}`;

        button.setAttribute(
            "role",
            "tab"
        );

        button.addEventListener(
            "click",
            () => selectPuzzleSize(size)
        );

        tabs.appendChild(button);
    });

    updateSizeTabs();
}

function updateSizeTabs() {
    const tabs =
        document.querySelectorAll(".sizeTab");

    tabs.forEach(tab => {
        const active =
            Number(tab.dataset.size) === puzzleSize;

        tab.classList.toggle(
            "active",
            active
        );

        tab.setAttribute(
            "aria-selected",
            active ? "true" : "false"
        );
    });
}

function createRulesButton() {
    if (document.getElementById("rulesButton")) {
        return;
    }

    const button =
        document.createElement("button");

    button.type = "button";
    button.id = "rulesButton";
    button.textContent = "HOW TO PLAY";

    button.addEventListener(
        "click",
        openRulesModal
    );

    const resetButton =
        document.getElementById("resetButton");

    if (resetButton && resetButton.parentNode) {
        resetButton.parentNode.insertBefore(
            button,
            resetButton
        );
    } else {
        document.body.appendChild(button);
    }
}

function createRulesModal() {
    if (document.getElementById("rulesModal")) {
        return;
    }

    const modal =
        document.createElement("div");

    modal.id = "rulesModal";
    modal.className = "rulesModal";
    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    modal.innerHTML = `
        <div class="rulesOverlay" data-close-rules="true"></div>
        <div class="rulesBox"
             role="dialog"
             aria-modal="true"
             aria-labelledby="rulesTitle">
            <button type="button"
                    class="rulesClose"
                    id="rulesClose"
                    aria-label="Close rules">
                ×
            </button>
            <h2 id="rulesTitle">How to Play Numstep</h2>
            <div id="rulesContent"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const closeButton =
        document.getElementById("rulesClose");

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            closeRulesModal
        );
    }

    modal.addEventListener(
        "click",
        event => {
            if (
                event.target.dataset &&
                event.target.dataset.closeRules === "true"
            ) {
                closeRulesModal();
            }
        }
    );

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                modal.getAttribute("aria-hidden") === "false"
            ) {
                closeRulesModal();
            }
        }
    );

    renderRules(DEFAULT_RULES);
}

function openRulesModal() {
    const modal =
        document.getElementById("rulesModal");

    if (!modal) {
        return;
    }

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    modal.classList.add("open");
}

function closeRulesModal() {
    const modal =
        document.getElementById("rulesModal");

    if (!modal) {
        return;
    }

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    modal.classList.remove("open");
}

function renderRules(rules) {
    const title =
        document.getElementById("rulesTitle");

    const content =
        document.getElementById("rulesContent");

    if (!title || !content) {
        return;
    }

    title.textContent =
        rules.title || DEFAULT_RULES.title;

    content.innerHTML =
        rules.body || DEFAULT_RULES.body;
}

async function loadRules() {
    try {
        const response = await fetch(
            RULES_FILE,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error(
                `Rules file returned ${response.status}.`
            );
        }

        const rules = await response.json();

        if (
            !rules ||
            typeof rules !== "object"
        ) {
            throw new Error(
                "Rules JSON is invalid."
            );
        }

        renderRules({
            title: rules.title || DEFAULT_RULES.title,
            body: rules.body || DEFAULT_RULES.body
        });

    } catch (error) {
        /*
         * rules.json is deliberately optional.
         * The game remains usable with the built-in rules.
         */
        console.warn(
            "Using built-in Numstep rules:",
            error.message
        );

        renderRules(DEFAULT_RULES);
    }
}

// ============================================================
// GENERAL HELPERS
// ============================================================

function isInsideBoard(r, c) {
    return (
        r >= 0 &&
        r < puzzleSize &&
        c >= 0 &&
        c < puzzleSize
    );
}

function isAdjacent(
    r1,
    c1,
    r2,
    c2
) {
    const rowDifference =
        Math.abs(r1 - r2);

    const columnDifference =
        Math.abs(c1 - c2);

    return (
        (
            rowDifference === 1 &&
            columnDifference === 0
        ) ||
        (
            rowDifference === 0 &&
            columnDifference === 1
        )
    );
}

function getCellElement(r, c) {
    return document.querySelector(
        `.cell[data-r="${r}"][data-c="${c}"]`
    );
}

function showMessage(message) {
    const messageElement =
        document.getElementById("message");

    if (messageElement) {
        messageElement.textContent = message;
    }
}

function showLoadError(error) {
    const gridElement =
        document.getElementById("grid");

    if (gridElement) {
        gridElement.innerHTML = "";
    }

    showMessage(
        `Unable to load today's ` +
        `${puzzleSize}×${puzzleSize} puzzle: ` +
        `${error.message}`
    );
}
