(function () {
    "use strict";

    function getSavedTheme() {
        try {
            return localStorage.getItem("numstep-theme");
        } catch (error) {
            return null;
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem("numstep-theme", theme);
        } catch (error) {
            // Theme still works for the current page if storage is unavailable.
        }
    }

    function applyTheme(theme) {
        const dark = theme === "dark";
        document.body.classList.toggle("dark-theme", dark);

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

        const initialTheme = getSavedTheme() === "dark" ? "dark" : "classic";
        applyTheme(initialTheme);

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
