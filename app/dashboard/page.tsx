"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DocumentList } from "@/components/document-list";
import { Button } from "@/components/ui/button";
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
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-amber-500 mx-auto"></div>
            <p className="text-stone-500">加载中...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-amber-600/80">Workspace</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-800">你的 Markdown 文档</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-500">
            在任意设备上查看、编辑并自动同步你的 Markdown 文档。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard/files">
            <Button variant="secondary">文件管理</Button>
          </Link>
          <div className="rounded-2xl border border-stone-200 bg-white/60 px-4 py-3 text-sm text-stone-600">
            共 {documents?.length ?? 0} 篇文档
          </div>
        </div>
      </div>

      <Card className="p-4 md:p-6">
        <DocumentList documents={documents ?? []} />
      </Card>
    </main>
  );
}
