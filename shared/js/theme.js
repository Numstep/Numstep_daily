(function () {
    "use strict";

    const STORAGE_KEY = "numstep-theme";
    const DARK_BLOCKED = "#6b1f2b";
    const DARK_PASTELS = {
        "#4e79a7": "#a8c4e3",
        "#59a14f": "#b8d8a8",
        "#f28e2b": "#f6c98d",
        "#e15759": "#f2a7a7",
        "#b07aa1": "#d9b9d5",
        "#76b7b2": "#a9d5d0",
        "#edc948": "#f2e3a3",
        "#9c755f": "#cdb6a0",
        "#86bcb6": "#b8dcd7",
        "#ff9da7": "#f6bfc5",
        "#79706e": "#beb9b7",
        "#a0cbe8": "#c7dceb"
    };

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

    function pastelColour(sourceColour) {
        if (!sourceColour) return null;
        return DARK_PASTELS[sourceColour.trim().toLowerCase()] || sourceColour;
    }

    function applyPuzzleColours(dark) {
        document.querySelectorAll(".black").forEach(cell => {
            cell.style.setProperty("background-color", dark ? DARK_BLOCKED : "#000000", "important");
            cell.style.setProperty("color", dark ? "#ffffff" : "#000000", "important");
        });

        document.querySelectorAll(".cell.active, .clue, .chainCell, .boxCell:not(.black), .cubeCell:not(.black)").forEach(cell => {
            const sourceColour = cell.dataset.numstepColour;

            if (dark) {
                if (sourceColour) {
                    cell.style.setProperty("background-color", pastelColour(sourceColour), "important");
                    cell.style.setProperty("color", "#000000", "important");
                } else if (!cell.classList.contains("clue") && !cell.classList.contains("chainCell")) {
                    cell.style.setProperty("background-color", "#ffffff", "important");
                    cell.style.setProperty("color", "#000000", "important");
                }
            } else if (sourceColour) {
                cell.style.setProperty("background-color", sourceColour, "important");
                cell.style.setProperty("color", "#ffffff", "important");
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
