import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";
import { createHash } from "crypto";

// POST /api/versions - Create a new version with deduplication
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
    const { document_id, title, content } = body;

    // Validation
    if (!document_id || typeof document_id !== "string") {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    // Verify user owns the document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id")
      .eq("id", document_id)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    // Calculate content hash (SHA-256)
    const contentHash = createHash("sha256")
      .update(title + content)
      .digest("hex");

    // Check if latest version has the same hash (deduplication)
    const { data: latestVersion } = await supabase
      .from("document_versions")
      .select("content_hash")
      .eq("document_id", document_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    if (latestVersion && latestVersion.content_hash === contentHash) {
      // Content hasn't changed, return the latest version without creating a new one
      const { data: existingVersion } = await supabase
        .from("document_versions")
        .select("*")
        .eq("document_id", document_id)
        .eq("content_hash", contentHash)
        .order("version_number", { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        version: existingVersion,
        message: "No changes detected, version not created",
      });
    }

    // Get the next version number
    const { data: maxVersionData } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("document_id", document_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = maxVersionData
      ? maxVersionData.version_number + 1
      : 1;

    // Create new version
    const { data: newVersion, error: versionError } = await supabase
      .from("document_versions")
      .insert({
        document_id,
        title,
        content,
        version_number: nextVersionNumber,
        content_hash: contentHash,
      })
      .select()
      .single();

    if (versionError) {
      return NextResponse.json(
        { error: versionError.message },
        { status: 500 }
      );
    }

    // Note: The cleanup_old_versions trigger will automatically prune versions beyond 50

    return NextResponse.json({ version: newVersion }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
