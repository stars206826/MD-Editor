"use client";

import { useEffect, useState } from "react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type { SortField, SortOrder, Tag } from "@/lib/types";

interface DocumentSortFilterProps {
  sortField: SortField;
  sortOrder: SortOrder;
  selectedTags: string[];
  onSortChange: (field: SortField, order: SortOrder) => void;
  onTagFilter: (tags: string[]) => void;
}

export function DocumentSortFilter({
  sortField,
  sortOrder,
  selectedTags,
  onSortChange,
  onTagFilter,
}: DocumentSortFilterProps) {
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available tags
  useEffect(() => {
    loadTags();
  }, []);

  // Persist settings to session storage
  useEffect(() => {
    sessionStorage.setItem("documentSortField", sortField);
    sessionStorage.setItem("documentSortOrder", sortOrder);
    sessionStorage.setItem("documentFilterTags", JSON.stringify(selectedTags));
  }, [sortField, sortOrder, selectedTags]);

  async function loadTags() {
    setIsLoading(true);
    try {
      const response = await fetch("/api/tags");
      if (!response.ok) {
        throw new Error("加载标签失败");
      }
      const data = await response.json();
      setAvailableTags(data.tags || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载标签失败");
    } finally {
      setIsLoading(false);
    }
  }

  function handleSortFieldChange(field: SortField) {
    onSortChange(field, sortOrder);
  }

  function handleSortOrderToggle() {
    const newOrder: SortOrder = sortOrder === "asc" ? "desc" : "asc";
    onSortChange(sortField, newOrder);
  }

  function handleTagToggle(tagId: string) {
    if (selectedTags.includes(tagId)) {
      // Remove tag
      onTagFilter(selectedTags.filter((id) => id !== tagId));
    } else {
      // Add tag
      onTagFilter([...selectedTags, tagId]);
    }
  }

  function handleClearFilters() {
    onTagFilter([]);
  }

  const hasActiveFilters = selectedTags.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white/60 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort Field Selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-stone-600 whitespace-nowrap">排序:</label>
          <Select
            value={sortField}
            onChange={(e) => handleSortFieldChange(e.target.value as SortField)}
            className="w-32"
          >
            <option value="updated_at">更新时间</option>
            <option value="created_at">创建时间</option>
            <option value="title">标题</option>
          </Select>
        </div>

        {/* Sort Order Toggle */}
        <Button
          onClick={handleSortOrderToggle}
          variant="secondary"
          className="whitespace-nowrap"
          aria-label={sortOrder === "asc" ? "升序" : "降序"}
        >
          {sortOrder === "asc" ? "↑ 升序" : "↓ 降序"}
        </Button>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <Button
            onClick={handleClearFilters}
            variant="ghost"
            className="ml-auto text-xs"
          >
            清除筛选
          </Button>
        )}
      </div>

      {/* Tag Filter */}
      {availableTags.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm text-stone-600">按标签筛选:</label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleTagToggle(tag.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    isSelected
                      ? "border-amber-500 bg-amber-50 text-amber-800"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
                  }`}
                  aria-pressed={isSelected}
                >
                  <div
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span>{tag.name}</span>
                  {isSelected && <span className="ml-1">✓</span>}
                </button>
              );
            })}
          </div>
          {selectedTags.length > 0 && (
            <p className="text-xs text-stone-500">
              已选择 {selectedTags.length} 个标签 (显示包含所有选中标签的文档)
            </p>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {/* Loading State */}
      {isLoading && availableTags.length === 0 && (
        <p className="text-sm text-stone-500">加载标签中...</p>
      )}
    </div>
  );
}
