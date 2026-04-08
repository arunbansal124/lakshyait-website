-- ============================================================
-- LakshyaIT Blog — Supabase Schema Update
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add new columns to blog_posts table
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_name TEXT,
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. Update existing posts to have 'published' status
UPDATE blog_posts SET status = 'published' WHERE status IS NULL;

-- 3. Create index for fast draft/published filtering
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);

-- 4. RLS Policies — allow service role full access (for the automation script)
-- (Your anon policies from before still apply for public reads)

-- Allow public to read only PUBLISHED posts
DROP POLICY IF EXISTS "Public can read published posts" ON blog_posts;
CREATE POLICY "Public can read published posts"
  ON blog_posts FOR SELECT
  USING (status = 'published');

-- Allow service role to do everything (needed for automation)
DROP POLICY IF EXISTS "Service role full access" ON blog_posts;
CREATE POLICY "Service role full access"
  ON blog_posts
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================================
-- Verify: check your table structure
-- ============================================================
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'blog_posts'
ORDER BY ordinal_position;
