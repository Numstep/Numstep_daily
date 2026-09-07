const NumstepBadge = {
    colors: {
        background: "#ffffff",
        text: "#000000",
        subtext: "#666666",
        gridLines: "#000000",
        blackCell: "#000000"
    },

    colourPalette: [
        "#4E79A7", "#59A14F", "#F28E2B", "#E15759",
        "#B07AA1", "#76B7B2", "#EDC948", "#9C755F",
        "#86BCB6", "#FF9DA7", "#79706E", "#A0CBE8"
    ],

    fonts: {
        main: "Arial, sans-serif",
        monospace: "monospace"
    },

    async generate(size, dateString, time, attempts) {
        const shareUrl = `numstep_${size}_${dateString}_share.json`;

        try {
            const response = await fetch(shareUrl, { cache: "no-store" });

            if (!response.ok) {
                throw new Error(`Share file returned ${response.status}.`);
            }

            // The repository's _share.json files contain the JSON puzzle
            // data inside a "content" string. Parse that inner JSON before
            // passing it to the badge renderer.
            const fileData = await response.json();
            const shareData = typeof fileData.content === "string"
                ? JSON.parse(fileData.content)
                : fileData;

            return await this.drawAndDisplay(
                shareData,
                dateString,
                time,
                attempts
            );
        } catch (error) {
            console.error("Failed to generate share badge:", error);
            return "";
        }
    },

    buildClueColours(shareData) {
        const solution = Array.isArray(shareData.solution)
            ? shareData.solution.map(Number)
            : [];

        const clueValues = [
            ...new Set(
                (shareData.clues || [])
                    .map(Number)
                    .filter(value => Number.isInteger(value))
            )
        ]
            .filter(value => solution.includes(value))
            .sort((a, b) => a - b);

        const clueColours = new Map();

        clueValues.forEach((clueValue, index) => {
            clueColours.set(
                clueValue,
                this.colourPalette[index % this.colourPalette.length]
            );
        });

        return clueColours;
    },

    getChainColour(value, clueValues, clueColours, maxValue) {
        if (value <= 0 || clueValues.length === 0) return null;

        for (let i = clueValues.length - 1; i >= 0; i--) {
            const clueValue = clueValues[i];
            if (value >= clueValue) {
                return clueColours.get(clueValue) || null;
            }
        }

        return null;
    },

    async drawAndDisplay(shareData, dateString, time, attempts) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) throw new Error("Could not create badge canvas.");

        const scale = 2;
        const displayWidth = 500;
        const displayHeight = 700;

        canvas.width = displayWidth * scale;
        canvas.height = displayHeight * scale;
        ctx.scale(scale, scale);

        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        ctx.fillStyle = this.colors.text;
        ctx.textAlign = "center";
        ctx.font = "bold 32px Arial, sans-serif";
        ctx.fillText("NUMSTEP", displayWidth / 2, 55);

        ctx.font = "18px Arial, sans-serif";
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText(`${sizeLabel(shareData.size)}×${sizeLabel(shareData.size)} • ${dateString}`, displayWidth / 2, 85);

        const puzzleSize = Number(shareData.size);
        if (!Number.isInteger(puzzleSize) || puzzleSize <= 0) {
            throw new Error("Invalid puzzle size in share data.");
        }

        const gridSize = 440;
        const cellSize = gridSize / puzzleSize;
        const gridX = (displayWidth - gridSize) / 2;
        const gridY = 120;
        const solution = Array.isArray(shareData.solution)
            ? shareData.solution.map(Number)
            : [];

        if (solution.length !== puzzleSize * puzzleSize) {
            throw new Error("Invalid solution length in share data.");
        }

        const clueColours = this.buildClueColours(shareData);
        const clueValues = [...clueColours.keys()].sort((a, b) => a - b);

        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        for (let row = 0; row < puzzleSize; row++) {
            for (let col = 0; col < puzzleSize; col++) {
                const value = solution[row * puzzleSize + col] || 0;
                const x = gridX + col * cellSize;
                const y = gridY + row * cellSize;

                const colour = this.getChainColour(
                    value,
                    clueValues,
                    clueColours,
                    shareData.steps
                );

                ctx.fillStyle = value === 0
                    ? this.colors.blackCell
                    : (colour || this.colors.background);
                ctx.fillRect(x, y, cellSize, cellSize);

                ctx.strokeStyle = this.colors.gridLines;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, cellSize, cellSize);

                if (value !== 0) {
                    ctx.fillStyle = this.colors.text;
                    ctx.font = `bold ${Math.max(12, cellSize * 0.0001)}px Arial, sans-serif`;
                    ctx.fillText(
                        string("*"),
                        x + cellSize / 2,
                        y + cellSize / 2
                    );
                }
            }
        }

        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = this.colors.text;
        ctx.font = "bold 24px Arial, sans-serif";
        ctx.fillText(`${time} • ${attempts} attempt${attempts === 1 ? "" : "s"}`, displayWidth / 2, 620);

        ctx.fillStyle = this.colors.subtext;
        ctx.font = "16px Arial, sans-serif";
        ctx.fillText("Can you beat my result?", displayWidth / 2, 655);

        return canvas.toDataURL("image/png");
    }
};

function sizeLabel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
}
