"use strict";

const RULES = {
    classic: { title: "Classic rules", paragraphs: [
        "Start at the coloured clue and follow the numbered chain in order.",
        "Move horizontally or vertically to an adjacent square. Diagonal moves are not allowed. Black squares are blocked, and you cannot use a square more than once.",
        "The highest-numbered clue completes the chain and may be the terminal square.",
        "Adjacency is the ordinary four-way grid. There is no wrap-around at the edges."
    ]},
    cube: { title: "Cube rules", paragraphs: [
        "Start at the coloured clue and follow the numbered chain in order across the cube.",
        "Move between cells that share a face. This includes moving within a layer or between adjacent layers. Diagonal, edge-only and corner-only contacts do not count. Black cells are blocked, and you cannot use a cell more than once.",
        "The highest-numbered clue completes the chain and may be the terminal cell.",
        "Adjacency is three-dimensional six-way face adjacency: above, below, left, right, forward and back."
    ]},
    torus: { title: "Torus rules", paragraphs: [
        "Start at the coloured clue and follow the numbered chain in order.",
        "Move horizontally or vertically to an adjacent square. Diagonal moves are not allowed. Black squares are blocked, and you cannot use a square more than once.",
        "The highest-numbered clue completes the chain and may be the terminal square.",
        "The grid wraps around both directions: the left edge is adjacent to the right edge, and the top edge is adjacent to the bottom edge."
    ]},
    box: { title: "Box rules", paragraphs: [
        "Start at the coloured clue and follow the numbered chain across the surface of the box.",
        "Move between cells that share an edge on a face, including across a box edge where the surface cells meet. Diagonal moves and moves through the inside of the box are not allowed. Black cells are blocked, and you cannot use a cell more than once.",
        "The highest-numbered clue completes the chain and may be the terminal cell.",
        "Adjacency follows the box surface, not the flattened drawing. Each cell connects to its four surface neighbours, with face-to-face transitions handled at the box edges."
    ]}
};

function initialiseRulesModal() {
    const button = document.getElementById("rulesButton");
    const rules = RULES[document.body.dataset.rulesVariant];
    if (!button || !rules) return;
    const modal = document.createElement("div");
    modal.className = "rulesModal";
    modal.id = "rulesModal";
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.innerHTML = `<div class="rulesOverlay"></div><div class="rulesBox" role="dialog" aria-modal="true" aria-labelledby="rulesTitle"><button type="button" class="rulesClose" aria-label="Close rules">×</button><h2 id="rulesTitle">${rules.title}</h2>${rules.paragraphs.map(text => `<p>${text}</p>`).join("")}</div>`;
    document.body.appendChild(modal);
    const close = () => { modal.hidden = true; modal.setAttribute("aria-hidden", "true"); modal.classList.remove("open"); document.body.classList.remove("rules-open"); button.focus(); };
    const open = () => { modal.hidden = false; modal.setAttribute("aria-hidden", "false"); modal.classList.add("open"); document.body.classList.add("rules-open"); modal.querySelector(".rulesClose").focus(); };
    button.addEventListener("click", open);
    modal.querySelector(".rulesClose").addEventListener("click", close);
    modal.querySelector(".rulesOverlay").addEventListener("click", close);
    document.addEventListener("keydown", event => { if (event.key === "Escape" && modal.classList.contains("open")) close(); });
}

document.addEventListener("DOMContentLoaded", initialiseRulesModal);
