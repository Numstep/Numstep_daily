"use strict";

// Give Box the same tap-and-drag pointer interaction used by Classic, Taurus,
// and Cube. elementFromPoint keeps dragging reliable even when selecting a
// cell causes Box to re-render its net.
(function setupBoxDrag() {
    let activePointerId = null;
    let lastPositionKey = null;

    document.addEventListener("pointerdown", event => {
        const cell = event.target.closest?.("#boxGrid .boxCell:not(.black)");

        if (!cell || event.button > 0) {
            return;
        }

        activePointerId = event.pointerId;
        lastPositionKey = cell.dataset.position || null;
        event.preventDefault();

        const parts = lastPositionKey ? lastPositionKey.split(",").map(Number) : [];
        if (parts.length === 3 && parts.every(Number.isInteger)) {
            select(parts);
        }
    });

    document.addEventListener("pointermove", event => {
        if (event.pointerId !== activePointerId) {
            return;
        }

        event.preventDefault();

        const element = document.elementFromPoint(event.clientX, event.clientY);
        const cell = element?.closest?.("#boxGrid .boxCell:not(.black)");

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
            select(position);
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
