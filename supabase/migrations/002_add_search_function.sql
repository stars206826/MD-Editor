-- Migration: Add Full-Text Search Function
-- Description: Creates RPC function for document search with PostgreSQL full-text search
-- Requirements: 1.1, 1.2, 1.4, 1.5, 1.7, 11.2

-- ============================================================================
-- Function: search_documents
-- Purpose: Full-text search across document titles and content
-- ============================================================================

create or replace function public.search_documents(
  search_query text,
  user_id_param uuid
)
returns table (
  id uuid,
  title text,
  content text,
  excerpt text,
  match_count bigint,
  updated_at timestamptz,
  rank real
) as $$
begin
  return query
  select
    d.id,
    d.title,
    d.content,
    -- Generate excerpt with ts_headline (Requirement 1.3: 20 words context)
    ts_headline(
      'english',
      d.content,
      to_tsquery('english', search_query),
      'MaxWords=20, MinWords=10, StartSel=<mark>, StopSel=</mark>'
    ) as excerpt,
    -- Count matches in title and content
    (
      (length(lower(d.title)) - length(replace(lower(d.title), lower(split_part(search_query, ' & ', 1)), ''))) / 
      greatest(length(split_part(search_query, ' & ', 1)), 1) +
      (length(lower(d.content)) - length(replace(lower(d.content), lower(split_part(search_query, ' & ', 1)), ''))) / 
      greatest(length(split_part(search_query, ' & ', 1)), 1)
    )::bigint as match_count,
    d.updated_at,
    -- Calculate relevance score using ts_rank (Requirement 1.4)
    ts_rank(
      to_tsvector('english', d.title || ' ' || d.content),
      to_tsquery('english', search_query)
    ) as rank
  from public.documents d
  where
    -- Requirement 1.7: Only return documents owned by authenticated user
    d.user_id = user_id_param
    and (
      -- Requirement 1.2: Search both title and content fields
      to_tsvector('english', d.title) @@ to_tsquery('english', search_query)
      or to_tsvector('english', d.content) @@ to_tsquery('english', search_query)
    )
  -- Requirement 1.4: Sort by relevance score descending
  order by rank desc
  -- Requirement 1.5: Return max 50 results
  limit 50;
end;
$$ language plpgsql security definer;

-- Grant execute permission to authenticated users
grant execute on function public.search_documents(text, uuid) to authenticated;

-- Add comment for documentation
comment on function public.search_documents is 'Full-text search for documents using PostgreSQL ts_query and ts_rank. Returns up to 50 results sorted by relevance.';

-- ============================================================================
-- Optional: Add GIN indexes for better full-text search performance
-- ============================================================================

-- Create GIN index on title for full-text search
create index if not exists idx_documents_title_fts 
on public.documents 
using gin(to_tsvector('english', title));

-- Create GIN index on content for full-text search
create index if not exists idx_documents_content_fts 
on public.documents 
using gin(to_tsvector('english', content));

-- Create composite GIN index for combined title and content search
create index if not exists idx_documents_title_content_fts 
on public.documents 
using gin(to_tsvector('english', title || ' ' || content));

-- Add comment
comment on index idx_documents_title_fts is 'GIN index for full-text search on document titles';
comment on index idx_documents_content_fts is 'GIN index for full-text search on document content';
comment on index idx_documents_title_content_fts is 'GIN index for combined title and content full-text search';
