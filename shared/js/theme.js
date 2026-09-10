(function () {
    "use strict";

    const STORAGE_KEY = "numstep-theme";
    const DARK_BLOCKED = "#6b1f2b";
    // Dark-mode chain colours deliberately avoid red/burgundy hues so the
    // burgundy blocked squares remain visually distinct from every chain.
    const DARK_CHAIN_PALETTE = [
        "#4f81bd", "#59a14f", "#d6a84f", "#8064a2",
        "#4fa3a5", "#b07d45", "#7f8c8d", "#6f9f6f",
        "#8c78b5", "#5f9ea0", "#c2a85a", "#7186a8"
    ];

    function getSavedTheme() {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved === "dark" || saved === "classic" ? saved : null;
        } catch (error) {
            return null;
        }
    }

    function getBrowserTheme() {
        return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "classic";
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            // Theme still works for the current page if storage is unavailable.
        }
    }

    function applyPuzzleColours(dark) {
        document.querySelectorAll(".black").forEach(cell => {
            cell.style.setProperty("background-color", dark ? DARK_BLOCKED : "#000000", "important");
        });

        if (!dark) return;

        const colouredCells = document.querySelectorAll(".clue, .chainCell, .cell.active");
        const colourIndexes = new Map();
        let nextColour = 0;

        colouredCells.forEach(cell => {
            const inlineColour = cell.style.getPropertyValue("background-color");
            if (!inlineColour) return;

            if (!colourIndexes.has(inlineColour)) {
                colourIndexes.set(inlineColour, nextColour % DARK_CHAIN_PALETTE.length);
                nextColour += 1;
            }

            cell.style.setProperty(
                "background-color",
                DARK_CHAIN_PALETTE[colourIndexes.get(inlineColour)],
                "important"
            );
        });
    }

    function applyTheme(theme) {
        const dark = theme === "dark";
        document.body.classList.toggle("dark-theme", dark);
        applyPuzzleColours(dark);

        const toggle = document.getElementById("themeToggle");
        const label = document.getElementById("themeToggleLabel");
        if (!toggle || !label) return;

        label.textContent = dark ? "classic" : "dark";
        toggle.setAttribute("aria-pressed", String(dark));
        toggle.setAttribute("aria-label", dark ? "Switch to classic theme" : "Switch to dark theme");
    }

    function initThemeToggle() {
        const toggle = document.getElementById("themeToggle");
        if (!toggle) return;

        // An explicit player choice wins; otherwise follow the browser/OS preference.
        applyTheme(getSavedTheme() || getBrowserTheme());

        // Puzzle scripts re-render cells, so keep blocked and chain colours in sync.
        const observer = new MutationObserver(() => {
            applyPuzzleColours(document.body.classList.contains("dark-theme"));
        });
        observer.observe(document.body, { childList: true, subtree: true });

        toggle.addEventListener("click", function () {
            const nextTheme = document.body.classList.contains("dark-theme") ? "classic" : "dark";
            applyTheme(nextTheme);
            saveTheme(nextTheme);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initThemeToggle);
    } else {
        initThemeToggle();
    }
})();
