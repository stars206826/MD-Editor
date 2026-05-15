"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Tag } from "@/lib/types";

interface TagManagerProps {
  documentId: string;
  selectedTags: Tag[];
  onTagsChange: () => void;
}

export function TagManager({
  documentId,
  selectedTags,
  onTagsChange,
}: TagManagerProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [selectedTagId, setSelectedTagId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load available tags
  useEffect(() => {
    loadTags();
  }, []);

  async function loadTags() {
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) {
        throw new Error("Failed to load tags");
      }
      const data = await response.json();
      setAvailableTags(data.tags || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tags");
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) {
      setError("标签名称不能为空");
      return;
    }

    if (newTagName.length > 50) {
      setError("标签名称不能超过 50 个字符");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTagName.trim(),
          color: newTagColor,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create tag");
      }

      // Refresh tags list
      await loadTags();

      // Reset form
      setNewTagName("");
      setNewTagColor("#3b82f6");
      setIsCreateDialogOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create tag");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAssignTag() {
    if (!selectedTagId) {
      return;
    }

    // Check if document already has 10 tags
    if (selectedTags.length >= 10) {
      setError("文档最多只能有 10 个标签");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tags/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: documentId,
          tag_id: selectedTagId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to assign tag");
      }

      // Reset selection
      setSelectedTagId("");

      // Notify parent to refresh
      onTagsChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign tag");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRemoveTag(tagId: string) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/tags/unassign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: documentId,
          tag_id: tagId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove tag");
      }

      // Notify parent to refresh
      onTagsChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove tag");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDeleteTag() {
    if (!tagToDelete) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/tags/${tagToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete tag");
      }

      // Refresh tags list
      await loadTags();

      // Notify parent to refresh (in case this tag was on the document)
      onTagsChange();

      // Close dialog
      setIsDeleteDialogOpen(false);
      setTagToDelete(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete tag");
    } finally {
      setIsLoading(false);
    }
  }

  function openDeleteDialog(tag: Tag) {
    setTagToDelete(tag);
    setIsDeleteDialogOpen(true);
  }

  // Get tags that are not already assigned to this document
  const unassignedTags = availableTags.filter(
    (tag) => !selectedTags.some((st) => st.id === tag.id)
  );

  return (
    <div className="space-y-4">
      {/* Error message */}
      {error && (
        <div className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Current tags */}
      <div className="space-y-2">
        <label className="text-sm text-slate-300">文档标签</label>
        {selectedTags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <div
                key={tag.id}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-slate-800/50 px-3 py-1.5"
              >
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-sm text-slate-200">{tag.name}</span>
                <button
                  onClick={() => handleRemoveTag(tag.id)}
                  disabled={isLoading}
                  className="ml-1 text-slate-400 hover:text-red-400 disabled:opacity-50"
                  aria-label="移除标签"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">暂无标签</p>
        )}
        {selectedTags.length >= 10 && (
          <p className="text-xs text-amber-400">
            已达到最多 10 个标签的限制
          </p>
        )}
      </div>

      {/* Add tag section */}
      {selectedTags.length < 10 && (
        <div className="space-y-2">
          <label className="text-sm text-slate-300">添加标签</label>
          <div className="flex gap-2">
            <Select
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              disabled={isLoading || unassignedTags.length === 0}
              className="flex-1"
            >
              <option value="">
                {unassignedTags.length === 0
                  ? "没有可用标签"
                  : "选择标签..."}
              </option>
              {unassignedTags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </Select>
            <Button
              onClick={handleAssignTag}
              disabled={!selectedTagId || isLoading}
              variant="secondary"
            >
              添加
            </Button>
          </div>
        </div>
      )}

      {/* Tag management buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          variant="ghost"
          className="text-xs"
        >
          + 创建新标签
        </Button>
      </div>

      {/* Manage existing tags */}
      {availableTags.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm text-slate-300">管理标签</label>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border bg-slate-950/30 p-2">
            {availableTags.map((tag) => (
              <div
                key={tag.id}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-800/50"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-sm text-slate-200">{tag.name}</span>
                </div>
                <button
                  onClick={() => openDeleteDialog(tag)}
                  disabled={isLoading}
                  className="text-xs text-slate-400 hover:text-red-400 disabled:opacity-50"
                >
                  删除
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Tag Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setNewTagName("");
          setNewTagColor("#3b82f6");
          setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新标签</DialogTitle>
            <DialogDescription>
              创建一个新标签来组织你的文档
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-300">标签名称</label>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="输入标签名称"
                maxLength={50}
                disabled={isLoading}
              />
              <p className="text-xs text-slate-500">
                {newTagName.length}/50 字符
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-slate-300">颜色</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  disabled={isLoading}
                  className="h-10 w-20 cursor-pointer rounded-lg border border-border bg-slate-950/60"
                />
                <Input
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  placeholder="#3b82f6"
                  disabled={isLoading}
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsCreateDialogOpen(false);
                setNewTagName("");
                setNewTagColor("#3b82f6");
                setError(null);
              }}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isLoading}
            >
              {isLoading ? "创建中..." : "创建标签"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Tag Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setTagToDelete(null);
          setError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>删除标签</DialogTitle>
            <DialogDescription>
              确定要删除此标签吗？它将从所有文档中移除。
            </DialogDescription>
          </DialogHeader>

          {tagToDelete && (
            <div className="my-4 flex items-center gap-2 rounded-lg border border-border bg-slate-800/50 px-4 py-3">
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: tagToDelete.color }}
              />
              <span className="text-sm text-slate-200">{tagToDelete.name}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setTagToDelete(null);
                setError(null);
              }}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteTag}
              disabled={isLoading}
            >
              {isLoading ? "删除中..." : "删除标签"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
