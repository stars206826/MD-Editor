import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";
import { createHash } from "crypto";

// POST /api/versions/restore - Restore a document to a specific version
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
    const { version_id } = body;

    // Validation
    if (!version_id || typeof version_id !== "string") {
      return NextResponse.json(
        { error: "Version ID is required" },
        { status: 400 }
      );
    }

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
      .from("document_versions")
      .select("*")
      .eq("id", version_id)
      .single();

    if (versionError || !version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }

    // Verify user owns the document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id, title, content")
      .eq("id", version.document_id)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    // Update the document with the version's content
    const { data: updatedDocument, error: updateError } = await supabase
      .from("documents")
      .update({
        title: version.title,
        content: version.content,
        updated_at: new Date().toISOString(),
      })
      .eq("id", version.document_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Create a new version for the restore action
    // Calculate content hash
    const contentHash = createHash("sha256")
      .update(version.title + version.content)
      .digest("hex");

    // Get the next version number
    const { data: maxVersionData } = await supabase
      .from("document_versions")
      .select("version_number")
      .eq("document_id", version.document_id)
      .order("version_number", { ascending: false })
      .limit(1)
      .single();

    const nextVersionNumber = maxVersionData
      ? maxVersionData.version_number + 1
      : 1;

    // Create new version (this represents the restore action)
    const { data: newVersion, error: newVersionError } = await supabase
      .from("document_versions")
      .insert({
        document_id: version.document_id,
        title: version.title,
        content: version.content,
        version_number: nextVersionNumber,
        content_hash: contentHash,
      })
      .select()
      .single();

    if (newVersionError) {
      // Log error but don't fail the restore operation
      console.error("Failed to create version after restore:", newVersionError);
    }

    return NextResponse.json({
      document: updatedDocument,
      version: newVersion,
      message: `Document restored to version ${version.version_number}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
