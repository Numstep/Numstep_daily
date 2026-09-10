const NumstepBadge = {
    colors: {
        background: "#ffffff",
        text: "#000000",
        subtext: "#666666",
        gridLines: "#000000",
        blackCell: "#6b1f2b"
    },

    // Keep share colours aligned with the playable Cube palette so a chain has
    // the same identity in the puzzle and in the exported badge.
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
        const halfWidth = side * Math.sqrt(3) / 2;
        const halfHeight = side / 2;

        // All three projected cube axes have equal length and are separated by
        // exactly 120 degrees. Therefore every square face is a 60/120-degree
        // rhombus, including the top and both visible side faces.
        const xAxis = [halfWidth, halfHeight];
        const yAxis = [-halfWidth, halfHeight];
        const zAxis = [0, -side];
        const origin = [width / 2, 250 + (size - 1) * side / 2];
        const project = (layer, row, col) => [
            origin[0] + col * xAxis[0] + row * yAxis[0] + layer * zAxis[0],
            origin[1] + col * xAxis[1] + row * yAxis[1] + layer * zAxis[1]
        ];
        const offset = (point, vector) => [point[0] + vector[0], point[1] + vector[1]];
        const polygon = (point, first, second) => [
            point,
            offset(point, first),
            offset(offset(point, first), second),
            offset(point, second)
        ];

        const drawFace = (points, value, shade = 0) => {
            const chainColour = this.getChainColour(value, clueValues, clueColours);
            if (!chainColour) return;

            ctx.beginPath();
            points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point[0], point[1]);
                else ctx.lineTo(point[0], point[1]);
            });
            ctx.closePath();

            // Keep each chain identifiable while giving the three cube faces
            // enough tonal separation to make the 3-D form read clearly.
            ctx.fillStyle = shade === 0 ? chainColour : this.adjustColour(chainColour, shade);
            ctx.fill();
            ctx.strokeStyle = this.colors.gridLines;
            ctx.lineWidth = 2;
            ctx.stroke();
        };

        // Painter's order: back/deeper cubes first. Only exposed faces are drawn,
        // so adjacent cubes read as a single isometric structure while zero cells
        // create the same open gaps as the puzzle.
        const cubes = [];
        for (let layer = 0; layer < size; layer += 1) {
            for (let row = 0; row < size; row += 1) {
                for (let col = 0; col < size; col += 1) {
                    const value = shareData.solution[layer][row][col] || 0;
                    if (value > 0) cubes.push({ layer, row, col, value, depth: layer + row + col });
                }
            }
        }

        cubes.sort((a, b) => b.depth - a.depth);

        cubes.forEach(({ layer, row, col, value }) => {
            const point = project(layer, row, col);
            const cube = shareData.solution;

            if (layer === 0 || cube[layer - 1][row][col] === 0) {
                drawFace(polygon(point, xAxis, yAxis), value, 0);
            }
            if (row === size - 1 || cube[layer][row + 1][col] === 0) {
                drawFace(polygon(point, yAxis, zAxis), value, -18);
            }
            if (col === size - 1 || cube[layer][row][col + 1] === 0) {
                drawFace(polygon(point, xAxis, zAxis), value, -30);
            }
        });

        ctx.fillStyle = this.colors.text;
        ctx.font = "bold 24px Helvetica, Arial, sans-serif";
        ctx.fillText(`${time} • ${attempts} attempt${attempts === 1 ? "" : "s"}`, width / 2, 610);
        ctx.fillStyle = this.colors.subtext;
        ctx.font = "16px Helvetica, Arial, sans-serif";
        ctx.fillText("Can you beat my result?", width / 2, 645);
        return canvas.toDataURL("image/png");
    },

    adjustColour(hex, amount) {
        const value = hex.replace("#", "");
        const channels = [0, 2, 4].map(index => parseInt(value.slice(index, index + 2), 16));
        const adjusted = channels.map(channel => Math.max(0, Math.min(255, channel + amount)));
        return `#${adjusted.map(channel => channel.toString(16).padStart(2, "0")).join("")}`;
    }
};

function sizeLabel(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : "";
}
