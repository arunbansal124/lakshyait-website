// assets/admin.js — WITH EMAILJS
// ============================================
// REPLACE THESE WITH YOUR EMAILJS CREDENTIALS:
const EMAILJS_SERVICE_ID = 'service_8f84qzq';   // ← Your Service ID
const EMAILJS_TEMPLATE_ID = 'template_66291yz'; // ← Your Template ID  
const EMAILJS_PUBLIC_KEY = 'C_leSmLd5LfK9T_wp';    // ← Your Public Key
// ============================================

const ADMIN_PASSWORD = 'lakshya@1204';
let isAdmin = false;
let isEditMode = false;
let messages = JSON.parse(localStorage.getItem('lakshya_messages')) || [];

function isContactPage() {
    const path = window.location.pathname.toLowerCase();
    return path.includes('contact') || path.endsWith('/contact') || path.includes('contact.html');
}

function loadEmailJS() {
    if (document.querySelector('script[src*="emailjs"]')) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
        script.onload = () => { emailjs.init(EMAILJS_PUBLIC_KEY); resolve(); };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const footer = document.querySelector('footer .copyright');
    if (footer) {
        footer.insertAdjacentHTML('beforeend', `
            <a id="admin-link" href="#" style="margin-left:15px;font-size:0.8rem;color:var(--accent);text-decoration:underline;">Admin</a>
            <span id="edit-page-btn" style="display:none;margin-left:15px;font-size:0.8rem;color:#fbbf24;cursor:pointer;text-decoration:underline;">Edit Page</span>
            <span id="logout-btn" style="display:none;margin-left:15px;font-size:0.8rem;color:#ff6b6b;cursor:pointer;text-decoration:underline;">Logout</span>
        `);
        document.getElementById('admin-link').onclick = e => { e.preventDefault(); enterAdmin(); };
        document.getElementById('edit-page-btn').onclick = toggleEdit;
        document.getElementById('logout-btn').onclick = exitAdmin;
    }

    if (sessionStorage.getItem('lakshya_admin') === 'true') {
        isAdmin = true;
        document.body.classList.add('admin-mode');
        showControls();
        loadEdits();
        if (isContactPage()) loadEmailJS().then(() => initContactAdmin());
    }
});

function enterAdmin() {
    const pass = prompt('Admin Password:');
    if (pass === ADMIN_PASSWORD) {
        isAdmin = true;
        sessionStorage.setItem('lakshya_admin', 'true');
        document.body.classList.add('admin-mode');
        showControls();
        loadEdits();
        if (isContactPage()) loadEmailJS().then(() => initContactAdmin());
        alert('Admin Mode ON');
    } else {
        alert('Wrong password');
    }
}

function exitAdmin() {
    sessionStorage.removeItem('lakshya_admin');
    isAdmin = false;
    isEditMode = false;
    document.body.classList.remove('admin-mode', 'edit-mode');
    location.reload();
}

function showControls() {
    const editBtn = document.getElementById('edit-page-btn');
    const logoutBtn = document.getElementById('logout-btn');
    if (editBtn) editBtn.style.display = 'inline';
    if (logoutBtn) logoutBtn.style.display = 'inline';
}

function toggleEdit() {
    isEditMode = !isEditMode;
    document.body.classList.toggle('edit-mode', isEditMode);
    isEditMode ? enableEdit() : disableEdit();
}

