import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

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

// ─── Step 2: Generate Blog Post via Groq ────────────────────────────────────

async function generatePost(article, category) {
  const prompt = `You are a blog writer for LakshyaIT Blog, a clean and professional Indian tech/news blog.

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
}`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1500,
  });

  const text = completion.choices[0].message.content.trim();
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ─── Step 3: Save to Supabase (Auto-Publish) ────────────────────────────────

async function savePost(post) {
  const { data, error } = await supabase
    .from('blog_posts')
    .upsert({
      title: post.title,
      slug: post.slug || slugify(post.title),
      excerpt: post.excerpt,
      content: post.content,
      category: post.category,
      status: 'published', // Set to published automatically
      published: true,     // Matches your script.js filter
      source_url: post.source_url,
      source_name: post.source_name,
      image_url: post.image_url || 'https://via.placeholder.com/1200x630?text=LakshyaIT+News', 
      auto_generated: true,
      created_at: new Date().toISOString(),
    }, { 
      onConflict: 'slug' 
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert error: ${JSON.stringify(error)}`);
  return data;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting LakshyaIT Daily News Auto-Publish...');
  console.log(`📅 Fetching news for: ${yesterday()}`);

  console.log('\n📡 Fetching Indian news...');
  const indianArticles = await fetchIndianNews();
  console.log(`   Found ${indianArticles.length} Indian articles`);

  console.log('📡 Fetching Tech/World news...');
  const techArticles = await fetchTechNews();
  console.log(`   Found ${techArticles.length} Tech articles`);

  const allArticles = [
    ...indianArticles.map(a => ({ article: a, category: 'India' })),
    ...techArticles.map(a => ({ article: a, category: 'Technology' })),
  ];

  if (allArticles.length === 0) {
    console.log('⚠️ No news found today.');
    return;
  }

  console.log('\n🤖 Generating and Publishing blog posts with Groq AI...');

  for (const { article, category } of allArticles) {
    try {
      console.log(`   Processing: "${article.title.slice(0, 60)}..."`);
      
      const post = await generatePost(article, category);
      
      // Attach the image from the original news article
      post.image_url = article.urlToImage; 
      
      // Save directly to the database as Published
      await savePost(post);
      console.log(`   ✅ Successfully published!`);
      
    } catch (e) {
      console.error(`   ❌ Error with article: ${e.message}`);
    }
  }

  console.log('\n✅ Done! News has been published directly to the website.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
