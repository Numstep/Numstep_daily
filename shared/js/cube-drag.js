"use strict";

// Use one pointer path for Cube taps and drags. Pointer events cover mouse,
// pen and touch; handling the initial pointerdown here also preserves taps on
// browsers where preventDefault() suppresses the compatibility click event.
(function setupCubeDrag() {
    let activePointerId = null;
    let lastPositionKey = null;

    document.addEventListener("pointerdown", event => {
        const cell = event.target.closest?.("#cubeGrid .cubeCell:not(.black)");

        if (!cell || event.button > 0) {
            return;
        }

        activePointerId = event.pointerId;
        lastPositionKey = cell.dataset.position || null;
        event.preventDefault();

        selectPosition(cell);
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

        selectPosition(cell);
    });

    function selectPosition(cell) {
        const positionKey = cell.dataset.position;

        if (!positionKey || positionKey === lastPositionKey) {
            return;
        }

        lastPositionKey = positionKey;
        const position = positionKey.split(",").map(Number);

        if (position.length === 3 && position.every(Number.isInteger)) {
            selectCell(position);
        }
    }

    function endDrag(event) {
        if (event.pointerId === activePointerId) {
            activePointerId = null;
            lastPositionKey = null;
        }
    }

    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
})();
