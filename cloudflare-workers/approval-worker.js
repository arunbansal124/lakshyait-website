/**
 * LakshyaIT News Approval Worker
 * Deploy this to Cloudflare Workers at: lakshya1.pages.dev/api/approve
 * (or as a standalone worker at api.lakshyait.com/approve)
 *
 * Handles approve / reject / edit actions from the daily review email.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const action = url.searchParams.get('action');

    if (!id || !action) {
      return html('❌ Missing parameters', 400);
    }

    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_KEY;
    const headers = {
      'Content-Type': 'application/json',
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
    };

    // ── APPROVE: set status = 'published' ──────────────────────────────────
    if (action === 'approve') {
      const res = await fetch(`${supabaseUrl}/rest/v1/blog_posts?id=eq.${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: 'published',
          published_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        return html(`❌ Failed to approve post: ${err}`, 500);
      }

      return html(`
        <h1>✅ Post Published!</h1>
        <p>The post has been approved and is now live on 
           <a href="https://lakshya1.pages.dev">lakshya1.pages.dev</a>.
        </p>
        <p><a href="https://lakshya1.pages.dev">👉 View your site</a></p>
      `);
    }

    // ── REJECT: delete the draft ───────────────────────────────────────────
    if (action === 'reject') {
      const res = await fetch(`${supabaseUrl}/rest/v1/blog_posts?id=eq.${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!res.ok) {
        const err = await res.text();
        return html(`❌ Failed to reject post: ${err}`, 500);
      }

      return html(`
        <h1>🗑️ Post Rejected</h1>
        <p>The draft has been deleted and will not appear on your site.</p>
      `);
    }

    // ── EDIT: redirect to admin editor ────────────────────────────────────
    if (action === 'edit') {
      return Response.redirect(
        `https://lakshya1.pages.dev/admin/posts.html?edit=${id}`,
        302
      );
    }

    return html('❌ Unknown action', 400);
  },
};

// ── Helper ────────────────────────────────────────────────────────────────────
function html(body, status = 200) {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>LakshyaIT — Post Review</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          display: flex; align-items: center; justify-content: center;
          min-height: 100vh; margin: 0; background: #f1f5f9;
        }
        .card {
          background: white; border-radius: 16px; padding: 48px;
          max-width: 480px; text-align: center;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
        }
        h1 { font-size: 28px; color: #1e293b; margin: 0 0 16px; }
        p  { color: #64748b; line-height: 1.6; }
        a  { color: #2563eb; font-weight: 600; }
      </style>
    </head>
    <body>
      <div class="card">${body}</div>
    </body>
    </html>
  `, {
    status,
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
