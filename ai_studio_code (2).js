/**
 * Numstep Integrated Script
 * Combines Puzzle Logic (script.js) with Cell Colour Logic (script4.js)
 */

const CONFIG = {
    colors: {
        background: '#1a1a1a',
        walkable: '#2d2d2d',
        visited: '#4CAF50',
        current: '#2196F3',
        target: '#FFC107',
        targetReached: '#8BC34A',
        error: '#F44336'
    },
    gridSelector: '#grid-container',
    statusSelector: '#status-message'
};

let gameState = {
    grid: [],
    path: [], // Array of {x, y}
    targets: {}, // { "x,y": value }
    gridSize: 5,
    isGameOver: false
};

// 1. INITIALIZATION
async function initGame(jsonUrl) {
    try {
        const response = await fetch(jsonUrl);
        const data = await response.json();
        
        gameState.gridSize = data.size;
        gameState.targets = data.targets; // Format: {"0,0": 1, "2,2": 10}
        gameState.path = [];
        gameState.isGameOver = false;

        createGridUI();
        
        // Find start position (where target value is 1)
        const startPos = Object.keys(data.targets).find(key => data.targets[key] === 1);
        if (startPos) {
            const [x, y] = startPos.split(',').map(Number);
            moveTo(x, y);
        }
    } catch (err) {
        console.error("Failed to load puzzle:", err);
    }
}

// 2. UI CONSTRUCTION
function createGridUI() {
    const container = document.querySelector(CONFIG.gridSelector);
    container.style.gridTemplateColumns = `repeat(${gameState.gridSize}, 1fr)`;
    container.innerHTML = '';

    for (let y = 0; y < gameState.gridSize; y++) {
        for (let x = 0; x < gameState.gridSize; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            
            const targetVal = gameState.targets[`${x},${y}`];
            if (targetVal) {
                cell.textContent = targetVal;
                cell.classList.add('target');
            }

            cell.addEventListener('click', () => handleCellClick(x, y));
            container.appendChild(cell);
        }
    }
    updateColors();
}

// 3. PUZZLE LOGIC (Movement & Validation)
function handleCellClick(x, y) {
    if (gameState.isGameOver) return;

    const lastPos = gameState.path[gameState.path.length - 1];
    
    // Check adjacency (Script.js logic)
    if (lastPos) {
        const dx = Math.abs(x - lastPos.x);
        const dy = Math.abs(y - lastPos.y);
        const isAdjacent = (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
        
        if (!isAdjacent) return triggerErrorEffect(x, y);
    }

    // Check if already visited
    if (gameState.path.find(p => p.x === x && p.y === y)) {
        // Handle Undo logic if clicking the previous cell
        if (gameState.path.length > 1 && lastPos.x === x && lastPos.y === y) {
            undoLastMove();
            return;
        }
        return triggerErrorEffect(x, y);
    }

    // Check Numstep condition (Target value must match step count)
    const currentStep = gameState.path.length + 1;
    const targetVal = gameState.targets[`${x},${y}`];
    
    if (targetVal && targetVal !== currentStep) {
        return triggerErrorEffect(x, y);
    }

    moveTo(x, y);
}

function moveTo(x, y) {
    gameState.path.push({ x, y });
    updateColors();
    checkWinCondition();
}

function undoLastMove() {
    if (gameState.path.length > 1) {
        gameState.path.pop();
        updateColors();
    }
}

// 4. COLOUR LOGIC (Merged from script4.js)
function updateColors() {
    const cells = document.querySelectorAll('.cell');
    const currentPos = gameState.path[gameState.path.length - 1];

    cells.forEach(cell => {
        const x = parseInt(cell.dataset.x);
        const y = parseInt(cell.dataset.y);
        const posKey = `${x},${y}`;
        const isVisited = gameState.path.find(p => p.x === x && p.y === y);
        const isCurrent = currentPos && currentPos.x === x && currentPos.y === y;
        const isTarget = gameState.targets[posKey];

        // Reset classes
        cell.classList.remove('visited', 'current', 'target-hit');
        cell.style.backgroundColor = CONFIG.colors.walkable;

        if (isCurrent) {
            cell.style.backgroundColor = CONFIG.colors.current;
            cell.classList.add('current');
        } else if (isVisited) {
            cell.style.backgroundColor = CONFIG.colors.visited;
            cell.classList.add('visited');
        } else if (isTarget) {
            cell.style.backgroundColor = CONFIG.colors.target;
        }

        // Target reached color logic
        if (isTarget && isVisited) {
            cell.style.backgroundColor = CONFIG.colors.targetReached;
            cell.classList.add('target-hit');
        }
    });
}

function triggerErrorEffect(x, y) {
    const cell = document.querySelector(`.cell[data-x="${x}"][data-y="${y}"]`);
    cell.style.backgroundColor = CONFIG.colors.error;
    setTimeout(() => updateColors(), 300); // Revert after flash
}

// 5. WIN CONDITION
function checkWinCondition() {
    const totalCells = gameState.gridSize * gameState.gridSize;
    if (gameState.path.length === totalCells) {
        gameState.isGameOver = true;
        document.querySelector(CONFIG.statusSelector).textContent = "Puzzle Solved!";
    }
}

// Initialize with a daily file
initGame('numstep_5_2026-09-02.json');