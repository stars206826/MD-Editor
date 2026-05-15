import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";
import type { SearchResult } from "@/lib/types";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { userId, isAuthDisabled } = await getUserIdOrDev(supabase);

  if (!userId && !isAuthDisabled) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!userId && isAuthDisabled) {
    return NextResponse.json(
      { error: "DEV_USER_ID is required when auth is disabled" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const { query } = body;

    // Validate query
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Sanitize query for PostgreSQL full-text search
    // Remove special characters that could break tsquery
    const sanitizedQuery = trimmedQuery
      .replace(/[^\w\s\u4e00-\u9fa5]/g, " ") // Keep alphanumeric, spaces, and Chinese characters
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .join(" & "); // Use AND logic for multiple terms

    if (!sanitizedQuery) {
      return NextResponse.json({ results: [] });
    }

    // Execute full-text search using PostgreSQL
    // Search in both title and content fields
    const { data, error } = await supabase.rpc("search_documents", {
      search_query: sanitizedQuery,
      user_id_param: userId,
    });

    if (error) {
      // If the RPC function doesn't exist, fall back to ILIKE search
      if (error.code === "42883") {
        // Function does not exist, use fallback
        const likePattern = `%${trimmedQuery}%`;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("documents")
          .select("id, title, content, updated_at")
          .eq("user_id", userId)
          .or(`title.ilike.${likePattern},content.ilike.${likePattern}`)
          .order("updated_at", { ascending: false })
          .limit(50);

        if (fallbackError) {
          return NextResponse.json(
            { error: fallbackError.message },
            { status: 500 }
          );
        }

        // Transform fallback results
        const results: SearchResult[] = (fallbackData || []).map((doc) => {
          const titleMatches = countMatches(doc.title, trimmedQuery);
          const contentMatches = countMatches(doc.content, trimmedQuery);
          const matchCount = titleMatches + contentMatches;

          return {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            excerpt: generateExcerpt(doc.content, trimmedQuery),
            matchCount,
            updated_at: doc.updated_at,
          };
        });

        // Sort by match count (relevance)
        results.sort((a, b) => b.matchCount - a.matchCount);

        return NextResponse.json({ results });
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform RPC results to SearchResult format
    const results: SearchResult[] = (data || []).map((doc: any) => ({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      excerpt: doc.excerpt || generateExcerpt(doc.content, trimmedQuery),
      matchCount: doc.match_count || 0,
      updated_at: doc.updated_at,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Helper function to count matches in text
function countMatches(text: string, query: string): number {
  if (!text || !query) return 0;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter(Boolean);

  let count = 0;
  for (const term of terms) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = text.match(regex);
    count += matches ? matches.length : 0;
  }

  return count;
}

// Helper function to generate excerpt with context
function generateExcerpt(content: string, query: string, contextLength = 50): string {
  if (!content) return "";

  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter(Boolean);

  // Find the first match position
  let matchPos = -1;
  for (const term of terms) {
    const pos = lowerContent.indexOf(term);
    if (pos !== -1 && (matchPos === -1 || pos < matchPos)) {
      matchPos = pos;
    }
  }

  if (matchPos === -1) {
    // No match found, return beginning of content
    return content.substring(0, 150).trim() + (content.length > 150 ? "..." : "");
  }

  // Calculate excerpt boundaries
  const start = Math.max(0, matchPos - contextLength);
  const end = Math.min(content.length, matchPos + contextLength + query.length);

  let excerpt = content.substring(start, end).trim();

  // Add ellipsis if needed
  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt = excerpt + "...";

  return excerpt;
}
