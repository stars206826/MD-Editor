/**
 * Share Link Access API Route
 * 
 * Handles public access to shared documents via token.
 * Requirements: 8.7, 8.8, 8.9, 8.10, 10.6
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import bcrypt from "bcryptjs";

interface AccessShareLinkBody {
  password?: string;
}

/**
 * GET /api/share/[token]
 * 
 * Access a shared document by token (public access)
 * Requirements: 8.7, 8.8, 8.9, 8.10
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // Fetch share link
    const { data: shareLink, error: fetchError } = await supabase
      .from("share_links")
      .select("id, document_id, expires_at, password_hash, view_count, last_viewed_at")
      .eq("token", token)
      .single();

    if (fetchError || !shareLink) {
      return NextResponse.json(
        { error: "Share link not found" },
        { status: 404 }
      );
    }

    // Check if expired (Requirement 8.9)
    if (shareLink.expires_at) {
      const expirationDate = new Date(shareLink.expires_at);
      const now = new Date();
      
      if (now > expirationDate) {
        return NextResponse.json(
          { 
            error: "This share link has expired",
            expired: true,
            expires_at: shareLink.expires_at,
          },
          { status: 410 } // 410 Gone
        );
      }
    }

    // Check if password-protected (Requirement 8.10)
    if (shareLink.password_hash) {
      return NextResponse.json(
        {
          success: true,
          requiresPassword: true,
          shareLink: {
            id: shareLink.id,
            document_id: shareLink.document_id,
            expires_at: shareLink.expires_at,
            view_count: shareLink.view_count,
            last_viewed_at: shareLink.last_viewed_at,
          },
        },
        { status: 200 }
      );
    }

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, title, content, created_at, updated_at")
      .eq("id", shareLink.document_id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Increment view count and update last_viewed_at (Requirement 8.7, 8.8)
    const { error: updateError } = await supabase
      .from("share_links")
      .update({
        view_count: shareLink.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", shareLink.id);

    if (updateError) {
      console.error("Failed to update share link stats:", updateError);
      // Continue anyway - not critical
    }

    // Return document
    return NextResponse.json({
      success: true,
      requiresPassword: false,
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        created_at: document.created_at,
        updated_at: document.updated_at,
      },
      shareLink: {
        view_count: shareLink.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Share link access error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to access share link" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/share/[token]
 * 
 * Access a password-protected shared document
 * Requirements: 8.10
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const supabase = await createClient();

    // Parse request body
    const body: AccessShareLinkBody = await request.json();
    const { password } = body;

    // Fetch share link
    const { data: shareLink, error: fetchError } = await supabase
      .from("share_links")
      .select("id, document_id, expires_at, password_hash, view_count, last_viewed_at")
      .eq("token", token)
      .single();

    if (fetchError || !shareLink) {
      return NextResponse.json(
        { error: "Share link not found" },
        { status: 404 }
      );
    }

    // Check if expired (Requirement 8.9)
    if (shareLink.expires_at) {
      const expirationDate = new Date(shareLink.expires_at);
      const now = new Date();
      
      if (now > expirationDate) {
        return NextResponse.json(
          { 
            error: "This share link has expired",
            expired: true,
            expires_at: shareLink.expires_at,
          },
          { status: 410 } // 410 Gone
        );
      }
    }

    // Verify password (Requirement 8.10)
    if (!shareLink.password_hash) {
      return NextResponse.json(
        { error: "This share link is not password-protected" },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }

    const isPasswordValid = await bcrypt.compare(password, shareLink.password_hash);
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      );
    }

    // Fetch document
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, title, content, created_at, updated_at")
      .eq("id", shareLink.document_id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Increment view count and update last_viewed_at (Requirement 8.7, 8.8)
    const { error: updateError } = await supabase
      .from("share_links")
      .update({
        view_count: shareLink.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      })
      .eq("id", shareLink.id);

    if (updateError) {
      console.error("Failed to update share link stats:", updateError);
      // Continue anyway - not critical
    }

    // Return document
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        title: document.title,
        content: document.content,
        created_at: document.created_at,
        updated_at: document.updated_at,
      },
      shareLink: {
        view_count: shareLink.view_count + 1,
        last_viewed_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Share link password verification error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to verify password" },
      { status: 500 }
    );
  }
}
