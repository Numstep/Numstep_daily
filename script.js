/**
 * Numstep Daily - script.js
 *
 * Replacement for the current daily-play JavaScript.
 *
 * IMPORTANT:
 * The current Numstep JSON files do NOT contain a "grid" property.
 * They contain:
 *   date
 *   size
 *   steps
 *   clues
 *   solution
 *
 * The solution is a flattened array. Zeroes represent black squares.
 * This script converts that format into the playable grid.
 *
 * The daily files are named:
 *   numstep_5_YYYY-MM-DD.json
 *   numstep_7_YYYY-MM-DD.json
 *   numstep_9_YYYY-MM-DD.json
 *
 * Change PUZZLE_SIZE below if the daily website should use a different
 * puzzle size.
 */

// ------------------------------------------------------------
// GLOBAL STATE
// ------------------------------------------------------------

let grid = [];
let clues = [];
let currentPath = [];
let puzzleData = null;

let timerInterval = null;
let startTime = null;
let totalElapsedBeforeCurrentAttempt = 0;

let isSolved = false;
let attempts = 0;

// ------------------------------------------------------------
// CONFIGURATION
// ------------------------------------------------------------

// The daily website currently uses the 7 x 7 puzzle.
// Change this to 5 or 9 if required.
const PUZZLE_SIZE = 7;

const STORAGE_KEY_STATS = 'numstep-stats';
const STORAGE_KEY_LAST_PLAYED = 'numstep-last-played';
const STORAGE_KEY_ATTEMPTS = 'numstep-attempts';
const STORAGE_KEY_TIMER = 'numstep-timer';


// Colours are assigned to clue/checkpoint groups.
const colourPalette = [
    "#4E79A7", "#59A14F", "#F28E2B", "#E15759",
    "#B07AA1", "#76B7B2", "#EDC948", "#9C755F",
    "#86BCB6", "#FF9DA7", "#79706E", "#A0CBE8"
];

let clueColours = {};


const DIRECTIONS = [
    { r: -1, c: 0 },
    { r: 1, c: 0 },
    { r: 0, c: -1 },
    { r: 0, c: 1 }
];

// ------------------------------------------------------------
// STARTUP
// ------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    setupResetButton();
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
            cache: 'no-store'
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
        console.error('Failed to load todays Numstep puzzle:', err);
        showLoadError(err);
    }
}

/**
 * Returns the date in YYYY-MM-DD format using the user's local date.
 *
 * This deliberately avoids toISOString(), because that uses UTC and
 * can therefore select yesterday's or tomorrow's puzzle around midnight.
 */
function getLocalDateString() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * Check that the downloaded JSON has the structure produced by the
 * current Numstep generator.
 */
function validatePuzzleData(data, today) {
    if (!data || typeof data !== 'object') {
        throw new Error('Puzzle JSON is empty or invalid.');
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
        throw new Error('Puzzle JSON does not contain a solution array.');
    }

    const expectedLength = PUZZLE_SIZE * PUZZLE_SIZE;

    if (data.solution.length !== expectedLength) {
        throw new Error(
            `Solution has ${data.solution.length} cells; expected ${expectedLength}.`
        );
    }

    if (!Array.isArray(data.clues) || data.clues.length === 0) {
        throw new Error('Puzzle JSON does not contain a valid clues array.');
    }
}

// ------------------------------------------------------------
// PUZZLE INITIALISATION
// ------------------------------------------------------------

function initializePuzzle(data) {
    stopTimer(false);

    grid = convertSolutionToPlayableGrid(data);

    clues = [];
    currentPath = [];
    isSolved = false;

    attempts = getStoredAttempts(data.date);

    const gridElement = document.getElementById('grid');

    if (!gridElement) {
        throw new Error('Could not find #grid in index.html.');
    }

    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns =
        `repeat(${data.size}, 1fr)`;

    // Build the playable grid.
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const cellVal = grid[r][c];

            const cell = document.createElement('div');

            cell.classList.add('cell');

            cell.dataset.r = r;
            cell.dataset.c = c;

            if (cellVal === -1) {
                // Black square.
                cell.classList.add('black');

            } else if (cellVal > 0) {
                // Clue square.
                cell.classList.add('clue');
                cell.textContent = cellVal;

                clues.push({
                    value: cellVal,
                    r: r,
                    c: c
                });
            }

            cell.addEventListener('click', () => {
                handleCellClick(r, c);
            });

            gridElement.appendChild(cell);
        }
    }

    // Always define clue order numerically.
    clues.sort((a, b) => a.value - b.value);

    updateAttemptsDisplay();

    // A new puzzle starts with a fresh timer.
    totalElapsedBeforeCurrentAttempt = 0;
    startTime = null;

    document.getElementById('timer').textContent = '00:00';

    showMessage('Start from a clue square.');

    console.log('Numstep puzzle loaded successfully:', data);
}

/**
 * Converts the current JSON format into the internal grid format.
 *
 * JSON:
 *   positive number = path step
 *   0              = black square
 *
 * Player grid:
 *   clue number     = visible clue
 *   -1              = black square
 *   0               = ordinary playable square
 */
