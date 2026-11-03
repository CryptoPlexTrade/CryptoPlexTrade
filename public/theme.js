/**
 * theme.js — CryptoPlexTrade Sovereign Theme Lock
 * Enforces Sovereign Hybrid Deep Midnight (#040914) dark architecture.
 */
(function () {
    try {
        localStorage.removeItem('cpt_theme');
    } catch (e) {}
    document.documentElement.setAttribute('data-theme', 'dark');
    if (document.body) {
        document.body.classList.remove('light-theme');
    }
    // Clean up any toggle buttons from DOM
    function purgeThemeToggles() {
        document.querySelectorAll('.theme-toggle-btn, .mobile-theme-btn').forEach(function (el) {
            el.remove();
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', purgeThemeToggles);
    } else {
        purgeThemeToggles();
    }
})();
