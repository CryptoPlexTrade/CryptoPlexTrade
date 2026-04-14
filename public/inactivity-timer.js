/**
 * Handles user inactivity timeout.
 * After a specified duration of inactivity, shows a toast and logs the user out.
 */
(function() {
    const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes
    const TOAST_DURATION     = 4000;            // ms toast is visible before redirect
    let inactivityTimer;

    // ── Inject toast styles once ──────────────────────────────────────
    if (!document.getElementById('inactivity-toast-styles')) {
        const style = document.createElement('style');
        style.id = 'inactivity-toast-styles';
        style.textContent = `
            #inactivity-toast {
                position: fixed;
                top: 24px;
                left: 50%;
                transform: translateX(-50%) translateY(-120px);
                z-index: 99999;
                display: flex;
                align-items: center;
                gap: 14px;
                background: #1e293b;
                color: #f1f5f9;
                padding: 16px 22px;
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.06);
                font-family: 'Poppins', system-ui, sans-serif;
                font-size: 0.9rem;
                font-weight: 500;
                max-width: 420px;
                width: calc(100vw - 40px);
                transition: transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease;
                opacity: 0;
                pointer-events: none;
            }
            #inactivity-toast.show {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
            #inactivity-toast .toast-icon {
                width: 40px; height: 40px; flex-shrink: 0;
                background: linear-gradient(135deg, #ef4444, #dc2626);
                border-radius: 10px;
                display: flex; align-items: center; justify-content: center;
            }
            #inactivity-toast .toast-icon svg {
                width: 20px; height: 20px; color: #fff;
            }
            #inactivity-toast .toast-body {
                flex: 1; min-width: 0;
            }
            #inactivity-toast .toast-title {
                font-weight: 700; font-size: 0.88rem;
                color: #f8fafc; margin-bottom: 2px;
            }
            #inactivity-toast .toast-sub {
                font-size: 0.78rem; color: #94a3b8;
            }
            #inactivity-toast .toast-progress {
                position: absolute;
                bottom: 0; left: 0;
                height: 3px;
                background: linear-gradient(90deg, #ef4444, #f97316);
                border-radius: 0 0 16px 16px;
                width: 100%;
                transform-origin: left;
                animation: toast-shrink ${TOAST_DURATION}ms linear forwards;
            }
            @keyframes toast-shrink {
                from { transform: scaleX(1); }
                to   { transform: scaleX(0); }
            }
        `;
        document.head.appendChild(style);
    }

    // ── Show toast then redirect ──────────────────────────────────────
    function showInactivityToast(onDone) {
        // Remove any existing toast
        const old = document.getElementById('inactivity-toast');
        if (old) old.remove();

        const toast = document.createElement('div');
        toast.id = 'inactivity-toast';
        toast.innerHTML = `
            <div class="toast-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3A5.25 5.25 0 0 0 12 1.5Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clip-rule="evenodd"/>
                </svg>
            </div>
            <div class="toast-body">
                <div class="toast-title">You've been logged out</div>
                <div class="toast-sub">Session ended due to inactivity. Redirecting…</div>
            </div>
            <div class="toast-progress"></div>
        `;
        document.body.appendChild(toast);

        // Trigger slide-in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => toast.classList.add('show'));
        });

        setTimeout(onDone, TOAST_DURATION);
    }

    // ── Cookie helper ─────────────────────────────────────────────────
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // ── Main logout flow ──────────────────────────────────────────────
    async function logoutDueToInactivity() {
        // Stop listening so no false resets after timeout
        ['mousemove', 'keydown', 'click', 'scroll'].forEach(evt =>
            document.removeEventListener(evt, resetTimer, true)
        );

        // Fire logout API (non-blocking)
        try {
            const csrfToken = getCookie('csrf-token');
            if (csrfToken) {
                await fetch('/api/logout', {
                    method: 'POST',
                    headers: { 'X-CSRF-Token': csrfToken }
                });
            }
        } catch (err) {
            console.error('Server logout request failed during inactivity timeout:', err);
        }

        // Clear sensitive storage
        localStorage.removeItem('buyOrderDetails');
        localStorage.removeItem('sellOrderDetails');

        // Show toast, then redirect
        showInactivityToast(() => {
            window.location.href = '/login.html?reason=inactivity';
        });
    }

    // ── Activity listeners ────────────────────────────────────────────
    function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(logoutDueToInactivity, INACTIVITY_TIMEOUT);
    }

    ['mousemove', 'keydown', 'click', 'scroll'].forEach(evt =>
        document.addEventListener(evt, resetTimer, true)
    );

    resetTimer();
})();