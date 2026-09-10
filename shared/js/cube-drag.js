"use strict";

// Use pointer events for mouse/pen/touch. The initial pointerdown selects the
// cell so a touch tap does not depend on a compatibility click event.
(function setupCubeDrag() {
    let activePointerId = null;
    let lastPositionKey = null;

    function selectPosition(cell) {
        const positionKey = cell?.dataset.position;

        if (!positionKey || positionKey === lastPositionKey) return;

        lastPositionKey = positionKey;
        const position = positionKey.split(",").map(Number);

        if (position.length === 3 && position.every(Number.isInteger)) {
            selectCell(position);
        }
    }

    function cellAtPoint(clientX, clientY) {
        const element = document.elementFromPoint(clientX, clientY);
        return element?.closest?.("#cubeGrid .cubeCell:not(.black)");
    }

    function handlePointerDown(event) {
        const cell = event.target.closest?.("#cubeGrid .cubeCell:not(.black)");
        if (!cell || event.button > 0) return;

        activePointerId = event.pointerId;
        lastPositionKey = null;
        event.preventDefault();
        selectPosition(cell);
    }

    function handlePointerMove(event) {
        if (event.pointerId !== activePointerId) return;

        event.preventDefault();
        selectPosition(cellAtPoint(event.clientX, event.clientY));
    }

    function endPointer(event) {
        if (event.pointerId === activePointerId) {
            activePointerId = null;
            lastPositionKey = null;
        }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", endPointer);
    document.addEventListener("pointercancel", endPointer);
})();
