-- Migration: Add Comprehensive Editor Enhancements
-- Description: Adds tables for tags, document_tags, document_versions, document_images, and share_links
-- Requirements: 4.1, 4.2, 5.1, 5.4, 6.1, 6.4, 8.1, 8.2, 10.1

-- ============================================================================
-- Table: tags
-- Purpose: Store user-defined tags for document categorization
-- ============================================================================

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#3b82f6',
  created_at timestamptz not null default timezone('utc', now()),
  constraint tags_name_length check (char_length(name) <= 50),
  constraint tags_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  unique(user_id, name)
);

-- Enable RLS
alter table public.tags enable row level security;

-- RLS Policies for tags
drop policy if exists "Users can view own tags" on public.tags;
create policy "Users can view own tags"
on public.tags
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own tags" on public.tags;
create policy "Users can insert own tags"
on public.tags
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update own tags" on public.tags;
create policy "Users can update own tags"
on public.tags
for update
using (auth.uid() = user_id);

drop policy if exists "Users can delete own tags" on public.tags;
create policy "Users can delete own tags"
on public.tags
for delete
using (auth.uid() = user_id);

-- Index for tag queries
create index if not exists idx_tags_user_id on public.tags(user_id);

-- ============================================================================
-- Table: document_tags
-- Purpose: Junction table for many-to-many relationship between documents and tags
-- ============================================================================

