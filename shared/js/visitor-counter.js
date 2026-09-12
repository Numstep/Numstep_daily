"use strict";

(function () {
    const counter = document.createElement("div");
    counter.className = "siteVisitorCounter";
    counter.setAttribute("aria-label", "Numstep website visits");

    const widget = document.createElement("div");
    widget.className = "counterapi";
    widget.setAttribute("ns", "numstepdaily");
    widget.setAttribute("action", "view");
    widget.setAttribute("key", "all-website-traffic");
    widget.setAttribute("icon", "eye");
    widget.setAttribute("label", "site visits");
    widget.setAttribute("noIcon", "true");
    widget.setAttribute("noCss", "true");
    widget.setAttribute("noFormatting", "false");
    widget.setAttribute("noAnim", "true");

    counter.appendChild(widget);
    document.body.appendChild(counter);

    const script = document.createElement("script");
    script.src = "https://counterapi.com/c.js?ns=numstepdaily";
    script.async = true;
    document.head.appendChild(script);
})();
