"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchBar } from "@/components/search-bar";
import { DocumentSortFilter } from "@/components/document-sort-filter";
import { type DocumentRecord, type SearchResult, type SortField, type SortOrder } from "@/lib/types";
import { formatDate } from "@/lib/utils";

type DocumentListProps = {
  documents: DocumentRecord[];
};

export function DocumentList({ documents: initialDocuments }: DocumentListProps) {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState(initialDocuments);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  
  // Sort and filter state
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isLoadingFiltered, setIsLoadingFiltered] = useState(false);

  // Load saved settings from session storage
  useEffect(() => {
    const savedSortField = sessionStorage.getItem("documentSortField") as SortField;
    const savedSortOrder = sessionStorage.getItem("documentSortOrder") as SortOrder;
    const savedTags = sessionStorage.getItem("documentFilterTags");

    if (savedSortField) setSortField(savedSortField);
    if (savedSortOrder) setSortOrder(savedSortOrder);
    if (savedTags) {
      try {
        setSelectedTags(JSON.parse(savedTags));
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  // Fetch filtered/sorted documents when sort or filter changes
  useEffect(() => {
    if (isSearching) return; // Don't fetch if searching
    fetchFilteredDocuments();
  }, [sortField, sortOrder, selectedTags]);

  async function fetchFilteredDocuments() {
    setIsLoadingFiltered(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        sortBy: sortField,
        order: sortOrder,
      });

      if (selectedTags.length > 0) {
        params.append("tags", selectedTags.join(","));
      }

      const response = await fetch(`/api/documents?${params.toString()}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "获取文档列表失败");
      }

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取文档列表失败");
    } finally {
      setIsLoadingFiltered(false);
    }
  }

  // Determine which documents to display
  const displayDocuments = searchResults !== null ? searchResults : documents;
  const isShowingSearchResults = searchResults !== null;
  const hasActiveFilters = selectedTags.length > 0;

  function handleSearch(results: SearchResult[]) {
    setSearchResults(results);
    setIsSearching(true);
  }

  function handleClearSearch() {
    setSearchResults(null);
    setIsSearching(false);
  }

  function handleSortChange(field: SortField, order: SortOrder) {
    setSortField(field);
    setSortOrder(order);
  }

  function handleTagFilter(tags: string[]) {
    setSelectedTags(tags);
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);

    const response = await fetch("/api/documents", {
      method: "POST",
    });

    const payload = await response.json();
    setCreating(false);

    if (!response.ok) {
      setError(payload.error ?? "创建文档失败");
      return;
    }

    router.push(`/dashboard/doc/${payload.document.id}`);
    router.refresh();
  }

  function handleImportClick() {
    if (importing) {
      return;
    }

    importInputRef.current?.click();
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImporting(true);
    setError(null);

    try {
      const rawContent = await file.text();
      const content = rawContent.replace(/^\uFEFF/, "");
      const baseName = file.name.replace(/\.(md|markdown)$/i, "").trim();
      const title = baseName || "未命名文档";

      const response = await fetch("/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "导入文档失败");
      }

      router.push(`/dashboard/doc/${payload.document.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入文档失败");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  async function handleRename(id: string) {
    const title = draftTitle.trim() || "未命名文档";
    const response = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "重命名失败");
      return;
    }

    setDocuments((current) =>
      current.map((item) => (item.id === id ? payload.document : item)),
    );
    setRenamingId(null);
    setDraftTitle("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("确定删除这篇文档吗？此操作不可撤销。");

    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/documents/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const payload = await response.json();
      setError(payload.error ?? "删除失败");
      return;
    }

    setDocuments((current) => current.filter((item) => item.id !== id));
    
    // Also update search results if searching
    if (searchResults) {
      setSearchResults((current) => current ? current.filter((item) => item.id !== id) : null);
    }
    
    router.refresh();
  }

  // Helper function to highlight matches in title
  function highlightMatches(text: string, shouldHighlight: boolean) {
    if (!shouldHighlight) return text;
    // For now, just return the text as-is
    // In a real implementation, you'd parse and highlight the search terms
    return text;
  }

  // Helper function to highlight matches in excerpt
  function highlightExcerpt(excerpt: string) {
    // The excerpt from the API already has ** markers for highlights
    // Replace them with styled spans
    const parts = excerpt.split(/\*\*(.*?)\*\*/g);
    return (
      <>
        {parts.map((part, index) => {
          // Odd indices are the highlighted parts
          if (index % 2 === 1) {
            return (
              <span key={index} className="bg-amber-100 text-amber-800 font-medium">
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-800">全部文档</h2>
          <p className="text-sm text-stone-500">
            {isShowingSearchResults
              ? `搜索结果 (${displayDocuments.length})`
              : hasActiveFilters
              ? `筛选结果 (${displayDocuments.length})`
              : "按最近更新时间排序"}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={importInputRef}
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            className="hidden"
            onChange={handleImportFile}
            disabled={importing}
          />
          <Button onClick={handleImportClick} disabled={importing} variant="secondary">
            {importing ? "导入中..." : "导入 Markdown"}
          </Button>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? "创建中..." : "新建文档"}
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar
        onSearch={handleSearch}
        onClear={handleClearSearch}
        placeholder="搜索标题或内容..."
      />

      {/* Sort and Filter Controls */}
      {!isShowingSearchResults && (
        <DocumentSortFilter
          sortField={sortField}
          sortOrder={sortOrder}
          selectedTags={selectedTags}
          onSortChange={handleSortChange}
          onTagFilter={handleTagFilter}
        />
      )}

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

      {isLoadingFiltered && !isShowingSearchResults ? (
        <Card className="flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-stone-200 border-t-amber-500"></div>
          <p className="text-sm text-stone-500">加载中...</p>
        </Card>
      ) : displayDocuments.length === 0 ? (
        <Card className="flex min-h-72 flex-col items-center justify-center gap-4 p-8 text-center">
          {isShowingSearchResults ? (
            <>
              <h3 className="text-xl font-medium text-stone-800">未找到匹配的文档</h3>
              <p className="max-w-md text-sm leading-7 text-stone-500">
                尝试使用不同的关键词搜索，或清空搜索查看所有文档。
              </p>
              <Button onClick={handleClearSearch} variant="secondary">
                清空搜索
              </Button>
            </>
          ) : hasActiveFilters ? (
            <>
              <h3 className="text-xl font-medium text-stone-800">没有匹配的文档</h3>
              <p className="max-w-md text-sm leading-7 text-stone-500">
                没有文档包含所有选中的标签。尝试减少筛选条件。
              </p>
              <Button onClick={() => setSelectedTags([])} variant="secondary">
                清除筛选
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-xl font-medium text-stone-800">还没有文档</h3>
              <p className="max-w-md text-sm leading-7 text-stone-500">
                先创建你的第一篇 Markdown 文档，之后你就可以在不同设备之间继续编辑。
              </p>
              <Button onClick={handleCreate} disabled={creating}>
                立即创建
              </Button>
            </>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {displayDocuments.map((document) => {
            const isRenaming = renamingId === document.id;

            return (
              <Card key={document.id} className="flex flex-col gap-4 p-5">
                <div className="space-y-3">
                  {isRenaming ? (
                    <div className="space-y-3">
                      <Input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} />
                      <div className="flex gap-2">
                        <Button className="flex-1" onClick={() => handleRename(document.id)}>
                          保存
                        </Button>
                        <Button
                          className="flex-1"
                          variant="secondary"
                          onClick={() => {
                            setRenamingId(null);
                            setDraftTitle("");
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Link href={`/dashboard/doc/${document.id}`} className="block text-lg font-semibold text-stone-800 hover:text-amber-700">
                          {highlightMatches(document.title, isShowingSearchResults)}
                        </Link>
                        <p className="line-clamp-3 text-sm leading-7 text-stone-500">
                          {isShowingSearchResults && "excerpt" in document
                            ? highlightExcerpt((document as SearchResult).excerpt)
                            : document.content || "空文档"}
                        </p>
                      </div>
                      {"tags" in document && document.tags && document.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {document.tags.map((tag) => (
                            <div
                              key={tag.id}
                              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-stone-50 px-2 py-1"
                            >
                              <div
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              <span className="text-xs text-stone-600">{tag.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-stone-400">更新于 {formatDate(document.updated_at)}</p>
                    </>
                  )}
                </div>
                {!isRenaming ? (
                  <div className="mt-auto flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setRenamingId(document.id);
                        setDraftTitle(document.title);
                      }}
                    >
                      重命名
                    </Button>
                    <Button variant="danger" className="flex-1" onClick={() => handleDelete(document.id)}>
                      删除
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
