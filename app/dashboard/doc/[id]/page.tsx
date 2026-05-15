import { notFound } from "next/navigation";

import { DocumentEditor } from "@/components/document-editor";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // 开发模式：不检查用户，直接获取文档
  const { data: document } = await supabase
    .from("documents")
    .select("id, user_id, title, content, created_at, updated_at")
    .eq("id", id)
    .single();

  if (!document) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 md:px-6">
      <DocumentEditor document={document} />
    </main>
  );
}
