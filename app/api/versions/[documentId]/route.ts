import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

// GET /api/versions/[documentId] - List versions for a document
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
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

  const { documentId } = await params;

  if (!documentId) {
    return NextResponse.json(
      { error: "Document ID is required" },
      { status: 400 }
    );
  }

  // Verify user owns the document
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, user_id")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docError || !document) {
    return NextResponse.json(
      { error: "Document not found or access denied" },
      { status: 404 }
    );
  }

  // Get all versions for this document, ordered by version number descending
  const { data: versions, error: versionsError } = await supabase
    .from("document_versions")
    .select("*")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false });

  if (versionsError) {
    return NextResponse.json(
      { error: versionsError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ versions: versions || [] });
}
