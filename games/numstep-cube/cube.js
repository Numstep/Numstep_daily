"use strict";

let selectedDate = new Date();
let puzzle = null;
let chains = new Map();
let activeChainClue = null;
let attempts = 0;
let timerStartedAt = null;
let timerHandle = null;
let solved = false;

const gridElement = document.getElementById("cubeGrid");
const messageElement = document.getElementById("message");
const progressElement = document.getElementById("cubeProgress");
const attemptsElement = document.getElementById("attempts");
const timerElement = document.getElementById("timer");

// Keep the same clue/chain palette used by Numstep Classic.
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

function isClue(value) {
    return value > 0 && (value === 1 || value % 10 === 0);
}

function positionKey(position) {
    return position.join(",");
}

function samePosition(a, b) {
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

function areAdjacent(a, b) {
    return Math.abs(a[0] - b[0]) +
        Math.abs(a[1] - b[1]) +
        Math.abs(a[2] - b[2]) === 1;
}

function getValue(position) {
    return puzzle.solution[position[0]][position[1]][position[2]];
}

function getCluePositions() {
    const positions = new Map();

    for (let layer = 0; layer < puzzle.size; layer += 1) {
        for (let row = 0; row < puzzle.size; row += 1) {
            for (let col = 0; col < puzzle.size; col += 1) {
                const value = puzzle.solution[layer][row][col];
                if (isClue(value)) {
                    positions.set(value, [layer, row, col]);
                }
            }
        }
    }

    return positions;
}

function initialiseChains() {
    chains = new Map();
    const cluePositions = getCluePositions();
    const values = puzzle.solution.flat(2).filter(value => value > 0);
    const maxValue = Math.max(...values);
    const clueValues = [...cluePositions.keys()].sort((a, b) => a - b);

    clueValues.forEach((clueValue, index) => {
        const nextClue = clueValues[index + 1];

        // A clue that is also the highest numbered cell is the terminal
        // marker, matching Classic's final-clue behaviour.
        if (clueValue === maxValue && !nextClue) {
            return;
        }

        const endValue = nextClue ? nextClue - 1 : maxValue;

        chains.set(clueValue, {
            clueValue,
            endValue,
            path: [cluePositions.get(clueValue)],
            complete: false
        });
    });
}

function getClueColour(clueValue) {
    const clueValues = [...chains.keys()].sort((a, b) => a - b);
    const index = clueValues.indexOf(clueValue);
    return COLOUR_PALETTE[(index < 0 ? 0 : index) % COLOUR_PALETTE.length];
}

function resetTimer() {
    if (timerHandle !== null) {
        window.clearInterval(timerHandle);
        timerHandle = null;
    }
    timerStartedAt = null;
    timerElement.textContent = "00:00";
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

function resetGame(message = "Choose any coloured clue to start.") {
    activeChainClue = null;
    attempts = 0;
    solved = false;
    resetTimer();
    initialiseChains();
    attemptsElement.textContent = "Attempts: 0";
    messageElement.textContent = message;
    renderPuzzle();
}

function renderPuzzle() {
    gridElement.replaceChildren();

    if (!puzzle) {
        progressElement.textContent = "0 / 0";
        return;
    }

    const rendered = new Map();
    for (const chain of chains.values()) {
        chain.path.forEach((position, index) => {
            rendered.set(positionKey(position), {
                value: getValue(position),
                clueValue: chain.clueValue,
                step: index + chain.clueValue
            });
        });
    }

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
                const position = [layer, row, col];
                const value = getValue(position);
                const cell = document.createElement("button");
                const key = positionKey(position);

                cell.type = "button";
                cell.className = "cubeCell";
                cell.dataset.position = key;
                cell.setAttribute("aria-label", `Layer ${layer + 1}, row ${row + 1}, column ${col + 1}`);

                if (value === 0) {
                    cell.classList.add("black");
                    cell.disabled = true;
                } else {
                    const state = rendered.get(key);
                    const clue = isClue(value);

                    if (clue) {
                        cell.classList.add("clue");
                    }

                    if (state) {
                        cell.classList.add("chainCell");
                        cell.textContent = String(state.step);
                        cell.style.setProperty("background-color", getClueColour(state.clueValue), "important");
                        cell.style.setProperty("color", "#FFFFFF", "important");
                    } else if (clue) {
                        cell.textContent = String(value);
                        cell.style.setProperty("background-color", getClueColour(value), "important");
                        cell.style.setProperty("color", "#FFFFFF", "important");
                    } else {
                        cell.textContent = "";
                    }

                    cell.addEventListener("click", () => selectCell(position));
                }

                if (activeChainClue !== null) {
                    const active = chains.get(activeChainClue);
                    if (active && active.path.length > 0 && samePosition(active.path[active.path.length - 1], position)) {
                        cell.classList.add("current");
                    }
                }

                layerGrid.appendChild(cell);
            }
        }

        layerContainer.appendChild(layerGrid);
        gridElement.appendChild(layerContainer);
    }

    const completedCells = [...chains.values()].reduce((total, chain) => total + chain.path.length, 0);
    progressElement.textContent = `${completedCells} / ${puzzle.steps}`;
}

