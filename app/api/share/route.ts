/**
 * Share Link API Route
 * 
 * Handles creation and management of public share links for documents.
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.11, 10.6
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

interface CreateShareLinkBody {
  documentId: string;
  expiresInDays?: number;
  password?: string;
}

/**
 * POST /api/share
 * 
 * Create a new share link for a document
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
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
    const body: CreateShareLinkBody = await request.json();
    const { documentId, expiresInDays, password } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Revoke existing share link for this document (Requirement 8.6)
    const { error: revokeError } = await supabase
      .from("share_links")
      .delete()
      .eq("document_id", documentId);

    if (revokeError) {
      console.error("Failed to revoke existing share link:", revokeError);
      // Continue anyway - not critical
    }

    // Generate unique 32-character URL-safe token (Requirement 8.1, 8.2)
    let token: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!isUnique && attempts < maxAttempts) {
      token = generateUrlSafeToken(32);
      
      // Check if token is unique
      const { data: existing } = await supabase
        .from("share_links")
        .select("id")
        .eq("token", token)
        .single();

      if (!existing) {
        isUnique = true;
      }
      
      attempts++;
    }

    if (!isUnique) {
      return NextResponse.json(
        { error: "Failed to generate unique token. Please try again." },
        { status: 500 }
      );
    }

    // Calculate expiration date (Requirement 8.3)
    let expiresAt: string | null = null;
    if (expiresInDays && expiresInDays > 0) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + expiresInDays);
      expiresAt = expirationDate.toISOString();
    }

    // Hash password if provided (Requirement 8.4, 8.5)
    let passwordHash: string | null = null;
    if (password && password.trim()) {
      passwordHash = await bcrypt.hash(password, 10); // 10 salt rounds
    }

    // Create share link
    const { data: shareLink, error: createError } = await supabase
      .from("share_links")
      .insert({
        document_id: documentId,
        user_id: userId, // 添加 user_id 字段
        token: token!,
        expires_at: expiresAt,
        password_hash: passwordHash,
        view_count: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error("Failed to create share link:", createError);
      return NextResponse.json(
        { error: "Failed to create share link" },
        { status: 500 }
      );
    }

    // Return share link (without password hash)
    return NextResponse.json({
      success: true,
      shareLink: {
        id: shareLink.id,
        token: shareLink.token,
        document_id: shareLink.document_id,
        expires_at: shareLink.expires_at,
        has_password: !!passwordHash,
        view_count: shareLink.view_count,
        last_viewed_at: shareLink.last_viewed_at,
        created_at: shareLink.created_at,
      },
    });
  } catch (error) {
    console.error("Share link creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create share link" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/share?documentId={id}
 * 
 * Get the current share link for a document
 */
export async function GET(request: NextRequest) {
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

    // Get document ID from query params
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Verify document ownership
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get share link
    const { data: shareLink, error: fetchError } = await supabase
      .from("share_links")
      .select("id, token, document_id, expires_at, password_hash, view_count, last_viewed_at, created_at")
      .eq("document_id", documentId)
      .single();

    if (fetchError) {
      // No share link exists
      return NextResponse.json({
        success: true,
        shareLink: null,
      });
    }

    // Return share link (without password hash)
    return NextResponse.json({
      success: true,
      shareLink: {
        id: shareLink.id,
        token: shareLink.token,
        document_id: shareLink.document_id,
        expires_at: shareLink.expires_at,
        has_password: !!shareLink.password_hash,
        view_count: shareLink.view_count,
        last_viewed_at: shareLink.last_viewed_at,
        created_at: shareLink.created_at,
      },
    });
  } catch (error) {
    console.error("Share link fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch share link" },
      { status: 500 }
    );
  }
}

/**
 * Generate a URL-safe random token
 * 
 * @param length The length of the token in characters
 * @returns A URL-safe random token
 */
function generateUrlSafeToken(length: number): string {
  // Generate random bytes (need more bytes than characters due to base64 encoding)
  const bytes = randomBytes(Math.ceil(length * 3 / 4));
  
  // Convert to base64 and make URL-safe
  return bytes
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .substring(0, length);
}
