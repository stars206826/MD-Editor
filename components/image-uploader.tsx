"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import type { UploadProgress } from "@/lib/types";

interface ImageUploaderProps {
  documentId: string;
  onUploadComplete: (url: string, filename: string) => void;
  onUploadError: (error: Error) => void;
  maxSize?: number; // in bytes, default 5MB
  acceptedFormats?: string[];
  disabled?: boolean;
}

// Allowed image MIME types (Requirement 6.2)
const DEFAULT_ALLOWED_FORMATS = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Maximum file size: 5MB (Requirement 6.3)
const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5242880 bytes

export function ImageUploader({
  documentId,
  onUploadComplete,
  onUploadError,
  maxSize = DEFAULT_MAX_SIZE,
  acceptedFormats = DEFAULT_ALLOWED_FORMATS,
  disabled = false,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // Validate file (Requirement 6.4)
  const validateFile = useCallback(
    (file: File): { isValid: boolean; error: string | null } => {
      // Check file type
      if (!acceptedFormats.includes(file.type)) {
        return {
          isValid: false,
          error: `不支持的文件格式，仅支持 JPEG、PNG、GIF 和 WebP 图片。`,
        };
      }

      // Check file size
      if (file.size > maxSize) {
        return {
          isValid: false,
          error: `文件大小超过 ${(maxSize / 1024 / 1024).toFixed(0)}MB 限制，当前文件大小为 ${(file.size / 1024 / 1024).toFixed(2)}MB。`,
        };
      }

      return { isValid: true, error: null };
    },
    [acceptedFormats, maxSize]
  );

  // Upload file to server (Requirement 6.6, 6.7, 6.8)
  const uploadFile = useCallback(
    async (file: File) => {
      setIsUploading(true);
      setValidationError(null);
      setUploadProgress({ loaded: 0, total: file.size, percentage: 0 });

      try {
        // Create form data
        const formData = new FormData();
        formData.append("file", file);
        formData.append("documentId", documentId);

        // Upload with progress tracking (Requirement 6.9)
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentage = Math.round((e.loaded / e.total) * 100);
            setUploadProgress({
              loaded: e.loaded,
              total: e.total,
              percentage,
            });
          }
        });

        // Handle completion
        const uploadPromise = new Promise<{ success: boolean; image?: { url: string }; error?: string }>(
          (resolve, reject) => {
            xhr.addEventListener("load", () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const response = JSON.parse(xhr.responseText);
                  resolve(response);
                } catch (err) {
                  reject(new Error("解析服务器响应失败"));
                }
              } else {
                try {
                  const response = JSON.parse(xhr.responseText);
                  reject(new Error(response.error || "上传失败"));
                } catch (err) {
                  reject(new Error(`上传失败，状态码 ${xhr.status}`));
                }
              }
            });

            xhr.addEventListener("error", () => {
              reject(new Error("上传时网络错误"));
            });

            xhr.addEventListener("abort", () => {
              reject(new Error("上传已取消"));
            });
          }
        );

        xhr.open("POST", "/api/storage/upload");
        xhr.send(formData);

        const response = await uploadPromise;

        if (response.success && response.image) {
          // Upload successful (Requirement 6.8)
          setUploadProgress(null);
          setIsUploading(false);
          onUploadComplete(response.image.url, file.name);
        } else {
          throw new Error(response.error || "上传失败");
        }
      } catch (err) {
        // Upload failed (Requirement 6.10)
        setUploadProgress(null);
        setIsUploading(false);
        const error = err instanceof Error ? err : new Error("上传失败");
        setValidationError(error.message);
        onUploadError(error);
      }
    },
    [documentId, onUploadComplete, onUploadError]
  );

  // Handle file selection
  const handleFileSelect = useCallback(
    async (file: File) => {
      if (disabled || isUploading) return;

      // Validate file (Requirement 6.4, 6.5)
      const validation = validateFile(file);
      if (!validation.isValid) {
        setValidationError(validation.error);
        onUploadError(new Error(validation.error || "文件验证失败"));
        return;
      }

      // Upload file
      await uploadFile(file);
    },
    [disabled, isUploading, validateFile, uploadFile, onUploadError]
  );

  // Handle drag events (Requirement 6.1)
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;

      dragCounterRef.current++;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    },
    [disabled, isUploading]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;

      dragCounterRef.current--;
      if (dragCounterRef.current === 0) {
        setIsDragging(false);
      }
    },
    [disabled, isUploading]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled || isUploading) return;

      setIsDragging(false);
      dragCounterRef.current = 0;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        handleFileSelect(file);
      }
    },
    [disabled, isUploading, handleFileSelect]
  );

  // Handle paste event (Requirement 6.1)
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (disabled || isUploading) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            handleFileSelect(file);
          }
          break;
        }
      }
    },
    [disabled, isUploading, handleFileSelect]
  );

  // Handle file input change (Requirement 6.1)
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileSelect(files[0]);
      }
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [handleFileSelect]
  );

  // Handle button click
  const handleButtonClick = useCallback(() => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  }, [disabled, isUploading]);

  return (
    <div className="space-y-3">
      {/* Drag and drop zone (Requirement 6.1) */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          relative rounded-xl border-2 border-dashed p-6 text-center transition-colors
          ${isDragging ? "border-amber-400 bg-amber-50" : "border-stone-300 bg-stone-50"}
          ${disabled || isUploading ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-amber-400/50 hover:bg-stone-100"}
        `}
      >
        <div className="space-y-3">
          <div className="text-4xl">🖼️</div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-stone-600">
              {isDragging ? "松开以上传图片" : "拖拽图片到此处"}
            </p>
            <p className="text-xs text-stone-500">
              或粘贴 (Ctrl+V) 或点击下方按钮选择
            </p>
          </div>
          <div className="text-xs text-stone-400">
            支持 JPEG、PNG、GIF、WebP · 最大 {(maxSize / 1024 / 1024).toFixed(0)}MB
          </div>
        </div>
      </div>

      {/* File input button (Requirement 6.1) */}
      <div className="flex justify-center">
        <Button
          onClick={handleButtonClick}
          disabled={disabled || isUploading}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          {isUploading ? "上传中..." : "选择图片文件"}
        </Button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(",")}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Upload progress bar (Requirement 6.9) */}
      {uploadProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span>上传中...</span>
            <span>{uploadProgress.percentage}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full bg-amber-500 transition-all duration-300"
              style={{ width: `${uploadProgress.percentage}%` }}
            />
          </div>
          <div className="text-xs text-stone-400">
            {(uploadProgress.loaded / 1024).toFixed(0)} KB / {(uploadProgress.total / 1024).toFixed(0)} KB
          </div>
        </div>
      )}

      {/* Validation error (Requirement 6.5) */}
      {validationError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {validationError}
        </div>
      )}
    </div>
  );
}

// Hook to attach paste listener to document
export function useImagePasteHandler(
  onPaste: (file: File) => void,
  enabled: boolean = true
) {
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!enabled) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            onPaste(file);
          }
          break;
        }
      }
    },
    [enabled, onPaste]
  );

  // Attach/detach paste listener
  if (typeof window !== "undefined") {
    if (enabled) {
      document.addEventListener("paste", handlePaste);
      return () => document.removeEventListener("paste", handlePaste);
    }
  }
}
