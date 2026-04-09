import Groq from 'groq-sdk';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function yesterday() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function slugify(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 80);
}

async function fetchNews(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`NewsAPI error: ${data.message}`);
  return data.articles.slice(0, 2);
}

async function generatePost(article, category) {
  const prompt = `Write a professional blog post for LakshyaIT Blog. Article: ${article.title}. Category: ${category}. Respond ONLY in JSON: {"title":"","slug":"","excerpt":"","content":""}`;
  
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const clean = completion.choices[0].message.content.trim().replace(/```json|```/g, '');
  return JSON.parse(clean);
}

async function savePost(post, originalArticle) {
  const { error } = await supabase
    .from('blog_posts')
    .upsert({
      title: post.title,
      slug: post.slug || slugify(post.title),
      excerpt: post.excerpt,
      content: post.content,
      category: post.category || 'Technology',
      status: 'published', // PUBLISH AUTOMATICALLY
      published: true,     // Compatibility for your script.js
      source_url: originalArticle.url,
      source_name: originalArticle.source?.name || 'News',
      image_url: originalArticle.urlToImage || 'https://via.placeholder.com/1200x630?text=LakshyaIT',
      auto_generated: true,
      created_at: new Date().toISOString(),
    }, { onConflict: 'slug' });

  if (error) throw error;
}

async function main() {
  console.log('🚀 Auto-Publishing Daily News...');
  const date = yesterday();
  
  const indian = await fetchNews(`https://newsapi.org/v2/top-headlines?country=in&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`);
  const tech = await fetchNews(`https://newsapi.org/v2/top-headlines?category=technology&language=en&pageSize=5&apiKey=${process.env.NEWS_API_KEY}`);

  const all = [
    ...indian.map(a => ({ article: a, category: 'India' })),
    ...tech.map(a => ({ article: a, category: 'Technology' })),
  ];

  for (const item of all) {
    try {
      console.log(`📝 Publishing: ${item.article.title.slice(0, 50)}...`);
      const post = await generatePost(item.article, item.category);
      await savePost(post, item.article);
    } catch (e) {
      console.error(`❌ Failed: ${e.message}`);
    }
  }
  console.log('✅ All posts published!');
}

main().catch(err => { console.error(err); process.exit(1); });