function selectCell(position) {
    if (!puzzle || solved || getValue(position) === 0) {
        return;
    }

    if (activeChainClue === null) {
        if (!isClue(getValue(position))) {
            setMessage("Start from a coloured clue.");
            return;
        }

        startChain(getValue(position));
        return;
    }

    const chain = chains.get(activeChainClue);
    if (!chain || chain.complete) {
        activeChainClue = null;
        renderPuzzle();
        return;
    }

    const last = chain.path[chain.path.length - 1];
    const expected = getValue(last) + 1;

    // Selecting a different clue switches to that chain only when it is
    // an explicit click after the current chain has been completed. During
    // an active chain, any other selection is evaluated as the next move.
    if (!areAdjacent(last, position)) {
        failActiveChain("The next step must share a face with the current cube.");
        return;
    }

    if (chain.path.some(existing => samePosition(existing, position))) {
        failActiveChain("You cannot revisit a cube. The current chain is broken.");
        return;
    }

    const value = getValue(position);

    if (value !== expected || value > chain.endValue) {
        failActiveChain(`Wrong next step. You need ${expected}. The current chain is broken.`);
        return;
    }

    chain.path.push(position);
    startTimer();
    renderPuzzle();

    if (value === chain.endValue) {
        completeChain(chain);
    }
}

function startChain(clueValue) {
    const chain = chains.get(clueValue);

    if (!chain) {
        setMessage(`Clue ${clueValue} is the final marker.`);
        return;
    }

    if (chain.complete) {
        setMessage(`Chain ${clueValue} is already complete.`);
        return;
    }

    activeChainClue = clueValue;
    startTimer();
    renderPuzzle();
    setMessage(`Chain ${clueValue}–${chain.endValue} started. Select ${clueValue + 1} next.`);
}

function completeChain(chain) {
    chain.complete = true;
    activeChainClue = null;

    if ([...chains.values()].every(item => item.complete)) {
        solved = true;
        stopTimer();
        renderPuzzle();
        setMessage("Solved! Every chain is complete.");
        createShareResult();
        return;
    }

    renderPuzzle();
    setMessage(`Chain ${chain.clueValue}–${chain.endValue} complete. Start from any remaining coloured clue.`);
}

function failActiveChain(message) {
    const chain = chains.get(activeChainClue);
    attempts += 1;
    attemptsElement.textContent = `Attempts: ${attempts}`;

    if (chain) {
        // Keep the clue itself, but erase the player's current chain.
        chain.path = [chain.path[0]];
        chain.complete = false;
    }

    activeChainClue = null;
    renderPuzzle();
    setMessage(message);
}

async function createShareResult() {
    const elapsed = timerStartedAt === null ? 0 : Date.now() - timerStartedAt;
    let badgeImageUrl = "";

    // The Classic badge renderer is 2D-only, so Cube uses the same result
    // modal and PNG pipeline when available, falling back cleanly if absent.
    if (typeof NumstepBadge !== "undefined" && NumstepBadge.generate) {
        try {
            badgeImageUrl = await NumstepBadge.generate(
                puzzle.size,
                formatDate(selectedDate),
                timerElement.textContent,
                attempts
            );
        } catch (error) {
            console.error("Could not generate Cube badge:", error);
        }
    }

    if (typeof showShareModal === "function") {
        showShareModal({
            size: puzzle.size,
            date: formatDate(selectedDate),
            elapsed,
            attempts,
            url: window.location.href,
            badgeImageUrl
        });
    }
}

function setMessage(text) {
    messageElement.textContent = text;
}

function validatePuzzle(data) {
    if (!data || typeof data !== "object") {
        throw new Error("Invalid puzzle JSON.");
    }

    const size = Number(data.size);
    if (!Number.isInteger(size) || size < 1) {
        throw new Error("Invalid cube size.");
    }

    if (!Array.isArray(data.solution) || data.solution.length !== size) {
        throw new Error(`Expected ${size} cube layers.`);
    }

    for (const layer of data.solution) {
        if (!Array.isArray(layer) || layer.length !== size || layer.some(row => !Array.isArray(row) || row.length !== size)) {
            throw new Error(`Expected a ${size} × ${size} × ${size} solution array.`);
        }
    }

    if (!Number.isInteger(Number(data.steps)) || Number(data.steps) <= 0) {
        throw new Error("Invalid step count.");
    }
}

async function loadPuzzleForDate(dateString) {
    try {
        const response = await fetch(`data/${dateString}.json`, { cache: "no-store" });

        if (!response.ok) {
            puzzle = null;
            resetTimer();
            gridElement.replaceChildren();
            progressElement.textContent = "0 / 0";
            setMessage(`No Cube puzzle is available for ${displayDate(selectedDate)}.`);
            return;
        }

        const data = await response.json();
        validatePuzzle(data);
        puzzle = data;
        resetGame("Choose any coloured clue to start.");
    } catch (error) {
        console.error(error);
        puzzle = null;
        resetTimer();
        gridElement.replaceChildren();
        progressElement.textContent = "0 / 0";
        setMessage("Unable to load this Cube puzzle.");
    }
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
    if (puzzle) {
        resetGame("Choose any coloured clue to start.");
    }
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
loadPuzzleForDate(formatDate(selectedDate));
