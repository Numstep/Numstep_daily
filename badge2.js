


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
