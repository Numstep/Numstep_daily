"use strict";

// Potential sponsor messages.
// Add or replace strings in this array as new sponsors are added.
const SPONSOR_MESSAGES = [
    "George Pólya —

\“If you can\'t solve a problem, then there is an easier problem you can solve: find it.\”",
    "G. H. Hardy —

\“A mathematician, like a painter or a poet, is a maker of patterns.”,
    "Gian-Carlo Rota —

\“One starts out in life trying to do mathematics, and winds up doing combinatorics.\”"
];

const SPONSOR_URL = "https://ko-fi.com/c/14accf6daa";

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

    const message = document.createElement("div");
    message.className = "sponsorMessage";
    message.textContent = getRandomSponsorMessage();

    const sponsorLink = document.createElement("a");
    sponsorLink.className = "sponsorLink";
    sponsorLink.href = SPONSOR_URL;
    sponsorLink.target = "_blank";
    sponsorLink.rel = "noopener noreferrer";
    sponsorLink.textContent =
        "Write your message here by sponsoring this box";

    sponsorBox.replaceChildren(message, sponsorLink);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        renderSponsorBox
    );
} else {
    renderSponsorBox();
}
