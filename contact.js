// contact.js - Contact Page Functionality

const SUPA_URL = 'https://rbmrbiubrprutrvwfqea.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJibXJiaXVicnBydXRydndmcWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MzExNzIsImV4cCI6MjA4MTIwNzE3Mn0.rd8BQRlxySgAYuhGRusv4cGkYAzMz1ESThpCxaH0DQ4';

let contactDb = null;
let messages = [];

// Completely self-contained Supabase init - no dependency on script.js
async function initContactDb() {
    if (contactDb) return;

    // Reuse existing client if script.js already made one
    if (window._supabaseClient) {
        contactDb = window._supabaseClient;
        return;
    }

    // Wait for supabase lib to be available (script.js loads it dynamically)
    await new Promise((resolve) => {
        if (window.supabase && window.supabase.createClient) { resolve(); return; }
        const check = setInterval(() => {
            if (window.supabase && window.supabase.createClient) {
                clearInterval(check);
                resolve();
            }
        }, 50);
        // Timeout after 5s - load it ourselves
        setTimeout(() => {
            clearInterval(check);
            resolve();
        }, 5000);
    });

    if (window.supabase && window.supabase.createClient) {
        contactDb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
        window._supabaseClient = contactDb;
    } else {
        // Load the library ourselves as a fallback
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.3/dist/umd/supabase.js';
            s.onload = () => {
                contactDb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
                window._supabaseClient = contactDb;
                resolve();
            };
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await initContactDb();

    const isAdminMode = sessionStorage.getItem('blog_admin') === 'true';
    const onContactPage  = !!document.getElementById('contact-form');
    const onMessagesPage = !!document.getElementById('inbox-content') && !onContactPage;

    if (onMessagesPage) {
        await loadMessages();
        showInbox();
        return;
    }

    if (onContactPage) {
        if (isAdminMode) {
            document.body.classList.add('admin-mode');
            document.getElementById('admin-inbox').style.display = 'block';
            await loadMessages();
            showInbox();
        }
        setupContactForm();
    }
});

function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const btn = form.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

        const formData = {
            name:    form.querySelector('#name').value.trim(),
            email:   form.querySelector('#email').value.trim(),
            company: form.querySelector('#company') ? form.querySelector('#company').value.trim() || null : null,
            message: form.querySelector('#message').value.trim(),
            replied: false
        };

        console.log('Submitting message:', formData);
        console.log('Using DB:', contactDb);

        try {
            if (!contactDb) throw new Error('Database not initialised');

            const { data, error } = await contactDb
                .from('contact_messages')
                .insert([formData])
                .select();

            console.log('Insert result — data:', data, 'error:', error);

            if (error) throw error;

            alert('✅ Message sent successfully! We\'ll get back to you soon.');
            form.reset();
        } catch (err) {
            console.error('Full error object:', err);
            alert('❌ Failed to send message.\n\nError: ' + (err.message || JSON.stringify(err)));
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message'; }
        }
    });
}

