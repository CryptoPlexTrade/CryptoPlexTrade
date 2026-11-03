/**
 * chat-widget.js
 * Floating live-chat bubble for customer-facing pages.
 * Responsive design for PC and Mobile with seamless authenticated user support.
 */
(function () {
    'use strict';

    // ── Generate or retrieve a stable session key ──────────────────────
    function getSessionKey() {
        let key = localStorage.getItem('cpt_chat_session');
        if (!key) {
            key = 'chat_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
            localStorage.setItem('cpt_chat_session', key);
        }
        return key;
    }

    // ── Check if user is authenticated ────────────────────────────────
    let cachedUser = null;
    async function getAuthenticatedUser() {
        if (cachedUser) return cachedUser;
        try {
            const res = await fetch('/api/user/profile', { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                cachedUser = data.fullname || data.email || null;
                return cachedUser;
            }
        } catch (_) {}
        return null;
    }

    // ── Inject styles ──────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        /* ── Floating Launcher Bubble ─────────────────────────────────── */
        #cpt-chat-bubble {
            position: fixed;
            bottom: 78px; right: 24px;
            z-index: 9998;
            width: 56px; height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, #0052cc 0%, #0077c8 100%);
            box-shadow: 0 8px 24px rgba(0, 82, 204, 0.38);
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s;
            border: none; outline: none;
        }
        #cpt-chat-bubble:hover { transform: scale(1.08); box-shadow: 0 12px 32px rgba(0, 82, 204, 0.48); }
        #cpt-chat-bubble svg { width: 24px; height: 24px; color: #fff; transition: opacity .2s; }
        #cpt-chat-bubble .bubble-close { display: none; }
        #cpt-chat-bubble.open .bubble-chat  { display: none; }
        #cpt-chat-bubble.open .bubble-close { display: block; }

        @media (max-width: 768px) {
            #cpt-chat-bubble {
                bottom: 64px; right: 16px;
                width: 50px; height: 50px;
            }
            #cpt-chat-bubble svg { width: 22px; height: 22px; }
        }

        /* Unread badge */
        #cpt-chat-badge {
            position: absolute; top: -2px; right: -2px;
            background: #ef4444; color: #fff;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: .68rem; font-weight: 700;
            width: 20px; height: 20px; border-radius: 50%;
            display: none; align-items: center; justify-content: center;
            border: 2px solid #fff;
            box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        #cpt-chat-badge.show { display: flex; animation: badge-pop .3s cubic-bezier(.34,1.56,.64,1); }
        @keyframes badge-pop { from { transform: scale(0); } to { transform: scale(1); } }

        /* ── Spacious Chat Window ─────────────────────────────────────── */
        #cpt-chat-window {
            position: fixed;
            bottom: 145px; right: 24px;
            z-index: 9999;
            width: 390px; max-width: calc(100vw - 32px);
            height: 560px; max-height: calc(100vh - 170px);
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 16px 48px rgba(11, 45, 90, 0.18), 0 0 0 1px rgba(0, 82, 204, 0.1);
            display: flex; flex-direction: column;
            overflow: hidden;
            transform: scale(.92) translateY(16px);
            opacity: 0;
            pointer-events: none;
            transition: transform .28s cubic-bezier(.34,1.56,.64,1), opacity .22s ease;
        }
        #cpt-chat-window.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }

        @media (max-width: 768px) {
            #cpt-chat-window {
                bottom: 120px; right: 12px;
                width: calc(100vw - 24px);
                max-width: 420px;
                height: calc(100vh - 140px);
                max-height: 560px;
                border-radius: 18px;
            }
        }

        /* ── Header ───────────────────────────────────────────────────── */
        #cpt-chat-header {
            background: linear-gradient(135deg, #0052cc 0%, #0077c8 100%);
            padding: 14px 18px;
            display: flex; align-items: center; justify-content: space-between;
            gap: 12px;
            flex-shrink: 0;
            color: #ffffff;
        }
        .chat-header-identity {
            display: flex; align-items: center; gap: 12px;
            min-width: 0; flex: 1;
        }
        .chat-header-avatar {
            width: 38px; height: 38px; border-radius: 50%;
            background: rgba(255,255,255,.2);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .chat-header-avatar svg { width: 20px; height: 20px; color: #fff; }
        .chat-header-info { min-width: 0; flex: 1; }
        .chat-header-title {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: .92rem; font-weight: 700; color: #ffffff;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .chat-header-sub {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: .72rem; color: rgba(255,255,255,.88);
            margin-top: 2px;
            display: flex; align-items: center; gap: 5px;
        }
        .chat-online-dot {
            width: 7px; height: 7px; border-radius: 50%;
            background: #22c55e; display: inline-block;
            box-shadow: 0 0 6px #22c55e;
        }

        /* Action Buttons */
        .chat-header-actions {
            display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }
        .chat-hdr-btn {
            background: rgba(255,255,255,.18);
            border: none; border-radius: 8px;
            color: #ffffff; cursor: pointer;
            padding: 6px 10px;
            font-size: 0.76rem; font-weight: 600;
            font-family: inherit;
            display: inline-flex; align-items: center; gap: 5px;
            transition: all 0.2s ease;
        }
        .chat-hdr-btn:hover {
            background: rgba(255,255,255,.32);
        }
        .chat-hdr-btn.end-btn:hover {
            background: #ef4444;
        }
        .chat-hdr-btn svg { width: 14px; height: 14px; }

        /* ── Confirmation Overlay ─────────────────────────────────────── */
        #cpt-cust-confirm {
            position: absolute; inset: 0; z-index: 30;
            background: rgba(10, 25, 47, 0.65);
            backdrop-filter: blur(4px);
            display: none; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 24px;
        }
        #cpt-cust-confirm.show { display: flex; }
        .cust-conf-card {
            background: #ffffff; border-radius: 16px; padding: 24px 20px;
            text-align: center; width: 100%; max-width: 290px;
            box-shadow: 0 16px 40px rgba(0,0,0,0.22);
            animation: conf-in 0.2s ease;
        }
        @keyframes conf-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .cust-conf-icon {
            width: 44px; height: 44px; border-radius: 50%;
            background: #fef2f2; color: #ef4444;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 12px;
        }
        .cust-conf-icon svg { width: 22px; height: 22px; }
        .cust-conf-card h4 {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 0.98rem; font-weight: 700; color: #0a192f; margin: 0 0 6px 0;
        }
        .cust-conf-card p {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 0.8rem; color: #64748b; margin: 0 0 18px 0; line-height: 1.45;
        }
        .cust-conf-btns { display: flex; gap: 8px; }
        .cust-conf-btn {
            flex: 1; padding: 9px; border-radius: 10px; border: none;
            font-size: 0.84rem; font-weight: 700; cursor: pointer; transition: all 0.15s;
            font-family: inherit;
        }
        .cust-conf-cancel { background: #f1f5f9; color: #475569; }
        .cust-conf-cancel:hover { background: #e2e8f0; }
        .cust-conf-end { background: #ef4444; color: #ffffff; }
        .cust-conf-end:hover { background: #dc2626; }

        /* ── Name Prompt Overlay ──────────────────────────────────────── */
        #cpt-name-prompt {
            position: absolute; inset: 0;
            background: #ffffff;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 14px; padding: 32px 28px; z-index: 10;
        }
        #cpt-name-prompt h3 {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 1.12rem; font-weight: 800; color: #0a192f; margin: 0; text-align: center;
        }
        #cpt-name-prompt p {
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 0.84rem; color: #64748b; margin: 0 0 6px 0; text-align: center; line-height: 1.5;
        }
        #cpt-name-input {
            width: 100%; padding: 12px 16px; border: 1.5px solid #cbd5e1; border-radius: 10px;
            font-family: inherit; font-size: 0.92rem; outline: none;
            transition: all 0.2s; box-sizing: border-box; color: #0a192f;
        }
        #cpt-name-input:focus {
            border-color: #0052cc;
            box-shadow: 0 0 0 3px rgba(0, 82, 204, 0.15);
        }
        #cpt-start-chat {
            width: 100%; padding: 12px;
            background: linear-gradient(135deg, #0052cc 0%, #0077c8 100%);
            border: none; border-radius: 10px; color: #fff;
            font-family: inherit; font-size: 0.92rem; font-weight: 700;
            cursor: pointer; transition: transform 0.15s, box-shadow 0.2s;
            box-shadow: 0 4px 14px rgba(0, 82, 204, 0.25);
        }
        #cpt-start-chat:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0, 82, 204, 0.35); }

        /* ── Messages Area ────────────────────────────────────────────── */
        #cpt-chat-messages {
            flex: 1; overflow-y: auto; padding: 18px;
            display: flex; flex-direction: column; gap: 12px;
            scroll-behavior: smooth;
            background: #fafcff;
        }
        #cpt-chat-messages::-webkit-scrollbar { width: 5px; }
        #cpt-chat-messages::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 5px; }

        .chat-msg {
            max-width: 82%; padding: 11px 16px; border-radius: 16px;
            font-family: 'Inter', system-ui, sans-serif; font-size: 0.86rem; line-height: 1.55;
            word-break: break-word; animation: msg-in 0.2s ease;
            box-shadow: 0 2px 6px rgba(0,0,0,0.03);
        }
        @keyframes msg-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .chat-msg.admin {
            background: #ffffff; color: #0a192f;
            border: 1px solid #e2e8f0;
            border-bottom-left-radius: 4px; align-self: flex-start;
        }
        .chat-msg.customer {
            background: linear-gradient(135deg, #0052cc 0%, #0077c8 100%); color: #ffffff;
            border-bottom-right-radius: 4px; align-self: flex-end;
        }
        .chat-msg-time {
            font-size: 0.65rem; opacity: 0.6; margin-top: 4px;
            font-family: inherit;
        }
        .chat-msg.admin .chat-msg-time { text-align: left; }
        .chat-msg.customer .chat-msg-time { text-align: right; color: rgba(255,255,255,0.8); }

        /* Quick Chips (Spacious & Clean) */
        #cpt-quick-chips {
            display: flex; gap: 6px; padding: 8px 14px;
            overflow-x: auto; background: #ffffff;
            border-top: 1px solid #f1f5f9; flex-shrink: 0;
            scrollbar-width: none;
        }
        #cpt-quick-chips::-webkit-scrollbar { display: none; }
        .cpt-chip {
            white-space: nowrap; font-size: 0.74rem; font-weight: 600;
            padding: 5px 12px; border-radius: 9999px;
            background: #f8fafc; border: 1px solid #e2e8f0;
            color: #0052cc; cursor: pointer; transition: all 0.15s;
            font-family: inherit;
        }
        .cpt-chip:hover {
            background: #0052cc; color: #ffffff; border-color: #0052cc;
        }

        /* ── Input Box ────────────────────────────────────────────────── */
        #cpt-chat-input-wrap {
            padding: 12px 14px; border-top: 1px solid #e2e8f0;
            display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
            background: #ffffff;
        }
        #cpt-chat-input {
            flex: 1; border: 1.5px solid #e2e8f0; border-radius: 12px;
            padding: 10px 14px; font-family: inherit; font-size: 0.88rem;
            outline: none; resize: none; max-height: 90px; min-height: 40px;
            transition: border-color 0.15s; color: #0a192f; background: #fafcff;
            line-height: 1.45;
        }
        #cpt-chat-input:focus { border-color: #0052cc; background: #ffffff; }
        #cpt-chat-input::placeholder { color: #94a3b8; }
        #cpt-chat-send {
            width: 42px; height: 42px; flex-shrink: 0;
            background: linear-gradient(135deg, #0052cc 0%, #0077c8 100%);
            border: none; border-radius: 12px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.15s, opacity 0.15s;
            box-shadow: 0 3px 10px rgba(0, 82, 204, 0.25);
        }
        #cpt-chat-send:hover { transform: scale(1.05); }
        #cpt-chat-send:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        #cpt-chat-send svg { width: 17px; height: 17px; color: #fff; }
    `;
    document.head.appendChild(style);

    // ── Build DOM Elements ─────────────────────────────────────────────
    const bubble = document.createElement('button');
    bubble.id = 'cpt-chat-bubble';
    bubble.setAttribute('aria-label', 'Open live chat');
    bubble.innerHTML = `
        <svg class="bubble-chat" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223Z" clip-rule="evenodd"/>
        </svg>
        <svg class="bubble-close" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" d="M5.47 5.47a.75.75 0 0 1 1.06 0L12 10.94l5.47-5.47a.75.75 0 1 1 1.06 1.06L13.06 12l5.47 5.47a.75.75 0 1 1-1.06 1.06L12 13.06l-5.47 5.47a.75.75 0 0 1-1.06-1.06L10.94 12 5.47 6.53a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd"/>
        </svg>
        <span id="cpt-chat-badge"></span>
    `;

    const win = document.createElement('div');
    win.id = 'cpt-chat-window';
    win.innerHTML = `
        <div id="cpt-chat-header">
            <div class="chat-header-identity">
                <div class="chat-header-avatar">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <div class="chat-header-info">
                    <div class="chat-header-title">CryptoPlex Support Desk</div>
                    <div class="chat-header-sub">
                        <span class="chat-online-dot"></span>
                        <span>Active · Replies in minutes</span>
                    </div>
                </div>
            </div>
            <div class="chat-header-actions">
                <button type="button" class="chat-hdr-btn end-btn" id="cpt-endchat-btn" title="End conversation">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                    <span>End</span>
                </button>
                <button type="button" class="chat-hdr-btn" id="cpt-minimize-btn" title="Minimize chat">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"/></svg>
                </button>
            </div>
        </div>

        <!-- End Chat Confirmation -->
        <div id="cpt-cust-confirm">
            <div class="cust-conf-card">
                <div class="cust-conf-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
                </div>
                <h4>End this conversation?</h4>
                <p>This will close your active support session. You can start a new inquiry at any time.</p>
                <div class="cust-conf-btns">
                    <button type="button" class="cust-conf-btn cust-conf-cancel" id="cpt-conf-no">Cancel</button>
                    <button type="button" class="cust-conf-btn cust-conf-end" id="cpt-conf-yes">End Chat</button>
                </div>
            </div>
        </div>

        <!-- Guest Name Prompt -->
        <div id="cpt-name-prompt" style="display:none;">
            <div class="chat-header-avatar" style="width:54px;height:54px;background:linear-gradient(135deg,#0052cc,#0077c8);margin-bottom:4px;">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:26px;height:26px;color:#fff;">
                    <path fill-rule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223Z" clip-rule="evenodd"/>
                </svg>
            </div>
            <h3>Direct Operational Desk</h3>
            <p>Enter your name or trader identifier to connect directly with our support desk officers.</p>
            <input id="cpt-name-input" type="text" placeholder="Your name or business name" maxlength="60">
            <button type="button" id="cpt-start-chat">Connect to Desk →</button>
        </div>

        <div id="cpt-chat-messages"></div>
        <div id="cpt-quick-chips">
            <button type="button" class="cpt-chip" data-ask="How do I buy crypto with MoMo?">💰 MoMo Buy</button>
            <button type="button" class="cpt-chip" data-ask="How do I sell crypto for Cedis?">💵 Sell for GHS</button>
            <button type="button" class="cpt-chip" data-ask="How long does settlement take?">⚡ Settlement Time</button>
            <button type="button" class="cpt-chip" data-ask="What are your fees?">📊 Rates &amp; Fees</button>
        </div>
        <div id="cpt-chat-input-wrap">
            <textarea id="cpt-chat-input" placeholder="Type your message…" rows="1" maxlength="2000"></textarea>
            <button type="button" id="cpt-chat-send" aria-label="Send message">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.478 2.405a.75.75 0 0 0-.926.94l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.405Z"/>
                </svg>
            </button>
        </div>
    `;

    document.body.appendChild(bubble);
    document.body.appendChild(win);

    // ── State ──────────────────────────────────────────────────────────
    let sessionId = localStorage.getItem('cpt_chat_session_id');
    let lastMsgTime = localStorage.getItem('cpt_chat_last_time') || '1970-01-01';
    let unreadCount = 0;
    let pollInterval = null;
    let isOpen = false;
    let isFetching = false;
    const displayedMessageIds = new Set();

    const badge = document.getElementById('cpt-chat-badge');
    const namePrompt = document.getElementById('cpt-name-prompt');
    const nameInput = document.getElementById('cpt-name-input');
    const startBtn = document.getElementById('cpt-start-chat');
    const messagesEl = document.getElementById('cpt-chat-messages');
    const inputEl = document.getElementById('cpt-chat-input');
    const sendBtn = document.getElementById('cpt-chat-send');
    const minimizeBtn = document.getElementById('cpt-minimize-btn');
    const endChatBtn = document.getElementById('cpt-endchat-btn');
    const quickChips = document.getElementById('cpt-quick-chips');
    const custConfirm = document.getElementById('cpt-cust-confirm');
    const confNoBtn = document.getElementById('cpt-conf-no');
    const confYesBtn = document.getElementById('cpt-conf-yes');

    // ── Quick chips listener ───────────────────────────────────────────
    if (quickChips) {
        quickChips.addEventListener('click', (e) => {
            const btn = e.target.closest('.cpt-chip');
            if (!btn) return;
            const ask = btn.dataset.ask;
            if (ask) {
                inputEl.value = ask;
                sendMessage();
            }
        });
    }

    function fmtTime(iso) {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function appendMsg(msg, scroll = true) {
        if (msg.id && displayedMessageIds.has(msg.id)) return;
        if (msg.id) {
            displayedMessageIds.add(msg.id);
            if (msg.sender === 'customer') {
                const temps = messagesEl.querySelectorAll('[data-temp-id]');
                for (const t of temps) {
                    const body = t.firstChild ? t.firstChild.textContent : '';
                    if (body === msg.message || body.trim() === String(msg.message).trim()) {
                        t.removeAttribute('data-temp-id');
                        t.setAttribute('data-id', msg.id);
                        return;
                    }
                }
            }
        }

        const div = document.createElement('div');
        div.className = 'chat-msg ' + (msg.sender || 'admin');
        if (msg.tempId) div.setAttribute('data-temp-id', msg.tempId);

        div.innerHTML = `${msg.message}<div class="chat-msg-time">${fmtTime(msg.created_at || new Date())}</div>`;
        messagesEl.appendChild(div);
        if (scroll) messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function updateBadge() {
        if (unreadCount > 0 && !isOpen) {
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.classList.add('show');
        } else {
            badge.classList.remove('show');
        }
    }

    // ── Reset Chat (Ends session and closes window cleanly) ────────────
    function resetChat() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
        sessionId = null;
        lastMsgTime = '1970-01-01';
        isFetching = false;
        unreadCount = 0;
        displayedMessageIds.clear();
        localStorage.removeItem('cpt_chat_session_id');
        localStorage.removeItem('cpt_chat_last_time');
        localStorage.removeItem('cpt_chat_session');

        messagesEl.innerHTML = '';
        inputEl.disabled = false;
        sendBtn.disabled = false;
        updateBadge();

        // Close window cleanly — DO NOT show the name box while closed
        namePrompt.style.display = 'none';
        closeChat();
    }

    // ── Poll for new messages ──────────────────────────────────────────
    async function pollMessages() {
        if (!sessionId || isFetching) return;
        isFetching = true;
        try {
            const r = await fetch(`/api/chat/${sessionId}?since=${encodeURIComponent(lastMsgTime)}`);
            if (!r.ok) { isFetching = false; return; }
            const data = await r.json();

            if (data.status === 'closed') {
                resetChat();
                return;
            }

            data.messages.forEach(m => {
                const isNew = !m.id || !displayedMessageIds.has(m.id);
                appendMsg(m);
                lastMsgTime = m.created_at;
                if (isNew && m.sender === 'admin' && !isOpen) {
                    unreadCount++;
                }
            });

            if (data.messages.length) {
                localStorage.setItem('cpt_chat_last_time', lastMsgTime);
                updateBadge();
            }
        } catch (_) {
        } finally {
            isFetching = false;
        }
    }

    // ── Start Polling ──────────────────────────────────────────────────
    function startPolling() {
        if (pollInterval) return;
        pollInterval = setInterval(pollMessages, 3500);
    }

    // ── Start session ──────────────────────────────────────────────────
    async function startSession(name) {
        const key = getSessionKey();
        try {
            const r = await fetch('/api/chat/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionKey: key, guestName: name })
            });
            const data = await r.json();
            sessionId = data.sessionId;
            localStorage.setItem('cpt_chat_session_id', sessionId);
            namePrompt.style.display = 'none';

            await pollMessages();
            startPolling();
        } catch (_) { }
    }

    // ── Open / close chat ──────────────────────────────────────────────
    async function openChat() {
        isOpen = true;
        win.classList.add('open');
        bubble.classList.add('open');
        unreadCount = 0;
        updateBadge();

        if (!sessionId) {
            // Check if user is logged in: automatically use their name and skip name box!
            const loggedInName = await getAuthenticatedUser();
            if (loggedInName) {
                namePrompt.style.display = 'none';
                await startSession(loggedInName);
            } else {
                namePrompt.style.display = 'flex';
                setTimeout(() => { if (nameInput) nameInput.focus(); }, 150);
            }
        } else {
            namePrompt.style.display = 'none';
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function closeChat() {
        isOpen = false;
        win.classList.remove('open');
        bubble.classList.remove('open');
    }

    bubble.addEventListener('click', () => isOpen ? closeChat() : openChat());
    minimizeBtn.addEventListener('click', closeChat);

    // ── Customer End Chat Actions ──────────────────────────────────────
    endChatBtn.addEventListener('click', () => {
        if (!sessionId) {
            closeChat();
            return;
        }
        custConfirm.classList.add('show');
    });

    confNoBtn.addEventListener('click', () => {
        custConfirm.classList.remove('show');
    });

    confYesBtn.addEventListener('click', async () => {
        custConfirm.classList.remove('show');
        if (sessionId) {
            try {
                await fetch(`/api/chat/${sessionId}/close`, { method: 'PUT' });
            } catch (_) { }
        }
        resetChat();
    });

    // ── Name Submit ────────────────────────────────────────────────────
    startBtn.addEventListener('click', () => {
        const name = nameInput.value.trim() || 'Guest';
        startSession(name);
    });
    nameInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); startBtn.click(); }
    });

    // ── Send message ───────────────────────────────────────────────────
    async function sendMessage() {
        const msg = inputEl.value.trim();
        if (!msg || !sessionId) return;
        inputEl.value = '';
        inputEl.style.height = 'auto';
        sendBtn.disabled = true;

        const tempId = 'temp_' + Date.now();
        appendMsg({ sender: 'customer', message: msg, created_at: new Date().toISOString(), tempId });

        try {
            const r = await fetch(`/api/chat/${sessionId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });

            if (r.status === 400) {
                resetChat();
                return;
            }
        } catch (_) { }

        sendBtn.disabled = false;
        inputEl.focus();
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + 'px';
    });

    // Resume existing session if saved in localStorage
    if (sessionId) {
        namePrompt.style.display = 'none';
        isFetching = true;
        fetch(`/api/chat/${sessionId}`)
            .then(r => r.json())
            .then(data => {
                if (data.status === 'closed') {
                    resetChat();
                    return;
                }
                data.messages?.forEach(m => {
                    appendMsg(m, false);
                    lastMsgTime = m.created_at;
                });
                messagesEl.scrollTop = messagesEl.scrollHeight;
                localStorage.setItem('cpt_chat_last_time', lastMsgTime);
                isFetching = false;
                startPolling();
            }).catch(() => {
                isFetching = false;
            });
    }

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && sessionId) startPolling();
    });
})();
