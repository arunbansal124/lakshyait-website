// contact.js - Contact Page Functionality

let messages = [];

document.addEventListener('DOMContentLoaded', async () => {
    await loadSupabase();
    
    // Check if admin
    const isAdminMode = sessionStorage.getItem('blog_admin') === 'true';
    
    if (isAdminMode) {
        document.body.classList.add('admin-mode');
        document.getElementById('admin-inbox').style.display = 'block';
        await loadMessages();
        showInbox();
    }
    
    // Setup form submission
    setupContactForm();
});

function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: form.name.value.trim(),
            email: form.email.value.trim(),
            company: form.company.value.trim() || null,
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
            
            // If admin, reload messages
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
    setActiveTab('inbox-tab');
    const container = document.getElementById('inbox-content');
    
    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:3rem;color:var(--text-muted);">
                <i class="fas fa-inbox" style="font-size:3rem;margin-bottom:1rem;opacity:0.5;"></i>
                <p>No messages yet.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = messages.map((msg, index) => `
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
    setActiveTab('compose-tab');
    const container = document.getElementById('inbox-content');
    
    container.innerHTML = `
        <div class="contact-form" style="display:block;">
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
            <button class="submit-btn" onclick="sendReply()">
                <i class="fas fa-paper-plane"></i> Send Reply
            </button>
            <p style="margin-top:1rem;color:var(--text-muted);font-size:0.9rem;text-align:center;">
                <i class="fas fa-info-circle"></i> Note: This will copy the email content. Send it from your email client.
            </p>
        </div>
    `;
};

window.replyToMessage = function(id, email, name) {
    showCompose();
    setTimeout(() => {
        document.getElementById('reply-to').value = email;
        document.getElementById('reply-subject').value = `Re: Your message to LakshyaIT`;
        document.getElementById('reply-body').value = `Hi ${name},\n\n\n\nBest regards,\nLakshyaIT Team`;
    }, 100);
};

window.sendReply = function() {
    const to = document.getElementById('reply-to').value;
    const subject = document.getElementById('reply-subject').value;
    const body = document.getElementById('reply-body').value;
    
    if (!to || !subject || !body) {
        alert('Please fill in all fields');
        return;
    }
    
    // Copy to clipboard
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
        
        alert('✅ Message deleted');
        await loadMessages();
        showInbox();
    } catch (err) {
        console.error('Error deleting message:', err);
        alert('❌ Failed to delete message');
    }
};

function setActiveTab(tabId) {
    document.querySelectorAll('.admin-tabs button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.getElementById(tabId)?.classList.add('active');
}

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
