/**
 * theme.js — CryptoPlexTrade Theme Engine (Dark / Light Mode)
 * Architecture: Sovereign Precision Hybrid with Instant Persistence
 */
(function () {
    const SUN_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
    const MOON_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

    function getSavedTheme() {
        return localStorage.getItem('cpt_theme') || 'dark';
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        if (document.body) {
            if (theme === 'light') {
                document.body.classList.add('light-theme');
            } else {
                document.body.classList.remove('light-theme');
            }
        }
        localStorage.setItem('cpt_theme', theme);
        updateToggleButtons(theme);
    }

    function toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme') || getSavedTheme();
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    }

    function updateToggleButtons(theme) {
        const btns = document.querySelectorAll('.theme-toggle-btn');
        btns.forEach(btn => {
            btn.innerHTML = theme === 'dark' ? SUN_SVG : MOON_SVG;
            btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
        });
    }

    // Apply immediately to prevent flicker
    const initialTheme = getSavedTheme();
    document.documentElement.setAttribute('data-theme', initialTheme);

    document.addEventListener('DOMContentLoaded', function () {
        applyTheme(initialTheme);

        // Wire existing buttons
        document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
            btn.addEventListener('click', toggleTheme);
        });

        // If no theme toggle exists in the header, inject one
        const headerNav = document.querySelector('.header .nav') || document.querySelector('.nav') || document.querySelector('.header-nav');
        if (headerNav && !headerNav.querySelector('.theme-toggle-btn')) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'theme-toggle-btn';
            toggleBtn.type = 'button';
            toggleBtn.innerHTML = initialTheme === 'dark' ? SUN_SVG : MOON_SVG;
            toggleBtn.setAttribute('title', initialTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            toggleBtn.setAttribute('aria-label', initialTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            toggleBtn.addEventListener('click', toggleTheme);
            headerNav.appendChild(toggleBtn);
        }

        // Also inject into mobile CTA if present
        const mobileCta = document.querySelector('.mobile-header-cta');
        if (mobileCta && !mobileCta.querySelector('.theme-toggle-btn')) {
            const mBtn = document.createElement('button');
            mBtn.className = 'theme-toggle-btn mobile-theme-btn';
            mBtn.type = 'button';
            mBtn.innerHTML = initialTheme === 'dark' ? SUN_SVG : MOON_SVG;
            mBtn.setAttribute('title', initialTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            mBtn.setAttribute('aria-label', initialTheme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
            mBtn.addEventListener('click', toggleTheme);
            mobileCta.prepend(mBtn);
        }
    });

    window.cptToggleTheme = toggleTheme;
})();
