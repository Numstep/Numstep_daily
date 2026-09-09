 /* NUMSTEP DAILY - SCRIPT 7 REBUILD
 *
 * Main features:
 *   - Supports 5x5, 7x7 and 9x9 daily puzzles.
 *   - Loads daily puzzle JSON from games/numstep/data/[size]x[size]/.
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
const PUZZLE_DATA_DIRECTORY = "games/numstep/data";
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
    if (window.selectedDateString) {
        return window.selectedDateString;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function getPuzzleFilename(size) {
    const selectedDate = getSelectedDateString();

    // Daily Classic files are generated under the website data folders.
    return `${PUZZLE_DATA_DIRECTORY}/${size}x${size}/${selectedDate}.json`;
}

async function selectPuzzleSize(size) {
    size = Number(size);

    if (!AVAILABLE_SIZES.includes(size)) {
        return;
    }

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
    window.selectedDateString = dateString;
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
    const clueValues = [...new Set(data.clues.map(Number))]
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
    cell.classList.remove("clue", "active", "selected");
    cell.classList.add("black", "unused");
    cell.textContent = "";
    cell.style.setProperty("background-color", "#000000", "important");
    cell.style.setProperty("color", "#FFFFFF", "important");
}

function renderEmptyPlayableCell(cell) {
    cell.classList.remove("black", "unused", "clue", "active", "selected");
    cell.textContent = "";
    cell.style.setProperty("background-color", "#FFFFFF", "important");
    cell.style.setProperty("color", "#000000", "important");
}

function renderClueCell(cell, clueValue) {
    cell.classList.remove("black", "unused", "active", "selected");
    cell.classList.add("clue");
    cell.textContent = clueValue;
    cell.style.setProperty("background-color", getClueColour(clueValue), "important");
    cell.style.setProperty("color", "#FFFFFF", "important");
}

function renderChainCell(cell, value, clueValue) {
    cell.classList.remove("black", "unused", "clue");
    cell.classList.add("active", "selected");
    cell.textContent = value;
    cell.style.setProperty("background-color", getClueColour(clueValue), "important");
    cell.style.setProperty("color", "#FFFFFF", "important");
}

// ============================================================
// PLAYER INTERACTION
// ============================================================

function handleCellSelection(r, c) {
    if (isSolved) return;
    if (!isInsideBoard(r, c)) return;

    const value = board[r][c];

    if (value === 0) {
        showMessage("That square is blocked.");
        return;
    }

    if (activeChainClue === null) {
        if (!isClueValue(value)) {
            showMessage("Start on a coloured clue.");
            return;
        }

        const chain = chains.get(value);

        if (!chain) {
            showMessage("That clue is the final marker.");
            return;
        }

        if (chain.complete) {
            showMessage("That chain is already complete.");
            return;
        }

        activeChainClue = value;
        chain.path = [{ r, c }];

        startTimerIfNeeded();
        renderChainCellAt(r, c, value);
        showMessage(`Chain started at ${value}.`);
        return;
    }

    const chain = chains.get(activeChainClue);

    if (!chain) {
        activeChainClue = null;
        return;
    }

    const last = chain.path[chain.path.length - 1];

    if (last.r === r && last.c === c) return;

    if (!isAdjacent(last.r, last.c, r, c)) {
        breakCurrentChain("Move to an adjacent square.");
        return;
    }

    if (chain.path.some(position => position.r === r && position.c === c)) {
        breakCurrentChain("You cannot revisit a square.");
        return;
    }

    const expectedValue = board[last.r][last.c] + 1;

    if (value !== expectedValue) {
        breakCurrentChain(`The next number must be ${expectedValue}.`);
        return;
    }

    const nextClue = getNextClueAfter(activeChainClue);

    if (nextClue && value === nextClue.value) {
        completeCurrentChain();
        return;
    }

    chain.path.push({ r, c });
    renderChainCellAt(r, c, activeChainClue);

    if (value === chain.endValue) {
        completeCurrentChain();
    }
}

function completeCurrentChain() {
    const chain = chains.get(activeChainClue);

    if (!chain) {
        activeChainClue = null;
        return;
    }

    chain.complete = true;

    const nextClue = getNextClueAfter(activeChainClue);
    activeChainClue = null;

    if (!nextClue) {
        finishPuzzle();
        return;
    }

    showMessage(`Chain complete. Start the ${nextClue.value} chain.`);
}

function breakCurrentChain(message) {
    attempts += 1;
    storeAttempts();
    updateAttemptsDisplay();

    const chain = chains.get(activeChainClue);

    if (chain) chain.path = [];

    activeChainClue = null;
    rerenderCompletedChains();
    showMessage(`${message} Attempt recorded.`);
}

function finishPuzzle() {
    isSolved = true;
    stopTimer(true);

    const maxAttempts = attempts;

    showMessage(
        `Puzzle complete! ${maxAttempts} attempt${maxAttempts === 1 ? "" : "s"} • ${formatTime(finalElapsed)}`
    );

    createShareResult();
}

// ============================================================
// CHAIN / CLUE HELPERS
// ============================================================

function isClueValue(value) {
    return clues.some(clue => clue.value === value);
}

function getNextClueAfter(clueValue) {
    const index = clues.findIndex(clue => clue.value === clueValue);

    if (index === -1 || index >= clues.length - 1) return null;

    return clues[index + 1];
}

function getClueColour(clueValue) {
    return clueColours.get(clueValue) || "#000000";
}

function renderChainCellAt(r, c, clueValue) {
    const gridElement = document.getElementById("grid");
    if (!gridElement) return;

    const cell = gridElement.querySelector(`[data-r="${r}"][data-c="${c}"]`);
    if (!cell) return;

    renderChainCell(cell, board[r][c], clueValue);
}

function rerenderCompletedChains() {
    const gridElement = document.getElementById("grid");
    if (!gridElement) return;

    for (const chain of chains.values()) {
        for (const position of chain.path) {
            renderChainCellAt(position.r, position.c, chain.clueValue);
        }
    }
}

// ============================================================
// TIMER
// ============================================================

function startTimerIfNeeded() {
    if (puzzleStartTime !== null || isSolved) return;

    puzzleStartTime = Date.now();
    timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimer(finalise) {
    if (timerInterval !== null) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    if (puzzleStartTime !== null) {
        elapsedBeforeStart += Date.now() - puzzleStartTime;
    }

    puzzleStartTime = null;

    if (finalise) finalElapsed = elapsedBeforeStart;
}

function resetTimerDisplay() {
    const timerElement = document.getElementById("timer");
    if (timerElement) timerElement.textContent = "00:00";
}

function updateTimerDisplay() {
    const timerElement = document.getElementById("timer");
    if (!timerElement) return;

    let elapsed = elapsedBeforeStart;

    if (puzzleStartTime !== null) {
        elapsed += Date.now() - puzzleStartTime;
    }

    timerElement.textContent = formatTime(elapsed);
}

function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// ============================================================
// ATTEMPTS / STORAGE
// ============================================================

function getAttemptsStorageKey() {
    return `${STORAGE_KEY_ATTEMPTS}-${getSelectedDateString()}-${puzzleSize}`;
}

function getStoredAttempts() {
    try {
        return Number(localStorage.getItem(getAttemptsStorageKey())) || 0;
    } catch (error) {
        return 0;
    }
}

function storeAttempts() {
    try {
        localStorage.setItem(getAttemptsStorageKey(), String(attempts));
    } catch (error) {
        console.error("Could not store attempts:", error);
    }
}

function updateAttemptsDisplay() {
    const attemptsElement = document.getElementById("attempts");

    if (attemptsElement) {
        attemptsElement.textContent = `Attempts: ${attempts}`;
    }
}

// ============================================================
// RESET
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    const resetButton = document.getElementById("resetButton");
    if (!resetButton) return;

    resetButton.addEventListener("click", () => {
        if (isSolved) return;

        stopTimer(false);
        activeChainClue = null;

        for (const chain of chains.values()) {
            chain.path = [];
            chain.complete = false;
        }

        renderPuzzleCells();
        showMessage("Puzzle reset.");
    });
});

function renderPuzzleCells() {
    const gridElement = document.getElementById("grid");
    if (!gridElement) return;

    gridElement.innerHTML = "";
    renderBoard(gridElement);
}

// ============================================================
// RULES
// ============================================================

async function loadRules() {
    try {
        const response = await fetch(RULES_FILE, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Rules returned ${response.status}.`);
        }

        const data = await response.json();
        applyRules(data);
    } catch (error) {
        applyRules(DEFAULT_RULES);
    }
}

function applyRules(rules) {
    const rulesTitle = document.getElementById("rulesTitle");
    const rulesBody = document.getElementById("rulesBody");

    if (rulesTitle) rulesTitle.textContent = rules.title || DEFAULT_RULES.title;
    if (rulesBody) rulesBody.innerHTML = rules.body || DEFAULT_RULES.body;
}

// ============================================================
// UI CONTROLS
// ============================================================

function createInterfaceControls() {
    const grid = document.getElementById("grid");
    if (!grid) return;

    if (!document.getElementById("sizeTabs")) {
        const wrapper = document.createElement("div");
        wrapper.id = "sizeTabs";
        wrapper.className = "sizeTabs";

        AVAILABLE_SIZES.forEach(size => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.size = size;
            button.textContent = `${size}×${size}`;
            button.addEventListener("click", () => selectPuzzleSize(size));
            wrapper.appendChild(button);
        });

        grid.parentNode.insertBefore(wrapper, grid);
    }

    if (!document.getElementById("rulesButton")) {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "rulesButton";
        button.textContent = "RULES";
        button.addEventListener("click", openRules);
        grid.parentNode.insertBefore(button, grid);
    }

    if (!document.getElementById("rulesModal")) {
        const modal = document.createElement("div");
        modal.id = "rulesModal";
        modal.className = "rulesModal";
        modal.setAttribute("aria-hidden", "true");

        modal.innerHTML = `
            <div class="rulesOverlay"></div>
            <div class="rulesBox" role="dialog" aria-modal="true">
                <button type="button" class="rulesClose" aria-label="Close">×</button>
                <h2 id="rulesTitle">How to Play Numstep</h2>
                <div id="rulesBody"></div>
            </div>
        `;

        document.body.appendChild(modal);
        modal.querySelector(".rulesClose").addEventListener("click", closeRules);
        modal.querySelector(".rulesOverlay").addEventListener("click", closeRules);
    }
}

function updateSizeTabs() {
    document.querySelectorAll("#sizeTabs button").forEach(button => {
        button.classList.toggle("active", Number(button.dataset.size) === puzzleSize);
    });
}

function openRules() {
    const modal = document.getElementById("rulesModal");
    if (!modal) return;

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
}

function closeRules() {
    const modal = document.getElementById("rulesModal");
    if (!modal) return;

    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
}

// ============================================================
// DRAG CONTROLS
// ============================================================

function setupDragControls() {
    document.addEventListener("mouseup", () => {
        dragging = false;
    });

    document.addEventListener("touchend", () => {
        dragging = false;
    });
}

// ============================================================
// SHARE RESULT
// ============================================================

async function createShareResult() {
    const dateString = getSelectedDateString();
    let badgeImageUrl = "";

    if (typeof NumstepBadge !== "undefined" && NumstepBadge.generate) {
        badgeImageUrl = await NumstepBadge.generate(
            puzzleSize,
            dateString,
            formatTime(finalElapsed),
            attempts
        );
    }

    const result = {
        size: puzzleSize,
        date: dateString,
        elapsed: finalElapsed,
        attempts,
        url: window.location.href,
        badgeImageUrl
    };

    if (typeof showShareModal === "function") {
        showShareModal(result);
    }
}

// ============================================================
// MISC HELPERS
// ============================================================

function showMessage(message) {
    const element = document.getElementById("message");
    if (element) element.textContent = message;
}

function showLoadError(error) {
    showMessage(`Unable to load today's ${puzzleSize}×${puzzleSize} puzzle: ${error.message}`);
}

function isInsideBoard(r, c) {
    return r >= 0 && r < puzzleSize && c >= 0 && c < puzzleSize;
}

function isAdjacent(r1, c1, r2, c2) {
    return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
}
