import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    const { data: file, error } = await supabase
      .from("user_files")
      .select("id, filename, storage_path, public_url, size, mime_type, created_at")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "文件未找到" }, { status: 404 });
    }

    return NextResponse.json({ file });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    const { data: file, error: fetchError } = await supabase
      .from("user_files")
      .select("id, storage_path")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (fetchError || !file) {
      return NextResponse.json({ error: "文件未找到" }, { status: 404 });
    }

    // Delete from storage
    await supabase.storage.from("user-files").remove([file.storage_path]);

    // Delete from database
    const { error: deleteError } = await supabase
      .from("user_files")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete file record:", deleteError);
      return NextResponse.json(
        { error: "删除文件记录失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
