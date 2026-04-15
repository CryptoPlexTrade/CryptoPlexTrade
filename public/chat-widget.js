/**
 * chat-widget.js
 * Floating live-chat bubble for all customer-facing pages.
 * No dependencies — pure vanilla JS + injected CSS.
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

    // ── Inject styles ──────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        /* ── Bubble ───────────────────────────────────── */
        #cpt-chat-bubble {
            position: fixed;
            bottom: 28px; right: 28px;
            z-index: 9998;
            width: 58px; height: 58px;
            border-radius: 50%;
            background: linear-gradient(135deg, #005baa, #00a9e0);
            box-shadow: 0 6px 24px rgba(0,91,170,0.38);
            cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: transform .25s cubic-bezier(.34,1.56,.64,1), box-shadow .25s;
            border: none; outline: none;
        }
        #cpt-chat-bubble:hover { transform: scale(1.10); box-shadow: 0 10px 32px rgba(0,91,170,.5); }
        #cpt-chat-bubble svg { width: 26px; height: 26px; color: #fff; transition: opacity .2s; }
        #cpt-chat-bubble .bubble-close { display: none; }
        #cpt-chat-bubble.open .bubble-chat  { display: none; }
        #cpt-chat-bubble.open .bubble-close { display: block; }

        /* Unread badge */
        #cpt-chat-badge {
            position: absolute; top: 0; right: 0;
            background: #ef4444; color: #fff;
            font-family: 'Poppins', system-ui, sans-serif;
            font-size: .65rem; font-weight: 700;
            width: 19px; height: 19px; border-radius: 50%;
            display: none; align-items: center; justify-content: center;
            border: 2px solid #fff;
        }
        #cpt-chat-badge.show { display: flex; animation: badge-pop .3s cubic-bezier(.34,1.56,.64,1); }
        @keyframes badge-pop { from { transform: scale(0); } to { transform: scale(1); } }

        /* ── Chat window ──────────────────────────────── */
        #cpt-chat-window {
            position: fixed;
            bottom: 100px; right: 28px;
            z-index: 9997;
            width: 360px; max-width: calc(100vw - 32px);
            height: 500px; max-height: calc(100vh - 130px);
            background: #fff;
            border-radius: 20px;
            box-shadow: 0 16px 64px rgba(0,0,0,.18), 0 0 0 1px rgba(0,91,170,.08);
            display: flex; flex-direction: column;
            overflow: hidden;
            transform: scale(.85) translateY(20px);
            opacity: 0;
            pointer-events: none;
            transition: transform .3s cubic-bezier(.34,1.56,.64,1), opacity .25s ease;
        }
        #cpt-chat-window.open { transform: scale(1) translateY(0); opacity: 1; pointer-events: all; }

        /* Header */
        #cpt-chat-header {
            background: linear-gradient(135deg, #005baa, #00a9e0);
            padding: 16px 18px;
            display: flex; align-items: center; gap: 12px;
            flex-shrink: 0;
        }
        .chat-header-avatar {
            width: 40px; height: 40px; border-radius: 50%;
            background: rgba(255,255,255,.2);
            display: flex; align-items: center; justify-content: center;
            flex-shrink: 0;
        }
        .chat-header-avatar svg { width: 22px; height: 22px; color: #fff; }
        .chat-header-info { flex: 1; min-width: 0; }
        .chat-header-title { font-family: 'Poppins',system-ui,sans-serif; font-size: .88rem; font-weight: 700; color: #fff; }
        .chat-header-sub   { font-family: 'Poppins',system-ui,sans-serif; font-size: .72rem; color: rgba(255,255,255,.8); margin-top: 1px; }
        .chat-online-dot   { width: 8px; height: 8px; border-radius: 50%; background: #4ade80; display: inline-block; margin-right: 5px; animation: online-blink 2s ease-in-out infinite; }
        @keyframes online-blink { 0%,100%{opacity:1;} 50%{opacity:.4;} }

        /* Header action buttons */
        .chat-header-actions { display: flex; gap: 6px; flex-shrink: 0; }
        .chat-hdr-btn {
            width: 32px; height: 32px; border-radius: 8px;
            border: none; cursor: pointer; display: flex;
            align-items: center; justify-content: center;
            transition: all .2s; background: rgba(255,255,255,.15);
        }
        .chat-hdr-btn:hover { background: rgba(255,255,255,.3); }
        .chat-hdr-btn svg { width: 16px; height: 16px; color: #fff; }
        .chat-hdr-btn.end-btn:hover { background: rgba(239,68,68,.7); }

        /* Customer confirmation overlay */
        #cpt-cust-confirm {
            position: absolute; inset: 0; z-index: 20;
            background: rgba(15,23,42,.5); backdrop-filter: blur(4px);
            display: none; flex-direction: column;
            align-items: center; justify-content: center;
            padding: 28px; gap: 14px;
        }
        #cpt-cust-confirm.show { display: flex; }
        .cust-conf-card {
            background: #fff; border-radius: 20px; padding: 28px;
            text-align: center; width: 100%; max-width: 300px;
            box-shadow: 0 12px 40px rgba(0,0,0,.15);
            animation: msg-in .25s ease;
        }
        .cust-conf-icon {
            width: 52px; height: 52px; background: #fff1f2; border-radius: 16px;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 16px; color: #e11d48;
        }
        .cust-conf-icon svg { width: 26px; height: 26px; }
        .cust-conf-card h4 { font-family:'Poppins',system-ui,sans-serif; font-size:1rem; font-weight:700; color:#1e293b; margin:0 0 8px; }
        .cust-conf-card p  { font-family:'Poppins',system-ui,sans-serif; font-size:.82rem; color:#64748b; margin:0 0 20px; line-height:1.5; }
        .cust-conf-btns { display:flex; gap:10px; }
        .cust-conf-btn {
            flex:1; padding:10px; border-radius:12px; border:none;
            font-family:'Poppins',system-ui,sans-serif; font-size:.84rem;
            font-weight:600; cursor:pointer; transition:all .2s;
        }
        .cust-conf-cancel { background:#f1f5f9; color:#64748b; }
        .cust-conf-cancel:hover { background:#e2e8f0; color:#1e293b; }
        .cust-conf-end { background:#e11d48; color:#fff; box-shadow:0 4px 12px rgba(225,29,72,.25); }
        .cust-conf-end:hover { background:#be123c; transform:translateY(-1px); }

        /* Messages area */
        #cpt-chat-messages {
            flex: 1; overflow-y: auto; padding: 16px;
            display: flex; flex-direction: column; gap: 10px;
            scroll-behavior: smooth;
        }
        #cpt-chat-messages::-webkit-scrollbar { width: 4px; }
        #cpt-chat-messages::-webkit-scrollbar-track { background: transparent; }
        #cpt-chat-messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }

        .chat-msg {
            max-width: 80%; padding: 10px 14px; border-radius: 16px;
            font-family: 'Poppins',system-ui,sans-serif; font-size: .82rem; line-height: 1.5;
            word-break: break-word; animation: msg-in .2s ease;
        }
        @keyframes msg-in { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .chat-msg.admin {
            background: #f1f5f9; color: #1e293b;
            border-bottom-left-radius: 4px; align-self: flex-start;
        }
        .chat-msg.customer {
            background: linear-gradient(135deg, #005baa, #00a9e0); color: #fff;
            border-bottom-right-radius: 4px; align-self: flex-end;
        }
        .chat-msg-time {
            font-size: .62rem; opacity: .55; margin-top: 4px;
            font-family: 'Poppins',system-ui,sans-serif;
        }
        .chat-msg.admin .chat-msg-time { text-align: left; }
        .chat-msg.customer .chat-msg-time { text-align: right; }

        /* Typing indicator */
        .chat-typing { display: flex; gap: 4px; padding: 8px 12px; align-self: flex-start; }
        .chat-typing span { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; animation: typing-dot 1.2s infinite; }
        .chat-typing span:nth-child(2) { animation-delay: .2s; }
        .chat-typing span:nth-child(3) { animation-delay: .4s; }
        @keyframes typing-dot { 0%,60%,100%{transform:translateY(0);opacity:.4;} 30%{transform:translateY(-5px);opacity:1;} }

        /* Closed banner */
        #cpt-chat-closed-banner {
            display: none; background: #fef2f2; border-top: 1px solid #fecaca;
            padding: 10px 14px; font-family: 'Poppins',system-ui,sans-serif;
            font-size: .8rem; color: #dc2626; text-align: center;
        }

        /* Input area */
        #cpt-chat-input-wrap {
            padding: 12px 14px; border-top: 1px solid #f1f5f9;
            display: flex; gap: 8px; align-items: flex-end; flex-shrink: 0;
            background: #fff;
        }
        #cpt-chat-input {
            flex: 1; border: 1.5px solid #e2e8f0; border-radius: 12px;
            padding: 10px 13px; font-family: 'Poppins',system-ui,sans-serif; font-size: .84rem;
            outline: none; resize: none; max-height: 100px; min-height: 40px;
            transition: border-color .2s; color: #1e293b; background: #fafcff;
            line-height: 1.4;
        }
        #cpt-chat-input:focus { border-color: #005baa; }
        #cpt-chat-input::placeholder { color: #94a3b8; }
        #cpt-chat-send {
            width: 40px; height: 40px; flex-shrink: 0;
            background: linear-gradient(135deg, #005baa, #00a9e0);
            border: none; border-radius: 12px; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            transition: transform .2s, opacity .2s;
        }
        #cpt-chat-send:hover { transform: scale(1.08); }
        #cpt-chat-send:disabled { opacity: .45; cursor: not-allowed; transform: none; }
        #cpt-chat-send svg { width: 18px; height: 18px; color: #fff; }

        /* Name prompt overlay */
        #cpt-name-prompt {
            position: absolute; inset: 0;
            background: rgba(255,255,255,.96);
            backdrop-filter: blur(4px);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            gap: 14px; padding: 28px; z-index: 10;
        }
        #cpt-name-prompt h3 { font-family:'Poppins',system-ui,sans-serif; font-size:1rem; font-weight:700; color:#1e293b; margin:0; text-align:center; }
        #cpt-name-prompt p  { font-family:'Poppins',system-ui,sans-serif; font-size:.8rem; color:#64748b; margin:0; text-align:center; }
        #cpt-name-input {
            width:100%; padding:11px 14px; border:1.5px solid #e2e8f0; border-radius:10px;
            font-family:'Poppins',system-ui,sans-serif; font-size:.88rem; outline:none;
            transition:border-color.2s;
        }
        #cpt-name-input:focus { border-color:#005baa; }
        #cpt-start-chat {
            width:100%; padding:12px; background:linear-gradient(135deg,#005baa,#00a9e0);
            border:none; border-radius:10px; color:#fff; font-family:'Poppins',system-ui,sans-serif;
            font-size:.88rem; font-weight:600; cursor:pointer; transition:transform.2s;
        }
        #cpt-start-chat:hover { transform:translateY(-1px); }
    `;
    document.head.appendChild(style);

    // ── Build DOM ──────────────────────────────────────────────────────
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
            <div class="chat-header-avatar">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M18.685 19.097A9.723 9.723 0 0 0 21.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 0 0 3.065 7.097A9.716 9.716 0 0 0 12 21.75a9.716 9.716 0 0 0 6.685-2.653Zm-12.54-1.285A7.486 7.486 0 0 1 12 15a7.486 7.486 0 0 1 5.855 2.812A8.224 8.224 0 0 1 12 20.25a8.224 8.224 0 0 1-5.855-2.438ZM15.75 9a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" clip-rule="evenodd"/>
                </svg>
            </div>
            <div class="chat-header-info">
                <div class="chat-header-title">CryptoPlexTrade Support</div>
                <div class="chat-header-sub"><span class="chat-online-dot"></span>We're online — typically reply in minutes</div>
            </div>
            <div class="chat-header-actions">
                <button class="chat-hdr-btn" id="cpt-minimize-btn" aria-label="Minimize chat" title="Minimize">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3"/></svg>
                </button>
                <button class="chat-hdr-btn end-btn" id="cpt-endchat-btn" aria-label="End chat" title="End chat">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                </button>
            </div>
        </div>

        <!-- Customer end-chat confirmation -->
        <div id="cpt-cust-confirm">
            <div class="cust-conf-card">
                <div class="cust-conf-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>
                </div>
                <h4>End this chat?</h4>
                <p>Your conversation history will be cleared and you'll need to start a new session to reach us again.</p>
                <div class="cust-conf-btns">
                    <button class="cust-conf-btn cust-conf-cancel" id="cpt-conf-no">Cancel</button>
                    <button class="cust-conf-btn cust-conf-end" id="cpt-conf-yes">End Chat</button>
                </div>
            </div>
        </div>

        <div id="cpt-name-prompt">
            <div class="chat-header-avatar" style="width:56px;height:56px;background:linear-gradient(135deg,#005baa,#00a9e0);">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style="width:28px;height:28px;color:#fff;">
                    <path fill-rule="evenodd" d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223Z" clip-rule="evenodd"/>
                </svg>
            </div>
            <h3>Start a conversation</h3>
            <p>Enter your name so our team knows who they're chatting with.</p>
            <input id="cpt-name-input" type="text" placeholder="Your name" maxlength="60">
            <button id="cpt-start-chat">Start Chat →</button>
        </div>

        <div id="cpt-chat-messages"></div>
        <div id="cpt-chat-closed-banner">This chat session has been closed by the support team.</div>
        <div id="cpt-chat-input-wrap">
            <textarea id="cpt-chat-input" placeholder="Type your message…" rows="1" maxlength="2000"></textarea>
            <button id="cpt-chat-send" aria-label="Send message">
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

    const badge        = document.getElementById('cpt-chat-badge');
    const namePrompt   = document.getElementById('cpt-name-prompt');
    const nameInput    = document.getElementById('cpt-name-input');
    const startBtn     = document.getElementById('cpt-start-chat');
    const messagesEl   = document.getElementById('cpt-chat-messages');
    const closedBanner = document.getElementById('cpt-chat-closed-banner');
    const inputEl      = document.getElementById('cpt-chat-input');
    const sendBtn      = document.getElementById('cpt-chat-send');
    const minimizeBtn  = document.getElementById('cpt-minimize-btn');
    const endChatBtn   = document.getElementById('cpt-endchat-btn');
    const custConfirm  = document.getElementById('cpt-cust-confirm');
    const confNoBtn    = document.getElementById('cpt-conf-no');
    const confYesBtn   = document.getElementById('cpt-conf-yes');

    function fmtTime(iso) {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function appendMsg(msg, scroll = true) {
        // Prevent duplicates if ID exists
        if (msg.id && displayedMessageIds.has(msg.id)) return;
        if (msg.id) {
            displayedMessageIds.add(msg.id);
            // If this is a real message from customer, remove its corresponding optimistic (temp) version
            if (msg.sender === 'customer') {
                const temps = messagesEl.querySelectorAll('[data-temp-id]');
                for (const t of temps) {
                    // Match by content (since we don't have a correlation ID)
                    if (t.innerText.includes(msg.message)) {
                        t.remove();
                    }
                }
            }
        }

        const div = document.createElement('div');
        div.className = 'chat-msg ' + msg.sender;
        if (msg.tempId) div.setAttribute('data-temp-id', msg.tempId);
        
        div.innerHTML = `${msg.message}<div class="chat-msg-time">${fmtTime(msg.created_at)}</div>`;
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
        localStorage.removeItem('cpt_chat_session'); // Clear session key so a fresh one is generated
        
        // Reset UI
        messagesEl.innerHTML = '';
        closedBanner.style.display = 'none';
        inputEl.disabled = false;
        sendBtn.disabled = false;
        updateBadge();
        
        if (isOpen) {
            namePrompt.style.display = 'flex';
        }
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
                // Only count genuinely new messages toward unread badge
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

    // ── Open / close ───────────────────────────────────────────────────
    function openChat() {
        isOpen = true;
        win.classList.add('open');
        bubble.classList.add('open');
        unreadCount = 0;
        updateBadge();
        messagesEl.scrollTop = messagesEl.scrollHeight;

        // Show name prompt only if no session
        if (!sessionId) {
            namePrompt.style.display = 'flex';
        } else {
            namePrompt.style.display = 'none';
        }
    }

    function closeChat() {
        isOpen = false;
        win.classList.remove('open');
        bubble.classList.remove('open');
    }

    bubble.addEventListener('click', () => isOpen ? closeChat() : openChat());

    // ── Minimize button ───────────────────────────────────────────────
    minimizeBtn.addEventListener('click', closeChat);

    // ── End chat button (customer) ────────────────────────────────────
    endChatBtn.addEventListener('click', () => {
        if (!sessionId) return;
        custConfirm.classList.add('show');
    });

    confNoBtn.addEventListener('click', () => {
        custConfirm.classList.remove('show');
    });

    confYesBtn.addEventListener('click', async () => {
        custConfirm.classList.remove('show');
        if (!sessionId) return;
        try {
            await fetch(`/api/chat/${sessionId}/close`, { method: 'PUT' });
        } catch (_) {}
        resetChat();
    });

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

            // Load initial greeting
            await pollMessages();
            startPolling();
        } catch (_) {}
    }

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
        // Optimistic render
        appendMsg({ sender: 'customer', message: msg, created_at: new Date().toISOString(), tempId });

        try {
            const r = await fetch(`/api/chat/${sessionId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msg })
            });
            
            // Session was closed by admin — reset to fresh chat
            if (r.status === 400) {
                resetChat();
                return;
            }
        } catch (_) {}

        sendBtn.disabled = false;
        inputEl.focus();
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });

    // Auto-resize textarea
    inputEl.addEventListener('input', () => {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
    });

    // ── Polling ────────────────────────────────────────────────────────
    function startPolling() {
        if (pollInterval) return;
        pollInterval = setInterval(pollMessages, 4000);
    }

    // Resume if session already exists
    if (sessionId) {
        namePrompt.style.display = 'none';
        isFetching = true; // Use the same lock
        // Load history on first open
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
