"use client";

import { useEffect, useState, useRef, type ChangeEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type FileRecord = {
  id: string;
  filename: string;
  storage_path: string;
  public_url: string;
  size: number;
  mime_type: string;
  created_at: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(mimeType: string): string {
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word") || mimeType.includes("document")) return "📝";
  return "📁";
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFiles();
  }, []);

  async function loadFiles() {
    try {
      const res = await fetch("/api/files");
      if (!res.ok) throw new Error("Failed to fetch files");
      const json = await res.json();
      setFiles(json.files ?? []);
    } catch (err) {
      console.error("Failed to load files:", err);
      setError("加载文件列表失败");
    } finally {
      setLoading(false);
    }
  }

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "上传失败");
      }

      // Reload file list
      await loadFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("确定删除这个文件吗？此操作不可撤销。");
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "删除失败");
      }
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

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
          <p className="text-sm uppercase tracking-[0.24em] text-amber-600/80">Files</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-800">文件管理</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-stone-500">
            上传并查看 Word 和 PDF 文档。
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/dashboard">
            <Button variant="secondary">← 返回文档列表</Button>
          </Link>
          <div className="rounded-2xl border border-stone-200 bg-white/60 px-4 py-3 text-sm text-stone-600">
            共 {files.length} 个文件
          </div>
        </div>
      </div>

      <Card className="p-4 md:p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-stone-800">全部文件</h2>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <Button onClick={handleUploadClick} disabled={uploading}>
                {uploading ? "上传中..." : "上传文件"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {files.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-lg border border-stone-200 bg-stone-50/50 p-8 text-center">
              <h3 className="text-xl font-medium text-stone-800">还没有文件</h3>
              <p className="max-w-md text-sm leading-7 text-stone-500">
                上传 Word (.docx) 或 PDF 文件，即可在线查看。
              </p>
              <Button onClick={handleUploadClick} disabled={uploading}>
                上传文件
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {files.map((file) => (
                <Card key={file.id} className="flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{getFileIcon(file.mime_type)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-stone-800" title={file.filename}>
                        {file.filename}
                      </p>
                      <p className="text-xs text-stone-500">
                        {formatFileSize(file.size)} · {formatDate(file.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-stone-400">
                        {file.mime_type === "application/pdf" ? "PDF 文档" : "Word 文档"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-2">
                    <Link href={`/dashboard/files/${file.id}`} className="flex-1">
                      <Button variant="secondary" className="w-full">
                        查看
                      </Button>
                    </Link>
                    <Button variant="danger" className="flex-1" onClick={() => handleDelete(file.id)}>
                      删除
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}
