// --- Generic CSRF Helper ---
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// --- Browser Back-Forward Cache (bfcache) & Swipe-Back Guard ---
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        // Page was restored from memory/bfcache after back swipe — force reload to re-evaluate session
        window.location.reload();
    }
});

// --- Global admin session guard ---
// Intercepts all fetch calls. If any admin API returns 401 or 403,
// the session has expired — redirect to admin login immediately.
(function() {
    const _fetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await _fetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if ((response.status === 401 || response.status === 403) && url.includes('/api/admin')) {
            window.location.replace('/admin-login?reason=session_expired');
        }
        return response;
    };

    // Proactively verify admin session on initial load or back swipe
    (async function verifyAdminAuth() {
        try {
            const r = await _fetch('/api/admin/stats', { credentials: 'include' });
            if (r.status === 401 || r.status === 403) {
                window.location.replace('/admin-login?reason=session_expired');
            }
        } catch (_) {}
    })();
})();

document.addEventListener('DOMContentLoaded', function() {
    // --- Mobile Rail Drawer Toggle ---
    const rail = document.getElementById('admin-rail');
    const backdrop = document.getElementById('rail-backdrop');
    const openBtn = document.getElementById('rail-open-btn');
    const closeBtn = document.getElementById('rail-close-btn');

    function openRail() {
        if (rail) rail.classList.add('is-open');
        if (backdrop) backdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function closeRail() {
        if (rail) rail.classList.remove('is-open');
        if (backdrop) backdrop.classList.remove('show');
        document.body.style.overflow = '';
    }

    if (openBtn) openBtn.addEventListener('click', openRail);
    if (closeBtn) closeBtn.addEventListener('click', closeRail);
    if (backdrop) backdrop.addEventListener('click', closeRail);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && rail && rail.classList.contains('is-open')) {
            closeRail();
        }
    });

    // --- Logout Logic ---
    async function handleLogout(event) {
        if (event) event.preventDefault();
        const csrfToken = getCookie('csrf-token') || getCookie('admin-csrf-token');
        try {
            await fetch('/api/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
        } catch (_) {
            // Proceed with client redirection even if network fails
        }
        window.location.replace('/admin-login');
    }

    const logoutBtn = document.getElementById('logout-btn');
    const logoutRailBtn = document.getElementById('logout-btn-rail');
    const logoutButtons = document.querySelectorAll('.admin-logout-btn');

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (logoutRailBtn) logoutRailBtn.addEventListener('click', handleLogout);
    logoutButtons.forEach(btn => {
        if (btn !== logoutBtn && btn !== logoutRailBtn) {
            btn.addEventListener('click', handleLogout);
        }
    });
});