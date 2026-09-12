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
            if (value.version !== CONSENT_VERSION) return null;
            return value;
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
    }

    function clearConsent() {
        document.cookie = CONSENT_COOKIE + "=; Max-Age=0; Path=/; SameSite=Lax";
    }

    function privacyPath() {
        return window.location.pathname.includes("/games/numstep/")
            ? "privacy.html"
            : "../numstep/privacy.html";
    }

    function ensureGtag() {
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

    function loadAnalytics() {
        ensureGtag();
    }

    function disableAnalytics() {
        if (window.gtag) {
            window.gtag("consent", "update", {
                analytics_storage: "denied",
                ad_storage: "denied",
                ad_user_data: "denied",
                ad_personalization: "denied"
            });
        }
    }

    function makeButton(label, className, handler) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = className;
        button.addEventListener("click", handler);
        return button;
    }

    function createSettings() {
        const panel = document.createElement("div");
        panel.className = "cookieSettingsPanel";
        panel.hidden = true;
        panel.innerHTML = [
            '<h2 id="cookieSettingsTitle">Cookie settings</h2>',
            '<p>Choose whether Numstep may use Google Analytics to understand how the site is used. Analytics is optional and is off unless you choose it.</p>',
            '<label class="cookieChoice"><input id="cookieAnalytics" type="checkbox"><span><strong>Analytics</strong><small>Google Analytics cookies and similar technologies used for site measurement.</small></span></label>',
            '<div class="cookieActions"></div>'
        ].join("");

        const actions = panel.querySelector(".cookieActions");
        actions.appendChild(makeButton("Save choices", "cookiePrimary", function () {
            const accepted = panel.querySelector("#cookieAnalytics").checked;
            setConsent(accepted);
            if (accepted) {
                loadAnalytics();
                if (window.gtag) {
                    window.gtag("consent", "update", {
                        analytics_storage: "granted",
                        ad_storage: "denied",
                        ad_user_data: "denied",
                        ad_personalization: "denied"
                    });
                }
            } else {
                disableAnalytics();
            }
            closeBanner();
        }));

        return panel;
    }

    let banner;
    let settings;

    function closeBanner() {
        if (banner) banner.remove();
        if (settings) settings.remove();
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
        if (document.querySelector(".cookieSettingsLink")) return;
        const link = document.createElement("button");
        link.type = "button";
        link.className = "cookieSettingsLink";
        link.textContent = "Cookie settings";
        link.addEventListener("click", function () {
            showBanner(true);
        });
        document.body.appendChild(link);
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
            '<p class="cookieLinks"><a href="' + privacyPath() + '">Privacy &amp; cookies</a></p>',
            '<div class="cookieActions" aria-label="Cookie choices"></div>',
            '</div>',
            '<div class="cookieSettings" hidden></div>'
        ].join("");

        const introActions = banner.querySelector(".cookieIntro .cookieActions");
        introActions.appendChild(makeButton("Accept analytics", "cookiePrimary", function () {
            setConsent(true);
            loadAnalytics();
            if (window.gtag) {
                window.gtag("consent", "update", {
                    analytics_storage: "granted",
                    ad_storage: "denied",
                    ad_user_data: "denied",
                    ad_personalization: "denied"
                });
            }
            closeBanner();
        }));
        introActions.appendChild(makeButton("Reject analytics", "cookieSecondary", function () {
            setConsent(false);
            closeBanner();
        }));
        introActions.appendChild(makeButton("Manage choices", "cookieSecondary", openSettings));

        settings = createSettings();
        banner.querySelector(".cookieSettings").appendChild(settings);
        settings.hidden = false;
        banner.querySelector(".cookieSettings").hidden = true;

        if (settingsOnly) openSettings();
        document.body.appendChild(banner);
    }

    function init() {
        const consent = getConsent();
        if (consent && consent.analytics) {
            loadAnalytics();
            if (window.gtag) {
                window.gtag("consent", "update", {
                    analytics_storage: "granted",
                    ad_storage: "denied",
                    ad_user_data: "denied",
                    ad_personalization: "denied"
                });
            }
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
