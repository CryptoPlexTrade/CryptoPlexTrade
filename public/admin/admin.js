// --- Generic CSRF Helper ---
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

document.addEventListener('DOMContentLoaded', function() {
    // --- Logout Logic ---
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async function(event) {
            event.preventDefault();
            const csrfToken = getCookie('csrf-token');
            try {
                const response = await fetch('/api/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } });
                // Regardless of response, clear client-side and redirect to admin login
                window.location.href = '/admin-login'; // Redirect to the admin login page
            } catch (error) {
                window.location.href = '/admin-login'; // Redirect even if fetch fails
            }
        });
    }
});