function convertSolutionToPlayableGrid(data) {
    const size = Number(data.size);
    const solution = data.solution;

    const playableGrid = [];

    for (let r = 0; r < size; r++) {
        const row = [];

        for (let c = 0; c < size; c++) {
            const solutionValue = Number(solution[r * size + c]);

            if (solutionValue === 0) {
                row.push(-1);
            } else {
                row.push(0);
            }
        }

        playableGrid.push(row);
    }

    // Put the visible clues onto their corresponding solution cells.
    for (const clueValue of data.clues) {
        const value = Number(clueValue);

        const index = solution.indexOf(value);

        if (index === -1) {
            console.warn(`Clue ${value} was not found in the solution.`);
            continue;
        }

        const r = Math.floor(index / size);
        const c = index % size;

        playableGrid[r][c] = value;
    }

    return playableGrid;
}

// ------------------------------------------------------------
// PLAYER INTERACTION
// ------------------------------------------------------------

function handleCellClick(r, c) {
    if (isSolved) {
        return;
    }

    const cellVal = grid[r][c];

    // --------------------------------------------------------
    // FIRST MOVE
    // --------------------------------------------------------

    if (currentPath.length === 0) {

        if (cellVal <= 0) {
            showMessage('Start from a clue square.');
            return;
        }

        // The first clue should be the first clue in the chain.
        const firstClue = clues[0];

        if (!firstClue || cellVal !== firstClue.value) {
            showMessage('Start from the first clue.');
            return;
        }

        startTimer();

        addToPath(r, c);

        checkGameState(r, c);

        return;
    }

    const last = currentPath[currentPath.length - 1];

    // --------------------------------------------------------
    // NON-ADJACENT MOVE
    // --------------------------------------------------------

    if (!isAdjacent(last.r, last.c, r, c)) {
        showMessage('That square is not adjacent.');
        return;
    }

    // --------------------------------------------------------
    // ALREADY VISITED
    // --------------------------------------------------------

    if (isInPath(r, c)) {
        showMessage('You cannot revisit a square.');
        return;
    }

    // --------------------------------------------------------
    // BLACK SQUARE
    // --------------------------------------------------------

    if (cellVal === -1) {
        showMessage('That square is blocked.');
        return;
    }

    // --------------------------------------------------------
    // CLUE ORDER
    // --------------------------------------------------------

    const nextClue = getNextClueToReach();

    if (!nextClue) {
        handleWin();
        return;
    }

    if (cellVal > 0 && cellVal !== nextClue.value) {
        showMessage(
            `You need to reach clue ${nextClue.value} next.`
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
    currentPath.push({ r, c });

    const cell = getCellElement(r, c);

    if (cell) {
        cell.classList.add('active');
    }

    showMessage('');
}

// ------------------------------------------------------------
// GAME STATE / FAILURE DETECTION
// ------------------------------------------------------------

function checkGameState(r, c) {
    const lastVal = grid[r][c];

    const nextClue = getNextClueToReach();

    // --------------------------------------------------------
    // SUCCESS
    // --------------------------------------------------------

    if (!nextClue) {
        handleWin();
        return;
    }

    // --------------------------------------------------------
    // END OF CHAIN
    //
    // Example:
    //   1 -> 2 -> ... -> 9
    //
    // If 9 is reached, clue 10 must be adjacent.
    // The same applies to 19 -> 20, 29 -> 30, etc.
    // --------------------------------------------------------

    if (lastVal > 0 && lastVal % 10 === 9) {

        if (!isAdjacent(r, c, nextClue.r, nextClue.c)) {
            handleFailure(
                'You have reached the end of this chain, but you are not adjacent to the next clue.'
            );
            return;
        }
    }

    // --------------------------------------------------------
    // TRAPPED / CANNOT CONTINUE
    // --------------------------------------------------------

    if (isTrapped(r, c, nextClue)) {
        handleFailure(
            'You cannot continue from here. The next clue is no longer reachable.'
        );
        return;
    }
}

/**
 * Determines whether the next clue can still be reached from the
 * player's current position without using already visited cells.
 *
 * This is a reachability test, not a solution test. It checks whether
 * there is at least one geometrically possible route to the next clue.
 */
function isTrapped(r, c, targetClue) {
    const queue = [{ r, c }];
    const visited = new Set();

    visited.add(`${r},${c}`);

    while (queue.length > 0) {
        const current = queue.shift();

        if (
            current.r === targetClue.r &&
            current.c === targetClue.c
        ) {
            return false;
        }

        for (const dir of DIRECTIONS) {
            const nr = current.r + dir.r;
            const nc = current.c + dir.c;

            if (
                isValidMoveForSearch(
                    nr,
                    nc,
                    visited,
                    targetClue
                )
            ) {
                visited.add(`${nr},${nc}`);
                queue.push({ r: nr, c: nc });
            }
        }
    }

    return true;
}

function isValidMoveForSearch(
    r,
    c,
    searchVisited,
    targetClue
) {
    // Bounds.
    if (
        r < 0 ||
        r >= grid.length ||
        c < 0 ||
        c >= grid[0].length
    ) {
        return false;
    }

    // Black square.
    if (grid[r][c] === -1) {
        return false;
    }

    // Never reuse a square already in the player's path.
    //
    // The target clue is deliberately allowed through this test,
    // provided it is not already in the current path.
    if (isInPath(r, c)) {
        return false;
    }

    // BFS visited.
    if (searchVisited.has(`${r},${c}`)) {
        return false;
    }

    return true;
}

// ------------------------------------------------------------
// HELPERS
// ------------------------------------------------------------

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
        pos => pos.r === r && pos.c === c
    );
}

