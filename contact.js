// contact.js - Contact Page Functionality

let messages = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadSupabase();
    
    const isAdminMode = sessionStorage.getItem('blog_admin') === 'true';
    const onContactPage = !!document.getElementById('contact-form');
    const onMessagesPage = !!document.getElementById('inbox-content') && !onContactPage;

    if (onMessagesPage) {
        // We're on admin/messages.html
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
        
        const formData = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            company: form.company ? form.company.value.trim() || null : null,
            message: form.message.value.trim(),
            replied: false,
            created_at: new Date().toISOString()
        };
        
        try {
            const { error } = await supabase
                .from('contact_messages')
                .insert([formData]);
            
            if (error) throw error;
            
            alert('✅ Message sent successfully! We\'ll get back to you soon.');
            form.reset();
            
            if (sessionStorage.getItem('blog_admin') === 'true') {
                await loadMessages();
                showInbox();
            }
        } catch (err) {
            console.error('Error sending message:', err);
            alert('❌ Failed to send message. Please try again.');
        }
    });
}

async function loadMessages() {
    try {
        const { data, error } = await supabase
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
    const countEl = document.getElementById('inbox-count');
    if (countEl) {
        countEl.textContent = messages.length;
    }
}

window.showInbox = function() {
    // Highlight active tab if tabs exist
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
            </div>
        `;
        return;
    }
    
    container.innerHTML = messages.map((msg) => `
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
        </div>
    `).join('');
};

window.showCompose = function() {
    document.querySelectorAll('.admin-tabs button').forEach((btn, i) => {
        btn.classList.toggle('active', i === 1);
    });

    const container = document.getElementById('inbox-content');
    if (!container) return;
    
    container.innerHTML = `
        <div style="background:var(--surface);padding:2rem;border-radius:var(--radius-lg);border:1px solid var(--border);">
            <div class="form-group">
                <label for="reply-to">To (Email)</label>
                <input type="email" id="reply-to" placeholder="recipient@example.com">
            </div>
            <div class="form-group">
                <label for="reply-subject">Subject</label>
                <input type="text" id="reply-subject" placeholder="Re: Your message">
            </div>
            <div class="form-group">
                <label for="reply-body">Message</label>
                <textarea id="reply-body" rows="8" placeholder="Write your reply..."></textarea>
            </div>
            <button class="submit-btn" onclick="sendReply()" style="width:100%;padding:1.2rem;background:linear-gradient(135deg,var(--primary),var(--secondary));color:white;border:none;border-radius:var(--radius-full);font-size:1.1rem;font-weight:700;cursor:pointer;">
                <i class="fas fa-paper-plane"></i> Send Reply
            </button>
            <p style="margin-top:1rem;color:var(--text-muted);font-size:0.9rem;text-align:center;">
                <i class="fas fa-info-circle"></i> This will copy the email content. Send it from your email client.
            </p>
        </div>
    `;
};

window.replyToMessage = function(id, email, name) {
    showCompose();
    setTimeout(() => {
        const toEl = document.getElementById('reply-to');
        const subEl = document.getElementById('reply-subject');
        const bodyEl = document.getElementById('reply-body');
        if (toEl) toEl.value = email;
        if (subEl) subEl.value = `Re: Your message to LakshyaIT`;
        if (bodyEl) bodyEl.value = `Hi ${name},\n\n\n\nBest regards,\nLakshyaIT Team`;
    }, 100);
};

window.sendReply = function() {
    const to = document.getElementById('reply-to')?.value;
    const subject = document.getElementById('reply-subject')?.value;
    const body = document.getElementById('reply-body')?.value;
    
    if (!to || !subject || !body) {
        alert('Please fill in all fields');
        return;
    }
    
    const emailContent = `To: ${to}\nSubject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(emailContent).then(() => {
        alert('✅ Email content copied to clipboard! Now send it from your email client.');
    }).catch(() => {
        alert('Email details:\n\nTo: ' + to + '\nSubject: ' + subject + '\n\nMessage:\n' + body);
    });
};

window.deleteMessage = async function(id) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
        const { error } = await supabase
            .from('contact_messages')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        
        messages = messages.filter(m => m.id !== id);
        updateInboxCount();
        showInbox();
    } catch (err) {
        console.error('Error deleting message:', err);
        alert('❌ Failed to delete message');
    }
};

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
