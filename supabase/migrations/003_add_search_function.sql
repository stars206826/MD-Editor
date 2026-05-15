-- Migration: Add full-text search function for documents
-- This function provides efficient full-text search across document titles and content
-- Uses PostgreSQL's built-in text search capabilities with ts_rank for relevance scoring

-- Create the search function
CREATE OR REPLACE FUNCTION search_documents(
  search_query TEXT,
  user_id_param UUID
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  updated_at TIMESTAMPTZ,
  excerpt TEXT,
  match_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.content,
    d.updated_at,
    -- Generate excerpt using ts_headline
    ts_headline(
      'english',
      d.content,
      to_tsquery('english', search_query),
      'MaxWords=20, MinWords=10, StartSel=**, StopSel=**'
    ) as excerpt,
    -- Calculate match count (approximate based on rank)
    CAST(
      ts_rank(
        to_tsvector('english', d.title || ' ' || d.content),
        to_tsquery('english', search_query)
      ) * 100 AS INTEGER
    ) as match_count
  FROM documents d
  WHERE 
    d.user_id = user_id_param
    AND (
      to_tsvector('english', d.title) @@ to_tsquery('english', search_query)
      OR to_tsvector('english', d.content) @@ to_tsquery('english', search_query)
    )
  ORDER BY 
    ts_rank(
      to_tsvector('english', d.title || ' ' || d.content),
      to_tsquery('english', search_query)
    ) DESC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_documents(TEXT, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION search_documents IS 'Full-text search function for documents. Searches both title and content fields, returns results sorted by relevance with excerpts.';
