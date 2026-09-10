"use strict";

// Match Classic's pointer interaction. The grid captures the active pointer so
// finger/mouse drags continue across cell boundaries, while elementFromPoint
// resolves the current cell even after Box re-renders its net.
(function setupBoxDrag() {
    let activePointerId = null;
    let lastPositionKey = null;

    document.addEventListener("pointerdown", event => {
        const cell = event.target.closest?.("#boxGrid .boxCell:not(.black)");
        const boxGrid = document.getElementById("boxGrid");

        if (!cell || !boxGrid || event.button > 0) {
            return;
        }

        activePointerId = event.pointerId;
        lastPositionKey = null;
        event.preventDefault();
        boxGrid.setPointerCapture?.(event.pointerId);

        const positionKey = cell.dataset.position;
        const parts = positionKey ? positionKey.split(",").map(Number) : [];
        if (parts.length === 3 && parts.every(Number.isInteger)) {
            lastPositionKey = positionKey;
            select(parts);
        }
    }, true);

    document.addEventListener("pointermove", event => {
        if (event.pointerId !== activePointerId) {
            return;
        }

        event.preventDefault();
        const element = document.elementFromPoint(event.clientX, event.clientY);
        const cell = element?.closest?.("#boxGrid .boxCell:not(.black)");
        const positionKey = cell?.dataset.position;

        if (!positionKey || positionKey === lastPositionKey) {
            return;
        }

        lastPositionKey = positionKey;
        const position = positionKey.split(",").map(Number);

        if (position.length === 3 && position.every(Number.isInteger)) {
            select(position);
        }
    }, true);

    function endPointer(event) {
        if (event.pointerId === activePointerId) {
            activePointerId = null;
            lastPositionKey = null;
        }
    }

    document.addEventListener("pointerup", endPointer, true);
    document.addEventListener("pointercancel", endPointer, true);
})();
