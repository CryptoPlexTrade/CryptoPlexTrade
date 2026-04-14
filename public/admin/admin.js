// --- Generic CSRF Helper ---
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// --- Global admin session guard ---
// Intercepts all fetch calls. If any admin API returns 401 or 403,
// the session has expired — redirect to admin login immediately.
(function() {
    const _fetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await _fetch(...args);
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        if ((response.status === 401 || response.status === 403) && url.includes('/api/admin')) {
            window.location.href = '/admin-login?reason=session_expired';
        }
        return response;
    };
})();

document.addEventListener('DOMContentLoaded', function() {
    // --- Logout Logic ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(event) {
            event.preventDefault();
            const csrfToken = getCookie('csrf-token');
            try {
                await fetch('/api/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
                window.location.href = '/admin-login';
            } catch (error) {
                window.location.href = '/admin-login';
            }
        });
    }
});