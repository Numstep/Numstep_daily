"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const attempts = document.getElementById("attempts");

    if (attempts) {
        const normalise = () => {
            if (attempts.textContent.startsWith("Attempts:")) {
                attempts.textContent = attempts.textContent.replace(/^Attempts:/, "Mistakes:");
            }
        };

        normalise();
        const observer = new MutationObserver(normalise);
        observer.observe(attempts, { childList: true, characterData: true, subtree: true });
    }

    // Start the timer as soon as the loaded puzzle has been rendered,
    // rather than waiting for the player to select the first clue.
    const puzzleGrid =
        document.getElementById("grid") ||
        document.getElementById("cubeGrid") ||
        document.getElementById("boxGrid");

    if (puzzleGrid && typeof startTimer === "function") {
        const startWhenRendered = () => {
            if (puzzleGrid.children.length > 0) {
                startTimer();
            }
        };

        startWhenRendered();

        const timerObserver = new MutationObserver(startWhenRendered);
        timerObserver.observe(puzzleGrid, { childList: true, subtree: true });
    }

    if (window.CanvasRenderingContext2D) {
        const originalFillText = CanvasRenderingContext2D.prototype.fillText;
        CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
            if (typeof text === "string" && text.includes("I just solved today's puzzle.")) {
                text = text.replace(" [?]", "");
            }
            return originalFillText.call(this, text, ...args);
        };
    }
});
