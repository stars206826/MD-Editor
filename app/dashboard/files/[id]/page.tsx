"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

export default function FileViewerPage() {
  const params = useParams();
  const id = params.id as string;

  const [file, setFile] = useState<FileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wordHtml, setWordHtml] = useState<string | null>(null);
  const [wordLoading, setWordLoading] = useState(false);

  useEffect(() => {
    loadFile();
  }, [id]);

  async function loadFile() {
    try {
      const res = await fetch(`/api/files/${id}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "加载文件失败");
      }
      const json = await res.json();
      setFile(json.file);

      // If it's a Word document, load and convert it
      if (
        json.file.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        json.file.mime_type === "application/msword"
      ) {
        await loadWordDocument(json.file.public_url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载文件失败");
    } finally {
      setLoading(false);
    }
  }

  async function loadWordDocument(url: string) {
    setWordLoading(true);
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();

      // Dynamic import mammoth for client-side only
      const mammoth = await import("mammoth");

      // Style map: map common Word code styles to <pre><code>
      const styleMap = [
        "p[style-name='Code'] => pre:separator('\\n')",
        "p[style-name='Code Block'] => pre:separator('\\n')",
        "p[style-name='HTML Code'] => pre:separator('\\n')",
        "p[style-name='code'] => pre:separator('\\n')",
        "p[style-name='Listing'] => pre:separator('\\n')",
        "p[style-name='Source Code'] => pre:separator('\\n')",
        "p[style-name='Plain Text'] => pre:separator('\\n')",
        "r[style-name='Code Char'] => code",
        "r[style-name='HTML Code Char'] => code",
      ];

      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        { styleMap }
      );

      // Post-process: detect code-like blocks by monospace font or shading
      let html = result.value;
      html = postProcessWordHtml(html);

      setWordHtml(html);
    } catch (err) {
      console.error("Failed to convert Word document:", err);
      setError("Word 文档预览失败，请尝试下载查看");
    } finally {
      setWordLoading(false);
    }
  }

  // Post-process mammoth HTML to improve code block rendering
  function postProcessWordHtml(html: string): string {
    // Wrap consecutive <pre> lines into single <pre><code> blocks
    html = html.replace(
      /(<pre>[^<]*<\/pre>\n?)+/g,
      (match) => {
        const lines = match
          .replace(/<\/?pre>/g, "\n")
          .split("\n")
          .filter((l) => l.length > 0);
        const code = lines
          .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
          .join("\n");
        // Lines already escaped by mammoth, just join them
        return `<pre class="word-code-block"><code>${match.replace(/<\/?pre>/g, "\n").trim()}</code></pre>`;
      }
    );

    // Detect paragraphs that look like code
    // Primary pattern: lines that are very likely code (triggers a code block)
    const codeStartPattern = /[{}();=&]{3,}|function\s|const\s|let\s|var\s|class\s|import\s|export\s|#include|#define|#pragma|void\s|int\s|bool\s|float\s|double\s|char\s|unsigned\s|return\s|if\s*\(|for\s*\(|while\s*\(|switch\s*\(|FOREACH|ENUM\s*\(|STREAMABLE|TypeRegistry|addEnum|static_cast|dynamic_cast|reinterpret_cast|const_cast|static\s|virtual\s|override|namespace\s|template\s*<|typedef\s|struct\s|enum\s|public:|private:|protected:|=>\s*{|\(\)\s*=>|async\s|await\s|try\s*{|catch\s*\(/;

    // Secondary pattern: lines that look like code continuation
    const codeContinuePattern = /^\s*[{}();,\]>\[\*\/]|::|->|<<|>>|&&|\|\||[a-zA-Z_]\w*\s*[(<]|^\s*\.\w+|^\s*\/\/|^\s*\/\*|^\s*\*\s|^\s*\*\/|^\s*[a-zA-Z_]\w*\s*=\s|[;{}]\s*$/;

    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const container = doc.body.firstElementChild;
    if (!container) return html;

    // Find sequences of paragraphs that look like code
    const children = Array.from(container.children);
    let i = 0;
    while (i < children.length) {
      const el = children[i];
      const elText = el.textContent || "";
      if (
        el.tagName === "P" &&
        !el.closest("pre") &&
        codeStartPattern.test(elText)
      ) {
        // Collect consecutive code-like paragraphs
        const codeLines: string[] = [];
        let j = i;
        while (j < children.length) {
          const c = children[j];
          if (c.tagName !== "P") break;
          const text = c.textContent || "";
          const trimmed = text.trim();
          // Include if it matches primary or secondary pattern, or is a short continuation line
          if (
            codeStartPattern.test(text) ||
            codeContinuePattern.test(trimmed) ||
            (codeLines.length > 0 && trimmed.length > 0 && trimmed.length < 120)
          ) {
            codeLines.push(text);
            j++;
          } else {
            break;
          }
        }

        if (codeLines.length >= 1) {
          // Replace these paragraphs with a <pre><code> block
          const pre = doc.createElement("pre");
          pre.className = "word-code-block";
          const code = doc.createElement("code");
          code.textContent = codeLines.join("\n");
          pre.appendChild(code);

          // Insert before first code paragraph
          container.insertBefore(pre, children[i]);
          // Remove original paragraphs
          for (let k = i; k < j; k++) {
            children[k].remove();
          }

          i = j;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    return container.innerHTML;
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-amber-500 mx-auto"></div>
            <p className="text-stone-500">加载文件中...</p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !file) {
    return (
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold text-red-600">
            {error || "文件未找到"}
          </h2>
          <Link href="/dashboard/files" className="mt-4 inline-block">
            <Button variant="secondary">← 返回文件列表</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const isPdf = file.mime_type === "application/pdf";
  const isWord =
    file.mime_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.mime_type === "application/msword";

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard/files" className="text-sm text-amber-600 hover:underline">
            ← 返回文件列表
          </Link>
          <h1 className="mt-2 truncate text-2xl font-semibold text-stone-800" title={file.filename}>
            {file.filename}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {isPdf ? "PDF 文档" : "Word 文档"} ·{" "}
            {(file.size / (1024 * 1024)).toFixed(2)} MB ·{" "}
            上传于 {new Date(file.created_at).toLocaleString("zh-CN")}
          </p>
        </div>
        <div className="flex gap-2">
          <a href={file.public_url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary">下载</Button>
          </a>
        </div>
      </div>

      <Card className="overflow-hidden">
        {isPdf && (
          <iframe
            src={file.public_url}
            className="h-[80vh] w-full border-0"
            title={file.filename}
          />
        )}

        {isWord && wordLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-amber-500 mx-auto"></div>
              <p className="text-stone-500">正在转换 Word 文档...</p>
            </div>
          </div>
        )}

        {isWord && wordHtml && (
          <div className="bg-white rounded-lg">
            <style dangerouslySetInnerHTML={{ __html: `
              .word-viewer pre,
              .word-viewer .word-code-block {
                background-color: #f5f5f4;
                border: 1px solid #e7e5e4;
                border-radius: 0.5rem;
                padding: 1rem 1.25rem;
                overflow-x: auto;
                margin: 1rem 0;
                font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", "Monaco", monospace;
                font-size: 0.875rem;
                line-height: 1.6;
                color: #292524;
                white-space: pre;
              }
              .word-viewer pre code,
              .word-viewer .word-code-block code {
                background: none;
                border: none;
                padding: 0;
                font-size: inherit;
                color: inherit;
                white-space: pre;
              }
              .word-viewer code {
                background-color: #f5f5f4;
                border: 1px solid #e7e5e4;
                border-radius: 0.25rem;
                padding: 0.15rem 0.4rem;
                font-family: "Cascadia Code", "Fira Code", "Consolas", monospace;
                font-size: 0.875em;
                color: #c2410c;
              }
            `}} />
            <div
              className="word-viewer prose max-w-none p-8 prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-a:text-blue-600 prose-td:border prose-td:border-gray-300 prose-td:p-2 prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-th:bg-gray-50 prose-img:max-w-full"
              dangerouslySetInnerHTML={{ __html: wordHtml }}
            />
          </div>
        )}

        {isWord && !wordLoading && !wordHtml && !error && (
          <div className="p-8 text-center text-stone-500">
            <p>无法预览此 Word 文档</p>
            <a href={file.public_url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" className="mt-4">
                下载查看
              </Button>
            </a>
          </div>
        )}
      </Card>
    </main>
  );
}
