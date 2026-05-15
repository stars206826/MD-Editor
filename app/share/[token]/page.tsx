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
          setError(data.error || "This share link has expired");
        } else {
          setError(data.error || "Failed to load shared document");
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
      setError(err instanceof Error ? err.message : "Failed to load shared document");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!password.trim()) {
      setError("Please enter a password");
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
        setError(data.error || "Invalid password");
        return;
      }

      setDocument(data.document);
      setRequiresPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to verify password");
    } finally {
      setIsVerifying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-sky-400 border-t-transparent mx-auto" />
          <p className="text-slate-400">Loading shared document...</p>
        </div>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">⏰</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-200">
            Link Expired
          </h1>
          <p className="text-slate-400">
            This share link has expired and is no longer accessible.
          </p>
        </div>
      </div>
    );
  }

  if (error && !requiresPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md text-center">
          <div className="mb-4 text-6xl">❌</div>
          <h1 className="mb-2 text-2xl font-bold text-slate-200">
            Error
          </h1>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (requiresPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-slate-900 p-8 shadow-xl">
          <div className="text-center">
            <div className="mb-4 text-5xl">🔒</div>
            <h1 className="mb-2 text-2xl font-bold text-slate-200">
              Password Protected
            </h1>
            <p className="text-sm text-slate-400">
              This document is password protected. Please enter the password to view it.
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isVerifying}
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={isVerifying || !password.trim()}
              className="w-full"
            >
              {isVerifying ? "Verifying..." : "Access Document"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-4">
        <div className="text-center">
          <div className="mb-4 text-6xl">📄</div>
          <p className="text-slate-400">No document found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 rounded-2xl border border-border bg-slate-900 p-6 shadow-xl">
          <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
            <span>🔗</span>
            <span>Shared Document</span>
            <span>•</span>
            <span>Read-only</span>
          </div>
          <h1 className="mb-3 text-3xl font-bold text-slate-100">
            {document.title}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            <span>Created: {formatDate(document.created_at)}</span>
            <span>•</span>
            <span>Updated: {formatDate(document.updated_at)}</span>
          </div>
        </div>

        {/* Document content */}
        <div className="rounded-2xl border border-border bg-slate-900 shadow-xl">
          <article className="prose prose-invert max-w-none px-6 py-8 sm:px-8 prose-headings:text-white prose-p:text-slate-300 prose-strong:text-white prose-code:text-sky-200 prose-pre:bg-slate-950/80 prose-blockquote:text-slate-300 prose-del:line-through">
            <ReactMarkdown 
              remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
            >
              {document.content}
            </ReactMarkdown>
          </article>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-500">
          <p>This document is shared in read-only mode</p>
        </div>
      </div>
    </div>
  );
}
