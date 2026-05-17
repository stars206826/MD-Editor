/**
 * Share Dialog Component
 * 
 * Provides UI for creating and managing document share links.
 * Requirements: 8.1, 8.3, 8.4, 8.7, 8.11, 12.1, 12.4
 */

"use client";

import { useState, useEffect } from "react";
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
import { formatDate } from "@/lib/utils";

interface ShareLink {
  id: string;
  token: string;
  document_id: string;
  expires_at: string | null;
  has_password: boolean;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

interface ShareDialogProps {
  documentId: string;
  open: boolean;
  onClose: () => void;
}

export function ShareDialog({
  documentId,
  open,
  onClose,
}: ShareDialogProps) {
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state for creating share link
  const [expiresInDays, setExpiresInDays] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Load existing share link when dialog opens
  useEffect(() => {
    if (open) {
      loadShareLink();
    }
  }, [open, documentId]);

  async function loadShareLink() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/share?documentId=${documentId}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "加载分享链接失败");
      }

      const data = await response.json();
      setShareLink(data.shareLink);
      setShowCreateForm(!data.shareLink);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载分享链接失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateShareLink() {
    setIsCreating(true);
    setError(null);

    try {
      // Validate expiration days
      const expirationDays = expiresInDays ? parseInt(expiresInDays, 10) : undefined;
      if (expirationDays !== undefined && (isNaN(expirationDays) || expirationDays <= 0)) {
        throw new Error("过期天数必须是正整数");
      }

      // Create share link (Requirement 8.1, 8.3, 8.4)
      const response = await fetch("/api/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          expiresInDays: expirationDays,
          password: password || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "创建分享链接失败");
      }

      const data = await response.json();
      setShareLink(data.shareLink);
      setShowCreateForm(false);
      
      // Reset form
      setExpiresInDays("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建分享链接失败");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevokeShareLink() {
    if (!shareLink) return;

    // Confirmation dialog (Requirement 12.4)
    const confirmed = window.confirm(
      "确定要撤销此分享链接吗？撤销后，该链接将立即失效，无法恢复。"
    );

    if (!confirmed) return;

    setIsRevoking(true);
    setError(null);

    try {
      // Revoke share link (Requirement 8.11)
      const response = await fetch("/api/share/revoke", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          shareLinkId: shareLink.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "撤销分享链接失败");
      }

      setShareLink(null);
      setShowCreateForm(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "撤销分享链接失败");
    } finally {
      setIsRevoking(false);
    }
  }

  function getShareUrl(): string {
    if (!shareLink) return "";
    const baseUrl = window.location.origin;
    return `${baseUrl}/share/${shareLink.token}`;
  }

  async function handleCopyLink() {
    const url = getShareUrl();
    
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError("复制链接失败");
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>分享文档</DialogTitle>
          <DialogDescription>
            创建公开分享链接，让其他人可以查看此文档
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          ) : shareLink ? (
            // Display existing share link
            <div className="space-y-4">
              {/* Share URL with copy button */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-600">
                  分享链接
                </label>
                <div className="flex gap-2">
                  <Input
                    value={getShareUrl()}
                    readOnly
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleCopyLink}
                    disabled={isRevoking}
                  >
                    {copied ? "已复制" : "复制"}
                  </Button>
                </div>
              </div>

              {/* Share link stats (Requirement 8.7) */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div>
                  <p className="text-xs text-stone-500">浏览次数</p>
                  <p className="text-lg font-semibold text-stone-800">
                    {shareLink.view_count}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-stone-500">最后浏览</p>
                  <p className="text-sm text-stone-800">
                    {shareLink.last_viewed_at
                      ? formatDate(shareLink.last_viewed_at)
                      : "从未"}
                  </p>
                </div>
              </div>

              {/* Share link details */}
              <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">创建时间</span>
                  <span className="text-stone-800">
                    {formatDate(shareLink.created_at)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">过期时间</span>
                  <span className="text-stone-800">
                    {shareLink.expires_at
                      ? formatDate(shareLink.expires_at)
                      : "永不过期"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">密码保护</span>
                  <span className="text-stone-800">
                    {shareLink.has_password ? "是" : "否"}
                  </span>
                </div>
              </div>

              {/* Revoke button (Requirement 8.11, 12.4) */}
              <Button
                variant="danger"
                onClick={handleRevokeShareLink}
                disabled={isRevoking}
                className="w-full"
              >
                {isRevoking ? "撤销中..." : "撤销分享链接"}
              </Button>
            </div>
          ) : showCreateForm ? (
            // Create new share link form (Requirement 8.1, 8.3, 8.4)
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-600">
                  过期时间（可选）
                </label>
                <Input
                  type="number"
                  placeholder="天数（留空表示永不过期）"
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                  disabled={isCreating}
                  min="1"
                />
                <p className="text-xs text-stone-400">
                  设置链接的有效期，过期后将无法访问
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-600">
                  访问密码（可选）
                </label>
                <Input
                  type="password"
                  placeholder="留空表示无需密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isCreating}
                />
                <p className="text-xs text-stone-400">
                  设置密码后，访问者需要输入密码才能查看文档
                </p>
              </div>

              <Button
                variant="primary"
                onClick={handleCreateShareLink}
                disabled={isCreating}
                className="w-full"
              >
                {isCreating ? "创建中..." : "创建分享链接"}
              </Button>
            </div>
          ) : null}

          {/* Error message (Requirement 12.1) */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
