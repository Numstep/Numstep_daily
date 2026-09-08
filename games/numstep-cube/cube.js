"use strict";

let selectedDate = new Date();
let puzzle = null;
let path = [];
let attempts = 0;
let timerStartedAt = null;
let timerHandle = null;

const gridElement = document.getElementById("cubeGrid");
const messageElement = document.getElementById("message");
const progressElement = document.getElementById("cubeProgress");
const attemptsElement = document.getElementById("attempts");
const timerElement = document.getElementById("timer");

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function displayDate(date) {
    return date.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

function isFuture(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const candidate = new Date(date);
    candidate.setHours(0, 0, 0, 0);
    return candidate > today;
}

function cluePositionMap() {
    const positions = new Map();

    for (let layer = 0; layer < puzzle.size; layer += 1) {
        for (let row = 0; row < puzzle.size; row += 1) {
            for (let col = 0; col < puzzle.size; col += 1) {
                const number = puzzle.solution[layer][row][col];
                if (number !== 0 && (number === 1 || number % 10 === 0)) {
                    positions.set(number, [layer, row, col]);
                }
            }
        }
    }

    return positions;
}

function cellIsClue(number) {
    return number !== 0 && (number === 1 || number % 10 === 0);
}

function samePosition(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function areAdjacent(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1;
}

function startTimer() {
    if (timerStartedAt !== null) {
        return;
    }

    timerStartedAt = Date.now();
    timerHandle = window.setInterval(updateTimer, 1000);
    updateTimer();
}

function stopTimer() {
    if (timerHandle !== null) {
        window.clearInterval(timerHandle);
        timerHandle = null;
    }
}

function updateTimer() {
    if (timerStartedAt === null) {
        timerElement.textContent = "00:00";
        return;
    }

    const seconds = Math.floor((Date.now() - timerStartedAt) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    timerElement.textContent = `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function resetGame(message = "") {
    path = [];
    attempts = 0;
    timerStartedAt = null;
    stopTimer();
    updateTimer();
    attemptsElement.textContent = "Attempts: 0";
    messageElement.textContent = message;
    renderPuzzle();
}

function setMessage(text) {
    messageElement.textContent = text;
}

function renderPuzzle() {
    gridElement.replaceChildren();

    if (!puzzle) {
        progressElement.textContent = "0 / 0";
        return;
    }

    const visited = new Map();
    path.forEach((position, index) => {
        visited.set(position.join(","), index + 1);
    });

    const cluePositions = cluePositionMap();

    for (let layer = 0; layer < puzzle.size; layer += 1) {
        const layerContainer = document.createElement("section");
        layerContainer.className = "cubeLayer";

        const title = document.createElement("h3");
        title.className = "cubeLayerTitle";
        title.textContent = `LAYER ${layer + 1}${layer === 0 ? " (Top)" : layer === puzzle.size - 1 ? " (Bottom)" : ""}`;
        layerContainer.appendChild(title);

        const layerGrid = document.createElement("div");
        layerGrid.className = "cubeLayerGrid";

        for (let row = 0; row < puzzle.size; row += 1) {
            for (let col = 0; col < puzzle.size; col += 1) {
                const number = puzzle.solution[layer][row][col];
                const button = document.createElement("button");
                button.type = "button";
                button.className = "cubeCell";
                button.dataset.position = `${layer},${row},${col}`;
                button.setAttribute("aria-label", `Layer ${layer + 1}, row ${row + 1}, column ${col + 1}`);

                if (number === 0) {
                    button.classList.add("black");
                    button.disabled = true;
                } else {
                    const key = `${layer},${row},${col}`;
                    const entered = visited.get(key);

                    if (cellIsClue(number)) {
                        button.classList.add("clue");
                    }

                    if (entered !== undefined) {
                        button.classList.add("visited");
                        button.textContent = String(entered);
                    } else if (cellIsClue(number)) {
                        button.textContent = String(number);
                    }

                    if (path.length > 0 && samePosition(path[path.length - 1], [layer, row, col])) {
                        button.classList.add("current");
                    }

                    button.addEventListener("click", () => attemptMove([layer, row, col]));
                }

                layerGrid.appendChild(button);
            }
        }

        layerContainer.appendChild(layerGrid);
        gridElement.appendChild(layerContainer);
    }

    progressElement.textContent = `${path.length} / ${puzzle.steps}`;
}

function attemptMove(position) {
    if (!puzzle) {
        return;
    }

    attempts += 1;
    attemptsElement.textContent = `Attempts: ${attempts}`;

    if (path.some(existing => samePosition(existing, position))) {
        setMessage("That cube is already in your path.");
        return;
    }

    const number = puzzle.solution[position[0]][position[1]][position[2]];
    if (number === 0) {
        return;
    }

    const expectedStep = path.length + 1;
    const clues = cluePositionMap();

    if (path.length > 0 && !areAdjacent(path[path.length - 1], position)) {
        setMessage("The next cube must share a face with the current cube.");
        return;
    }

    if (expectedStep === 1 && number !== 1) {
        setMessage("The path must begin at 1.");
        return;
    }

    if (cellIsClue(number) && number !== expectedStep) {
        setMessage(`That clue is ${number}; you need ${expectedStep}.`);
        return;
    }

    if (clues.has(expectedStep) && !samePosition(clues.get(expectedStep), position)) {
        setMessage(`Step ${expectedStep} has a fixed clue elsewhere.`);
        return;
    }

    startTimer();
    path.push(position);
    setMessage("");
    renderPuzzle();

    if (path.length === puzzle.steps) {
        stopTimer();
        setMessage("Solved! Every white cube is in one continuous path.");
    }
}

async function loadPuzzleForDate(dateString) {
    const response = await fetch(`data/${dateString}.json`, { cache: "no-store" });

    if (!response.ok) {
        puzzle = null;
        resetGame(`No Cube puzzle is available for ${displayDate(selectedDate)}.`);
        return;
    }

    puzzle = await response.json();
    resetGame("");
}

function updateDateNavigation() {
    const filenameDate = formatDate(selectedDate);
    document.getElementById("currentDate").textContent = displayDate(selectedDate);
    document.getElementById("pdfLink").href = `printables/${filenameDate}.pdf`;
    document.getElementById("nextDay").disabled = formatDate(selectedDate) === formatDate(new Date());
}

document.getElementById("prevDay").addEventListener("click", async () => {
    selectedDate.setDate(selectedDate.getDate() - 1);
    updateDateNavigation();
    await loadPuzzleForDate(formatDate(selectedDate));
});

document.getElementById("nextDay").addEventListener("click", async () => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + 1);

    if (!isFuture(nextDate)) {
        selectedDate = nextDate;
        updateDateNavigation();
        await loadPuzzleForDate(formatDate(selectedDate));
    }
});

document.getElementById("resetButton").addEventListener("click", () => {
    resetGame("");
});

const moreButton = document.getElementById("moreButton");
const moreMenu = document.getElementById("moreMenu");

moreButton.addEventListener("click", () => {
    const open = moreButton.getAttribute("aria-expanded") === "true";
    moreButton.setAttribute("aria-expanded", String(!open));
    moreMenu.hidden = open;
});

document.addEventListener("click", event => {
    if (!moreMenu.hidden && !moreMenu.contains(event.target) && !moreButton.contains(event.target)) {
        moreMenu.hidden = true;
        moreButton.setAttribute("aria-expanded", "false");
    }
});

updateDateNavigation();
loadPuzzleForDate(formatDate(selectedDate)).catch(error => {
    console.error(error);
    puzzle = null;
    resetGame("Unable to load this Cube puzzle.");
});
