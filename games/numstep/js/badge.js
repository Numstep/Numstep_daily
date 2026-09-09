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

    async generate(size, dateString, time, attempts, variant = null) {
        variant = variant || this.detectVariant();
        const sharePaths = {
            classic: `data/${size}x${size}/${dateString}_share.json`,
            taurus: `data/${size}x${size}/${dateString}_share.json`,
            cube: `data/${dateString}_share.json`,
            box: `data/${dateString}_share.json`
        };
        const puzzlePaths = {
            classic: `data/${size}x${size}/${dateString}.json`,
            taurus: `data/${size}x${size}/${dateString}.json`,
            cube: `data/${dateString}.json`,
            box: `data/${dateString}.json`
        };

        try {
            const response = await fetch(sharePaths[variant] || sharePaths.classic, { cache: "no-store" });
            let fileData;

            if (response.ok) {
                fileData = await response.json();
            } else {
                // A share file may not exist yet for a newly generated game.
                // The normal daily puzzle contains the same solution data needed
                // to render the badge, so use it as a safe fallback.
                const puzzleResponse = await fetch(puzzlePaths[variant] || puzzlePaths.classic, { cache: "no-store" });
                if (!puzzleResponse.ok) {
                    throw new Error(`Puzzle data returned ${puzzleResponse.status}.`);
                }
                fileData = await puzzleResponse.json();
            }

            const shareData = typeof fileData.content === "string"
                ? JSON.parse(fileData.content)
                : fileData;
            return await this.generateFromData(shareData, dateString, time, attempts, variant);
        } catch (error) {
            console.error("Failed to generate share badge:", error);
            return "";
        }
    },

    detectVariant() {
        const path = window.location.pathname || "";
        if (path.includes("/numstep-cube/")) return "cube";
        if (path.includes("/numstep-taurus/")) return "taurus";
        if (path.includes("/numstep-box/")) return "box";
        return "classic";
    },

    async generateFromData(shareData, dateString, time, attempts, variant = "classic") {
        const data = this.normalise(shareData, variant);
        return this.drawAndDisplay(data, dateString, time, attempts);
    },

    normalise(shareData, variant) {
        const size = Number(shareData.size);
        let solution = [];

        if (Array.isArray(shareData.solution)) {
            if (Array.isArray(shareData.solution[0])) {
                // Cube share data is 3D; use the top layer for the compact badge view.
                solution = shareData.solution[0].flat().map(Number);
            } else {
                solution = shareData.solution.map(Number);
            }
        } else if (shareData.solution && typeof shareData.solution === "object") {
            // Box share data is face-keyed; use the FRONT face for the compact badge view.
            const face = shareData.solution.FRONT || shareData.solution.TOP;
            if (Array.isArray(face)) solution = face.flat().map(Number);
        }

        if (!Number.isInteger(size) || size <= 0 || solution.length !== size * size) {
            throw new Error("Invalid solution shape in share data.");
        }

        return { ...shareData, size, solution, variant };
    },

    buildClueColours(shareData) {
        const solution = shareData.solution;
        const clueValues = [...new Set((shareData.clues || []).map(Number))]
            .filter(value => Number.isInteger(value) && solution.includes(value))
            .sort((a, b) => a - b);
        const clueColours = new Map();
        clueValues.forEach((value, index) => {
            clueColours.set(value, this.colourPalette[index % this.colourPalette.length]);
        });
        return clueColours;
    },

    getChainColour(value, clueValues, clueColours) {
        if (value <= 0) return null;
        for (let i = clueValues.length - 1; i >= 0; i -= 1) {
            if (value >= clueValues[i]) return clueColours.get(clueValues[i]) || null;
        }
        return null;
    },

    drawAndDisplay(shareData, dateString, time, attempts) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create badge canvas.");

        const scale = 2;
        const width = 500;
        const height = 700;
        canvas.width = width * scale;
        canvas.height = height * scale;
        ctx.scale(scale, scale);

        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = this.colors.text;
        ctx.textAlign = "center";
        ctx.font = "bold 32px Arial, sans-serif";
        ctx.fillText("NUMSTEP", width / 2, 55);
        ctx.font = "18px Arial, sans-serif";
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText(`${sizeLabel(shareData.size)}×${sizeLabel(shareData.size)} • ${dateString}`, width / 2, 85);

        const gridSize = 440;
        const cellSize = gridSize / shareData.size;
        const gridX = (width - gridSize) / 2;
        const gridY = 120;
        const clueColours = this.buildClueColours(shareData);
        const clueValues = [...clueColours.keys()].sort((a, b) => a - b);

        ctx.textBaseline = "middle";
        for (let row = 0; row < shareData.size; row += 1) {
            for (let col = 0; col < shareData.size; col += 1) {
                const value = shareData.solution[row * shareData.size + col] || 0;
                const x = gridX + col * cellSize;
                const y = gridY + row * cellSize;
                const colour = this.getChainColour(value, clueValues, clueColours);
                ctx.fillStyle = value === 0 ? this.colors.blackCell : (colour || this.colors.background);
                ctx.fillRect(x, y, cellSize, cellSize);
                ctx.strokeStyle = this.colors.gridLines;
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, cellSize, cellSize);
                if (value !== 0) {
                    ctx.fillStyle = this.colors.text;
                    ctx.font = `bold ${Math.max(12, cellSize * 0.3)}px Arial, sans-serif`;
                    ctx.fillText("*", x + cellSize / 2, y + cellSize / 2);
                }
            }
        }

        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = this.colors.text;
        ctx.font = "bold 24px Arial, sans-serif";
        ctx.fillText(`${time} • ${attempts} attempt${attempts === 1 ? "" : "s"}`, width / 2, 620);
        ctx.fillStyle = this.colors.subtext;
        ctx.font = "16px Arial, sans-serif";
        ctx.fillText("Can you beat my result?", width / 2, 655);
        return canvas.toDataURL("image/png");
    }
};

function sizeLabel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
}
