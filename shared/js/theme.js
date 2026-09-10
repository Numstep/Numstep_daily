(function () {
    "use strict";

    const STORAGE_KEY = "numstep-theme";

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

        // An explicit player choice wins; otherwise follow the browser/OS preference.
        applyTheme(getSavedTheme() || getBrowserTheme());

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
