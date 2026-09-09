"use strict";

// Restore reliable drag selection when a grid captures the pointer.
// Pointer capture retargets pointer events to the grid, so cell-level
// pointerenter events are not dependable during touch/finger drags.
(function setupReliableGridDrag() {
    let activePointerId = null;
    let lastCellKey = null;

    document.addEventListener("pointerdown", event => {
        const cell = event.target.closest?.("#grid .cell");

        if (!cell || event.button > 0) {
            return;
        }

        activePointerId = event.pointerId;
        lastCellKey = null;
    });

    document.addEventListener("pointermove", event => {
        if (event.pointerId !== activePointerId) {
            return;
        }

        const element = document.elementFromPoint(event.clientX, event.clientY);
        const cell = element?.closest?.("#grid .cell");

        if (!cell) {
            return;
        }

        const key = `${cell.dataset.r},${cell.dataset.c}`;

        if (key === lastCellKey) {
            return;
        }

        lastCellKey = key;

        const row = Number(cell.dataset.r);
        const column = Number(cell.dataset.c);

        if (Number.isInteger(row) && Number.isInteger(column)) {
            handleCellSelection(row, column);
        }
    });

    function endDrag(event) {
        if (event.pointerId === activePointerId) {
            activePointerId = null;
            lastCellKey = null;
        }
    }

    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
})();
