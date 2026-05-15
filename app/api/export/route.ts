/**
 * Export API Route
 * 
 * Handles document export in multiple formats: HTML, Markdown, and plain text.
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.7
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";
import { remark } from "remark";
import remarkHtml from "remark-html";
import removeMarkdown from "remove-markdown";

export type ExportFormat = "html" | "markdown" | "text";

interface ExportRequestBody {
  documentId: string;
  format: ExportFormat;
  includeImages?: boolean;
  stylingTheme?: "light" | "dark";
  filename?: string;
}

/**
 * POST /api/export
 * 
 * Export a document in the specified format
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
    const body: ExportRequestBody = await request.json();
    const { documentId, format, includeImages = true, stylingTheme = "light", filename } = body;

    // Validate format
    const validFormats: ExportFormat[] = ["html", "markdown", "text"];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(", ")}` },
        { status: 400 }
      );
    }

    // Fetch document
    const { data: document, error: fetchError } = await supabase
      .from("documents")
      .select("id, title, content, user_id")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Generate export based on format
    let exportData: string;
    let mimeType: string;
    let fileExtension: string;

    switch (format) {
      case "markdown":
        // Return raw Markdown content (Requirement 7.2)
        exportData = document.content;
        mimeType = "text/markdown";
        fileExtension = "md";
        break;

      case "text":
        // Strip all Markdown syntax (Requirement 7.3)
        exportData = removeMarkdown(document.content);
        mimeType = "text/plain";
        fileExtension = "txt";
        break;

      case "html":
        // Convert Markdown to HTML with CSS styling (Requirement 7.4)
        exportData = await convertToHtml(
          document.title,
          document.content,
          includeImages,
          stylingTheme
        );
        mimeType = "text/html";
        fileExtension = "html";
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported format" },
          { status: 400 }
        );
    }

    // Return text-based exports
    const exportFilename = filename?.trim() || document.title;

    return new NextResponse(exportData, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": buildContentDisposition(exportFilename, fileExtension),
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}

/**
 * Convert Markdown to HTML with CSS styling (Requirement 7.4, 7.7)
 */
async function convertToHtml(
  title: string,
  content: string,
  includeImages: boolean,
  theme: "light" | "dark"
): Promise<string> {
  // Convert Markdown to HTML
  const result = await remark()
    .use(remarkHtml, { sanitize: false })
    .process(content);

  const htmlContent = result.toString();

  // Apply CSS styling based on theme
  const styles = theme === "dark" ? getDarkThemeStyles() : getLightThemeStyles();

  // Build complete HTML document
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
    ${styles}
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(title)}</h1>
    ${htmlContent}
  </article>
</body>
</html>`;

  return html;
}

/**
 * Light theme CSS styles
 */
function getLightThemeStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      background-color: #ffffff;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }
    
    article {
      background: #ffffff;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: #111827;
      border-bottom: 2px solid #e5e7eb;
      padding-bottom: 0.5rem;
    }
    
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #374151;
    }
    
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #4b5563;
    }
    
    p {
      margin-bottom: 1rem;
    }
    
    a {
      color: #3b82f6;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    code {
      background-color: #f3f4f6;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #dc2626;
    }
    
    pre {
      background-color: #1f2937;
      color: #f9fafb;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 1rem;
    }
    
    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
    
    blockquote {
      border-left: 4px solid #3b82f6;
      padding-left: 1rem;
      margin: 1rem 0;
      color: #6b7280;
      font-style: italic;
    }
    
    ul, ol {
      margin-left: 2rem;
      margin-bottom: 1rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 1rem 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }
    
    th, td {
      border: 1px solid #e5e7eb;
      padding: 0.75rem;
      text-align: left;
    }
    
    th {
      background-color: #f9fafb;
      font-weight: 600;
    }
  `;
}

/**
 * Dark theme CSS styles
 */
function getDarkThemeStyles(): string {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #e5e7eb;
      background-color: #0f172a;
      padding: 2rem;
      max-width: 800px;
      margin: 0 auto;
    }
    
    article {
      background: #1e293b;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    }
    
    h1 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      color: #f9fafb;
      border-bottom: 2px solid #334155;
      padding-bottom: 0.5rem;
    }
    
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 1rem;
      color: #f1f5f9;
    }
    
    h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.75rem;
      color: #cbd5e1;
    }
    
    p {
      margin-bottom: 1rem;
    }
    
    a {
      color: #60a5fa;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    code {
      background-color: #334155;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
      color: #fca5a5;
    }
    
    pre {
      background-color: #0f172a;
      color: #f9fafb;
      padding: 1rem;
      border-radius: 6px;
      overflow-x: auto;
      margin-bottom: 1rem;
    }
    
    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
    
    blockquote {
      border-left: 4px solid #60a5fa;
      padding-left: 1rem;
      margin: 1rem 0;
      color: #94a3b8;
      font-style: italic;
    }
    
    ul, ol {
      margin-left: 2rem;
      margin-bottom: 1rem;
    }
    
    li {
      margin-bottom: 0.5rem;
    }
    
    img {
      max-width: 100%;
      height: auto;
      border-radius: 6px;
      margin: 1rem 0;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 1rem;
    }
    
    th, td {
      border: 1px solid #334155;
      padding: 0.75rem;
      text-align: left;
    }
    
    th {
      background-color: #1e293b;
      font-weight: 600;
    }
  `;
}

/**
 * Sanitize filename for safe file download
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]/gi, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 100);
}

function toAsciiFilename(filename: string): string {
  return filename.replace(/[^\x20-\x7E]/g, "_");
}

function buildContentDisposition(filename: string, extension: string): string {
  const sanitized = sanitizeFilename(filename);
  const baseName = sanitized || "document";
  const asciiBase = toAsciiFilename(baseName) || "document";
  const fullName = `${baseName}.${extension}`;
  const asciiName = `${asciiBase}.${extension}`;
  const encodedName = encodeURIComponent(fullName);

  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
