/**
 * Numstep Badge Generator
 *
 * Existing script8.js integration:
 *     NumstepBadge.generate(size, dateString, time, attempts);
 *
 * The badge is displayed on screen and is NOT downloaded automatically.
 *
 * Colour rules:
 * - Each clue receives a colour from the same 12-colour palette used by
 *   script8.js.
 * - Every solution square belonging to that clue's chain uses that colour.
 * - The clue square itself uses the same colour.
 * - Black (0) squares remain black.
 */

const NumstepBadge = {
    colors: {
        background: "#ffffff",
        text: "#000000",
        subtext: "#666666",
        gridLines: "#000000",
        blackCell: "#000000"
    },

    // Must match the palette in script8.js.
    colourPalette: [
        "#4E79A7",
        "#59A14F",
        "#F28E2B",
        "#E15759",
        "#B07AA1",
        "#76B7B2",
        "#EDC948",
        "#9C755F",
        "#86BCB6",
        "#FF9DA7",
        "#79706E",
        "#A0CBE8"
    ],

    fonts: {
        main: "Arial, sans-serif",
        monospace: "monospace"
    },

    /**
     * Entry point called by script8.js on victory.
     * No change to script8.js is required.
     */
    async generate(size, dateString, time, attempts) {
        // Use the normal puzzle JSON. This is guaranteed to contain the
        // size, clues and solution needed to draw the badge.
        const puzzleUrl =
            `numstep_${size}_${dateString}.json`;

        try {
            const response = await fetch(
                puzzleUrl,
                { cache: "no-store" }
            );

            if (!response.ok) {
                throw new Error(
                    `Puzzle file returned ${response.status}.`
                );
            }

            const shareData = await response.json();

            return await this.drawAndDisplay(
                shareData,
                dateString,
                time,
                attempts
            );
        } catch (error) {
            console.error(
                "Failed to generate share badge:",
                error
            );

            // Let script8.js continue to the results popup even if badge
            // generation fails.
            return "";
        }
    },

    /**
     * Build the clue -> colour mapping in exactly the same way as
     * script8.js.
     *
     * script8.js sorts clues numerically before assigning colours.
     * Therefore the badge must do the same.
     */
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
                this.colourPalette[
                    index % this.colourPalette.length
                ]
            );
        });

        return clueColours;
    },

    /**
     * Determine which clue owns a solution value.
     *
     * A chain starts at its clue and runs up to one less than the
     * next clue. The final clue is included in its own chain.
     */
    getChainColour(value, clueValues, clueColours, maxValue) {
        if (value <= 0 || clueValues.length === 0) {
            return null;
        }

        for (let i = clueValues.length - 1; i >= 0; i--) {
            const clueValue = clueValues[i];

            if (value >= clueValue) {
                return clueColours.get(clueValue) || null;
            }
        }

        return null;
    },

    /**
     * Draw the badge and display it in a modal.
     */
    async drawAndDisplay(
        shareData,
        dateString,
        time,
        attempts
    ) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error(
                "Could not create badge canvas."
            );
        }

        const scale = 2;
        const displayWidth = 500;
        const displayHeight = 700;

        canvas.width = displayWidth * scale;
        canvas.height = displayHeight * scale;

        ctx.scale(scale, scale);

        // Background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(
            0,
            0,
            displayWidth,
            displayHeight
        );

        // Header
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";

        ctx.fillStyle = this.colors.text;
        ctx.font =
            "bold 38px " + this.fonts.main;

        ctx.fillText(
            "NUMSTEP",
            250,
            60
        );

        ctx.font =
            "normal 20px " + this.fonts.main;

        ctx.fillText(
            "Daily Challenge Success!",
            250,
            95
        );

        ctx.font =
            "bold 16px " + this.fonts.main;

        ctx.fillStyle =
            this.colors.subtext;

        ctx.fillText(
            dateString.toUpperCase(),
            250,
            120
        );

        // Grid
        const gridSize = 350;
        const startX =
            (displayWidth - gridSize) / 2;
        const startY = 150;

        const n = Number(shareData.size);

        if (!Number.isInteger(n) || n <= 0) {
            throw new Error(
                "Invalid puzzle size in share data."
            );
        }

        const solution =
            Array.isArray(shareData.solution)
                ? shareData.solution.map(Number)
                : [];

        if (solution.length !== n * n) {
            throw new Error(
                "Share solution does not match puzzle size."
            );
        }

        const clueColours =
            this.buildClueColours(shareData);

        const clueValues = [
            ...clueColours.keys()
        ].sort((a, b) => a - b);

        const cellSize =
            gridSize / n;

        solution.forEach((value, i) => {
            const row =
                Math.floor(i / n);

            const col =
                i % n;

            const x =
                startX + col * cellSize;

            const y =
                startY + row * cellSize;

            // Black/unused squares.
            if (value === 0) {
                ctx.fillStyle =
                    this.colors.blackCell;

                ctx.fillRect(
                    x,
                    y,
                    cellSize,
                    cellSize
                );

                return;
            }

            // Find the colour belonging to this chain.
            const chainColour =
                this.getChainColour(
                    value,
                    clueValues,
                    clueColours,
                    Math.max(...solution)
                );

            // All usable solution cells use their chain colour.
            ctx.fillStyle =
                chainColour ||
                this.colors.background;

            ctx.fillRect(
                x,
                y,
                cellSize,
                cellSize
            );

            // Grid border.
            ctx.strokeStyle =
                this.colors.gridLines;

            ctx.lineWidth = 1;

            ctx.strokeRect(
                x,
                y,
                cellSize,
                cellSize
            );

            // White number on coloured square.
            ctx.fillStyle = "#ffffff";

            ctx.font =
                `bold ${Math.max(12, cellSize * 0.32)}px ` +
                this.fonts.main;

            ctx.textBaseline =
                "middle";

            ctx.fillText(
                value,
                x + cellSize / 2,
                y + cellSize / 2
            );
        });

        ctx.textBaseline =
            "alphabetic";

        // Statistics
        const statsY =
            startY + gridSize + 60;

        ctx.fillStyle =
            this.colors.text;

        ctx.font =
            "bold 32px " +
            this.fonts.monospace;

        ctx.fillText(
            time,
            140,
            statsY
        );

        ctx.font =
            "16px " +
            this.fonts.main;

        ctx.fillStyle =
            this.colors.subtext;

        ctx.fillText(
            "TIME",
            140,
            statsY + 25
        );

        ctx.fillStyle =
            this.colors.text;

        ctx.font =
            "bold 32px " +
            this.fonts.main;

        ctx.fillText(
            attempts,
            360,
            statsY
        );

        ctx.font =
            "16px " +
            this.fonts.main;

        ctx.fillStyle =
            this.colors.subtext;

        ctx.fillText(
            "ATTEMPTS",
            360,
            statsY + 25
        );

        // Footer
        ctx.font =
            "14px " +
            this.fonts.main;

        ctx.fillStyle =
            this.colors.subtext;

        ctx.fillText(
            "ko-fi.com/numstep",
            250,
            670
        );

        // Convert to PNG.
        const imageUrl =
            canvas.toDataURL("image/png");

        // Return the PNG data URL so script8.js can place the badge
        // inside the unified sharing popup.
        return imageUrl;
    },

    /**
     * Display the badge and a manual download button.
     */
    showBadgeModal(
        imageUrl,
        dateString,
        size
    ) {
        const existingModal =
            document.getElementById(
                "numstep-badge-modal"
            );

        if (existingModal) {
            existingModal.remove();
        }

        const modal =
            document.createElement("div");

        modal.id =
            "numstep-badge-modal";

        Object.assign(
            modal.style,
            {
                position: "fixed",
                inset: "0",
                zIndex: "10000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                boxSizing: "border-box",
                background: "rgba(0, 0, 0, 0.75)",
                overflowY: "auto"
            }
        );

        const content =
            document.createElement("div");

        Object.assign(
            content.style,
            {
                width: "min(540px, 100%)",
                maxHeight: "95vh",
                overflowY: "auto",
                boxSizing: "border-box",
                padding: "20px",
                background: "#ffffff",
                borderRadius: "12px",
                boxShadow:
                    "0 10px 40px rgba(0, 0, 0, 0.35)",
                textAlign: "center",
                fontFamily: this.fonts.main
            }
        );

        const heading =
            document.createElement("h2");

        heading.textContent =
            "🏆 Numstep Complete!";

        Object.assign(
            heading.style,
            {
                margin: "0 0 15px",
                color: "#000000",
                fontSize: "26px"
            }
        );

        const image =
            document.createElement("img");

        image.src = imageUrl;
        image.alt =
            `Numstep ${size}×${size} badge for ${dateString}`;

        Object.assign(
            image.style,
            {
                display: "block",
                width: "min(500px, 100%)",
                height: "auto",
                margin: "0 auto 18px",
                border: "1px solid #dddddd",
                borderRadius: "4px"
            }
        );

        const downloadButton =
            document.createElement("button");

        downloadButton.type = "button";
        downloadButton.textContent =
            "Download Badge";

        Object.assign(
            downloadButton.style,
            {
                display: "inline-block",
                padding: "12px 24px",
                margin: "0 8px 10px",
                border: "none",
                borderRadius: "6px",
                background: "#000000",
                color: "#ffffff",
                fontSize: "17px",
                fontWeight: "bold",
                cursor: "pointer"
            }
        );

        downloadButton.addEventListener(
            "click",
            () => {
                const link =
                    document.createElement("a");

                link.download =
                    `numstep_${dateString}_badge.png`;

                link.href = imageUrl;

                // Download occurs ONLY after the
                // player presses this button.
                link.click();
            }
        );

        const closeButton =
            document.createElement("button");

        closeButton.type = "button";
        closeButton.textContent = "Close";

        Object.assign(
            closeButton.style,
            {
                display: "inline-block",
                padding: "12px 24px",
                margin: "0 8px 10px",
                border: "1px solid #999999",
                borderRadius: "6px",
                background: "#ffffff",
                color: "#000000",
                fontSize: "17px",
                cursor: "pointer"
            }
        );

        const closeModal = () => {
            modal.remove();
        };

        closeButton.addEventListener(
            "click",
            closeModal
        );

        modal.addEventListener(
            "click",
            event => {
                if (event.target === modal) {
                    closeModal();
                }
            }
        );

        const escapeHandler =
            event => {
                if (event.key === "Escape") {
                    closeModal();

                    document.removeEventListener(
                        "keydown",
                        escapeHandler
                    );
                }
            };

        document.addEventListener(
            "keydown",
            escapeHandler
        );

        content.appendChild(heading);
        content.appendChild(image);
        content.appendChild(downloadButton);
        content.appendChild(closeButton);

        modal.appendChild(content);
        document.body.appendChild(modal);
    }
};
