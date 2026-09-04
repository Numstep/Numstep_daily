"use strict";

let currentShareResult = null;

function createShareModal() {

    if (document.getElementById("shareModal")) {
        return;
    }

    const modal = document.createElement("div");

    modal.id = "shareModal";
    modal.className = "shareModal";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
        <div class="shareOverlay"></div>

        <div class="shareBox"
             role="dialog"
             aria-modal="true"
             aria-labelledby="shareTitle">

            <button
                type="button"
                class="shareClose"
                aria-label="Close">
                ×
            </button>

            <div id="shareGraphic" class="shareGraphic">

                <h2 id="shareTitle">🎉 Puzzle Complete!</h2>

                <div class="shareBrand">
                    NUMSTEP
                </div>

                <div id="shareResult"></div>

            </div>

            <div class="shareButtons">

                <button id="nativeShareButton">
                    📤 Share
                </button>

                <button id="copyShareButton">
                    📋 Copy Result
                </button>

            </div>

        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector(".shareClose")
        .addEventListener("click", closeShareModal);

    modal.querySelector(".shareOverlay")
        .addEventListener("click", closeShareModal);

    document.getElementById("nativeShareButton")
        .addEventListener("click", nativeShareResult);

    document.getElementById("copyShareButton")
        .addEventListener("click", copyShareResult);
}


function showShareModal(result) {

    createShareModal();

    currentShareResult = result;

    const modal = document.getElementById("shareModal");

    const resultElement =
        document.getElementById("shareResult");

    resultElement.innerHTML = `
        <div class="shareStat">
            <strong>${result.size}×${result.size}</strong>
            <span>Puzzle</span>
        </div>

        <div class="shareStat">
            <strong>${result.attempts}</strong>
            <span>Attempts</span>
        </div>

        <div class="shareStat">
            <strong>${formatShareTime(result.elapsed)}</strong>
            <span>Time</span>
        </div>

        <div class="shareDate">
            ${result.date}
        </div>
    `;

    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("open");
}


function closeShareModal() {

    const modal = document.getElementById("shareModal");

    if (!modal) {
        return;
    }

    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("open");
}


function buildShareText() {

    if (!currentShareResult) {
        return "";
    }

    return `🏆 NUMSTEP

${currentShareResult.size}×${currentShareResult.size}
📅 ${currentShareResult.date}

⏱️ ${formatShareTime(currentShareResult.elapsed)}
🎯 ${currentShareResult.attempts} attempt${currentShareResult.attempts === 1 ? "" : "s"}

Can you beat my result?`;
}


async function nativeShareResult() {

    const text = buildShareText();

    if (navigator.share) {

        try {

            await navigator.share({
                title: "My Numstep Result",
                text: text,
                url: window.location.href
            });

        } catch (error) {

            console.log("Sharing cancelled");

        }

    } else {

        copyShareResult();

    }
}


async function copyShareResult() {

    const text = buildShareText();

    try {

        await navigator.clipboard.writeText(text);

        alert("Result copied!");

    } catch (error) {

        console.error("Could not copy result:", error);

    }
}


function formatShareTime(milliseconds) {

    const totalSeconds =
        Math.floor(milliseconds / 1000);

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
}