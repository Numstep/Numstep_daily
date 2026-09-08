"use strict";

// Numstep: Cube mirrors the PDF's four 2D layers in a 2 × 2 arrangement.
// Black cells are blocked; numbered clues are shown in white cells.
// This is currently a visual play-space ready to load generated Cube data.

const DEMO_CUBE = [
  [[1,0,0,10],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
  [[0,0,20,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]],
  [[0,0,0,0],[0,30,0,0],[0,0,0,0],[0,0,0,0]],
  [[0,0,0,0],[0,0,0,0],[0,0,0,0],[40,0,0,0]]
];

function renderNumstepCube(grid = DEMO_CUBE) {
  const container = document.getElementById("cubeLayers");
  if (!container) return;
  container.replaceChildren();

  grid.forEach((layer, layerIndex) => {
    const card = document.createElement("section");
    card.className = "cubeLayerCard";

    const title = document.createElement("h3");
    let suffix = "";
    if (layerIndex === 0) suffix = " (Top)";
    if (layerIndex === grid.length - 1) suffix = " (Bottom)";
    title.textContent = "LAYER " + (layerIndex + 1) + suffix;

    const board = document.createElement("div");
    board.className = "cubeLayerGrid";
    board.style.setProperty("--cube-size", layer.length);

    layer.forEach(row => row.forEach(value => {
      const cell = document.createElement("div");
      cell.className = "cubeCell";
      // Match Classic: ordinary playable squares are white.
      // Only explicit blocked cells should be black.
      if (value === null || value === -1) {
        cell.classList.add("cubeBlocked");
      } else {
        cell.classList.add("cubePlayable");
        if (value === 1 || (Number.isInteger(value) && value % 10 === 0 && value > 0)) {
          cell.classList.add("cubeClue");
          cell.textContent = value;
        }
      }
      board.appendChild(cell);
    }));

    card.append(title, board);
    container.appendChild(card);
  });
}
