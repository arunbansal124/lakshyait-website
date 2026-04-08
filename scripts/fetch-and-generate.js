import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import fetch from 'node-fetch';

// 1. INITIALIZE APIS
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED: We will try 'gemini-1.5-flash' (standard name) on the STABLE v1 endpoint.
// If this still fails, the diagnostic below will tell us why.
const model = genAI.getGenerativeModel(
  { model: "gemini-1.5-flash" }, 
  { apiVersion: 'v1' } 
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
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

// 3. FETCH NEWS
async function fetchIndianNews() {
  const date = yesterday();
  const url = `https://newsapi.org/v2/top-headlines?country=in&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.articles || []).slice(0, 2);
}

async function fetchTechNews() {
  const date = yesterday();
  const url = `https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.articles || []).slice(0, 2);
}

// 4. GENERATE BLOG POST
async function generatePost(article, category) {
  const prompt = `Write a blog post in JSON format for: ${article.title}. Category: ${category}. Format: {"title":"","slug":"","excerpt":"","content":"","category":"","source_url":"","source_name":""}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// 5. SAVE TO SUPABASE
async function saveDraft(post) {
  const { data, error } = await supabase.from('blog_posts').insert({
    title: post.title,
    slug: post.slug || slugify(post.title),
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    status: 'draft',
    source_url: post.source_url,
    source_name: post.source_name,
    auto_generated: true,
  }).select().single();
  if (error) throw error;
  return data;
}

// 6. SEND EMAIL
async function sendReviewEmail(posts) {
  const postHtml = posts.map(p => `<li>${p.title}</li>`).join('');
  await resend.emails.send({
    from: 'LakshyaIT News <news@lakshyait.com>',
    to: process.env.REVIEW_EMAIL,
    subject: `📰 Daily News Ready`,
    html: `<ul>${postHtml}</ul>`,
  });
}

// 7. MAIN PROCESS
async function main() {
  console.log('🚀 Starting Daily News Automation...');

  // --- DIAGNOSTIC STEP ---
  // This will list every model your API key is allowed to see.
  try {
    const list = await genAI.listModels();
    console.log('✅ Connection Successful. Your key has access to these models:');
    console.log(list.models.map(m => m.name).join(', '));
  } catch (e) {
    console.log('❌ Could not list models. This usually means your API Key is invalid or from GCP instead of AI Studio.');
  }
  // -----------------------

  const indian = await fetchIndianNews();
  const tech = await fetchTechNews();
  const all = [...indian.map(a => ({ a, c: 'India' })), ...tech.map(a => ({ a, c: 'Technology' }))];

  if (all.length === 0) return console.log('⚠️ No news found.');

  const savedPosts = [];
  for (const item of all) {
    try {
      console.log(`🤖 Processing: ${item.a.title.slice(0, 40)}...`);
      const post = await generatePost(item.a, item.c);
      const saved = await saveDraft(post);
      savedPosts.push({ ...post, id: saved.id });
    } catch (e) {
      console.error('❌ Error:', e.message);
    }
  }

  if (savedPosts.length > 0) {
    await sendReviewEmail(savedPosts);
    console.log('✅ Done!');
  }
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
