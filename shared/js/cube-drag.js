"use strict";

// Match Classic's pointer interaction: start the selection on pointerdown,
// keep the grid as the pointer-capture target, and resolve dragged cells from
// the screen position so re-rendering does not interrupt a finger drag.
(function setupCubeDrag() {
    let activePointerId = null;
    let lastPositionKey = null;

    function selectPosition(cell) {
        const positionKey = cell?.dataset.position;

        if (!positionKey || positionKey === lastPositionKey) {
            return;
        }

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
        const grid = document.getElementById("cubeGrid");

        if (!cell || !grid || event.button > 0) {
            return;
        }

        activePointerId = event.pointerId;
        lastPositionKey = null;

        // This is the same pattern used by Classic: the app owns the gesture
        // and the grid keeps receiving pointer events while the finger moves.
        event.preventDefault();
        grid.setPointerCapture?.(event.pointerId);
        selectPosition(cell);
    }

    function handlePointerMove(event) {
        if (event.pointerId !== activePointerId) {
            return;
        }

        event.preventDefault();
        selectPosition(cellAtPoint(event.clientX, event.clientY));
    }

    function endPointer(event) {
        if (event.pointerId === activePointerId) {
            activePointerId = null;
            lastPositionKey = null;
        }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", endPointer, true);
    document.addEventListener("pointercancel", endPointer, true);
})();
