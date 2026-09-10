const NumstepBadge = {
    colors: {
        background: "#ffffff",
        text: "#000000",
        subtext: "#666666",
        gridLines: "#000000",
        blackCell: "#6b1f2b"
    },

    colourPalette: [
        "#A8C7E6", "#A9D6A0", "#F6C58B", "#F3A6A8",
        "#D2B7D9", "#A9D8D3", "#F3E39A", "#D8B79A",
        "#B9DDD8", "#F2C1C8", "#C7C2BE", "#B8D3E8"
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
            if (response.ok) fileData = await response.json();
            else {
                const puzzleResponse = await fetch(puzzlePaths[variant] || puzzlePaths.classic, { cache: "no-store" });
                if (!puzzleResponse.ok) throw new Error(`Puzzle data returned ${puzzleResponse.status}.`);
                fileData = await puzzleResponse.json();
            }
            const shareData = typeof fileData.content === "string" ? JSON.parse(fileData.content) : fileData;
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
        if (variant === "cube" && Array.isArray(shareData.solution)) {
            solution = shareData.solution.map(layer => Array.isArray(layer) ? layer.map(row => row.map(Number)) : []);
        } else if (Array.isArray(shareData.solution)) {
            if (Array.isArray(shareData.solution[0])) solution = shareData.solution[0].flat().map(Number);
            else solution = shareData.solution.map(Number);
        } else if (shareData.solution && typeof shareData.solution === "object") {
            const face = shareData.solution.FRONT || shareData.solution.TOP;
            if (Array.isArray(face)) solution = face.flat().map(Number);
        }
        if (!Number.isInteger(size) || size <= 0) throw new Error("Invalid solution size in share data.");
        if (variant === "cube") {
            const validCube = solution.length === size && solution.every(layer => layer.length === size && layer.every(row => row.length === size));
            if (!validCube) throw new Error("Invalid Cube solution shape in share data.");
        } else if (solution.length !== size * size) throw new Error("Invalid solution shape in share data.");
        return { ...shareData, size, solution, variant };
    },

    getSolutionValues(shareData) {
        return shareData.variant === "cube" ? shareData.solution.flat(2).map(Number) : shareData.solution.map(Number);
    },

    buildClueColours(shareData) {
        const solutionValues = this.getSolutionValues(shareData);
        const clueValues = [...new Set((shareData.clues || []).map(Number))]
            .filter(value => Number.isInteger(value) && solutionValues.includes(value))
            .sort((a, b) => a - b);
        const clueColours = new Map();
        clueValues.forEach((value, index) => clueColours.set(value, this.colourPalette[index % this.colourPalette.length]));
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
        if (shareData.variant === "cube") return this.drawCubeAndDisplay(shareData, dateString, time, attempts);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create badge canvas.");
        const scale = 2, width = 500, height = 700;
        canvas.width = width * scale; canvas.height = height * scale; ctx.scale(scale, scale);
        ctx.fillStyle = this.colors.background; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = this.colors.text; ctx.textAlign = "center"; ctx.font = "bold 32px Arial, sans-serif"; ctx.fillText("NUMSTEP", width / 2, 55);
        ctx.font = "18px Arial, sans-serif"; ctx.fillStyle = this.colors.subtext; ctx.fillText(`${shareData.size}×${shareData.size} • ${dateString}`, width / 2, 85);
        const gridSize = 440, cellSize = gridSize / shareData.size, gridX = (width - gridSize) / 2, gridY = 120;
        const clueColours = this.buildClueColours(shareData), clueValues = [...clueColours.keys()].sort((a, b) => a - b);
        for (let row = 0; row < shareData.size; row += 1) for (let col = 0; col < shareData.size; col += 1) {
            const value = shareData.solution[row * shareData.size + col] || 0, x = gridX + col * cellSize, y = gridY + row * cellSize;
            const colour = this.getChainColour(value, clueValues, clueColours);
            ctx.fillStyle = value === 0 ? this.colors.blackCell : (colour || this.colors.background); ctx.fillRect(x, y, cellSize, cellSize);
            ctx.strokeStyle = this.colors.gridLines; ctx.lineWidth = 2; ctx.strokeRect(x, y, cellSize, cellSize);
        }
        ctx.fillStyle = this.colors.text; ctx.font = "bold 24px Arial, sans-serif"; ctx.fillText(`${time} • ${attempts} attempt${attempts === 1 ? "" : "s"}`, width / 2, 620);
        ctx.fillStyle = this.colors.subtext; ctx.font = "16px Arial, sans-serif"; ctx.fillText("Can you beat my result?", width / 2, 655);
        return canvas.toDataURL("image/png");
    },

    drawCubeAndDisplay(shareData, dateString, time, attempts) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create badge canvas.");
        const scale = 2, width = 500, height = 700;
        canvas.width = width * scale; canvas.height = height * scale; ctx.scale(scale, scale);
        ctx.fillStyle = this.colors.background; ctx.fillRect(0, 0, width, height);
        ctx.textAlign = "center"; ctx.font = "bold 32px Arial, sans-serif"; ctx.fillStyle = this.colors.text; ctx.fillText("NUMSTEP: CUBE", width / 2, 55);
        ctx.font = "18px Arial, sans-serif"; ctx.fillStyle = this.colors.subtext; ctx.fillText(`${shareData.size}×${shareData.size}×${shareData.size} • ${dateString}`, width / 2, 85);

        const clueColours = this.buildClueColours(shareData);
        const clueValues = [...clueColours.keys()].sort((a, b) => a - b);
        const size = shareData.size;
        const side = Math.min(52, 250 / size);
        const half = side / 2;
        const rise = side * Math.sqrt(3) / 2;
        // u and v have equal length and an exact 60° included angle, so every
        // rhombus has 60°/120° interior angles. z is the third isometric axis.
        const u = [half, rise];
        const v = [-half, rise];
        const z = [0, side];
        const centre = [width / 2, 245];
        const add = (p, d, n = 1) => [p[0] + d[0] * n, p[1] + d[1] * n];
        const cellPolygon = (origin, d1, d2) => [origin, add(origin, d1), add(add(origin, d1), d2), add(origin, d2)];

        const paintCell = (points, value) => {
            ctx.beginPath();
            points.forEach((p, index) => index === 0 ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1]));
            ctx.closePath();
            const chainColour = this.getChainColour(value, clueValues, clueColours);
            ctx.fillStyle = value === 0 ? this.colors.blackCell : (chainColour || this.colors.background);
            ctx.fill();
            ctx.strokeStyle = this.colors.gridLines;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        };

        // Draw only the three visible faces. Every rendered cell is taken directly
        // from the 3-D solution in the _share.json and receives the same clue/chain
        // colour rule used by the puzzle: the clue starts a colour and all subsequent
        // chain values inherit that clue colour.
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                paintCell(cellPolygon(
                    add(add(centre, u, -(size - col)), v, -(size - row)), u, v
                ), shareData.solution[0][row][col] || 0);
            }
        }
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                paintCell(cellPolygon(
                    add(add(centre, z, row), v, -(size - col)), z, v
                ), shareData.solution[row][size - 1][col] || 0);
            }
        }
        for (let row = 0; row < size; row += 1) {
            for (let col = 0; col < size; col += 1) {
                paintCell(cellPolygon(
                    add(add(centre, z, row), u, -(size - col)), z, u
                ), shareData.solution[row][col][size - 1] || 0);
            }
        }

        ctx.fillStyle = this.colors.text; ctx.font = "bold 24px Arial, sans-serif"; ctx.fillText(`${time} • ${attempts} attempt${attempts === 1 ? "" : "s"}`, width / 2, 590);
        ctx.fillStyle = this.colors.subtext; ctx.font = "16px Arial, sans-serif"; ctx.fillText("Can you beat my result?", width / 2, 625);
        return canvas.toDataURL("image/png");
    }
};

function sizeLabel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
}
