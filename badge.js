/**
 * Numstep Badge Generator
 * Creates a high-res PNG badge using the "share" solution to avoid spoilers.
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
     * Entry point called by script8.js on victory
     */
    async generate(size, dateString, time, attempts) {
        const shareUrl = `numstep_${size}_${dateString}_share.json`;
        
        try {
            const response = await fetch(shareUrl);
            const data = await response.json();
            await this.drawAndDownload(data, dateString, time, attempts);
        } catch (error) {
            console.error("Failed to generate share badge:", error);
            alert("Could not generate badge. Check console for details.");
        }
    },

    async drawAndDownload(shareData, dateString, time, attempts) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // High-DPI Scaling for crisp images
        const scale = 2; 
        const width = 500 * scale;
        const height = 700 * scale;
        canvas.width = width;
        canvas.height = height;
        ctx.scale(scale, scale);

        // 1. Background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, 500, 700);

        // 2. Header (Match h1/h2 style)
        ctx.fillStyle = this.colors.text;
        ctx.textAlign = 'center';
        ctx.font = 'bold 38px ' + this.fonts.main;
        ctx.fillText('NUMSTEP', 250, 60);

        ctx.font = 'normal 20px ' + this.fonts.main;
        ctx.fillText('Daily Challenge Success!', 250, 95);

        ctx.font = 'bold 16px ' + this.fonts.main;
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText(dateString.toUpperCase(), 250, 120);

        // 3. Draw Grid (Match #grid and .cell style)
        const gridSize = 350;
        const startX = (500 - gridSize) / 2;
        const startY = 150;
        const n = shareData.size;
        const cellSize = gridSize / n;

        shareData.solution.forEach((val, i) => {
            const row = Math.floor(i / n);
            const col = i % n;
            const x = startX + (col * cellSize);
            const y = startY + (row * cellSize);

            if (val === 0) {
                // Black Square
                ctx.fillStyle = this.colors.blackCell;
                ctx.fillRect(x, y, cellSize, cellSize);
            } else {
                // White square with path number
                ctx.strokeStyle = this.colors.gridLines;
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, cellSize, cellSize);

                ctx.fillStyle = this.colors.text;
                ctx.font = `bold ${cellSize * 0.4}px ` + this.fonts.main;
                ctx.textBaseline = 'middle';
                ctx.fillText(val, x + cellSize/2, y + cellSize/2);
            }
        });

        // 4. Stats (Replicating the look of your #timer and #attempts div)
const statsY = startY + gridSize + 60;

// Time (Left Side)
ctx.fillStyle = this.colors.text;
ctx.font = 'bold 32px monospace'; // Match your #timer monospace font
ctx.fillText(time, 140, statsY);
ctx.font = '16px ' + this.fonts.main;
ctx.fillStyle = this.colors.subtext;
ctx.fillText('TIME', 140, statsY + 25);

// Attempts (Right Side)
ctx.fillStyle = this.colors.text;
ctx.font = 'bold 32px ' + this.fonts.main;
ctx.fillText(attempts, 360, statsY); // Just the number
ctx.font = '16px ' + this.fonts.main;
ctx.fillStyle = this.colors.subtext;
ctx.fillText('ATTEMPTS', 360, statsY + 25);

        // 5. Footer URL
        ctx.font = '14px ' + this.fonts.main;
        ctx.fillStyle = this.colors.subtext;
        ctx.fillText('ko-fi.com/numstep', 250, 670);

        // 6. Trigger Download
        const link = document.createElement('a');
        link.download = `numstep_${dateString}_badge.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }
};