/**
 * Finds the first clue whose value is greater than the highest clue
 * currently reached.
 */
function getNextClueToReach() {
    let maxClueInPath = 0;

    for (const pos of currentPath) {
        const value = grid[pos.r][pos.c];

        if (value > maxClueInPath) {
            maxClueInPath = value;
        }
    }

    return clues.find(
        clue => clue.value > maxClueInPath
    );
}

function getCellElement(r, c) {
    return document.querySelector(
        `.cell[data-r="${r}"][data-c="${c}"]`
    );
}

function showMessage(text) {
    const messageElement = document.getElementById('message');

    if (messageElement) {
        messageElement.textContent = text;
    }
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
        Math.floor(
            (totalMs / (1000 * 60)) % 60
        );

    const timerElement =
        document.getElementById('timer');

    if (timerElement) {
        timerElement.textContent =
            `${minutes.toString().padStart(2, '0')}:` +
            `${seconds.toString().padStart(2, '0')}`;
    }
}

// ------------------------------------------------------------
// FAILURE / RESET
// ------------------------------------------------------------

function handleFailure(message) {
    showMessage(message);

    attempts++;

    saveAttempts();

    updateAttemptsDisplay();

    // IMPORTANT:
    // The timer continues running after a failed attempt.
    resetPathState();
}

function resetPathState() {
    currentPath = [];

    document
        .querySelectorAll('.cell.active')
        .forEach(cell => {
            cell.classList.remove('active');
        });
}

function setupResetButton() {
    const resetButton =
        document.getElementById('resetButton');

    if (!resetButton) {
        return;
    }

    resetButton.addEventListener('click', () => {
        if (isSolved) {
            return;
        }

        resetPathState();

        showMessage('Start from a clue square.');
    });
}

// ------------------------------------------------------------
// SUCCESS
// ------------------------------------------------------------

function handleWin() {
    if (isSolved) {
        return;
    }

    isSolved = true;

    stopTimer(true);

    updateTimerDisplay();

    showMessage('Success! Puzzle Solved.');

    const finalTime =
        document.getElementById('timer').textContent;

    saveStats(finalTime);
}

// ------------------------------------------------------------
// ATTEMPTS / LOCAL STORAGE
// ------------------------------------------------------------

function getStoredAttempts(date) {
    try {
        const stored =
            JSON.parse(
                localStorage.getItem(STORAGE_KEY_ATTEMPTS)
            );

        if (
            stored &&
            stored.date === date &&
            Number.isFinite(Number(stored.attempts))
        ) {
            return Number(stored.attempts);
        }

    } catch (err) {
        console.warn(
            'Could not read stored attempts:',
            err
        );
    }

    return 0;
}

function saveAttempts() {
    if (!puzzleData) {
        return;
    }

    localStorage.setItem(
        STORAGE_KEY_ATTEMPTS,
        JSON.stringify({
            date: puzzleData.date,
            attempts: attempts
        })
    );
}

function updateAttemptsDisplay() {
    const attemptsElement =
        document.getElementById('attempts');

    if (attemptsElement) {
        attemptsElement.textContent =
            `Attempts: ${attempts}`;
    }
}

// ------------------------------------------------------------
// STATISTICS
// ------------------------------------------------------------

function saveStats(time) {
    if (!puzzleData) {
        return;
    }

    const stats = {
        date: puzzleData.date,
        time: time,
        attempts: attempts
    };

    localStorage.setItem(
        STORAGE_KEY_STATS,
        JSON.stringify(stats)
    );

    localStorage.setItem(
        STORAGE_KEY_LAST_PLAYED,
        puzzleData.date
    );
}

// ------------------------------------------------------------
// LOAD ERROR DISPLAY
// ------------------------------------------------------------

function showLoadError(error) {
    const gridElement =
        document.getElementById('grid');

    if (gridElement) {
        gridElement.innerHTML = '';

        const errorElement =
            document.createElement('div');

        errorElement.className = 'error-message';

        errorElement.innerHTML =
            '<strong>Today\'s puzzle could not be loaded.</strong>' +
            '<br><br>' +
            'Please try refreshing the page.' +
            '<br><br>' +
            '<small>Check that today\'s puzzle JSON has been uploaded to the repository.</small>';

        gridElement.appendChild(errorElement);
    }

    showMessage(
        'There was a problem loading today\'s puzzle.'
    );
}
