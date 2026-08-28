const size = 5;

const solution = [
    1, 2, 3, 4, 5,
    10, 9, 8, 7, 6,
    11, 12, 13, 14, 15,
    20, 19, 18, 17, 16,
    21, 22, 23, 24, 25
];

const grid = document.getElementById("grid");

let path = [];

for (let i = 0; i < size * size; i++) {

    const square = document.createElement("div");

    square.className = "square";

    square.dataset.number = solution[i];

    square.addEventListener("click", () => {

        const number = solution[i];

        if (path.includes(number)) {
            return;
        }

        path.push(number);

        square.classList.add("selected");
        square.textContent = number;

        checkPuzzle();
    });

    grid.appendChild(square);
}


function checkPuzzle() {

    if (path.length === solution.length) {

        const correct = path.every(
            (number, index) => number === solution[index]
        );

        if (correct) {
            alert("Congratulations! Puzzle solved!");
        } else {
            alert("That's not the correct path.");
            resetPuzzle();
        }
    }
}


function resetPuzzle() {

    path = [];

    document.querySelectorAll(".square").forEach(square => {
        square.classList.remove("selected");
        square.textContent = "";
    });
}
