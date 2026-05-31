-- =============================================================================
-- Devasya AI — Supabase Setup SQL
-- =============================================================================
-- Run this in: Supabase Dashboard → SQL Editor → New Query → Run
-- This sets up Storage buckets and RLS policies for the application.
-- =============================================================================

-- 1. Create Storage Buckets
-- (ON CONFLICT DO NOTHING = safe to re-run)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('documents', 'documents', false)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars', 'avatars', true)
  ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
  VALUES ('memory-assets', 'memory-assets', false)
  ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. Storage RLS Policies
-- Files are stored under {user_id}/{filename} so we match on the first segment
-- =============================================================================

-- Documents bucket
DROP POLICY IF EXISTS "Users can upload their workspace documents" ON storage.objects;
CREATE POLICY "Users can upload their workspace documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents');
  -- Note: Backend uploads use service_role key which bypasses RLS.
  -- This policy allows the anon key fallback scenario.

DROP POLICY IF EXISTS "Users can view their workspace documents" ON storage.objects;
CREATE POLICY "Users can view their workspace documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "Users can delete their workspace documents" ON storage.objects;
CREATE POLICY "Users can delete their workspace documents"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND auth.uid()::text = (string_to_array(name, '/'))[1]);

-- Avatars bucket (public)
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (string_to_array(name, '/'))[1]);
