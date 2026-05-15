import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
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

  // Fetch document
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("id, user_id, title, content, created_at, updated_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (docError) {
    return NextResponse.json({ error: docError.message }, { status: 500 });
  }

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  // Fetch tags for this document
  const { data: documentTags, error: tagsError } = await supabase
    .from("document_tags")
    .select("tag_id, tags(id, user_id, name, color, created_at)")
    .eq("document_id", id);

  if (tagsError) {
    return NextResponse.json({ error: tagsError.message }, { status: 500 });
  }

  // Extract tags from the join result
  const tags = documentTags?.map((dt: any) => dt.tags).filter(Boolean) || [];

  return NextResponse.json({ document: { ...document, tags } });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
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

  const body = (await request.json()) as {
    title?: string;
    content?: string;
  };

  const updates: { title?: string; content?: string } = {};

  if (typeof body.title === "string") {
    updates.title = body.title.trim() || "未命名文档";
  }

  if (typeof body.content === "string") {
    updates.content = body.content;
  }

  const { data, error } = await supabase
    .from("documents")
    .update(updates)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, user_id, title, content, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Automatically create version snapshot after successful save
  // This is done asynchronously and errors are handled gracefully
  try {
    await createVersionSnapshot(supabase, id, data.title, data.content);
  } catch (versionError) {
    // Log the error but don't fail the save operation
    console.error("Failed to create version snapshot:", versionError);
    // Version creation failure should not affect the document save
  }

  return NextResponse.json({ document: data });
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
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

  const { error } = await supabase.from("documents").delete().eq("id", id).eq("user_id", userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Helper function to create a version snapshot
 * Implements deduplication based on content hash
 * @param supabase - Supabase client
 * @param documentId - Document ID
 * @param title - Document title
 * @param content - Document content
 */
async function createVersionSnapshot(
  supabase: any,
  documentId: string,
  title: string,
  content: string
): Promise<void> {
  // Calculate content hash (SHA-256)
  const contentHash = createHash("sha256")
    .update(title + content)
    .digest("hex");

  // Check if latest version has the same hash (deduplication)
  const { data: latestVersion } = await supabase
    .from("document_versions")
    .select("content_hash")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersion && latestVersion.content_hash === contentHash) {
    // Content hasn't changed, skip version creation
    return;
  }

  // Get the next version number
  const { data: maxVersionData } = await supabase
    .from("document_versions")
    .select("version_number")
    .eq("document_id", documentId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextVersionNumber = maxVersionData
    ? maxVersionData.version_number + 1
    : 1;

  // Create new version
  const { error: versionError } = await supabase
    .from("document_versions")
    .insert({
      document_id: documentId,
      title,
      content,
      version_number: nextVersionNumber,
      content_hash: contentHash,
    });

  if (versionError) {
    throw new Error(`Failed to create version: ${versionError.message}`);
  }

  // Note: The cleanup_old_versions trigger will automatically prune versions beyond 50
}
