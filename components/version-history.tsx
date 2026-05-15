"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type DocumentVersion } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type VersionHistoryProps = {
  documentId: string;
  versions: DocumentVersion[];
  onRestore: (versionId: string) => Promise<void>;
  onRefresh?: () => void;
};

export function VersionHistory({
  documentId,
  versions,
  onRestore,
  onRefresh,
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    if (!selectedVersion) return;

    setIsRestoring(true);
    setError(null);

    try {
      await onRestore(selectedVersion.id);
      setSelectedVersion(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "恢复失败");
    } finally {
      setIsRestoring(false);
    }
  }

  function getContentPreview(content: string): string {
    const lines = content.split("\n").filter((line) => line.trim());
    const preview = lines.slice(0, 3).join(" ");
    return preview.length > 100 ? preview.substring(0, 100) + "..." : preview;
  }

  if (versions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-slate-900/50 p-6 text-center">
        <p className="text-sm text-slate-400">暂无历史版本</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {versions.map((version, index) => (
          <div
            key={version.id}
            className="group relative rounded-xl border border-border bg-slate-900/50 p-4 transition hover:border-sky-400/30 hover:bg-slate-900/70"
          >
            {/* Timeline connector */}
            {index < versions.length - 1 && (
              <div className="absolute left-6 top-full h-3 w-0.5 bg-slate-700" />
            )}

            <div className="flex items-start gap-4">
              {/* Version badge */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-400/10 text-sm font-semibold text-sky-400">
                v{version.version_number}
              </div>

              {/* Version details */}
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-medium text-slate-200">
                      {version.title}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {formatDate(version.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedVersion(version)}
                    className="shrink-0 opacity-0 transition group-hover:opacity-100"
                  >
                    恢复
                  </Button>
                </div>

                {/* Content preview */}
                <p className="line-clamp-2 text-xs text-slate-500">
                  {getContentPreview(version.content)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Restore confirmation dialog */}
      <Dialog
        open={selectedVersion !== null}
        onClose={() => !isRestoring && setSelectedVersion(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>恢复历史版本</DialogTitle>
            <DialogDescription>
              确定要恢复到版本 {selectedVersion?.version_number} 吗？当前内容将被替换，并创建一个新版本作为备份。
            </DialogDescription>
          </DialogHeader>

          {selectedVersion && (
            <div className="my-4 space-y-2 rounded-lg border border-border bg-slate-950/50 p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">版本号</span>
                <span className="font-medium text-slate-200">
                  v{selectedVersion.version_number}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">标题</span>
                <span className="truncate font-medium text-slate-200">
                  {selectedVersion.title}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">创建时间</span>
                <span className="font-medium text-slate-200">
                  {formatDate(selectedVersion.created_at)}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setSelectedVersion(null)}
              disabled={isRestoring}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={handleRestore}
              disabled={isRestoring}
            >
              {isRestoring ? "恢复中..." : "确认恢复"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
