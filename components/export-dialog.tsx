/**
 * Export Dialog Component
 * 
 * Provides UI for exporting documents in multiple formats.
 * Requirements: 7.1, 7.8, 7.9, 12.1, 12.2, 12.3
 */

"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";

export type ExportFormat = "html" | "markdown" | "text";
export type StylingTheme = "light" | "dark";

interface ExportDialogProps {
  documentId: string;
  documentTitle: string;
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({
  documentId,
  documentTitle,
  open,
  onClose,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>("html");
  const [includeImages, setIncludeImages] = useState(true);
  const [stylingTheme, setStylingTheme] = useState<StylingTheme>("light");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filename, setFilename] = useState(documentTitle);

  useEffect(() => {
    if (open) {
      setFilename(documentTitle);
    }
  }, [open, documentTitle]);

  async function handleExport() {
    setIsExporting(true);
    setError(null);

    try {
      // Call export API (Requirement 7.1)
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          format,
          includeImages,
          stylingTheme,
          filename: filename.trim() || documentTitle,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Export failed");
      }

      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get("Content-Disposition");
      const baseName = filename.trim() || documentTitle;
      let filenameToDownload = `${sanitizeFilename(baseName)}.${getFileExtension(format)}`;
      
      if (contentDisposition) {
        const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (filenameStarMatch) {
          filenameToDownload = decodeURIComponent(filenameStarMatch[1]);
        }
        const filenameMatch = contentDisposition.match(/filename="?(.+?)"?$/);
        if (!filenameStarMatch && filenameMatch) {
          filenameToDownload = filenameMatch[1];
        }
      }

      // Download file (Requirement 7.8)
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameToDownload;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Close dialog on success
      onClose();
    } catch (err) {
      // Display error message (Requirement 7.9, 12.3)
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }

  function getFileExtension(format: ExportFormat): string {
    switch (format) {
      case "html":
        return "html";
      case "markdown":
        return "md";
      case "text":
        return "txt";
      default:
        return "txt";
    }
  }

  function sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-z0-9\u4e00-\u9fa5_-]/gi, "_")
      .replace(/_{2,}/g, "_")
      .substring(0, 100);
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>导出文档</DialogTitle>
          <DialogDescription>
            选择导出格式和选项
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              文件名
            </label>
            <Input
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              disabled={isExporting}
              placeholder={documentTitle || "未命名文档"}
            />
            <p className="text-xs text-slate-500">无需填写扩展名</p>
          </div>
          {/* Format selector (Requirement 7.1) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">
              导出格式
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as ExportFormat)}
              disabled={isExporting}
              className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            >
              <option value="html">HTML</option>
              <option value="markdown">Markdown</option>
              <option value="text">纯文本</option>
            </select>
            <p className="text-xs text-slate-500">
              {format === "html" && "生成HTML网页，可在浏览器中查看（支持打印为PDF）"}
              {format === "markdown" && "导出原始Markdown格式"}
              {format === "text" && "导出纯文本，移除所有格式"}
            </p>
          </div>

          {/* Include images option (Requirement 7.6, 7.7) */}
          {format === "html" && (
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="includeImages"
                checked={includeImages}
                onChange={(e) => setIncludeImages(e.target.checked)}
                disabled={isExporting}
                className="h-4 w-4 rounded border-border bg-slate-900 text-sky-500 focus:ring-2 focus:ring-sky-400"
              />
              <label
                htmlFor="includeImages"
                className="text-sm text-slate-300 cursor-pointer"
              >
                包含图片
              </label>
            </div>
          )}

          {/* Styling theme option (HTML only) */}
          {format === "html" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">
                样式主题
              </label>
              <select
                value={stylingTheme}
                onChange={(e) => setStylingTheme(e.target.value as StylingTheme)}
                disabled={isExporting}
                className="w-full rounded-lg border border-border bg-slate-900 px-3 py-2 text-sm text-slate-200 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
              >
                <option value="light">浅色主题</option>
                <option value="dark">深色主题</option>
              </select>
            </div>
          )}

          {/* Export progress (Requirement 7.8, 12.2) */}
          {isExporting && (
            <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                <p className="text-sm text-sky-300">正在导出...</p>
              </div>
            </div>
          )}

          {/* Error message (Requirement 7.9, 12.3) */}
          {error && (
            <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isExporting}
          >
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? "导出中..." : "导出"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