create table if not exists public.document_tags (
  document_id uuid not null references public.documents(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (document_id, tag_id)
);

-- Enable RLS
alter table public.document_tags enable row level security;

-- RLS Policies for document_tags
drop policy if exists "Users can view own document_tags" on public.document_tags;
create policy "Users can view own document_tags"
on public.document_tags
for select
using (
  exists (
    select 1 from public.documents
    where documents.id = document_tags.document_id
    and documents.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own document_tags" on public.document_tags;
create policy "Users can insert own document_tags"
on public.document_tags
for insert
with check (
  exists (
    select 1 from public.documents
    where documents.id = document_tags.document_id
    and documents.user_id = auth.uid()
  )
  and
  exists (
    select 1 from public.tags
    where tags.id = document_tags.tag_id
    and tags.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own document_tags" on public.document_tags;
create policy "Users can delete own document_tags"
on public.document_tags
for delete
using (
  exists (
    select 1 from public.documents
    where documents.id = document_tags.document_id
    and documents.user_id = auth.uid()
  )
);

-- Indexes for document_tags
create index if not exists idx_document_tags_document_id on public.document_tags(document_id);
create index if not exists idx_document_tags_tag_id on public.document_tags(tag_id);

-- ============================================================================
-- Table: document_versions
-- Purpose: Store historical snapshots of documents for version control
-- ============================================================================

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  title text not null,
  content text not null,
  version_number int not null,
  content_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint document_versions_version_number_positive check (version_number > 0)
);

-- Enable RLS
alter table public.document_versions enable row level security;

-- RLS Policies for document_versions
drop policy if exists "Users can view own document_versions" on public.document_versions;
create policy "Users can view own document_versions"
on public.document_versions
for select
using (
  exists (
    select 1 from public.documents
    where documents.id = document_versions.document_id
    and documents.user_id = auth.uid()
  )
);

drop policy if exists "Users can insert own document_versions" on public.document_versions;
create policy "Users can insert own document_versions"
on public.document_versions
for insert
with check (
  exists (
    select 1 from public.documents
    where documents.id = document_versions.document_id
    and documents.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own document_versions" on public.document_versions;
create policy "Users can delete own document_versions"
on public.document_versions
for delete
using (
  exists (
    select 1 from public.documents
    where documents.id = document_versions.document_id
    and documents.user_id = auth.uid()
  )
);

-- Indexes for document_versions
create index if not exists idx_document_versions_document_id on public.document_versions(document_id);
create index if not exists idx_document_versions_created_at on public.document_versions(created_at desc);
create index if not exists idx_document_versions_content_hash on public.document_versions(content_hash);

-- ============================================================================
-- Table: document_images
-- Purpose: Track images uploaded to Supabase Storage for documents
-- ============================================================================

create table if not exists public.document_images (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  storage_path text not null unique,
  public_url text not null,
  size int not null,
  mime_type text not null,
  width int,
  height int,
  created_at timestamptz not null default timezone('utc', now()),
  constraint document_images_filename_length check (char_length(filename) <= 255),
  constraint document_images_size_limit check (size <= 5242880),
  constraint document_images_mime_type_valid check (
    mime_type in ('image/jpeg', 'image/png', 'image/gif', 'image/webp')
  ),
  constraint document_images_dimensions_positive check (
    (width is null or width > 0) and (height is null or height > 0)
  )
);

-- Enable RLS
alter table public.document_images enable row level security;

-- RLS Policies for document_images
drop policy if exists "Users can view own document_images" on public.document_images;
create policy "Users can view own document_images"
on public.document_images
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert own document_images" on public.document_images;
create policy "Users can insert own document_images"
on public.document_images
for insert
with check (
  auth.uid() = user_id
  and
  exists (
    select 1 from public.documents
    where documents.id = document_images.document_id
    and documents.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete own document_images" on public.document_images;
create policy "Users can delete own document_images"
on public.document_images
for delete
using (auth.uid() = user_id);

-- Indexes for document_images
create index if not exists idx_document_images_document_id on public.document_images(document_id);
create index if not exists idx_document_images_user_id on public.document_images(user_id);
create index if not exists idx_document_images_storage_path on public.document_images(storage_path);

-- ============================================================================
-- Table: share_links
-- Purpose: Store public share links for documents with optional expiration and password
-- ============================================================================

create table if not exists public.share_links (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  password_hash text,
  view_count int not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint share_links_token_length check (char_length(token) = 32),
  constraint share_links_view_count_non_negative check (view_count >= 0),
  constraint share_links_expires_at_future check (
    expires_at is null or expires_at > created_at
  )
);

-- Enable RLS
alter table public.share_links enable row level security;

-- RLS Policies for share_links
-- Users can view their own share links
drop policy if exists "Users can view own share_links" on public.share_links;
create policy "Users can view own share_links"
on public.share_links
for select
using (auth.uid() = user_id);

-- Public can view share links by token (for accessing shared documents)
drop policy if exists "Public can view share_links by token" on public.share_links;
create policy "Public can view share_links by token"
on public.share_links
for select
using (true);

-- Users can insert share links for their own documents
drop policy if exists "Users can insert own share_links" on public.share_links;
create policy "Users can insert own share_links"
on public.share_links
for insert
with check (
  auth.uid() = user_id
  and
  exists (
    select 1 from public.documents
    where documents.id = share_links.document_id
    and documents.user_id = auth.uid()
  )
);

-- Users can update their own share links (for view count increment)
drop policy if exists "Users can update own share_links" on public.share_links;
create policy "Users can update own share_links"
on public.share_links
for update
using (auth.uid() = user_id);

-- Public can update share links (for view count increment)
drop policy if exists "Public can update share_links view count" on public.share_links;
create policy "Public can update share_links view count"
on public.share_links
for update
using (true)
with check (true);

-- Users can delete their own share links
drop policy if exists "Users can delete own share_links" on public.share_links;
create policy "Users can delete own share_links"
on public.share_links
for delete
using (auth.uid() = user_id);

-- Indexes for share_links
create index if not exists idx_share_links_token on public.share_links(token);
create index if not exists idx_share_links_document_id on public.share_links(document_id);
create index if not exists idx_share_links_user_id on public.share_links(user_id);
create index if not exists idx_share_links_expires_at on public.share_links(expires_at) where expires_at is not null;

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to clean up old versions (keep only latest 50 per document)
create or replace function public.cleanup_old_versions()
returns trigger as $$
begin
  delete from public.document_versions
  where document_id = new.document_id
  and version_number <= (
    select max(version_number) - 50
    from public.document_versions
    where document_id = new.document_id
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to automatically cleanup old versions
drop trigger if exists trigger_cleanup_old_versions on public.document_versions;
create trigger trigger_cleanup_old_versions
after insert on public.document_versions
for each row
execute function public.cleanup_old_versions();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

comment on table public.tags is 'User-defined tags for document categorization';
comment on table public.document_tags is 'Junction table linking documents to tags (many-to-many)';
comment on table public.document_versions is 'Historical snapshots of documents for version control';
comment on table public.document_images is 'Metadata for images uploaded to Supabase Storage';
comment on table public.share_links is 'Public share links for documents with optional expiration and password';

comment on column public.tags.color is 'Hexadecimal color code for tag visualization (#RRGGBB)';
comment on column public.document_versions.content_hash is 'SHA-256 hash for deduplication';
comment on column public.document_versions.version_number is 'Sequential version number starting from 1';
comment on column public.document_images.storage_path is 'Path in Supabase Storage: {user_id}/{document_id}/{uuid}.{ext}';
comment on column public.document_images.size is 'File size in bytes (max 5MB)';
comment on column public.share_links.token is 'Unique 32-character URL-safe token';
comment on column public.share_links.password_hash is 'Bcrypt hash of password (if password-protected)';
