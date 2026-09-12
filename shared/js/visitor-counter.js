"use strict";

(function () {
    function addCounter() {
        if (document.querySelector(".siteVisitorCounter")) return;

        const bar = document.querySelector(".siteBottomBar");
        if (!bar) return;

        const wrapper = document.createElement("div");
        wrapper.className = "siteVisitorCounter";

        const badge = document.createElement("img");
        badge.src = "https://visitor-badge.laobi.icu/badge?page_id=Numstep.Numstep_daily";
        badge.alt = "Site visits";
        badge.width = 110;
        badge.height = 20;

        wrapper.appendChild(badge);
        bar.querySelector(".siteBottomCenter").appendChild(wrapper);
    }

    function init() {
        try {
            const match = document.cookie.match(/(?:^|; )numstep_consent=([^;]*)/);
            if (match) {
                const consent = JSON.parse(decodeURIComponent(match[1]));
                if (consent.version === "1" && consent.analytics === true) addCounter();
            }
        } catch (error) {
            // Leave the counter disabled if consent cannot be read safely.
        }

        window.addEventListener("numstep-consent-changed", function (event) {
            if (event.detail && event.detail.analytics === true) addCounter();
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
