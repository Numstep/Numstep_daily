"use strict";

let currentShareResult = null;

function createShareModal() {
    if (document.getElementById("shareModal")) return;

    const modal = document.createElement("div");
    modal.id = "shareModal";
    modal.className = "shareModal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
        <div class="shareOverlay"></div>
        <div class="shareBox" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
            <button type="button" class="shareClose" aria-label="Close">×</button>

            <div class="shareGraphic">
                <h2 id="shareTitle">🎉 Puzzle Complete!</h2>
                <img id="shareBadgeImage" class="shareBadgeImage" alt="Your Numstep result badge">
                <div id="shareResult"></div>
            </div>

            <div class="shareButtons">
                <button id="nativeShareButton">📤 Share</button>
                <button id="whatsappShareButton">WhatsApp</button>
                <button id="xShareButton">𝕏</button>
                <button id="blueskyShareButton">Bluesky</button>
                <button id="copyShareButton">📋 Copy</button>
                <button id="downloadBadgeButton">⬇️ PNG</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector(".shareClose").addEventListener("click", closeShareModal);
    modal.querySelector(".shareOverlay").addEventListener("click", closeShareModal);
    document.getElementById("nativeShareButton").addEventListener("click", nativeShareResult);
    document.getElementById("whatsappShareButton").addEventListener("click", () => openShareUrl("whatsapp"));
    document.getElementById("xShareButton").addEventListener("click", () => openShareUrl("x"));
    document.getElementById("blueskyShareButton").addEventListener("click", () => openShareUrl("bluesky"));
    document.getElementById("copyShareButton").addEventListener("click", copyShareResult);
    document.getElementById("downloadBadgeButton").addEventListener("click", downloadShareBadge);
}

function showShareModal(result) {
    createShareModal();
    currentShareResult = result;

    const badge = document.getElementById("shareBadgeImage");
    badge.src = result.badgeImageUrl || "";
    badge.style.display = result.badgeImageUrl ? "block" : "none";

    document.getElementById("shareResult").innerHTML = `
        <div class="shareStatsRow">
            <div class="shareStat"><strong>${result.size}×${result.size}</strong><span>Puzzle</span></div>
            <div class="shareStat"><strong>${result.attempts}</strong><span>Attempts</span></div>
            <div class="shareStat"><strong>${formatShareTime(result.elapsed)}</strong><span>Time</span></div>
        </div>
        <div class="shareDate">${result.date}</div>
    `;

    const modal = document.getElementById("shareModal");
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
}

function closeShareModal() {
    const modal = document.getElementById("shareModal");
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
}

function buildShareText() {
    if (!currentShareResult) return "";

    return `🏆 NUMSTEP

${currentShareResult.size}×${currentShareResult.size}
📅 ${currentShareResult.date}

⏱️ ${formatShareTime(currentShareResult.elapsed)}
🎯 ${currentShareResult.attempts} attempt${currentShareResult.attempts === 1 ? "" : "s"}

Can you beat my result?
${currentShareResult.url || window.location.href}`;
}

async function nativeShareResult() {
    if (!currentShareResult) return;

    const text = buildShareText();
    const shareData = {
        title: "My Numstep Result",
        text,
        url: currentShareResult.url || window.location.href
    };

    try {
        if (currentShareResult.badgeImageUrl && navigator.canShare && navigator.share) {
            const response = await fetch(currentShareResult.badgeImageUrl);
            if (!response.ok) {
                throw new Error("Could not read the badge PNG.");
            }
            const blob = await response.blob();
            const file = new File(
                [blob],
                `numstep_${currentShareResult.date}_badge.png`,
                { type: "image/png" }
            );

            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    ...shareData,
                    files: [file]
                });
                return;
            }
        }

        if (navigator.share) {
            await navigator.share(shareData);
            return;
        }

        copyShareResult();
    } catch (error) {
        if (error && error.name !== "AbortError") console.error("Could not share result:", error);
    }
}

function openShareUrl(network) {
    const text = buildShareText();
    const url = currentShareResult?.url || window.location.href;
    let shareUrl;

    if (network === "whatsapp") {
        shareUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    } else if (network === "x") {
        shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    } else {
        shareUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(text)}`;
    }

    window.open(shareUrl, "_blank", "noopener,noreferrer");
}

async function copyShareResult() {
    try {
        await navigator.clipboard.writeText(buildShareText());
        alert("Result copied!");
    } catch (error) {
        console.error("Could not copy result:", error);
    }
}

function downloadShareBadge() {
    if (!currentShareResult?.badgeImageUrl) return;

    const link = document.createElement("a");
    link.download = `numstep_${currentShareResult.date}_badge.png`;
    link.href = currentShareResult.badgeImageUrl;
    link.click();
}

function formatShareTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}