/**
 * Numstep Daily - script.js
 * Comprehensive replacement with updated error handling and continuous timer.
 */

// --- Global State ---
let grid = [];
let clues = []; // Array of { value, r, c }
let currentPath = []; // Array of { r, c }
let puzzleData = null;
let timerInterval = null;
let startTime = null;
let totalElapsedBeforeCurrentAttempt = 0; // Total time from previous attempts
let isSolved = false;
let attempts = 0;

// --- Constants & Config ---
const STORAGE_KEY_STATS = 'numstep-stats';
const STORAGE_KEY_LAST_PLAYED = 'numstep-last-played';
const DIRECTIONS = [
    { r: -1, c: 0 }, { r: 1, c: 0 },
    { r: 0, c: -1 }, { r: 0, c: 1 }
];

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    loadDailyPuzzle();
});

async function loadDailyPuzzle() {
    try {
        const response = await fetch('puzzles.json');
        const data = await response.json();
        
        // Use today's date to find the puzzle
        const today = new Date().toISOString().split('T')[0];
        puzzleData = data.find(p => p.date === today) || data[0];

        initializePuzzle(puzzleData);
    } catch (err) {
        console.error("Failed to load puzzle:", err);
    }
}

function initializePuzzle(data) {
    grid = data.grid; // 0 = white, -1 = black, >0 = clue
    clues = [];
    isSolved = false;
    currentPath = [];
    attempts = parseInt(localStorage.getItem('numstep-attempts') || "0");
    
    // Identify clues and clear previous DOM
    const gridElement = document.getElementById('grid');
    gridElement.innerHTML = '';
    gridElement.style.gridTemplateColumns = `repeat(${grid[0].length}, 1fr)`;

    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            const cellVal = grid[r][c];
            const cell = document.createElement('div');
            cell.classList.add('cell');
            cell.dataset.r = r;
            cell.dataset.c = c;

            if (cellVal === -1) {
                cell.classList.add('black');
            } else if (cellVal > 0) {
                cell.classList.add('clue');
                cell.textContent = cellVal;
                clues.push({ value: cellVal, r, c });
            }

            cell.addEventListener('click', () => handleCellClick(r, c));
            gridElement.appendChild(cell);
        }
    }

    // Sort clues numerically to define the chain order
    clues.sort((a, b) => a.value - b.value);
    
    // Reset timer display but preserve stats context
    stopTimer();
    document.getElementById('timer').textContent = "00:00";
    document.getElementById('message').textContent = "Start from a clue square.";
}

// --- Interaction Logic ---

function handleCellClick(r, c) {
    if (isSolved) return;

    const cellVal = grid[r][c];
    
    // ERROR 4: Attempt to begin incorrectly
    if (currentPath.length === 0) {
        if (cellVal <= 0) {
            showMessage("Start from a clue square.");
            return;
        }
        // Start Path
        startTimer();
        addToPath(r, c);
        return;
    }

    const last = currentPath[currentPath.length - 1];

    // ERROR 3: Illegal non-adjacent move (including diagonals)
    if (!isAdjacent(last.r, last.c, r, c)) {
        showMessage("That square is not adjacent.");
        return;
    }

    // Rule: Cannot visit already visited squares
    if (isInPath(r, c)) {
        return; // Ignore clicks on the current path
    }

    // Rule: Cannot enter black squares
    if (cellVal === -1) return;

    // VALID MOVE PROCESSING
    const nextClue = getNextClueToReach();
    
    // Logic for Clues
    if (cellVal > 0) {
        if (cellVal !== nextClue.value) {
            // Cannot jump to a future clue out of order
            return;
        }
    }

    addToPath(r, c);
    checkGameState(r, c);
}

function addToPath(r, c) {
    currentPath.push({ r, c });
    const cell = getCellElement(r, c);
    cell.classList.add('active');
    showMessage(""); // Clear messages on valid move
}

