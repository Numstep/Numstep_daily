"use strict";

(function () {
    const CONSENT_COOKIE = "numstep_consent";
    const CONSENT_VERSION = "1";
    const ANALYTICS_ID = "G-BWBT7DYH8Z";

    function getConsent() {
        const match = document.cookie.match(new RegExp("(?:^|; )" + CONSENT_COOKIE + "=([^;]*)"));
        if (!match) return null;
        try {
            const value = JSON.parse(decodeURIComponent(match[1]));
            return value.version === CONSENT_VERSION ? value : null;
        } catch (error) {
            return null;
        }
    }

    function setConsent(analytics) {
        const value = encodeURIComponent(JSON.stringify({
            version: CONSENT_VERSION,
            analytics: Boolean(analytics),
            updatedAt: new Date().toISOString()
        }));
        document.cookie = CONSENT_COOKIE + "=" + value + "; Max-Age=15552000; Path=/; SameSite=Lax";
        window.dispatchEvent(new CustomEvent("numstep-consent-changed", {
            detail: { analytics: Boolean(analytics) }
        }));
    }

    function privacyPath() {
        return window.location.pathname.includes("/games/numstep/")
            ? "legal.html"
            : "../numstep/legal.html";
    }

    function legalPath() {
        return privacyPath();
    }

    function loadAnalytics() {
        if (window.__numstepGtagLoaded) return;

        window.dataLayer = window.dataLayer || [];
        window.gtag = window.gtag || function () {
            window.dataLayer.push(arguments);
        };

        window.gtag("consent", "default", {
            ad_storage: "denied",
            analytics_storage: "granted",
            ad_user_data: "denied",
            ad_personalization: "denied",
            wait_for_update: 500
        });

        const script = document.createElement("script");
        script.async = true;
        script.src = "https://www.googletagmanager.com/gtag/js?id=" + ANALYTICS_ID;
        script.onload = function () {
            window.gtag("js", new Date());
            window.gtag("config", ANALYTICS_ID, {
                allow_google_signals: false,
                allow_ad_personalization_signals: false
            });
        };
        document.head.appendChild(script);
        window.__numstepGtagLoaded = true;
    }

    function makeButton(label, className, handler) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = className;
        button.addEventListener("click", handler);
        return button;
    }

    function ensureBottomBar() {
        let bar = document.querySelector(".siteBottomBar");
        if (bar) return bar;

        bar = document.createElement("div");
        bar.className = "siteBottomBar";
        bar.setAttribute("aria-label", "Site information and privacy controls");
        bar.innerHTML = '<div class="siteBottomLegal"></div><div class="siteBottomCenter"></div><div></div>';

        const legalLink = document.createElement("a");
        legalLink.className = "legalBitsLink";
        legalLink.href = legalPath();
        legalLink.textContent = "Legal bits and policies";
        bar.querySelector(".siteBottomLegal").appendChild(legalLink);

        document.body.appendChild(bar);
        return bar;
    }

    function applyChoice(analytics) {
        setConsent(analytics);
        if (analytics) loadAnalytics();
        closeBanner();
    }

    function createSettings() {
        const panel = document.createElement("div");
        panel.className = "cookieSettingsPanel";
        panel.innerHTML = [
            '<h2>Cookie settings</h2>',
            '<p>Choose whether Numstep may use Google Analytics to understand how the site is used. Analytics is optional and is off unless you choose it.</p>',
            '<label class="cookieChoice"><input id="cookieAnalytics" type="checkbox"><span><strong>Analytics</strong><small>Google Analytics cookies and similar technologies used for site measurement.</small></span></label>',
            '<div class="cookieActions"></div>'
        ].join("");

        const actions = panel.querySelector(".cookieActions");
        actions.appendChild(makeButton("Save choices", "cookiePrimary", function () {
            applyChoice(panel.querySelector("#cookieAnalytics").checked);
        }));
        actions.appendChild(makeButton("Reject analytics", "cookieSecondary", function () {
            applyChoice(false);
        }));
        return panel;
    }

    let banner;

    function closeBanner() {
        if (banner) banner.remove();
        banner = null;
        createSettingsLink();
    }

    function openSettings() {
        if (!banner) return;
        banner.querySelector(".cookieIntro").hidden = true;
        banner.querySelector(".cookieSettings").hidden = false;
        const saved = getConsent();
        banner.querySelector("#cookieAnalytics").checked = Boolean(saved && saved.analytics);
    }

    function createSettingsLink() {
        const bar = ensureBottomBar();
        if (bar.querySelector(".cookieSettingsLink")) return;

        const link = document.createElement("button");
        link.type = "button";
        link.className = "cookieSettingsLink";
        link.textContent = "Cookie settings";
        link.addEventListener("click", function () {
            showBanner(true);
        });
        bar.querySelector(".siteBottomCenter").appendChild(link);
    }

    function showBanner(settingsOnly) {
        if (banner) return;

        banner = document.createElement("aside");
        banner.className = "cookieBanner";
        banner.setAttribute("aria-labelledby", "cookieBannerTitle");
        banner.setAttribute("role", "region");
        banner.innerHTML = [
            '<div class="cookieIntro">',
            '<h2 id="cookieBannerTitle">Cookies and analytics</h2>',
            '<p>Numstep uses essential storage to make the site work. With your permission, we can also use Google Analytics to understand how the site is used and improve it. Analytics is optional.</p>',
            '<p class="cookieLinks"><a href="' + privacyPath() + '">Legal bits and policies</a></p>',
            '<div class="cookieActions" aria-label="Cookie choices"></div>',
            '</div>',
            '<div class="cookieSettings" hidden></div>'
        ].join("");

        const introActions = banner.querySelector(".cookieIntro .cookieActions");
        introActions.appendChild(makeButton("Accept analytics", "cookiePrimary", function () {
            applyChoice(true);
        }));
        introActions.appendChild(makeButton("Reject analytics", "cookieSecondary", function () {
            applyChoice(false);
        }));
        introActions.appendChild(makeButton("Manage choices", "cookieSecondary", openSettings));

        banner.querySelector(".cookieSettings").appendChild(createSettings());
        document.body.appendChild(banner);
        if (settingsOnly) openSettings();
    }

    function init() {
        ensureBottomBar();
        const consent = getConsent();
        if (consent && consent.analytics) {
            loadAnalytics();
            createSettingsLink();
            return;
        }
        if (consent && consent.analytics === false) {
            createSettingsLink();
            return;
        }
        showBanner(false);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
