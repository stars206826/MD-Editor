-- Migration: Create Supabase Storage bucket for document images
-- Description: Creates the document-images bucket with RLS policies for user-specific access
-- Requirements: 6.6, 10.5
-- Task: 8.1

-- ============================================================================
-- Storage Bucket: document-images
-- Purpose: Store uploaded images for documents
-- ============================================================================

-- Create the storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-images',
  'document-images',
  true, -- Public bucket for easy URL access
  5242880, -- 5MB limit
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do nothing;

-- ============================================================================
-- Storage Policies
-- ============================================================================

-- Policy: Users can upload images to their own folder
drop policy if exists "Users can upload own images" on storage.objects;
create policy "Users can upload own images"
on storage.objects
for insert
with check (
  bucket_id = 'document-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can view their own images
drop policy if exists "Users can view own images" on storage.objects;
create policy "Users can view own images"
on storage.objects
for select
using (
  bucket_id = 'document-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Public can view all images (for shared documents)
drop policy if exists "Public can view images" on storage.objects;
create policy "Public can view images"
on storage.objects
for select
using (bucket_id = 'document-images');

-- Policy: Users can update their own images
drop policy if exists "Users can update own images" on storage.objects;
create policy "Users can update own images"
on storage.objects
for update
using (
  bucket_id = 'document-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own images
drop policy if exists "Users can delete own images" on storage.objects;
create policy "Users can delete own images"
on storage.objects
for delete
using (
  bucket_id = 'document-images'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- Comments for documentation
-- ============================================================================

comment on column storage.buckets.public is 'Public bucket allows direct URL access to images';
comment on column storage.buckets.file_size_limit is 'Maximum file size: 5MB (5242880 bytes)';
comment on column storage.buckets.allowed_mime_types is 'Allowed image formats: JPEG, PNG, GIF, WebP';

