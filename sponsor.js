"use strict";

// Potential sponsor messages.
// Add or replace strings in this array as new sponsors are added.
const SPONSOR_MESSAGES = [
    "test 1",
    "test 2",
    "test 3"
];

function getRandomSponsorMessage() {
    if (SPONSOR_MESSAGES.length === 0) {
        return "";
    }

    const randomIndex = Math.floor(
        Math.random() * SPONSOR_MESSAGES.length
    );

    return SPONSOR_MESSAGES[randomIndex];
}

function renderSponsorBox() {
    const sponsorBox = document.getElementById("sponsorBox");

    if (!sponsorBox) {
        return;
    }

    sponsorBox.textContent = getRandomSponsorMessage();
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        renderSponsorBox
    );
} else {
    renderSponsorBox();
}
