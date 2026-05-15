/**
 * Share Link Revoke API Route
 * 
 * Handles revocation of share links.
 * Requirement: 8.11
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

interface RevokeShareLinkBody {
  shareLinkId: string;
}

/**
 * POST /api/share/revoke
 * 
 * Revoke a share link (delete it immediately)
 * Requirement: 8.11
 */
export async function POST(request: NextRequest) {
  try {
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

    // Parse request body
    const body: RevokeShareLinkBody = await request.json();
    const { shareLinkId } = body;

    if (!shareLinkId) {
      return NextResponse.json(
        { error: "Share link ID is required" },
        { status: 400 }
      );
    }

    // Fetch share link to verify ownership
    const { data: shareLink, error: fetchError } = await supabase
      .from("share_links")
      .select("id, document_id")
      .eq("id", shareLinkId)
      .single();

    if (fetchError || !shareLink) {
      return NextResponse.json(
        { error: "Share link not found" },
        { status: 404 }
      );
    }

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id")
      .eq("id", shareLink.document_id)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Unauthorized to revoke this share link" },
        { status: 403 }
      );
    }

    // Delete share link immediately (Requirement 8.11)
    const { error: deleteError } = await supabase
      .from("share_links")
      .delete()
      .eq("id", shareLinkId);

    if (deleteError) {
      console.error("Failed to revoke share link:", deleteError);
      return NextResponse.json(
        { error: "Failed to revoke share link" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Share link revoked successfully",
    });
  } catch (error) {
    console.error("Share link revocation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to revoke share link" },
      { status: 500 }
    );
  }
}
