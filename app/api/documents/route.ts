import { NextRequest, NextResponse } from "next/server";

import { createClient, getUserIdOrDev } from "@/lib/supabase/server";
import type { SortField, SortOrder } from "@/lib/types";

export async function GET(request: NextRequest) {
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

  // Parse query parameters
  const searchParams = request.nextUrl.searchParams;
  const sortBy = (searchParams.get("sortBy") as SortField) || "updated_at";
  const order = (searchParams.get("order") as SortOrder) || "desc";
  const tagsParam = searchParams.get("tags");
  
  // Validate sort parameters
  const validSortFields: SortField[] = ["created_at", "updated_at", "title"];
  const validOrders: SortOrder[] = ["asc", "desc"];
  
  if (!validSortFields.includes(sortBy)) {
    return NextResponse.json(
      { error: "Invalid sortBy parameter. Must be one of: created_at, updated_at, title" },
      { status: 400 }
    );
  }
  
  if (!validOrders.includes(order)) {
    return NextResponse.json(
      { error: "Invalid order parameter. Must be one of: asc, desc" },
      { status: 400 }
    );
  }

  try {
    // Parse tag IDs if provided (comma-separated)
    const tagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

    let query;

    if (tagIds.length > 0) {
      // Filter by tags using JOIN with document_tags
      // Use AND logic: document must have ALL specified tags
      query = supabase
        .from("documents")
        .select(`
          id, user_id, title, content, created_at, updated_at,
          document_tags(tag_id, tags(id, user_id, name, color, created_at))
        `)
        .eq("user_id", userId);

      // For each tag, ensure the document has it (AND logic)
      // We'll use a subquery approach by filtering documents that have all tags
      const { data: documentsWithTags, error: tagError } = await supabase
        .from("document_tags")
        .select("document_id")
        .in("tag_id", tagIds);

      if (tagError) {
        console.error("/api/documents tag filter error", {
          message: tagError.message,
          code: tagError.code,
          details: tagError.details,
        });
        return NextResponse.json({ error: tagError.message }, { status: 500 });
      }

      if (!documentsWithTags || documentsWithTags.length === 0) {
        // No documents have any of these tags
        return NextResponse.json({ documents: [] });
      }

      // Count occurrences of each document_id
      const documentCounts = documentsWithTags.reduce((acc, { document_id }) => {
        acc[document_id] = (acc[document_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Filter to only documents that have ALL tags (count equals tagIds.length)
      const documentIdsWithAllTags = Object.entries(documentCounts)
        .filter(([_, count]) => count === tagIds.length)
        .map(([docId]) => docId);

      if (documentIdsWithAllTags.length === 0) {
        // No documents have all the specified tags
        return NextResponse.json({ documents: [] });
      }

      // Filter documents by the IDs that have all tags
      query = query.in("id", documentIdsWithAllTags);
    } else {
      // No tag filtering, just get all user's documents
      query = supabase
        .from("documents")
        .select(`
          id, user_id, title, content, created_at, updated_at,
          document_tags(tag_id, tags(id, user_id, name, color, created_at))
        `)
        .eq("user_id", userId);
    }

    // Apply sorting
    const ascending = order === "asc";
    query = query.order(sortBy, { ascending });

    const { data, error } = await query;

    if (error) {
      console.error("/api/documents query error", {
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform the data to extract tags from the join result
    const documents = (data || []).map((doc: any) => {
      const tags = doc.document_tags?.map((dt: any) => dt.tags).filter(Boolean) || [];
      const { document_tags, ...rest } = doc;
      return { ...rest, tags };
    });

    return NextResponse.json({ documents });
  } catch (err) {
    console.error("/api/documents unexpected error", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
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

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      title: "未命名文档",
      content: "# 开始写作\n\n在这里记录你的想法。",
    })
    .select("id, user_id, title, content, created_at, updated_at")
    .single();

  if (error) {
    console.error("/api/documents create error", {
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}
