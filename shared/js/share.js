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
                <button id="nativeBadgeShareButton">📤 Share badge</button>
                <button id="nativeTextShareButton">📤 Share text</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector(".shareClose").addEventListener("click", closeShareModal);
    modal.querySelector(".shareOverlay").addEventListener("click", closeShareModal);
    document.getElementById("nativeBadgeShareButton").addEventListener("click", nativeShareBadge);
    document.getElementById("nativeTextShareButton").addEventListener("click", nativeShareText);
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
            <div class="shareStat"><strong>${result.mistakes ?? result.attempts ?? 0}</strong><span>Mistakes</span></div>
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

function getShareGameName() {
    const path = window.location.pathname || "";
    if (path.includes("/numstep-cube/")) return "Numstep:Cube";
    if (path.includes("/numstep-taurus/")) return "Numstep:Taurus";
    if (path.includes("/numstep-box/")) return "Numstep:Box";
    return "Numstep:Classic";
}

function buildShareText() {
    if (!currentShareResult) return "";

    const mistakes = currentShareResult.mistakes ?? currentShareResult.attempts ?? 0;

    return `${getShareGameName()}

${currentShareResult.size}×${currentShareResult.size}
📅 ${currentShareResult.date}

⏱️ ${formatShareTime(currentShareResult.elapsed)}
🎯 ${mistakes} mistake${mistakes === 1 ? "" : "s"}

I just solved today's puzzle. Can you beat me score
${currentShareResult.url || window.location.href}`;
}

async function nativeShareBadge() {
    if (!currentShareResult?.badgeImageUrl || !navigator.share) return;

    const url = currentShareResult.url || window.location.href;

    try {
        const response = await fetch(currentShareResult.badgeImageUrl);
        if (!response.ok) throw new Error("Could not read the badge PNG.");

        const blob = await response.blob();
        const file = new File(
            [blob],
            `numstep_${currentShareResult.date}_badge.png`,
            { type: "image/png" }
        );

        if (!navigator.canShare || !navigator.canShare({ files: [file] })) {
            alert("Badge sharing is not supported on this device.");
            return;
        }

        await navigator.share({ files: [file], url });
    } catch (error) {
        if (error && error.name !== "AbortError") console.error("Could not share badge:", error);
    }
}

async function nativeShareText() {
    if (!currentShareResult || !navigator.share) return;

    const text = buildShareText();
    const url = currentShareResult.url || window.location.href;

    try {
        await navigator.share({
            title: getShareGameName(),
            text,
            url
        });
    } catch (error) {
        if (error && error.name !== "AbortError") console.error("Could not share result:", error);
    }
}

function formatShareTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function normaliseMistakesLabel(node) {
    if (!node || node.id !== "attempts") return;
    node.textContent = node.textContent.replace(/\bAttempts?\b/g, "Mistakes");
}

function setupMistakesTerminology() {
    const attemptsElement = document.getElementById("attempts");
    normaliseMistakesLabel(attemptsElement);

    if (!document.body || typeof MutationObserver === "undefined") return;

    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            if (mutation.type === "characterData") {
                normaliseMistakesLabel(mutation.target.parentElement);
            } else if (mutation.type === "childList") {
                normaliseMistakesLabel(mutation.target);
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) normaliseMistakesLabel(node);
                });
            }
        });
    });

    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupMistakesTerminology, { once: true });
} else {
    setupMistakesTerminology();
}