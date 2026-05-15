"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TagManager } from "@/components/tag-manager";
import { SimpleRichEditor, type SimpleRichEditorHandle } from "@/components/simple-rich-editor";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import { VersionHistory } from "@/components/version-history";
import { ExportDialog } from "@/components/export-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { useNetwork } from "@/lib/network-context";
import { saveDocumentOffline } from "@/lib/offline-storage";
import { type DocumentRecord, type Tag, type DocumentVersion } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type DocumentEditorProps = {
  document: DocumentRecord;
};

export function DocumentEditor({ document }: DocumentEditorProps) {
  const router = useRouter();
  const { isOnline } = useNetwork();
  const editorRef = useRef<SimpleRichEditorHandle>(null);
  const [title, setTitle] = useState(document.title);
  const [content, setContent] = useState(document.content);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState(document.updated_at);
  const [documentTags, setDocumentTags] = useState<Tag[]>([]);
  const [showImageUploader, setShowImageUploader] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalTitle, setOriginalTitle] = useState(document.title);
  const [originalContent, setOriginalContent] = useState(document.content);

  // Load document tags
  useEffect(() => {
    loadDocumentTags();
  }, [document.id]);

  async function loadDocumentTags() {
    try {
      const response = await fetch(`/api/documents/${document.id}`);
      if (!response.ok) {
        throw new Error("Failed to load document tags");
      }
      const data = await response.json();
      setDocumentTags(data.document.tags || []);
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  }

  // Load document versions
  async function loadVersions() {
    setLoadingVersions(true);
    try {
      const response = await fetch(`/api/versions/${document.id}`);
      if (!response.ok) {
        throw new Error("Failed to load versions");
      }
      const data = await response.json();
      setVersions(data.versions || []);
    } catch (err) {
      console.error("Failed to load versions:", err);
      setError("无法加载历史版本");
    } finally {
      setLoadingVersions(false);
    }
  }

  // Handle version history button click
  function handleVersionHistoryClick() {
    setShowVersionHistory(true);
    loadVersions();
  }

  // Handle version restore
  async function handleVersionRestore(versionId: string) {
    try {
      const response = await fetch("/api/versions/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ version_id: versionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "恢复失败");
      }

      const data = await response.json();
      
      // Update the editor with restored content
      setTitle(data.document.title);
      setContent(data.document.content);
      setUpdatedAt(data.document.updated_at);
      
      // Reload versions to show the new version created by restore
      await loadVersions();
      
      // Show success message
      setSaveState("saved");
      
      // Refresh the page to ensure everything is in sync
      router.refresh();
    } catch (err) {
      throw err; // Re-throw to let VersionHistory component handle the error
    }
  }

  function handleTagsChange() {
    loadDocumentTags();
    router.refresh();
  }

  // Handle image upload completion
  function handleImageInsert(imageUrl: string, width?: number, height?: number) {
    // 构建图片 Markdown，包含尺寸信息
    let imageMarkdown = `![图片](${imageUrl})`;
    
    // 如果有自定义尺寸，使用 HTML img 标签
    if (width && height) {
      imageMarkdown = `<img src="${imageUrl}" alt="图片" width="${width}" height="${height}" />`;
    }
    
    // 插入到内容末尾
    setContent(content + "\n\n" + imageMarkdown + "\n");
    setShowImageUploader(false);
  }

  // 打开图片编辑器
  function handleOpenImageEditor() {
    setShowImageUploader(true);
  }

  // 检测内容变化
  useEffect(() => {
    const changed = title !== originalTitle || content !== originalContent;
    setHasUnsavedChanges(changed);
  }, [title, content, originalTitle, originalContent]);

  // 页面离开前提示
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "您有未保存的更改，确定要离开吗？";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 手动保存函数
  async function handleSave() {
    setSaveState("saving");
    setError(null);

    const latestContent = editorRef.current?.syncContent() ?? content;

    try {
      // Save offline if not connected
      if (!isOnline) {
        await saveDocumentOffline({
          ...document,
          title,
          content: latestContent,
          updated_at: new Date().toISOString(),
        }, [
          { field: 'title', value: title, timestamp: new Date().toISOString() },
          { field: 'content', value: latestContent, timestamp: new Date().toISOString() },
        ]);
        
        setSaveState("saved");
        setUpdatedAt(new Date().toISOString());
        setOriginalTitle(title);
        setOriginalContent(latestContent);
        setHasUnsavedChanges(false);
        
        // 2秒后恢复为idle状态
        setTimeout(() => setSaveState("idle"), 2000);
        return;
      }

      // Save online
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, content: latestContent }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setSaveState("error");
        setError(payload.error ?? "保存失败");
        return;
      }

      setSaveState("saved");
      setUpdatedAt(payload.document.updated_at);
      setOriginalTitle(title);
      setOriginalContent(payload.document.content ?? latestContent);
      setHasUnsavedChanges(false);
      
      // 2秒后恢复为idle状态
      setTimeout(() => setSaveState("idle"), 2000);
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  // 快捷键保存 (Ctrl+S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (hasUnsavedChanges && saveState !== "saving") {
          handleSave();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasUnsavedChanges, saveState, title, content]);

  async function handleDelete() {
    // 如果有未保存的更改，先提示
    if (hasUnsavedChanges) {
      const saveFirst = window.confirm("您有未保存的更改。是否先保存再删除？");
      if (saveFirst) {
        await handleSave();
      }
    }

    const confirmed = window.confirm("确定删除这篇文档吗？");

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/documents/${document.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "删除失败");
      return;
    }

    router.replace("/dashboard");
  }

  // 返回文档列表时检查未保存更改
  function handleBackToList(e: React.MouseEvent) {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm("您有未保存的更改，确定要离开吗？");
      if (!confirmed) {
        e.preventDefault();
        return;
      }
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <Link 
            href="/dashboard" 
            className="text-sm text-sky-300 hover:text-sky-200"
            onClick={handleBackToList}
          >
            ← 返回文档列表
          </Link>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
            <span>
              {saveState === "saving" && "保存中..."}
              {saveState === "saved" && (isOnline ? "已保存" : "已离线保存")}
              {saveState === "error" && "保存失败"}
              {saveState === "idle" && hasUnsavedChanges && "有未保存的更改"}
              {saveState === "idle" && !hasUnsavedChanges && "所有更改已保存"}
            </span>
            {!isOnline && (
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">
                离线模式
              </span>
            )}
            <span>最近更新：{formatDate(updatedAt)}</span>
          </div>
        </div>
        <div className="flex gap-2 self-start lg:self-auto">
          <Button 
            onClick={handleSave}
            disabled={!hasUnsavedChanges || saveState === "saving"}
            variant={hasUnsavedChanges ? "primary" : "secondary"}
            title="保存 (Ctrl+S)"
          >
            {saveState === "saving" ? "保存中..." : hasUnsavedChanges ? "保存" : "已保存"}
          </Button>
          <Button 
            variant="ghost" 
            onClick={handleVersionHistoryClick}
            disabled={loadingVersions}
          >
            {loadingVersions ? "加载中..." : "版本历史"}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setShowExportDialog(true)}
          >
            导出
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setShowShareDialog(true)}
          >
            分享
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            删除文档
          </Button>
        </div>
      </div>

      {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

      <div className="space-y-4">
        <section className="space-y-4 rounded-3xl border border-border bg-slate-900/70 p-6 shadow-panel">
          <div className="space-y-2">
            <label className="text-sm text-slate-300">标题</label>
            <Input 
              value={title} 
              onChange={(event) => setTitle(event.target.value)} 
              placeholder="输入标题" 
              className="text-xl font-semibold"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm text-slate-300">正文</label>
            <SimpleRichEditor
              ref={editorRef}
              content={content}
              onChange={setContent}
              placeholder="开始输入内容..."
              disabled={isUploadingImage}
              onImageClick={handleOpenImageEditor}
            />
            {isUploadingImage && (
              <div className="text-sm text-sky-400">
                正在上传图片...
              </div>
            )}
            {hasUnsavedChanges && (
              <div className="text-xs text-amber-400">
                💡 提示：按 Ctrl+S 快速保存
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <TagManager
              documentId={document.id}
              selectedTags={documentTags}
              onTagsChange={handleTagsChange}
            />
          </div>
        </section>
      </div>

      {/* 图片编辑对话框 */}
      <ImageEditorDialog
        open={showImageUploader}
        onClose={() => setShowImageUploader(false)}
        onInsert={handleImageInsert}
        documentId={document.id}
      />

      {/* 版本历史对话框 */}
      <Dialog open={showVersionHistory} onClose={() => setShowVersionHistory(false)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>版本历史</DialogTitle>
          </DialogHeader>
          {loadingVersions ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-sm text-slate-400">加载中...</p>
            </div>
          ) : (
            <VersionHistory
              documentId={document.id}
              versions={versions}
              onRestore={handleVersionRestore}
              onRefresh={loadVersions}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 导出对话框 */}
      <ExportDialog
        documentId={document.id}
        documentTitle={document.title}
        open={showExportDialog}
        onClose={() => setShowExportDialog(false)}
      />

      {/* 分享对话框 */}
      <ShareDialog
        documentId={document.id}
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
      />
    </div>
  );
}
