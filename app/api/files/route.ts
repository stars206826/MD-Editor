import { NextRequest, NextResponse } from "next/server";
import { createClient, getUserIdOrDev } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
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
    const { data: files, error } = await supabase
      .from("user_files")
      .select("id, filename, storage_path, public_url, size, mime_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch files:", error);
      return NextResponse.json(
        { error: "获取文件列表失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({ files: files ?? [] });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
