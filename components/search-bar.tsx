"use client";

import { useEffect, useState, useCallback, useId } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SearchResult } from "@/lib/types";

interface SearchBarProps {
  onSearch: (results: SearchResult[]) => void;
  onClear: () => void;
  placeholder?: string;
  defaultValue?: string;
}

export function SearchBar({
  onSearch,
  onClear,
  placeholder = "搜索文档...",
  defaultValue = "",
}: SearchBarProps) {
  const [query, setQuery] = useState(defaultValue);
  const [isSearching, setIsSearching] = useState(false);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  // Debounced search function
  const performSearch = useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();

      // Clear search if query is empty
      if (!trimmed) {
        setResultCount(null);
        setError(null);
        onClear();
        return;
      }

      // Validate minimum length
      if (trimmed.length < 2) {
        setError("搜索关键词至少需要 2 个字符");
        setResultCount(null);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const response = await fetch("/api/documents/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: trimmed }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "搜索失败");
        }

        const results = data.results || [];
        setResultCount(results.length);
        onSearch(results);
      } catch (err) {
        const message = err instanceof Error ? err.message : "搜索失败";
        setError(message);
        setResultCount(null);
        onSearch([]);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearch, onClear]
  );

  // Debounce search with 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  function handleClear() {
    setQuery("");
    setResultCount(null);
    setError(null);
    onClear();
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <label htmlFor={inputId} className="sr-only">
            搜索文档
          </label>
          <Input
            id={inputId}
            name="search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="pr-10"
            aria-label="搜索文档"
          />
          {query && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              aria-label="清空搜索"
            >
              ✕
            </button>
          )}
        </div>
        {query && (
          <Button
            onClick={handleClear}
            variant="secondary"
            className="whitespace-nowrap"
          >
            清空
          </Button>
        )}
      </div>

      {/* Search status */}
      <div className="flex items-center gap-2 text-sm">
        {isSearching && (
          <span className="text-slate-400">搜索中...</span>
        )}
        {!isSearching && resultCount !== null && (
          <span className="text-slate-400">
            找到 {resultCount} 个结果
          </span>
        )}
        {error && (
          <span className="text-red-400">{error}</span>
        )}
      </div>
    </div>
  );
}