function enableEdit() {
    document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,a,li,div,td,th').forEach(el => {
        if (!el.dataset.key && el.innerText.trim() !== '') {
            el.contentEditable = true;
            el.style.outline = '2px dashed #00e5ff';
            el.style.borderRadius = '4px';
            el.style.padding = '2px';
            el.dataset.key = `text_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            el.addEventListener('blur', () => save(el, 'text'));
        }
    });
    document.querySelectorAll('img').forEach(img => {
        if (!img.dataset.key) {
            img.style.cursor = 'pointer';
            img.title = 'Click to change image';
            img.dataset.key = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            img.onclick = () => {
                const url = prompt('New Image URL:', img.src);
                if (url && url.trim()) { img.src = url.trim(); save(img, 'img'); }
            };
        }
    });
}

function disableEdit() {
    document.querySelectorAll('[contentEditable]').forEach(el => {
        el.contentEditable = false;
        el.style.outline = '';
        el.style.borderRadius = '';
        el.style.padding = '';
    });
    document.querySelectorAll('img').forEach(img => { img.style.cursor = ''; img.title = ''; });
}

function save(el, type) {
    const key = el.dataset.key;
    const data = JSON.parse(localStorage.getItem(`lakshya_${type}`)) || {};
    data[key] = type === 'text' ? el.innerHTML : el.src;
    localStorage.setItem(`lakshya_${type}`, JSON.stringify(data));
}

function loadEdits() {
    ['text', 'img'].forEach(type => {
        const data = JSON.parse(localStorage.getItem(`lakshya_${type}`)) || {};
        Object.keys(data).forEach(k => {
            const el = document.querySelector(`[data-key="${k}"]`);
            if (el) { if (type === 'text') el.innerHTML = data[k]; else el.src = data[k]; }
        });
    });
}

function initContactAdmin() {
    const container = document.querySelector('.section.container');
    if (!container || document.querySelector('.admin-contact-tabs')) return;

    const contactForm = document.getElementById('contact-form');
    if (contactForm) contactForm.style.display = 'none';

    container.insertAdjacentHTML('afterbegin', `
        <div class="admin-contact-tabs">
            <button id="inbox-tab" class="tab-active" onclick="showInbox()">Inbox (${messages.length})</button>
            <button id="compose-tab" onclick="showCompose()">Compose</button>
        </div>
        <div id="admin-contact-content"></div>
    `);
    showInbox();
}

window.showInbox = function() { setActiveTab('inbox-tab'); renderContact('inbox'); };
window.showCompose = function() { setActiveTab('compose-tab'); renderContact('compose'); };

function setActiveTab(activeId) {
    document.querySelectorAll('.admin-contact-tabs button').forEach(btn => btn.classList.remove('tab-active'));
    const activeBtn = document.getElementById(activeId);
    if (activeBtn) activeBtn.classList.add('tab-active');
}

function renderContact(mode) {
    const el = document.getElementById('admin-contact-content');
    if (!el) return;

    if (mode === 'inbox') {
        if (messages.length === 0) {
            el.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted);">No messages yet.</p>';
        } else {
            el.innerHTML = messages.map((m, i) => `
                <div class="message-card ${m.replied ? 'replied' : ''}">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                        <h4 style="margin:0;color:#fff;">${m.name}</h4>
                        <small style="color:var(--text-muted);">${m.time}</small>
                    </div>
                    <small style="color:var(--accent);">${m.email}</small>
                    ${m.company && m.company !== '—' ? `<small style="margin-left:1rem;color:var(--text-muted);">${m.company}</small>` : ''}
                    <p style="margin:1rem 0;color:var(--text);">${m.message}</p>
                    <button class="reply-btn" onclick="replyMessage(${i})">Reply</button>
                    <button class="reply-btn" style="background:#ff6b6b;margin-left:0.5rem;" onclick="deleteMessage(${i})">Delete</button>
                </div>
            `).join('');
        }
    } else {
        el.innerHTML = `
            <div class="compose-box">
                <input id="reply-to" placeholder="To (email)" />
                <input id="reply-sub" placeholder="Subject" />
                <textarea id="reply-body" rows="6" placeholder="Your message..."></textarea>
                <button id="send-email-btn" onclick="sendEmail()">Send Email</button>
                <p id="send-status" style="text-align:center;margin-top:1rem;"></p>
            </div>
        `;
    }
}

window.sendEmail = async function() {
    const toEmail = document.getElementById('reply-to').value.trim();
    const subject = document.getElementById('reply-sub').value.trim();
    const message = document.getElementById('reply-body').value.trim();
    const statusEl = document.getElementById('send-status');
    const sendBtn = document.getElementById('send-email-btn');

    if (!toEmail || !subject || !message) {
        statusEl.style.color = '#ff6b6b';
        statusEl.textContent = 'Please fill in all fields.';
        return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    statusEl.style.color = 'var(--text-muted)';
    statusEl.textContent = 'Sending email...';

    try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, { to_email: toEmail, subject: subject, message: message });
        statusEl.style.color = '#4ade80';
        statusEl.textContent = 'Email sent successfully!';
        sendBtn.textContent = 'Sent ✓';

        const originalIndex = messages.findIndex(m => m.email === toEmail);
        if (originalIndex !== -1) {
            messages[originalIndex].replied = true;
            localStorage.setItem('lakshya_messages', JSON.stringify(messages));
        }

        setTimeout(() => {
            document.getElementById('reply-to').value = '';
            document.getElementById('reply-sub').value = '';
            document.getElementById('reply-body').value = '';
            sendBtn.disabled = false;
            sendBtn.textContent = 'Send Email';
            statusEl.textContent = '';
        }, 2000);
    } catch (error) {
        console.error('EmailJS Error:', error);
        statusEl.style.color = '#ff6b6b';
        statusEl.textContent = 'Failed to send. Check console for details.';
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send Email';
    }
};

window.deleteMessage = function(i) {
    if (confirm('Delete this message?')) {
        messages.splice(i, 1);
        localStorage.setItem('lakshya_messages', JSON.stringify(messages));
        const inboxTab = document.getElementById('inbox-tab');
        if (inboxTab) inboxTab.textContent = `Inbox (${messages.length})`;
        showInbox();
    }
};

window.replyMessage = function(i) {
    showCompose();
    setTimeout(() => {
        const msg = messages[i];
        document.getElementById('reply-to').value = msg.email;
        document.getElementById('reply-sub').value = 'Re: Your Message to LakshyaIT';
        document.getElementById('reply-body').value = `Hi ${msg.name},\n\n\n\n---\nYour original message:\n${msg.message}`;
    }, 100);
};

document.addEventListener('DOMContentLoaded', () => {
    if (isContactPage()) {
        const form = document.getElementById('contact-form');
        if (form) {
            form.onsubmit = e => {
                e.preventDefault();
                messages.push({
                    name: form.name.value,
                    email: form.email.value,
                    company: form.company.value || '—',
                    message: form.message.value,
                    time: new Date().toLocaleString(),
                    replied: false
                });
                localStorage.setItem('lakshya_messages', JSON.stringify(messages));
                alert('Message sent! We\'ll get back to you soon.');
                form.reset();
                if (isAdmin) {
                    showInbox();
                    const inboxTab = document.getElementById('inbox-tab');
                    if (inboxTab) inboxTab.textContent = `Inbox (${messages.length})`;
                }
            };
        }
    }
});