import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fetch from 'node-fetch';

// 1. INITIALIZE APIS
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED: Using the most compatible endpoint and full path to stop 404 errors
const model = genAI.getGenerativeModel(
  { model: "models/gemini-1.5-flash" }, 
  { apiVersion: 'v1beta' }
);

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// 2. HELPERS
function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0]; 
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

// 3. FETCH NEWS
async function fetchIndianNews() {
  const date = yesterday();
  const url = `https://newsapi.org/v2/top-headlines?country=in&pageSize=5&from=${date}&to=${date}&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`NewsAPI India error: ${data.message}`);
  return (data.articles || []).slice(0, 2);
}

async function fetchTechNews() {
  const date = yesterday();
  const url = `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=5&from=${date}&to=${date}&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`NewsAPI Tech error: ${data.message}`);
  return (data.articles || []).slice(0, 2);
}

// 4. GENERATE BLOG POST
async function generatePost(article, category) {
  const prompt = `
You are a professional blog writer for LakshyaIT Blog.
Write a blog post based on this article: ${article.title}.
Category: ${category}.
Include: Title, Slug, Excerpt, and HTML Content using <p> and <h2>.

Respond ONLY in this JSON format:
{
  "title": "Title",
  "slug": "slug",
  "excerpt": "Short summary",
  "content": "HTML content",
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

// 5. SAVE TO SUPABASE
async function saveDraft(post) {
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      title: post.title,
      slug: post.slug || slugify(post.title),
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      status: 'draft',
      source_url: post.source_url,
      source_name: post.source_name,
      auto_generated: true,
      created_at: new Date().toISOString(),
    })
    .select().single();

  if (error) throw new Error(`Supabase error: ${JSON.stringify(error)}`);
  return data;
}

// 6. SEND EMAIL
async function sendReviewEmail(posts) {
  const baseUrl = process.env.REVIEW_BASE_URL;
  const postHtml = posts.map(p => `<li>${p.title} - <a href="${baseUrl}">Review</a></li>`).join('');
  
  await resend.emails.send({
    from: 'LakshyaIT News <news@lakshyait.com>',
    to: process.env.REVIEW_EMAIL,
    subject: `📰 Daily News Ready (${posts.length} posts)`,
    html: `<h1>LakshyaIT Blog Drafts</h1><ul>${postHtml}</ul>`,
  });
}

// 7. MAIN PROCESS
async function main() {
  console.log('🚀 Starting Daily News Automation...');
  
  const indian = await fetchIndianNews();
  const tech = await fetchTechNews();
  const all = [
    ...indian.map(a => ({ article: a, category: 'India' })),
    ...tech.map(a => ({ article: a, category: 'Technology' }))
  ];

  if (all.length === 0) {
    console.log('⚠️ No articles found for today.');
    return;
  }

  const savedPosts = [];
  for (const item of all) {
    try {
      console.log(`🤖 Processing: ${item.article.title.slice(0, 40)}...`);
      const post = await generatePost(item.article, item.category);
      const saved = await saveDraft(post);
      savedPosts.push({ ...post, id: saved.id });
    } catch (e) {
      console.error('❌ Error processing article:', e.message);
    }
  }

  if (savedPosts.length > 0) {
    await sendReviewEmail(savedPosts);
    console.log(`✅ Success! ${savedPosts.length} posts sent for review.`);
  }
}

// RUN THE SCRIPT
main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
