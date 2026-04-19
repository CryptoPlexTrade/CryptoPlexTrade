// --- Generic CSRF Helper ---
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// --- Global admin fetch wrapper ---
// 1. Automatically injects the X-CSRF-Token header on every mutating request
//    so individual pages don't need to manage CSRF manually.
// 2. Redirects to admin login only on 401 (session missing/expired).
//    403 is no longer treated as a logout trigger — it may be a CSRF mismatch
//    or a permissions error that should surface as a message, not a redirect.
(function() {
    const _fetch = window.fetch;
    const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

    window.fetch = async function(resource, options = {}) {
        const method = (options.method || 'GET').toUpperCase();

        // Inject CSRF token on all mutating requests to our own API
        if (!SAFE_METHODS.has(method)) {
            const csrfToken = getCookie('admin-csrf-token');
            if (csrfToken) {
                options.headers = Object.assign({}, options.headers, {
                    'X-CSRF-Token': csrfToken
                });
            }
        }

        const response = await _fetch(resource, options);
        const url = typeof resource === 'string' ? resource : (resource?.url || '');

        // Only redirect to login on 401 (unauthenticated — session cookie missing or expired).
        // 403 is intentionally NOT treated as a logout trigger here.
        if (response.status === 401 && url.includes('/api/admin')) {
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
            try {
                // CSRF header is injected automatically by the fetch wrapper above
                await fetch('/api/logout', { method: 'POST', credentials: 'include' });
                window.location.href = '/admin-login';
            } catch (error) {
                window.location.href = '/admin-login';
            }
        });
    }
});