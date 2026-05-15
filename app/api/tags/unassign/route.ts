import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

// DELETE /api/tags/unassign - Remove a tag from a document
export async function DELETE(request: NextRequest) {
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

    // Remove the tag assignment
    const { error } = await supabase
      .from("document_tags")
      .delete()
      .eq("document_id", document_id)
      .eq("tag_id", tag_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
