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
});
