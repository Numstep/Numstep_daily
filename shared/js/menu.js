"use strict";

function initialiseMoreMenu() {
    const moreButton = document.getElementById("moreButton");
    const moreMenu = document.getElementById("moreMenu");

    if (!moreButton || !moreMenu) return;

    moreButton.addEventListener("click", () => {
        const open = moreButton.getAttribute("aria-expanded") === "true";
        moreButton.setAttribute("aria-expanded", String(!open));
        moreMenu.hidden = open;
    });

    document.addEventListener("click", event => {
        if (
            !moreMenu.hidden &&
            !moreMenu.contains(event.target) &&
            !moreButton.contains(event.target)
        ) {
            moreMenu.hidden = true;
            moreButton.setAttribute("aria-expanded", "false");
        }
    });
}

document.addEventListener("DOMContentLoaded", initialiseMoreMenu);
