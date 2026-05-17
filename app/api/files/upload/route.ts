import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/msword", // .doc
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/msword": "doc",
  };
  return mimeToExt[mimeType] || "bin";
}

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
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "仅支持 PDF 和 Word (.docx/.doc) 文件" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `文件大小超过 20MB 限制，当前大小: ${(file.size / 1024 / 1024).toFixed(2)}MB` },
        { status: 400 }
      );
    }

    const uuid = crypto.randomUUID();
    const extension = getExtensionFromMimeType(file.type);
    const filename = `${uuid}.${extension}`;
    const storagePath = `${userId}/${filename}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from("user-files")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("File upload error:", uploadError);
      return NextResponse.json(
        { error: `上传失败: ${uploadError.message}` },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("user-files").getPublicUrl(storagePath);

    const { data: fileRecord, error: dbError } = await supabase
      .from("user_files")
      .insert({
        user_id: userId,
        filename: file.name,
        storage_path: storagePath,
        public_url: publicUrl,
        size: file.size,
        mime_type: file.type,
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database insert error:", dbError);
      await supabase.storage.from("user-files").remove([storagePath]);
      return NextResponse.json(
        { error: `保存文件记录失败: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        filename: file.name,
        url: publicUrl,
        size: file.size,
        mime_type: file.type,
        created_at: fileRecord.created_at,
      },
    });
  } catch (error) {
    console.error("Unexpected error in file upload:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
