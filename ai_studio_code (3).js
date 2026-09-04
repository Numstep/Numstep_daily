function rerenderBoard() {
    const gridElement = document.getElementById("grid");
    if (gridElement) {
        gridElement.innerHTML = "";
        renderBoard(gridElement);
    }
}