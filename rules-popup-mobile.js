/* Numstep rules popup mobile fix.
 *
 * The rules UI is created by script8.js. This file deliberately uses
 * document-level event delegation so it still works if the controls are
 * recreated or replaced by the game script.
 */

(function () {
    "use strict";

    function getModal() {
        return document.getElementById("rulesModal");
    }

    function getCloseButton() {
        return document.getElementById("rulesClose");
    }

    function setOpen(open) {
        const modal = getModal();

        if (!modal) {
            return;
        }

        modal.hidden = !open;
        modal.classList.toggle("open", open);
        modal.setAttribute("aria-hidden", String(!open));

        document.body.classList.toggle("rules-open", open);

        if (open) {
            const closeButton = getCloseButton();

            if (closeButton) {
                window.setTimeout(function () {
                    closeButton.focus({ preventScroll: true });
                }, 0);
            }
        }
    }

    function openRules() {
        setOpen(true);
    }

    function closeRules() {
        setOpen(false);
    }

    function initialise() {
        const modal = getModal();
        const button = document.getElementById("rulesButton");

        if (!modal || !button) {
            return;
        }

        button.type = "button";
        modal.hidden = true;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");

        // Delegated events make the popup resilient to dynamically recreated DOM.
        document.addEventListener("click", function (event) {
            const target = event.target;

            if (!(target instanceof Element)) {
                return;
            }

            if (target.closest("#rulesButton")) {
                event.preventDefault();
                openRules();
                return;
            }

            if (
                target.closest("#rulesClose") ||
                target.closest("[data-close-rules=\"true\"]")
            ) {
                event.preventDefault();
                closeRules();
            }
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeRules();
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialise, { once: true });
    } else {
        initialise();
    }
})();
