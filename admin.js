// admin.js - Admin Panel Functionality

let editingPostId = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check admin auth
    if (sessionStorage.getItem('blog_admin') !== 'true') {
        alert('Access denied. Please log in as admin.');
        window.location.href = 'index.html';
        return;
    }

    await loadSupabase();
    await loadAllPostsForAdmin();
    setupEditorHandlers();

    // Check if editing
    const urlParams = new URLSearchParams(window.location.search);
    const editId = urlParams.get('edit');
    if (editId) {
        await loadPostForEditing(editId);
    }
});

// Auto-generate slug
document.getElementById('title').addEventListener('input', (e) => {
    const slug = slugify(e.target.value);
    document.getElementById('slug').value = slug;
});

function setupEditorHandlers() {
    // You can add more editor features here
}

async function loadAllPostsForAdmin() {
    try {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        renderAdminPostsList(data || []);
    } catch (err) {
        console.error('Error loading posts:', err);
        document.getElementById('posts-list-container').innerHTML = 
            '<p style="color:var(--danger);">Error loading posts</p>';
    }
}

function renderAdminPostsList(posts) {
    const container = document.getElementById('posts-list-container');
    
    if (!posts || posts.length === 0) {
        container.innerHTML = '<p style="color:var(--text-muted);">No posts yet. Create your first one above!</p>';
        return;
    }

    container.innerHTML = posts.map(post => `
        <div class="post-item">
            <div class="post-item-info">
                <h3>${post.title}</h3>
                <p>
                    ${post.category || 'Uncategorized'} • 
                    ${formatDate(post.created_at)} • 
                    ${post.published ? '<span style="color:var(--success);">Published</span>' : '<span style="color:var(--text-muted);">Draft</span>'}
                </p>
            </div>
            <div class="post-actions">
                <button class="btn btn-warning" onclick="editPost(${post.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger" onclick="deletePost(${post.id}, '${post.title.replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        </div>
    `).join('');
}

async function loadPostForEditing(id) {
    try {
        const { data, error } = await supabase
            .from('blog_posts')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (data) {
            editingPostId = data.id;
            document.getElementById('editor-title').textContent = 'Edit Post';
            document.getElementById('title').value = data.title;
            document.getElementById('slug').value = data.slug;
            document.getElementById('category').value = data.category || 'Technology';
            document.getElementById('image_url').value = data.image_url || '';
            document.getElementById('excerpt').value = data.excerpt || '';
            document.getElementById('content').value = data.content || '';
            document.getElementById('author').value = data.author || 'LakshyaIT';
            document.getElementById('published').checked = data.published;
            
            // Scroll to editor
            document.getElementById('editor-section').scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        console.error('Error loading post:', err);
        alert('Error loading post for editing');
    }
}

window.editPost = async function(id) {
    window.location.href = `admin.html?edit=${id}`;
};

window.savePost = async function() {
    const title = document.getElementById('title').value.trim();
    const slug = document.getElementById('slug').value.trim();
    const category = document.getElementById('category').value;
    const image_url = document.getElementById('image_url').value.trim();
    const excerpt = document.getElementById('excerpt').value.trim();
    const content = document.getElementById('content').value.trim();
    const author = document.getElementById('author').value.trim() || 'LakshyaIT';
    const published = document.getElementById('published').checked;

    if (!title || !content) {
        alert('Title and content are required!');
        return;
    }

    const postData = {
        title,
        slug: slug || slugify(title),
        category,
        image_url: image_url || null,
        excerpt: excerpt || null,
        content,
        author,
        published,
        updated_at: new Date().toISOString()
    };

    try {
        if (editingPostId) {
            // Update existing
            const { error } = await supabase
                .from('blog_posts')
                .update(postData)
                .eq('id', editingPostId);

            if (error) throw error;
            alert('Post updated successfully!');
        } else {
            // Create new
            postData.created_at = new Date().toISOString();
            
            const { error } = await supabase
                .from('blog_posts')
                .insert([postData]);

            if (error) throw error;
            alert('Post created successfully!');
        }

        // Reset form
        resetForm();
        await loadAllPostsForAdmin();
        
    } catch (err) {
        console.error('Error saving post:', err);
        alert('Error saving post: ' + err.message);
    }
};

window.deletePost = async function(id, title) {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
        const { error } = await supabase
            .from('blog_posts')
            .delete()
            .eq('id', id);

        if (error) throw error;

        alert('Post deleted successfully!');
        await loadAllPostsForAdmin();
        
    } catch (err) {
        console.error('Error deleting post:', err);
        alert('Error deleting post: ' + err.message);
    }
};

function resetForm() {
    editingPostId = null;
    document.getElementById('editor-title').textContent = 'Create New Post';
    document.getElementById('title').value = '';
    document.getElementById('slug').value = '';
    document.getElementById('category').value = 'Technology';
    document.getElementById('image_url').value = '';
    document.getElementById('excerpt').value = '';
    document.getElementById('content').value = '';
    document.getElementById('author').value = 'LakshyaIT';
    document.getElementById('published').checked = true;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
}
