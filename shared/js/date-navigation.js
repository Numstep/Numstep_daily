"use strict";

(function () {
    const prevDay = document.getElementById("prevDay");
    const nextDay = document.getElementById("nextDay");
    const currentDate = document.getElementById("currentDate");
    const pdfLink = document.getElementById("pdfLink");
    if (!prevDay || !nextDay || !currentDate) return;

    let selectedDate = new Date();
    selectedDate.setHours(0, 0, 0, 0);

    function formatDate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    function displayDate(date) {
        return date.toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        });
    }

    function todayAtMidnight() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    }

    function update() {
        const dateString = formatDate(selectedDate);
        const today = todayAtMidnight();

        window.selectedDateString = dateString;
        currentDate.textContent = displayDate(selectedDate);
        nextDay.disabled = selectedDate.getTime() >= today.getTime();

        if (pdfLink) pdfLink.href = `printables/${dateString}.pdf`;
        if (typeof loadPuzzleForDate === "function") loadPuzzleForDate(dateString);
    }

    prevDay.addEventListener("click", () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        update();
    });

    nextDay.addEventListener("click", () => {
        const today = todayAtMidnight();
        if (selectedDate.getTime() >= today.getTime()) return;
        selectedDate.setDate(selectedDate.getDate() + 1);
        update();
    });

    update();
})();
