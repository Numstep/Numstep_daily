
 /* Numstep Daily - Multi-Chain Rebuild
 *
 * Intended mechanic:
 *   - The player may start ANY chain from ANY clue.
 *   - Every clue owns a coloured numerical chain.
 *   - A chain runs from its clue up to one less than the next clue.
 *   - The final chain runs from its clue to the highest solution number.
 *   - Example:
 *       1  -> 2 ... 9
 *       10 -> 11 ... 19
 *       20 -> 21 ... 29
 *       30 -> 31 ... 39
 *       40 -> 41
 *
 *   - Each chain is stored independently.
 *   - Completing one chain does not erase other completed chains.
 *   - A wrong move resets ONLY the active chain.
 *   - A new chain may be started by clicking any unfinished clue.
 *
 * Expected JSON:
 * {
 *   "date": "YYYY-MM-DD",
 *   "size": 7,
 *   "steps": 41,
 *   "clues": [1, 10, 20, 30, 40],
 *   "solution": [49 flattened cells, 0 = blocked]
 * }
 */

"use strict";

// ============================================================
// CONFIGURATION
// ============================================================

const PUZZLE_SIZE = 7;

const STORAGE_KEY_ATTEMPTS = "numstep-attempts";

const DIRECTIONS = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 }
];

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

// ============================================================
// GLOBAL STATE
// ============================================================

let puzzleData = null;
let solution = [];
let board = [];
let puzzleSize = PUZZLE_SIZE;

let clues = [];
let clueColours = new Map();
let chains = new Map();

/*
 * chains:
 *
 * Map(
 *   clueValue => {
 *       clueValue: 10,
 *       endValue: 19,
 *       path: [{r, c}, ...],
 *       complete: false
 *   }
 * )
 */

let activeChainClue = null;

let attempts = 0;
let isSolved = false;

let dragging = false;

let timerInterval = null;
let puzzleStartTime = null;
let elapsedBeforeStart = 0;

// ============================================================
// STARTUP
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    setupResetButton();
    setupDragControls();
    loadDailyPuzzle();
});

// ============================================================
// DAILY PUZZLE LOADING
// ============================================================

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

    } catch (error) {
        console.error("Failed to load today's Numstep puzzle:", error);
        showLoadError(error);
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

    if (!Number.isInteger(Number(data.size))) {
        throw new Error("Puzzle size is invalid.");
    }

    if (Number(data.size) !== PUZZLE_SIZE) {
        throw new Error(
            `Puzzle size mismatch. Expected ${PUZZLE_SIZE}, received ${data.size}.`
        );
    }

    if (!Array.isArray(data.solution)) {
        throw new Error("Puzzle JSON does not contain a solution array.");
    }

    const expectedLength = Number(data.size) * Number(data.size);

    if (data.solution.length !== expectedLength) {
        throw new Error(
            `Solution has ${data.solution.length} cells; expected ${expectedLength}.`
        );
    }

    if (!Array.isArray(data.clues) || data.clues.length === 0) {
        throw new Error("Puzzle JSON does not contain a valid clues array.");
    }

    const playableValues = data.solution
        .map(Number)
        .filter(value => Number.isInteger(value) && value > 0);

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

    const clueValues = [...new Set(
        data.clues.map(Number)
    )].sort((a, b) => a - b);

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
    puzzleStartTime = null;

    const gridElement = document.getElementById("grid");

    if (!gridElement) {
        throw new Error("Could not find #grid in index.html.");
    }

    gridElement.innerHTML = "";
    gridElement.style.gridTemplateColumns =
        `repeat(${puzzleSize}, 1fr)`;

    renderBoard(gridElement);

    updateAttemptsDisplay();
    resetTimerDisplay();

    showMessage(
        "Choose any coloured clue to start a chain."
    );

    console.log("Numstep multi-chain puzzle loaded:", data);
}

