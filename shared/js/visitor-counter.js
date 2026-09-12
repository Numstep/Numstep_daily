"use strict";

(function () {
    const wrapper = document.createElement("div");
    wrapper.className = "siteVisitorCounter";

    const badge = document.createElement("img");
    badge.src = "https://visitor-badge.laobi.icu/badge?page_id=Numstep.Numstep_daily";
    badge.alt = "Site visits";
    badge.loading = "lazy";
    badge.width = 110;
    badge.height = 20;

    wrapper.appendChild(badge);
    document.body.appendChild(wrapper);
})();