function checkGameState(r, c) {
    const lastVal = grid[r][c];
    const nextClue = getNextClueToReach();

    // SUCCESS CHECK
    if (!nextClue) {
        handleWin();
        return;
    }

    // ERROR 1: End of a chain (e.g. 9 reached, 10 must be adjacent)
    if (lastVal > 0 && lastVal % 10 === 9) {
        if (!isAdjacent(r, c, nextClue.r, nextClue.c)) {
            handleFailure("You have reached the end of this chain, but you are not adjacent to the next clue.");
            return;
        }
    }

    // ERROR 2: Trapped / Impossible
    if (isTrapped(r, c, nextClue)) {
        handleFailure("You are trapped. This chain cannot be completed from here.");
        return;
    }
}

// --- Reachability (Trapped Logic) ---

/**
 * Uses Breadth-First Search to determine if the next clue is reachable
 * from the current position using only unvisited white squares.
 */
function isTrapped(r, c, targetClue) {
    const queue = [{ r, c }];
    const visited = new Set();
    visited.add(`${r},${c}`);

    while (queue.length > 0) {
        const curr = queue.shift();

        if (curr.r === targetClue.r && curr.c === targetClue.c) {
            return false; // Found a path to the target clue
        }

        for (const dir of DIRECTIONS) {
            const nr = curr.r + dir.r;
            const nc = curr.c + dir.c;

            if (isValidMoveForSearch(nr, nc, visited)) {
                visited.add(`${nr},${nc}`);
                queue.push({ r: nr, c: nc });
            }
        }
    }
    return true; // No path found
}

function isValidMoveForSearch(r, c, searchVisited) {
    // Bounds check
    if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return false;
    // Black square check
    if (grid[r][c] === -1) return false;
    // Current path check (must not use squares already in the actual path)
    if (isInPath(r, c)) return false;
    // BFS visited check
    if (searchVisited.has(`${r},${c}`)) return false;
    
    return true;
}

// --- Helpers ---

function isAdjacent(r1, c1, r2, c2) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

function isInPath(r, c) {
    return currentPath.some(pos => pos.r === r && pos.c === c);
}

function getNextClueToReach() {
    // Determine the highest clue value currently in the path
    let maxClueInPath = 0;
    currentPath.forEach(pos => {
        const val = grid[pos.r][pos.c];
        if (val > maxClueInPath) maxClueInPath = val;
    });

    return clues.find(clue => clue.value > maxClueInPath);
}

function getCellElement(r, c) {
    return document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
}

function showMessage(text) {
    document.getElementById('message').textContent = text;
}

// --- Timer Management ---

function startTimer() {
    if (timerInterval) return;
    startTime = Date.now();
    timerInterval = setInterval(updateTimerDisplay, 100);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        // Add current session time to the base total
        totalElapsedBeforeCurrentAttempt += (Date.now() - startTime);
    }
}

function updateTimerDisplay() {
    const currentSession = Date.now() - startTime;
    const totalMs = totalElapsedBeforeCurrentAttempt + currentSession;
    
    const seconds = Math.floor((totalMs / 1000) % 60);
    const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
    
    document.getElementById('timer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// --- Game Outcomes ---

function handleFailure(msg) {
    showMessage(msg);
    attempts++;
    localStorage.setItem('numstep-attempts', attempts);
    
    // Critical Requirement: Do NOT stop or reset the timer.
    // We just reset the visual path and path state.
    resetPathState();
}

function handleWin() {
    isSolved = true;
    stopTimer();
    showMessage("Success! Puzzle Solved.");
    
    // Save Final Statistics
    const finalTime = document.getElementById('timer').textContent;
    saveStats(finalTime);
}

function resetPathState() {
    // Clear path but keep timer running
    currentPath = [];
    document.querySelectorAll('.cell.active').forEach(cell => {
        cell.classList.remove('active');
    });
}

function saveStats(time) {
    const stats = {
        date: puzzleData.date,
        time: time,
        attempts: attempts
    };
    localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
    localStorage.setItem(STORAGE_KEY_LAST_PLAYED, puzzleData.date);
}