async function loadMessages() {
    try {
        if (!contactDb) await initContactDb();
        const { data, error } = await contactDb
            .from('contact_messages')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        messages = data || [];
        updateInboxCount();
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

function updateInboxCount() {
    const el = document.getElementById('inbox-count');
    if (el) el.textContent = messages.length;
}

window.showInbox = function () {
    document.querySelectorAll('.admin-tabs button').forEach((btn, i) => {
        btn.classList.toggle('active', i === 0);
    });

    const container = document.getElementById('inbox-content');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fas fa-inbox" style="font-size:3rem;margin-bottom:1rem;opacity:0.5;display:block;"></i>
                <p>No messages yet.</p>
            </div>`;
        return;
    }

    container.innerHTML = messages.map(msg => `
        <div class="message-card ${msg.replied ? 'replied' : ''}">
            <div class="message-header">
                <div>
                    <h4>${msg.name}</h4>
                    <p class="message-time">${formatDate(msg.created_at)}</p>
                </div>
            </div>
            <p class="message-email">
                <i class="fas fa-envelope"></i> ${msg.email}
                ${msg.company ? ` • ${msg.company}` : ''}
            </p>
            <p class="message-body">${msg.message}</p>
            <div class="message-actions">
                <button class="btn-reply" onclick="replyToMessage(${msg.id}, '${msg.email.replace(/'/g, "\\'")}', '${msg.name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-reply"></i> Reply
                </button>
                <button class="btn-delete" onclick="deleteMessage(${msg.id})">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>`).join('');
};

window.showCompose = function () {
    document.querySelectorAll('.admin-tabs button').forEach((btn, i) => {
        btn.classList.toggle('active', i === 1);
    });

    const container = document.getElementById('inbox-content');
    if (!container) return;

    container.innerHTML = `
        <div style="background:var(--surface);padding:2rem;border-radius:var(--radius-lg);border:1px solid var(--border);">
            <div class="form-group">
                <label>To (Email)</label>
                <input type="email" id="reply-to" placeholder="recipient@example.com" style="width:100%;padding:1rem;background:var(--bg);border:2px solid var(--border);border-radius:var(--radius-md);color:var(--text);font-family:inherit;">
            </div>
            <div class="form-group" style="margin-top:1rem;">
                <label>Subject</label>
                <input type="text" id="reply-subject" placeholder="Re: Your message" style="width:100%;padding:1rem;background:var(--bg);border:2px solid var(--border);border-radius:var(--radius-md);color:var(--text);font-family:inherit;">
            </div>
            <div class="form-group" style="margin-top:1rem;">
                <label>Message</label>
                <textarea id="reply-body" rows="8" placeholder="Write your reply..." style="width:100%;padding:1rem;background:var(--bg);border:2px solid var(--border);border-radius:var(--radius-md);color:var(--text);font-family:inherit;min-height:180px;"></textarea>
            </div>
            <button onclick="sendReply()" style="margin-top:1rem;width:100%;padding:1.2rem;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:var(--radius-full);font-size:1.1rem;font-weight:700;cursor:pointer;">
                <i class="fas fa-paper-plane"></i> Copy to Clipboard
            </button>
            <p style="margin-top:1rem;color:var(--text-muted);font-size:0.9rem;text-align:center;">
                <i class="fas fa-info-circle"></i> Copies email content — paste into your email client to send.
            </p>
        </div>`;
};

window.replyToMessage = function (id, email, name) {
    showCompose();
    setTimeout(() => {
        const toEl   = document.getElementById('reply-to');
        const subEl  = document.getElementById('reply-subject');
        const bodyEl = document.getElementById('reply-body');
        if (toEl)   toEl.value   = email;
        if (subEl)  subEl.value  = 'Re: Your message to LakshyaIT';
        if (bodyEl) bodyEl.value = `Hi ${name},\n\n\n\nBest regards,\nLakshyaIT Team`;
    }, 100);
};

window.sendReply = function () {
    const to      = document.getElementById('reply-to')?.value;
    const subject = document.getElementById('reply-subject')?.value;
    const body    = document.getElementById('reply-body')?.value;

    if (!to || !subject || !body) { alert('Please fill in all fields'); return; }

    const content = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(content)
        .then(() => alert('✅ Copied to clipboard! Paste into your email client to send.'))
        .catch(() => alert('Email details:\n\nTo: ' + to + '\nSubject: ' + subject + '\n\n' + body));
};

window.deleteMessage = async function (id) {
    if (!confirm('Delete this message?')) return;
    try {
        const { error } = await contactDb.from('contact_messages').delete().eq('id', id);
        if (error) throw error;
        messages = messages.filter(m => m.id !== id);
        updateInboxCount();
        showInbox();
    } catch (err) {
        console.error('Error deleting:', err);
        alert('❌ Failed to delete: ' + err.message);
    }
};

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}
