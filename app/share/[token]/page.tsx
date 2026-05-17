/**
 * Public Share Page
 * 
 * Displays shared documents accessible via public token.
 * Requirements: 8.9, 8.10, 10.6, 12.3
 */

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface SharedDocument {
  id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [document, setDocument] = useState<SharedDocument | null>(null);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    loadSharedDocument();
  }, [token]);

  async function loadSharedDocument() {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/share/${token}`);
      const data = await response.json();

      if (!response.ok) {
        // Check if expired (Requirement 8.9)
        if (data.expired) {
          setIsExpired(true);
          setError(data.error || "该分享链接已过期");
        } else {
          setError(data.error || "加载分享文档失败");
        }
        return;
      }

      // Check if password is required (Requirement 8.10)
      if (data.requiresPassword) {
        setRequiresPassword(true);
      } else {
        setDocument(data.document);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载分享文档失败");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!password.trim()) {
      setError("请输入密码");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(`/api/share/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "密码错误");
        return;
      }

      setDocument(data.document);
      setRequiresPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证密码失败");
    } finally {
      setIsVerifying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-stone-200 border-t-amber-500 mx-auto" />
          <p className="text-stone-500">加载分享文档中...</p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">⏰</div>
          <h1 className="mb-2 text-2xl font-bold text-stone-800">
            链接已过期
          </h1>
          <p className="text-stone-500">
            该分享链接已过期，无法再访问。
          </p>
        </div>
      </div>
    );
  }

  if (error && !requiresPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">❌</div>
          <h1 className="mb-2 text-2xl font-bold text-stone-800">
            出错了
          </h1>
          <p className="text-stone-500">{error}</p>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-stone-200 bg-white p-8 shadow-xl">
          <div className="text-center">
            <div className="mb-4 text-5xl">🔒</div>
            <h1 className="mb-2 text-2xl font-bold text-stone-800">
              需要密码
            </h1>
            <p className="text-sm text-stone-500">
              该文档已设置密码保护，请输入密码以查看。
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isVerifying}
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={isVerifying || !password.trim()}
              className="w-full"
            >
              {isVerifying ? "验证中..." : "访问文档"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mb-4 text-6xl">📄</div>
          <p className="text-stone-500">未找到文档</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-stone-200 bg-white/80 p-6 shadow-panel backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-2 text-sm text-stone-500">
            <span>🔗</span>
            <span>分享文档</span>
            <span>·</span>
            <span>只读</span>
          </div>
          <h1 className="mb-3 text-3xl font-bold text-stone-800">
            {document.title}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-stone-500">
            <span>创建于: {formatDate(document.created_at)}</span>
            <span>·</span>
            <span>更新于: {formatDate(document.updated_at)}</span>
          </div>
        </div>

        {/* Document content */}
        <div className="rounded-2xl border border-stone-200 bg-white shadow-panel">
          <article className="prose max-w-none px-6 py-8 sm:px-8 prose-headings:text-stone-800 prose-p:text-stone-700 prose-strong:text-stone-900 prose-code:text-amber-700 prose-pre:bg-stone-50 prose-blockquote:text-stone-600 prose-del:line-through">
            <ReactMarkdown 
              remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
            >
              {document.content}
            </ReactMarkdown>
          </article>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-stone-400">
          <p>该文档以只读模式分享</p>
        </div>
      </div>
    </div>
  );
}
