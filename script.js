// script.js - Main Blog Functionality

const SUPABASE_URL = 'https://rbmrbiubrprutrvwfqea.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJibXJiaXVicnBydXRydndmcWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2MzExNzIsImV4cCI6MjA4MTIwNzE3Mn0.rd8BQRlxySgAYuhGRusv4cGkYAzMz1ESThpCxaH0DQ4';
const ADMIN_PASSWORD = 'lakshya@1204';

let supabase;
let allPosts = [];
let isAdmin = sessionStorage.getItem('blog_admin') === 'true';

// Load Supabase
async function loadSupabase() {
    if (window.supabase) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => {
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Mobile Menu Toggle
function toggleMobileMenu() {
    document.getElementById('mobile-menu').classList.toggle('active');
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSupabase();
    
    if (document.getElementById('posts-container')) {
        await loadPosts();
        setupSearch();
    }
    
    if (document.getElementById('post-content')) {
        await loadSinglePost();
    }
    
    updateAdminUI();
});

// Load All Posts
async function loadPosts() {
    try {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allPosts = data || [];
        
        // Show featured posts (latest 3)
        if (document.getElementById('featured-posts')) {
            renderFeaturedPosts(allPosts.slice(0, 3));
        }
        
        // Show all posts
        renderPosts(allPosts);
    } catch (err) {
        console.error('Error loading posts:', err);
        showError('posts-container');
    }
}

function renderFeaturedPosts(posts) {
    const container = document.getElementById('featured-posts');
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);">No featured posts yet.</p>';
        return;
    }
    
    container.innerHTML = posts.map(post => createPostCard(post)).join('');
}

function renderPosts(posts) {
    const container = document.getElementById('posts-container');
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);">No posts found.</p>';
        return;
    }
    
    container.innerHTML = posts.map(post => createPostCard(post)).join('');
}

function createPostCard(post) {
    return `
        <div class="post-card" onclick="window.location.href='post.html?slug=${post.slug}'">
            ${post.image_url ? `<img src="${post.image_url}" alt="${post.title}" class="post-image">` : ''}
            <div class="post-content">
                <div class="post-meta">
                    <span class="post-category">${post.category || 'Uncategorized'}</span>
                    <span><i class="far fa-calendar"></i> ${formatDate(post.created_at)}</span>
                </div>
                <h3 class="post-title">${post.title}</h3>
                <p class="post-excerpt">${post.excerpt || ''}</p>
            </div>
        </div>
    `;
}

// Search Functionality
function setupSearch() {
    const searchInput = document.getElementById('search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allPosts.filter(post =>
            post.title.toLowerCase().includes(query) ||
            (post.excerpt && post.excerpt.toLowerCase().includes(query)) ||
            (post.category && post.category.toLowerCase().includes(query))
        );
        renderPosts(filtered);
    });
}

// Filter by Category
window.filterByCategory = function(category) {
    if (category === 'All') {
        renderPosts(allPosts);
    } else {
        const filtered = allPosts.filter(post => post.category === category);
        renderPosts(filtered);
    }
};

// Load Single Post
async function loadSinglePost() {
    const urlParams = new URLSearchParams(window.location.search);
    const slug = urlParams.get('slug');

    if (!slug) {
        showError('post-content');
        return;
    }

    try {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) throw error;
        if (!data) {
            showError('post-content');
            return;
        }

        renderSinglePost(data);
    } catch (err) {
        console.error('Error loading post:', err);
        showError('post-content');
    }
}

function renderSinglePost(post) {
    document.title = `${post.title} - LakshyaIT Blog`;
    
    document.getElementById('post-category').textContent = post.category || 'Uncategorized';
    document.getElementById('post-title').textContent = post.title;
    document.getElementById('post-meta').innerHTML = `
        By ${post.author || 'LakshyaIT'} • ${formatDate(post.created_at)}
    `;
    
    if (post.image_url) {
        document.getElementById('post-image').src = post.image_url;
        document.getElementById('post-image').alt = post.title;
        document.getElementById('post-image-container').style.display = 'block';
    }
    
    document.getElementById('post-content').innerHTML = post.content;
    document.getElementById('loading').style.display = 'none';
    document.getElementById('post-container').style.display = 'block';
}

// Admin Functions
window.showAdminLogin = function() {
    if (isAdmin) {
        window.location.href = 'admin.html';
        return;
    }
    
    const password = prompt('Enter admin password:');
    if (password === ADMIN_PASSWORD) {
        sessionStorage.setItem('blog_admin', 'true');
        isAdmin = true;
        alert('Admin access granted!');
        window.location.href = 'admin.html';
    } else if (password) {
        alert('Wrong password!');
    }
};

window.logoutAdmin = function() {
    sessionStorage.removeItem('blog_admin');
    isAdmin = false;
    window.location.href = 'index.html';
};

function updateAdminUI() {
    if (isAdmin) {
        const fab = document.getElementById('admin-fab');
        if (fab) {
            fab.innerHTML = '<i class="fas fa-cog"></i>';
            fab.onclick = () => window.location.href = 'admin.html';
        }
    }
}

// Utility Functions
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}

function slugify(text) {
    return text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

function showError(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '<p style="color:var(--danger);">Error loading content. Please refresh the page.</p>';
    }
}
