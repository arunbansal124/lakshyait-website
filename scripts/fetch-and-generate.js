import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fetch from 'node-fetch';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED: Using 'gemini-pro' (1.0). 
// This is the most stable version and should eliminate the 404 Not Found error.
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Helpers ────────────────────────────────────────────────────────────────

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

Requirements:
- Original title, 300 words of content, HTML tags (<p>, <h2>), Indian-friendly English.
- Category: ${category}

Respond ONLY in this exact JSON format (no markdown, no backticks):
{
  "title": "Your title",
  "slug": "slug-here",
  "excerpt": "Summary",
  "content": "HTML content",
  "category": "${category}",
  "source_url": "${article.url || ''}",
  "source_name": "${article.source?.name || 'News'}"
}
`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  // Cleaning possible markdown backticks if AI adds them
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Step 3: Save to Supabase ───────────────────────────────────────────────

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

// ─── Step 4: Send Email ──────────────────────────────────────────────────────

async function sendReviewEmail(posts) {
  const baseUrl = process.env.REVIEW_BASE_URL;
  const postHtml = posts.map(p => `<li>${p.title} - <a href="${baseUrl}">Review</a></li>`).join('');
  
  const { data, error } = await resend.emails.send({
    from: 'LakshyaIT News <news@lakshyait.com>',
    to: process.env.REVIEW_EMAIL,
    subject: `📰 Daily News Review (${posts.length} posts)`,
    html: `<h1>News Ready</h1><ul>${postHtml}</ul>`,
  });

  if (error) throw new Error(`Email error: ${JSON.stringify(error)}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting Automation with Gemini Pro 1.0...');
  
  const indian = await fetchIndianNews();
  const tech = await fetchTechNews();
  const all = [
    ...indian.map(a => ({ article: a, category: 'India' })),
    ...tech.map(a => ({ article: a, category: 'Technology' }))
  ];

  if (all.length === 0) return console.log('No news found.');

  const savedPosts = [];
  for (const item of all) {
    try {
      console.log(`🤖 Processing: ${item.article.title.slice(0, 40)}...`);
      const post = await generatePost(item.article, item.category);
      const saved = await saveDraft(post);
      savedPosts.push({ ...post, id: saved.id });
    } catch (e) {
      console.error('❌ Skipping article due to error:', e.message);
    }
  }

  if (savedPosts.length > 0) {
    await sendReviewEmail(savedPosts);
    console.log('✅ Email sent!');
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
