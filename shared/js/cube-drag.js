"use strict";

// Allow finger/pointer dragging across Cube cells even though the cells are
// buttons and the board is rendered as several independent layer grids.
(function setupCubeDrag() {
    let activePointerId = null;
    let lastPositionKey = null;

    document.addEventListener("pointerdown", event => {
        const cell = event.target.closest?.("#cubeGrid .cubeCell:not(.black)");

        if (!cell || event.button > 0) {
            return;
        }

        activePointerId = event.pointerId;
        lastPositionKey = null;
        event.preventDefault();
    });

    document.addEventListener("pointermove", event => {
        if (event.pointerId !== activePointerId) {
            return;
        }

        event.preventDefault();

        const element = document.elementFromPoint(event.clientX, event.clientY);
        const cell = element?.closest?.("#cubeGrid .cubeCell:not(.black)");

        if (!cell) {
            return;
        }

        const positionKey = cell.dataset.position;

        if (!positionKey || positionKey === lastPositionKey) {
            return;
        }

        lastPositionKey = positionKey;
        const position = positionKey.split(",").map(Number);

        if (position.length === 3 && position.every(Number.isInteger)) {
            selectCell(position);
        }
    });

    function endDrag(event) {
        if (event.pointerId === activePointerId) {
            activePointerId = null;
            lastPositionKey = null;
        }
    }

    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
})();
