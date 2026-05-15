import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

// POST /api/tags/assign - Assign a tag to a document
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
    const { document_id, tag_id } = body;

    // Validation
    if (!document_id || !tag_id) {
      return NextResponse.json(
        { error: "document_id and tag_id are required" },
        { status: 400 }
      );
    }

    // Verify the document belongs to the user
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id")
      .eq("id", document_id)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Verify the tag belongs to the user
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .select("id")
      .eq("id", tag_id)
      .eq("user_id", userId)
      .single();

    if (tagError || !tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Check if document already has 10 tags
    const { count, error: countError } = await supabase
      .from("document_tags")
      .select("*", { count: "exact", head: true })
      .eq("document_id", document_id);

    if (countError) {
      return NextResponse.json(
        { error: countError.message },
        { status: 500 }
      );
    }

    if (count !== null && count >= 10) {
      return NextResponse.json(
        { error: "Document cannot have more than 10 tags" },
        { status: 400 }
      );
    }

    // Assign the tag to the document
    const { data, error } = await supabase
      .from("document_tags")
      .insert({
        document_id,
        tag_id,
      })
      .select()
      .single();

    if (error) {
      // Check for duplicate assignment
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Tag is already assigned to this document" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ document_tag: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
