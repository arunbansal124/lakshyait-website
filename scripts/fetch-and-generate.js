import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fetch from 'node-fetch';

// Initialize APIs
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED: Added { apiVersion: 'v1' } to resolve the 404 error
const model = genAI.getGenerativeModel(
  { model: 'gemini-1.5-flash' },
  { apiVersion: 'v1' }
);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// ─── Step 1: Fetch News ──────────────────────────────────────────────────────

async function fetchIndianNews() {
  const date = yesterday();
  const url = `https://newsapi.org/v2/top-headlines?country=in&pageSize=5&from=${date}&to=${date}&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`NewsAPI India error: ${data.message}`);
  return data.articles.slice(0, 2);
}

async function fetchTechNews() {
  const date = yesterday();
  const url = `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=5&from=${date}&to=${date}&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`NewsAPI Tech error: ${data.message}`);
  return data.articles.slice(0, 2);
}

// ─── Step 2: Generate Blog Post via Gemini ───────────────────────────────────

async function generatePost(article, category) {
  const prompt = `
You are a blog writer for LakshyaIT Blog, a clean and professional Indian tech/news blog.

Write a complete blog post based on this news article:

Title: ${article.title}
Source: ${article.source?.name || 'News'}
Description: ${article.description || ''}
Content: ${article.content || article.description || ''}
Published: ${article.publishedAt}

Requirements:
- Write a compelling, original blog post title (not copied from the source)
- Write 300-400 words of engaging, informative content
- Use simple, clear English suitable for Indian readers
- Include relevant context and explain why this matters
- Category: ${category}
- Do NOT copy the article verbatim — rewrite it in your own words

Respond ONLY in this exact JSON format (no markdown, no extra text, no backticks):
{
  "title": "Your blog post title here",
  "slug": "url-friendly-slug-here",
  "excerpt": "One sentence summary (max 160 chars)",
  "content": "Full HTML blog post content here using <p>, <h2>, <ul>, <li> tags",
  "category": "${category}",
  "source_url": "${article.url || ''}",
  "source_name": "${article.source?.name || 'News'}"
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Step 3: Save drafts to Supabase ────────────────────────────────────────

async function saveDraft(post) {
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title: post.title,
      slug: post.slug || slugify(post.title),
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      status: 'draft',           // NOT published yet — awaiting approval
      source_url: post.source_url,
      source_name: post.source_name,
      auto_generated: true,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert error: ${JSON.stringify(error)}`);
  return data;
}

// ─── Step 4: Send Review Email ───────────────────────────────────────────────

function buildEmailHtml(posts) {
  const baseUrl = process.env.REVIEW_BASE_URL;
  const date = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const postCards = posts.map((p) => `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="background:${p.category === 'India' ? '#16a34a' : '#2563eb'};color:white;font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;text-transform:uppercase;letter-spacing:1px;">
          ${p.category}
        </span>
        <span style="color:#94a3b8;font-size:12px;">via ${p.source_name}</span>
      </div>
      <h2 style="margin:0 0 10px;font-size:20px;color:#1e293b;font-family:Georgia,serif;">${p.title}</h2>
      <p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.6;">${p.excerpt}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a href="${baseUrl}/api/approve?id=${p.id}&action=approve"
           style="background:#16a34a;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          ✅ Approve & Publish
        </a>
        <a href="${baseUrl}/api/approve?id=${p.id}&action=reject"
           style="background:#dc2626;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          ❌ Reject
        </a>
        <a href="${baseUrl}/api/approve?id=${p.id}&action=edit"
           style="background:#f59e0b;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block;">
          ✏️ Edit First
        </a>
      </div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;margin:0;padding:32px 16px;">
      <div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:32px;text-align:center;">
          <h1 style="color:white;margin:0;font-size:24px;font-family:Georgia,serif;">📰 LakshyaIT Daily News</h1>
          <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">${date} — ${posts.length} posts ready for review</p>
        </div>
        <div style="padding:32px;">
          <p style="color:#475569;margin:0 0 24px;font-size:15px;">
            Your AI-generated news posts are ready. Review each one below and click <strong>Approve</strong> to publish.
          </p>
          ${postCards}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
            LakshyaIT Blog • Auto-generated by Gemini AI • lakshya1.pages.dev
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

async function sendReviewEmail(posts) {
  const { data, error } = await resend.emails.send({
    from: 'LakshyaIT News <news@lakshyait.com>', 
    to: process.env.REVIEW_EMAIL,
    subject: `📰 Daily News Review — ${new Date().toLocaleDateString('en-IN')} (${posts.length} posts)`,
    html: buildEmailHtml(posts),
  });

  if (error) throw new Error(`Email send error: ${JSON.stringify(error)}`);
  console.log('✅ Review email sent:', data.id);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting LakshyaIT Daily News Automation...');
  console.log(`📅 Fetching news for: ${yesterday()}`);

  // 1. Fetch news
  console.log('\n📡 Fetching Indian news...');
  const indianArticles = await fetchIndianNews();
  console.log(`   Found ${indianArticles.length} Indian articles`);

  console.log('📡 Fetching Tech/World news...');
  const techArticles = await fetchTechNews();
  console.log(`   Found ${techArticles.length} Tech articles`);

  // 2. Generate blog posts
  const allArticles = [
    ...indianArticles.map(a => ({ article: a, category: 'India' })),
    ...techArticles.map(a => ({ article: a, category: 'Technology' })),
  ];

  if (allArticles.length === 0) {
    console.log('\n🛑 No new articles found. Exiting.');
    return;
  }

  console.log('\n🤖 Generating blog posts with Gemini AI...');
  const generatedPosts = [];

  for (const { article, category } of allArticles) {
    console.log(`   Writing: "${article.title.slice(0, 60)}..."`);
    try {
        const post = await generatePost(article, category);
        generatedPosts.push(post);
    } catch (e) {
        console.error(`   ❌ Error generating post for "${article.title}":`, e.message);
    }
  }

  // 3. Save as drafts
  console.log('\n💾 Saving drafts to Supabase...');
  const savedPosts = [];
  for (const post of generatedPosts) {
    const saved = await saveDraft(post);
    savedPosts.push({ ...post, id: saved.id });
    console.log(`   Saved draft ID: ${saved.id} — "${post.title.slice(0, 50)}"`);
  }

  // 4. Send review email
  if (savedPosts.length > 0) {
    console.log('\n📧 Sending review email...');
    await sendReviewEmail(savedPosts);
  }

  console.log('\n✅ Done! Check your email to review and approve posts.');
}

async function main() {
  console.log('🚀 Starting Diagnostic Test...');
  
  try {
    // This part asks Google: "What models can I actually use?"
    const result = await genAI.listModels();
    console.log('✅ Connection Successful! Available models:');
    result.models.forEach(m => console.log(`   - ${m.name}`));
  } catch (err) {
    console.error('❌ Diagnostic Failed:', err.message);
  }

  // Stop here so we can read the logs
  process.exit(0);
}
