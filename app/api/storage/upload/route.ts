import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

// Allowed image MIME types (Requirement 6.2)
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Maximum file size: 5MB (Requirement 6.3)
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5242880 bytes

// Helper function to get file extension from MIME type
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  return mimeToExt[mimeType] || "jpg";
}

// Helper function to generate UUID v4
function generateUUID(): string {
  return crypto.randomUUID();
}

// Helper function to extract image dimensions from buffer
// This is a simplified implementation that reads basic image headers
// For production, consider using a library like 'image-size' or 'sharp'
async function getImageDimensions(
  buffer: Uint8Array,
  mimeType: string
): Promise<{ width: number; height: number } | null> {
  try {
    // For now, we'll return null and let dimensions be extracted client-side
    // In a production environment, you would use a library like 'sharp' or 'image-size'
    // to extract dimensions from the buffer on the server side
    
    // Example with image-size (not installed):
    // const dimensions = imageSize(Buffer.from(buffer));
    // return { width: dimensions.width!, height: dimensions.height! };
    
    return null;
  } catch (error) {
    console.warn("Failed to extract image dimensions:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { userId, isAuthDisabled } = await getUserIdOrDev(supabase);

  console.info("/api/storage/upload auth context", {
    userId,
    isAuthDisabled,
  });

  if (!userId && !isAuthDisabled) {
    console.warn("/api/storage/upload unauthorized", {
      userId,
      isAuthDisabled,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!userId && isAuthDisabled) {
    console.warn("/api/storage/upload missing DEV_USER_ID", {
      userId,
      isAuthDisabled,
    });
    return NextResponse.json(
      { error: "DEV_USER_ID is required when auth is disabled" },
      { status: 400 }
    );
  }

  try {
    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentId = formData.get("documentId") as string | null;

    console.info("/api/storage/upload request payload", {
      hasFile: Boolean(file),
      documentId,
      fileType: file?.type ?? null,
      fileSize: file?.size ?? null,
    });

    // Validate required fields
    if (!file) {
      console.warn("/api/storage/upload missing file", { documentId });
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!documentId) {
      console.warn("/api/storage/upload missing documentId");
      return NextResponse.json(
        { error: "Document ID is required" },
        { status: 400 }
      );
    }

    // Validate document ownership
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single();

    if (docError || !document) {
      console.warn("/api/storage/upload document check failed", {
        documentId,
        userId,
        docError: docError ? {
          message: docError.message,
          code: docError.code,
          details: docError.details,
        } : null,
      });
      return NextResponse.json(
        { error: "Document not found or access denied" },
        { status: 404 }
      );
    }

    // Validate file type (Requirement 6.4)
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      console.warn("/api/storage/upload invalid mime type", {
        fileType: file.type,
      });
      return NextResponse.json(
        {
          error: `Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.`,
        },
        { status: 400 }
      );
    }

    // Validate file size (Requirement 6.4)
    if (file.size > MAX_FILE_SIZE) {
      console.warn("/api/storage/upload file too large", {
        fileSize: file.size,
        maxSize: MAX_FILE_SIZE,
      });
      return NextResponse.json(
        {
          error: `File size exceeds 5MB limit. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
        },
        { status: 400 }
      );
    }

    // Generate unique filename (Requirement 6.6)
    const uuid = generateUUID();
    const extension = getExtensionFromMimeType(file.type);
    const filename = `${uuid}.${extension}`;

    // Construct storage path: {user_id}/{document_id}/{uuid}.{ext} (Requirement 6.6)
    const storagePath = `${userId}/${documentId}/${filename}`;

    console.info("/api/storage/upload storage target", {
      bucket: "document-images",
      storagePath,
    });

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage (Requirement 6.6)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("document-images")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("document-images").getPublicUrl(storagePath);

    // Extract image dimensions (Requirement 6.7)
    // Note: Dimensions are optional and can be extracted client-side if needed
    let width: number | null = null;
    let height: number | null = null;

    const dimensions = await getImageDimensions(buffer, file.type);
    if (dimensions) {
      width = dimensions.width;
      height = dimensions.height;
    }

    // Create database record (Requirement 6.6)
    const { data: imageRecord, error: dbError } = await supabase
      .from("document_images")
      .insert({
        document_id: documentId,
        user_id: userId,
        filename: file.name,
        storage_path: storagePath,
        public_url: publicUrl,
        size: file.size,
        mime_type: file.type,
        width,
        height,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);

      // Rollback: delete the uploaded file
      await supabase.storage.from("document-images").remove([storagePath]);

      return NextResponse.json(
        { error: `Failed to save image record: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Return success response with public URL
    return NextResponse.json({
      success: true,
      image: {
        id: imageRecord.id,
        url: publicUrl,
        filename: file.name,
        size: file.size,
        width,
        height,
      },
    });
  } catch (error) {
    console.error("Unexpected error in image upload:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
