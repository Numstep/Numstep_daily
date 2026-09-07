/**
 * Numstep Badge Generator
 * Creates a high-res PNG badge and displays it on screen.
 *
 * Existing integration:
 *     NumstepBadge.generate(size, dateString, time, attempts);
 *
 * The badge is NOT downloaded automatically.
 * The player must press "Download Badge".
 */

const NumstepBadge = {
    // Styling constants derived from style.css
    colors: {
        background: '#ffffff',
        text: '#000000',
        subtext: '#666666',
        gridLines: '#000000',
        blackCell: '#000000'
    },

    fonts: {
        main: 'Arial, sans-serif',
        monospace: 'monospace'
    },

    /**
     * Entry point called by script8.js on victory.
     * The existing script8.js integration does not need to change.
     */
    async generate(size, dateString, time, attempts) {
        const shareUrl = `numstep_${size}_${dateString}_share.json`;

        try {
            const response = await fetch(shareUrl, {
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(
                    `Share file returned ${response.status}.`
                );
            }

            const data = await response.json();

            await this.drawAndDownload(
                data,
                dateString,
                time,
                attempts
            );
        } catch (error) {
            console.error('Failed to generate share badge:', error);
            alert('Could not generate badge. Check console for details.');
        }
    },

    /**
     * Draw the badge and display it in an on-screen modal.
     *
     * The method name is retained as drawAndDownload so that the
     * existing structure remains compatible. It no longer downloads
     * the image automatically.
     */
    async drawAndDownload(shareData, dateString, time, attempts) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
            throw new Error('Could not create badge canvas.');
        }

        // High-DPI scaling for a crisp downloaded image.
        const scale = 2;
        const displayWidth = 500;
        const displayHeight = 700;

        canvas.width = displayWidth * scale;
        canvas.height = displayHeight * scale;

        ctx.scale(scale, scale);

        // 1. Background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, displayWidth, displayHeight);

        // 2. Header
        ctx.fillStyle = this.colors.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';

        ctx.font = 'bold 38px ' + this.fonts.main;
        ctx.fillText('NUMSTEP', 250, 60);

        ctx.font = 'normal 20px ' + this.fonts.main;
        ctx.fillText('Daily Challenge Success!', 250, 95);

        ctx.font = 'bold 16px ' + this.fonts.main;
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText(dateString.toUpperCase(), 250, 120);

        // 3. Draw grid
        const gridSize = 350;
        const startX = (displayWidth - gridSize) / 2;
        const startY = 150;
        const n = shareData.size;
        const cellSize = gridSize / n;

        shareData.solution.forEach((val, i) => {
            const row = Math.floor(i / n);
            const col = i % n;
            const x = startX + (col * cellSize);
            const y = startY + (row * cellSize);

            if (val === 0) {
                // Black square
                ctx.fillStyle = this.colors.blackCell;
                ctx.fillRect(x, y, cellSize, cellSize);
            } else {
                // White square with path number
                ctx.fillStyle = this.colors.background;
                ctx.fillRect(x, y, cellSize, cellSize);

                ctx.strokeStyle = this.colors.gridLines;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, cellSize, cellSize);

                ctx.fillStyle = this.colors.text;
                ctx.font =
                    `bold ${cellSize * 0.4}px ` +
                    this.fonts.main;

                ctx.textBaseline = 'middle';
                ctx.fillText(
                    val,
                    x + cellSize / 2,
                    y + cellSize / 2
                );
            }
        });

        // Reset text baseline before drawing statistics.
        ctx.textBaseline = 'alphabetic';

        // 4. Stats
        const statsY = startY + gridSize + 60;

        // Time
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 32px ' + this.fonts.monospace;
        ctx.fillText(time, 140, statsY);

        ctx.font = '16px ' + this.fonts.main;
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText('TIME', 140, statsY + 25);

        // Attempts
        ctx.fillStyle = this.colors.text;
        ctx.font = 'bold 32px ' + this.fonts.main;
        ctx.fillText(attempts, 360, statsY);

        ctx.font = '16px ' + this.fonts.main;
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText('ATTEMPTS', 360, statsY + 25);

        // 5. Footer
        ctx.font = '14px ' + this.fonts.main;
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText('ko-fi.com/numstep', 250, 670);

        // 6. Convert the canvas to an image.
        const imageUrl = canvas.toDataURL('image/png');

        // 7. Display the badge instead of downloading it.
        this.showBadgeModal(
            imageUrl,
            dateString,
            n
        );
    },

    /**
     * Display the generated badge in a modal.
     */
    showBadgeModal(imageUrl, dateString, size) {
        // Remove an existing badge modal if one is already open.
        const existingModal = document.getElementById(
            'numstep-badge-modal'
        );

        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = 'numstep-badge-modal';

        // Overlay
        Object.assign(modal.style, {
            position: 'fixed',
            inset: '0',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box',
            background: 'rgba(0, 0, 0, 0.75)',
            overflowY: 'auto'
        });

        // Modal content
        const content = document.createElement('div');

        Object.assign(content.style, {
            width: 'min(540px, 100%)',
            maxHeight: '95vh',
            overflowY: 'auto',
            boxSizing: 'border-box',
            padding: '20px',
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.35)',
            textAlign: 'center',
            fontFamily: this.fonts.main
        });

        // Heading
        const heading = document.createElement('h2');
        heading.textContent = '🏆 Numstep Complete!';

        Object.assign(heading.style, {
            margin: '0 0 15px',
            color: '#000000',
            fontSize: '26px'
        });

        // Badge image
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = `Numstep ${size}×${size} badge for ${dateString}`;

        Object.assign(image.style, {
            display: 'block',
            width: 'min(500px, 100%)',
            height: 'auto',
            margin: '0 auto 18px',
            border: '1px solid #dddddd',
            borderRadius: '4px'
        });

        // Download button
        const downloadButton = document.createElement('button');
        downloadButton.type = 'button';
        downloadButton.textContent = 'Download Badge';

        Object.assign(downloadButton.style, {
            display: 'inline-block',
            padding: '12px 24px',
            margin: '0 8px 10px',
            border: 'none',
            borderRadius: '6px',
            background: '#000000',
            color: '#ffffff',
            fontSize: '17px',
            fontWeight: 'bold',
            cursor: 'pointer'
        });

        downloadButton.addEventListener('click', () => {
            const link = document.createElement('a');

            link.download =
                `numstep_${dateString}_badge.png`;

            link.href = imageUrl;

            // This is now the ONLY place where the badge downloads.
            link.click();
        });

        // Close button
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.textContent = 'Close';

        Object.assign(closeButton.style, {
            display: 'inline-block',
            padding: '12px 24px',
            margin: '0 8px 10px',
            border: '1px solid #999999',
            borderRadius: '6px',
            background: '#ffffff',
            color: '#000000',
            fontSize: '17px',
            cursor: 'pointer'
        });

        const closeModal = () => {
            modal.remove();
        };

        closeButton.addEventListener('click', closeModal);

        // Allow tapping/clicking outside the white modal to close it.
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                closeModal();
            }
        });

        // Allow Escape to close the modal.
        const escapeHandler = (event) => {
            if (event.key === 'Escape') {
                closeModal();
                document.removeEventListener(
                    'keydown',
                    escapeHandler
                );
            }
        };

        document.addEventListener(
            'keydown',
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
