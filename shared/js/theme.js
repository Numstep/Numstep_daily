(function () {
    "use strict";

    const STORAGE_KEY = "numstep-theme";
    const DARK_BLOCKED = "#6b1f2b";

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
            cell.style.setProperty("color", dark ? "#ffffff" : "#000000", "important");
        });

        document.querySelectorAll(".cell.active, .clue, .chainCell, .boxCell:not(.black), .cubeCell:not(.black)").forEach(cell => {
            if (dark) {
                cell.style.setProperty("background-color", "#ffffff", "important");
                cell.style.setProperty("color", "#000000", "important");
            } else {
                const sourceColour = cell.dataset.numstepColour;
                if (sourceColour) {
                    cell.style.setProperty("background-color", sourceColour, "important");
                }
            }
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

        applyTheme(getSavedTheme() || getBrowserTheme());

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
