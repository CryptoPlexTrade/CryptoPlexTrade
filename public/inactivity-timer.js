/**
 * Handles user inactivity timeout.
 * After a specified duration of inactivity, it logs the user out and redirects them.
 */
(function() {
    const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds
    let inactivityTimer;

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    async function logoutDueToInactivity() {
        alert('You have been logged out due to inactivity.');
        try {
            const csrfToken = getCookie('csrf-token');
            if (csrfToken) {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': csrfToken }
                });
            }
        } catch (error) {
            console.error('Server logout request failed during inactivity timeout:', error);
        } finally {
            // Clear any sensitive local storage items
            localStorage.removeItem('buyOrderDetails');
            localStorage.removeItem('sellOrderDetails');
            // Redirect to the main index page
            window.location.href = '/index.html';
        }
    }

    function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT);
    }

    // Listen for user activity events to reset the timer
    ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => document.addEventListener(event, resetTimer, true));

    // Initialize the timer when the script loads
    resetTimer();
})();