function buildBoardData() {
    board = [];

    for (let r = 0; r < puzzleSize; r++) {
        const row = [];

        for (let c = 0; c < puzzleSize; c++) {
            row.push(
                solution[r * puzzleSize + c]
            );
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

    /*
     * Keep the palette deterministic for a given puzzle load.
     * Clue order maps directly to palette order.
     */
    clues.forEach((clue, index) => {
        clueColours.set(
            clue.value,
            COLOUR_PALETTE[index % COLOUR_PALETTE.length]
        );
    });
}

function initialiseChains() {
    chains = new Map();

    const maxValue = Math.max(
        ...solution.filter(value => value > 0)
    );

    clues.forEach((clue, index) => {
        const nextClue = clues[index + 1];

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

            /*
             * Both classes are included for compatibility with
             * earlier versions of your CSS.
             */
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
    cell.classList.remove("black", "unused");
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
    cell.classList.remove("black", "unused", "clue");
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
// MULTI-CHAIN INTERACTION
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
     * If no chain is currently active, the player may click
     * ANY unfinished clue to start that chain.
     */
    if (activeChainClue === null) {
        if (!isClueValue(value)) {
            showMessage(
                "Start a new chain from any unfinished coloured clue."
            );
            return;
        }

        startOrResumeChain(value);
        return;
    }

    const activeChain = chains.get(activeChainClue);

    if (!activeChain || activeChain.complete) {
        activeChainClue = null;
        showMessage(
            "Choose another unfinished coloured clue."
        );
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
     * A player may switch to another clue by clicking it.
     * This is allowed only when not dragging through the board.
     */
    if (isClueValue(value) && value !== activeChainClue) {
        if (chains.get(value).complete) {
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

    /*
     * Squares already belonging to any completed/active chain
     * cannot be reused.
     */
    if (isUsedByAnyChain(r, c)) {
        showMessage("That square is already part of a chain.");
        return;
    }

    const expectedValue = getExpectedNextValue(activeChain);

    /*
     * A chain ends at its configured end value.
     */
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

    if (value === activeChain.endValue) {
        finishActiveChain();
    }
}

// ============================================================
// START / RESUME CHAIN
// ============================================================

function startOrResumeChain(clueValue) {
    const chain = chains.get(clueValue);

    if (!chain) {
        showMessage("That clue does not have a valid chain.");
        return;
    }

    if (chain.complete) {
        showMessage(
            `The chain starting at ${clueValue} is already complete.`
        );
        return;
    }

    /*
     * A fresh chain always begins at its clue.
     */
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
// CHAIN COMPLETION
// ============================================================

function finishActiveChain() {
    const chain = chains.get(activeChainClue);

    if (!chain) {
        return;
    }

    chain.complete = true;

    const completedClue = activeChainClue;

    activeChainClue = null;

    const completedCount = getCompletedChainCount();

    if (completedCount === chains.size) {
        handlePuzzleWin();
        return;
    }

    showMessage(
        `Chain ${completedClue}–${chain.endValue} complete! ` +
        "Choose another coloured clue."
    );
}

function getCompletedChainCount() {
    let count = 0;

    for (const chain of chains.values()) {
        if (chain.complete) {
            count++;
        }
    }

    return count;
}

// ============================================================
// ERROR / FAILURE LOGIC
// ============================================================

function handleChainFailure(chain, message) {
    attempts++;

    saveAttempts();
    updateAttemptsDisplay();

    /*
     * Only the ACTIVE chain is reset.
     * All previously completed chains remain visible.
     */
    clearChainFromBoard(chain);

    chain.path = [];
    chain.complete = false;

    activeChainClue = null;
    dragging = false;

    showMessage(
        `${message} The active chain has been reset.`
    );
}

/*
 * Restores every square used by one chain.
 *
 * Clue squares are restored as coloured clues.
 * Empty playable squares become white.
 *
 * Completed chains are never passed into this function,
 * so their colours remain untouched.
 */
function clearChainFromBoard(chain) {
    for (const position of chain.path) {
        const value = board[position.r][position.c];

        const cell = getCellElement(
            position.r,
            position.c
        );

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
// REACHABILITY CHECKS
// ============================================================

/*
 * This keeps the reachability/error philosophy from the
 * original script.js, but applies it to an independent chain.
 *
 * Because each puzzle value has a fixed location, the next
 * required number must be adjacent to the current position.
 * The check below catches impossible continuation immediately.
 */
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

    if (!isAdjacent(last.r, last.c, target.r, target.c)) {
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
 * General BFS helper retained for future puzzle/error rules.
 * It avoids blocked cells and cells owned by another chain.
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

            if (
                isUsedByAnotherChain(
                    nr,
                    nc,
                    ignoreChainClue
                )
            ) {
                continue;
            }

            visited.add(key);
            queue.push({ r: nr, c: nc });
        }
    }

    return false;
}

// ============================================================
// CHAIN / CELL LOOKUPS
// ============================================================

function isClueValue(value) {
    return clues.some(clue => clue.value === value);
}

function getClueByValue(value) {
    return clues.find(clue => clue.value === value) || null;
}

function getClueColour(clueValue) {
    return (
        clueColours.get(clueValue) ||
        COLOUR_PALETTE[0]
    );
}

function getChainForValue(value) {
    let owner = null;

    for (const clue of clues) {
        if (clue.value <= value) {
            owner = clue.value;
        } else {
            break;
        }
    }

    return owner;
}

function findPositionForValue(value) {
    const index = solution.indexOf(value);

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
        if (
            chain.path.some(
                position =>
                    position.r === r &&
                    position.c === c
            )
        ) {
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
        if (clueValue === allowedChainClue) {
            continue;
        }

        if (
            chain.path.some(
                position =>
                    position.r === r &&
                    position.c === c
            )
        ) {
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
// DRAG / TOUCH CONTROLS
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
// RESET
// ============================================================

function setupResetButton() {
    const resetButton =
        document.getElementById("resetButton");

    if (!resetButton) {
        return;
    }

    resetButton.addEventListener("click", () => {
        resetEntirePuzzle();
    });
}

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

function rerenderBoard() {
    for (let r = 0; r < puzzleSize; r++) {
        for (let c = 0; c < puzzleSize; c++) {
            const cell = getCellElement(r, c);

            if (!cell) {
                continue;
            }

            const value = board[r][c];

            if (value === 0) {
                renderBlockedCell(cell);
            } else if (isClueValue(value)) {
                renderClueCell(cell, value);
            } else {
                renderEmptyPlayableCell(cell);
            }
        }
    }
}

// ============================================================
// PUZZLE WIN
// ============================================================

function handlePuzzleWin() {
    isSolved = true;
    dragging = false;

    stopTimer(true);

    showMessage(
        "Congratulations! You completed every Numstep chain!"
    );
}

// ============================================================
// TIMER
// ============================================================

function startTimer() {
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

function updateTimerDisplay() {
    if (puzzleStartTime === null) {
        return;
    }

    const elapsed =
        elapsedBeforeStart +
        (Date.now() - puzzleStartTime);

    const totalSeconds =
        Math.floor(elapsed / 1000);

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        totalSeconds % 60;

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

// ============================================================
// ATTEMPTS
// ============================================================

function getAttemptStorageKey() {
    const date =
        puzzleData && puzzleData.date
            ? puzzleData.date
            : "unknown";

    return `${STORAGE_KEY_ATTEMPTS}-${date}`;
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

    if (attemptsElement) {
        attemptsElement.textContent =
            String(attempts);
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

function isAdjacent(r1, c1, r2, c2) {
    const rowDifference = Math.abs(r1 - r2);
    const columnDifference = Math.abs(c1 - c2);

    return (
        (rowDifference === 1 && columnDifference === 0) ||
        (rowDifference === 0 && columnDifference === 1)
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
        `Unable to load today's puzzle: ${error.message}`
    );
}
