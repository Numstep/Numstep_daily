const NumstepBadge = {
    colors: {
        background: "#ffffff",
        text: "#000000",
        subtext: "#666666",
        gridLines: "#000000",
        blackCell: "#6b1f2b"
    },

    // Match the colours used by the playable Cube chains.
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

    getClueValues(shareData) {
        const solutionValues = this.getSolutionValues(shareData);
        const suppliedClues = Array.isArray(shareData.clues) ? shareData.clues.map(Number) : [];
        const clueValues = suppliedClues.length > 0
            ? suppliedClues
            : solutionValues.filter(value => value > 0 && (value === 1 || value % 10 === 0));

        return [...new Set(clueValues)]
            .filter(value => Number.isInteger(value) && solutionValues.includes(value))
            .sort((a, b) => a - b);
    },

    buildClueColours(shareData) {
        const clueValues = this.getClueValues(shareData);
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
        ctx.fillStyle = this.colors.text; ctx.textAlign = "center"; ctx.font = "bold 32px Helvetica, Arial, sans-serif"; ctx.fillText("NUMSTEP", width / 2, 55);
        ctx.font = "18px Helvetica, Arial, sans-serif"; ctx.fillStyle = this.colors.subtext; ctx.fillText(`${shareData.size}×${shareData.size} • ${dateString}`, width / 2, 85);
        const gridSize = 440, cellSize = gridSize / shareData.size, gridX = (width - gridSize) / 2, gridY = 120;
        const clueColours = this.buildClueColours(shareData), clueValues = [...clueColours.keys()].sort((a, b) => a - b);
        for (let row = 0; row < shareData.size; row += 1) for (let col = 0; col < shareData.size; col += 1) {
            const value = shareData.solution[row * shareData.size + col] || 0, x = gridX + col * cellSize, y = gridY + row * cellSize;
            const colour = this.getChainColour(value, clueValues, clueColours);
            ctx.fillStyle = value === 0 ? this.colors.blackCell : (colour || this.colors.background); ctx.fillRect(x, y, cellSize, cellSize);
            ctx.strokeStyle = this.colors.gridLines; ctx.lineWidth = 2; ctx.strokeRect(x, y, cellSize, cellSize);
        }
        ctx.fillStyle = this.colors.text; ctx.font = "bold 24px Helvetica, Arial, sans-serif"; ctx.fillText(`${time} • ${attempts} attempt${attempts === 1 ? "" : "s"}`, width / 2, 620);
        ctx.fillStyle = this.colors.subtext; ctx.font = "16px Helvetica, Arial, sans-serif"; ctx.fillText("Can you beat my result?", width / 2, 655);
        return canvas.toDataURL("image/png");
    },

    drawCubeAndDisplay(shareData, dateString, time, attempts) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not create badge canvas.");
        const scale = 2, width = 500, height = 700;
        canvas.width = width * scale; canvas.height = height * scale; ctx.scale(scale, scale);
        ctx.fillStyle = this.colors.background; ctx.fillRect(0, 0, width, height);
        ctx.textAlign = "center";
        ctx.font = "bold 32px Helvetica, Arial, sans-serif";
        ctx.fillStyle = this.colors.text;
        ctx.fillText("NUMSTEP: CUBE", width / 2, 55);
        ctx.font = "18px Helvetica, Arial, sans-serif";
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText(`${shareData.size}×${shareData.size}×${shareData.size} • ${dateString}`, width / 2, 85);

        const clueColours = this.buildClueColours(shareData);
        const clueValues = [...clueColours.keys()].sort((a, b) => a - b);
        const size = shareData.size;
        const side = Math.min(56, 230 / size);
        const axisX = [side * Math.cos(Math.PI / 6), side * Math.sin(Math.PI / 6)];
        const axisY = [side * Math.cos(5 * Math.PI / 6), side * Math.sin(5 * Math.PI / 6)];
        const axisZ = [0, -side];
        const origin = [width / 2, 310];

        // Model every occupied cell as a real unit cube. The 3D axes are
        // projected after a 30-degree isometric rotation: all three axes have
        // equal projected length and 120-degree separation. Every face is
        // therefore an exact 60/120-degree rhombus.
        const project = (x, y, z) => [
            origin[0] + x * axisX[0] + y * axisY[0] + z * axisZ[0],
            origin[1] + x * axisX[1] + y * axisY[1] + z * axisZ[1]
        ];

        const face = (corners, value, depth) => ({ corners, value, depth });
        const faces = [];
        const cube = shareData.solution;

        for (let layer = 0; layer < size; layer += 1) {
            // Layer 0 is the top of the logical cube, so invert it into z space.
            const z = size - 1 - layer;
            for (let row = 0; row < size; row += 1) {
                for (let col = 0; col < size; col += 1) {
                    const value = cube[layer][row][col] || 0;
                    if (value <= 0) continue;

                    // The cube occupies [col,col+1] × [row,row+1] × [z,z+1].
                    // Only faces exposed to empty space are rendered. This keeps
                    // the graphic hollow where the puzzle has burgundy/black cells,
                    // while every remaining voxel is visually solid.
                    if (layer === 0 || cube[layer - 1][row][col] === 0) {
                        faces.push(face([
                            project(col, row, z + 1),
                            project(col + 1, row, z + 1),
                            project(col + 1, row + 1, z + 1),
                            project(col, row + 1, z + 1)
                        ], value, col + row + z + 1));
                    }

                    if (row === size - 1 || cube[layer][row + 1][col] === 0) {
                        faces.push(face([
                            project(col, row + 1, z),
                            project(col + 1, row + 1, z),
                            project(col + 1, row + 1, z + 1),
                            project(col, row + 1, z + 1)
                        ], value, col + row + 1 + z));
                    }

                    if (col === size - 1 || cube[layer][row][col + 1] === 0) {
                        faces.push(face([
                            project(col + 1, row, z),
                            project(col + 1, row + 1, z),
                            project(col + 1, row + 1, z + 1),
                            project(col + 1, row, z + 1)
                        ], value, col + 1 + row + z));
                    }
                }
            }
        }

        // Painter's algorithm: distant faces first, nearest faces last. The
        // depth is derived from the same 3D coordinates used for projection,
        // avoiding the previous face-order artefacts around hollow cells.
        faces.sort((a, b) => a.depth - b.depth);

        faces.forEach(({ corners, value }) => {
            const colour = this.getChainColour(value, clueValues, clueColours);
            if (!colour) return;

            ctx.beginPath();
            corners.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point[0], point[1]);
                else ctx.lineTo(point[0], point[1]);
            });
            ctx.closePath();
            ctx.fillStyle = colour;
            ctx.fill();
            ctx.strokeStyle = this.colors.gridLines;
            ctx.lineWidth = 2;
            ctx.stroke();
        });

        ctx.fillStyle = this.colors.text;
        ctx.font = "bold 24px Helvetica, Arial, sans-serif";
        ctx.fillText(`${time} • ${attempts} attempt${attempts === 1 ? "" : "s"}`, width / 2, 610);
        ctx.fillStyle = this.colors.subtext;
        ctx.font = "16px Helvetica, Arial, sans-serif";
        ctx.fillText("Can you beat my result?", width / 2, 645);
        return canvas.toDataURL("image/png");
    }
};

function sizeLabel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
}
