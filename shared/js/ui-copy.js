"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const attempts = document.getElementById("attempts");
    if (!attempts) return;

    const normalise = () => {
        if (attempts.textContent.startsWith("Attempts:")) {
            attempts.textContent = attempts.textContent.replace(/^Attempts:/, "Mistakes:");
        }
    };

    normalise();
    const observer = new MutationObserver(normalise);
    observer.observe(attempts, { childList: true, characterData: true, subtree: true });

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
