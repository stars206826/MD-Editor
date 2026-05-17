"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
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

interface ImageEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onInsert: (imageData: string, width?: number, height?: number) => void;
  documentId: string;
}

export function ImageEditorDialog({
  open,
  onClose,
  onInsert,
  documentId,
}: ImageEditorDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [imageWidth, setImageWidth] = useState<number>(0);
  const [imageHeight, setImageHeight] = useState<number>(0);
  const [displayWidth, setDisplayWidth] = useState<number>(0);
  const [displayHeight, setDisplayHeight] = useState<number>(0);
  const [maintainAspectRatio, setMaintainAspectRatio] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false);
  const [hasCropped, setHasCropped] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSelectedFile(null);
      setPreviewUrl("");
      setImageWidth(0);
      setImageHeight(0);
      setDisplayWidth(0);
      setDisplayHeight(0);
      setCropMode(false);
      setHasCropped(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setAspect(null);
      setCroppedAreaPixels(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!previewUrl.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // 打开文件选择器
  function handleSelectFile() {
    fileInputRef.current?.click();
  }

  // 处理文件选择
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("不支持的文件格式。请选择 JPEG、PNG、GIF 或 WebP 图片。");
      return;
    }

    // 验证文件大小 (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`文件过大。最大支持 10MB，您的文件为 ${(file.size / 1024 / 1024).toFixed(2)}MB。`);
      return;
    }

    setError(null);
    setSelectedFile(file);
    setCropMode(false);
    setHasCropped(false);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(null);
    setCroppedAreaPixels(null);

    // 创建预览
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setPreviewUrl(url);

      // 获取图片尺寸
      const img = new Image();
      img.onload = () => {
        setImageWidth(img.width);
        setImageHeight(img.height);
        setDisplayWidth(img.width);
        setDisplayHeight(img.height);
        
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  }

  // 调整宽度
  function handleWidthChange(value: number) {
    setDisplayWidth(value);
    if (maintainAspectRatio && imageWidth > 0) {
      const ratio = imageHeight / imageWidth;
      setDisplayHeight(Math.round(value * ratio));
    }
  }

  // 调整高度
  function handleHeightChange(value: number) {
    setDisplayHeight(value);
    if (maintainAspectRatio && imageHeight > 0) {
      const ratio = imageWidth / imageHeight;
      setDisplayWidth(Math.round(value * ratio));
    }
  }

  // 重置尺寸
  function handleResetSize() {
    setDisplayWidth(imageWidth);
    setDisplayHeight(imageHeight);
  }

  // 开始裁剪
  function handleStartCrop() {
    setCropMode(true);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }

  // 取消裁剪
  function handleCancelCrop() {
    setCropMode(false);
  }

  // 应用裁剪
  async function handleApplyCrop() {
    if (!croppedAreaPixels || !previewUrl) return;
    const result = await getCroppedImage(previewUrl, croppedAreaPixels);
    setPreviewUrl(result.url);
    setImageWidth(result.width);
    setImageHeight(result.height);
    setDisplayWidth(result.width);
    setDisplayHeight(result.height);
    setHasCropped(true);
    setCropMode(false);
  }

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // 上传并插入图片
  async function handleInsertImage() {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);

    try {
      // 如果有裁剪或调整大小，先处理图片
      let fileToUpload = selectedFile;
      
      if (hasCropped || displayWidth !== imageWidth || displayHeight !== imageHeight) {
        // 创建处理后的图片
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("无法创建画布");

        canvas.width = displayWidth;
        canvas.height = displayHeight;

        const img = new Image();
        img.src = previewUrl;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

        // 转换为 Blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("无法生成图片"));
          }, "image/png");
        });

        fileToUpload = new File([blob], selectedFile.name, { type: "image/png" });
      }

      // 上传图片
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("documentId", documentId);

      const response = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "上传失败");
      }

      if (data.success && data.image) {
        // 插入图片，带上尺寸信息
        onInsert(data.image.url, displayWidth, displayHeight);
        onClose();
      } else {
        throw new Error("上传失败");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>插入图片</DialogTitle>
          <DialogDescription>
            选择图片文件，可以调整大小或裁剪后插入
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 文件选择 */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button onClick={handleSelectFile} variant="secondary" className="w-full">
              📁 选择图片文件
            </Button>
            <p className="text-xs text-stone-400 text-center">
              支持 JPEG、PNG、GIF、WebP 格式，最大 10MB
            </p>
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* 图片预览和编辑 */}
          {previewUrl && (
            <div className="space-y-4">
              {/* 预览区域 */}
              <div className="relative rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div
                  className="relative mx-auto max-h-96 overflow-hidden"
                  style={{ maxWidth: "100%" }}
                >
                  {cropMode ? (
                    <div className="relative h-72 w-full">
                      <Cropper
                        image={previewUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect ?? undefined}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={handleCropComplete}
                        objectFit="contain"
                      />
                    </div>
                  ) : (
                    <img
                      src={previewUrl}
                      alt="预览"
                      className="mx-auto max-h-96 object-contain"
                      style={{
                        width: `${Math.min(displayWidth, 600)}px`,
                        height: "auto",
                      }}
                    />
                  )}
                </div>
                
                <canvas ref={canvasRef} className="hidden" />
                
                <p className="mt-2 text-center text-xs text-stone-500">
                  原始尺寸: {imageWidth} × {imageHeight} 像素
                </p>
              </div>

              {/* 裁剪控制 */}
              {!cropMode ? (
                <div className="flex gap-2">
                  <Button onClick={handleStartCrop} variant="secondary" className="flex-1">
                    ✂️ 裁剪图片
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs text-stone-500">缩放</label>
                      <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-stone-500">裁剪比例</label>
                      <select
                        value={aspect ?? "free"}
                        onChange={(e) => {
                          const value = e.target.value;
                          setAspect(value === "free" ? null : Number(value));
                        }}
                        className="w-full rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
                      >
                        <option value="free">自由</option>
                        <option value="1">1:1</option>
                        <option value="1.3333333">4:3</option>
                        <option value="1.7777777">16:9</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleApplyCrop} variant="primary" className="flex-1">
                      ✓ 应用裁剪
                    </Button>
                    <Button onClick={handleCancelCrop} variant="secondary" className="flex-1">
                      ✕ 取消裁剪
                    </Button>
                  </div>
                </div>
              )}

              {/* 尺寸调整 */}
              {!cropMode && (
                <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-stone-600">
                      调整尺寸
                    </label>
                    <Button onClick={handleResetSize} variant="ghost" size="sm">
                      重置
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-stone-500">宽度 (像素)</label>
                      <Input
                        type="number"
                        value={displayWidth}
                        onChange={(e) => handleWidthChange(Number(e.target.value))}
                        min={1}
                        max={imageWidth * 2}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-stone-500">高度 (像素)</label>
                      <Input
                        type="number"
                        value={displayHeight}
                        onChange={(e) => handleHeightChange(Number(e.target.value))}
                        min={1}
                        max={imageHeight * 2}
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="aspectRatio"
                      checked={maintainAspectRatio}
                      onChange={(e) => setMaintainAspectRatio(e.target.checked)}
                      className="h-4 w-4 rounded border-stone-300 bg-white text-amber-500"
                    />
                    <label htmlFor="aspectRatio" className="text-sm text-stone-600 cursor-pointer">
                      保持宽高比
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isUploading}>
            取消
          </Button>
          <Button
            onClick={handleInsertImage}
            disabled={!selectedFile || isUploading || cropMode}
            variant="primary"
          >
            {isUploading ? "上传中..." : "插入图片"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

async function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("无法加载图片"));
    image.src = url;
  });
}

async function getCroppedImage(
  imageSrc: string,
  cropPixels: Area
): Promise<{ url: string; width: number; height: number; blob: Blob }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("无法创建画布");
  }

  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;

  ctx.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    cropPixels.width,
    cropPixels.height
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) {
        resolve(result);
      } else {
        reject(new Error("无法生成裁剪图片"));
      }
    }, "image/png");
  });

  const url = URL.createObjectURL(blob);
  return {
    url,
    width: cropPixels.width,
    height: cropPixels.height,
    blob,
  };
}
