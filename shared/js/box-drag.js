"use strict";

// Match Classic's pointer interaction without pointer capture. Box re-renders
// the whole net after each accepted move, so capturing a cell would capture an
// element that is immediately removed from the DOM. Keep the pointer on the
// document and resolve the live cell from the screen position instead.
(function setupBoxDrag() {
    let activePointerId = null;
    let lastPositionKey = null;

    document.addEventListener("pointerdown", event => {
        const cell = event.target.closest?.("#boxGrid .boxCell:not(.black)");

        if (!cell || event.button > 0) {
            return;
        }

        activePointerId = event.pointerId;
        lastPositionKey = null;
        event.preventDefault();

        selectCell(cell);
    }, true);

    document.addEventListener("pointermove", event => {
        if (event.pointerId !== activePointerId) {
            return;
        }

        event.preventDefault();
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const cell = element?.closest?.("#boxGrid .boxCell:not(.black)");

        if (!cell || cell.dataset.position === lastPositionKey) {
            return;
        }

        selectCell(cell);
    }, true);

    function selectCell(cell) {
        const positionKey = cell?.dataset.position;
        const parts = positionKey ? positionKey.split(",").map(Number) : [];

        if (parts.length !== 3 || !parts.every(Number.isInteger)) {
            return;
        }

        lastPositionKey = positionKey;
        select(parts);
    }

    function endPointer(event) {
        if (event.pointerId === activePointerId) {
            activePointerId = null;
            lastPositionKey = null;
        }
    }

    document.addEventListener("pointerup", endPointer, true);
    document.addEventListener("pointercancel", endPointer, true);
})();
