"use client";

import { useEffect, useState } from "react";
import { DocumentList } from "@/components/document-list";
import { Card } from "@/components/ui/card";

export default function AppPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDocuments() {
      try {
        const res = await fetch("/api/documents");
        if (!res.ok) throw new Error("Failed to fetch documents");
        const json = await res.json();
        setDocuments(json.documents ?? []);
      } catch (err) {
        console.error("Failed to load documents:", err);
        setDocuments([]);
      } finally {
        setLoading(false);
      }
    }

    loadDocuments();
  }, []);

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-sky-400 border-t-transparent mx-auto"></div>
            <p className="text-slate-400">加载中...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-sky-300/80">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">你的 Markdown 文档</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-400">
            在任意设备上查看、编辑并自动同步你的 Markdown 文档。
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          共 {documents?.length ?? 0} 篇文档
        </div>
      </div>

      <Card className="p-4 md:p-6">
        <DocumentList documents={documents ?? []} />
      </Card>
    </main>
  );
}
