/**
 * Integration tests for Task 8.4: Image Upload Integration
 * 
 * Tests all three image upload methods:
 * 1. Toolbar button (opens dialog)
 * 2. Paste (Ctrl+V) - direct upload
 * 3. Drag and drop - direct upload
 * 
 * Requirements: 6.1, 6.8, 12.1
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { DocumentEditor } from "./document-editor";
import type { DocumentRecord } from "@/lib/types";

// Mock Next.js modules
vi.mock("next/link", () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("react-markdown", () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("remark-gfm", () => ({
  default: () => {},
}));

// Mock fetch globally
global.fetch = vi.fn();

describe("DocumentEditor - Image Upload Integration (Task 8.4)", () => {
  const mockDocument: DocumentRecord = {
    id: "test-doc-id",
    user_id: "test-user-id",
    title: "Test Document",
    content: "Test content",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful document fetch
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes("/api/documents/")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ document: { ...mockDocument, tags: [] } }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
  });

  describe("Requirement 6.1: Image button in toolbar", () => {
    it("should have an image button in the toolbar", () => {
      render(<DocumentEditor document={mockDocument} />);
      
      // Find the image button (🖼️ emoji)
      const imageButton = screen.getByTitle("插入图片");
      expect(imageButton).toBeDefined();
    });

    it("should open image upload dialog when image button is clicked", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const imageButton = screen.getByTitle("插入图片");
      fireEvent.click(imageButton);
      
      // Dialog should appear
      await waitFor(() => {
        expect(screen.getByText("Upload Image")).toBeDefined();
      });
    });
  });

  describe("Requirement 6.1: Paste event listener", () => {
    it("should handle image paste in textarea", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const textarea = screen.getByPlaceholderText("在这里写 Markdown...");
      
      // Focus the textarea
      fireEvent.focus(textarea);
      
      // Create a mock image file
      const file = new File(["image content"], "test.png", { type: "image/png" });
      
      // Mock successful upload
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              image: { url: "https://example.com/test.png" },
            }),
        })
      );
      
      // Create clipboard event with image
      const clipboardData = {
        items: [
          {
            type: "image/png",
            kind: "file",
            getAsFile: () => file,
          },
        ],
      };
      
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: clipboardData as any,
      });
      
      // Trigger paste event
      fireEvent(textarea, pasteEvent);
      
      // Wait for upload to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/storage/upload",
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });

    it("should show error for invalid file type on paste", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const textarea = screen.getByPlaceholderText("在这里写 Markdown...");
      fireEvent.focus(textarea);
      
      // Create a mock non-image file
      const file = new File(["text content"], "test.txt", { type: "text/plain" });
      
      const clipboardData = {
        items: [
          {
            type: "text/plain",
            kind: "file",
            getAsFile: () => file,
          },
        ],
      };
      
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: clipboardData as any,
      });
      
      fireEvent(textarea, pasteEvent);
      
      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/Invalid file type/i)
        ).toBeDefined();
      });
    });

    it("should show error for file size exceeding 5MB on paste", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const textarea = screen.getByPlaceholderText("在这里写 Markdown...");
      fireEvent.focus(textarea);
      
      // Create a mock large file (6MB)
      const largeFile = new File(
        [new ArrayBuffer(6 * 1024 * 1024)],
        "large.png",
        { type: "image/png" }
      );
      
      const clipboardData = {
        items: [
          {
            type: "image/png",
            kind: "file",
            getAsFile: () => largeFile,
          },
        ],
      };
      
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: clipboardData as any,
      });
      
      fireEvent(textarea, pasteEvent);
      
      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/File size exceeds 5MB/i)
        ).toBeDefined();
      });
    });
  });

  describe("Requirement 6.1: Drag and drop handlers", () => {
    it("should show drag overlay when dragging image over editor", () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const editorSection = screen.getByText("标题").closest("section");
      expect(editorSection).toBeDefined();
      
      // Create drag event with image file
      const file = new File(["image"], "test.png", { type: "image/png" });
      const dataTransfer = {
        items: [{ kind: "file", type: "image/png" }],
        files: [file],
      };
      
      const dragEnterEvent = new DragEvent("dragenter", {
        dataTransfer: dataTransfer as any,
      });
      
      fireEvent(editorSection!, dragEnterEvent);
      
      // Should show drag overlay
      expect(screen.getByText(/Drop image here to upload/i)).toBeDefined();
    });

    it("should upload image on drop", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const editorSection = screen.getByText("标题").closest("section");
      
      // Mock successful upload
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              image: { url: "https://example.com/dropped.png" },
            }),
        })
      );
      
      // Create drop event with image file
      const file = new File(["image"], "dropped.png", { type: "image/png" });
      const dataTransfer = {
        files: [file],
      };
      
      const dropEvent = new DragEvent("drop", {
        dataTransfer: dataTransfer as any,
      });
      
      fireEvent(editorSection!, dropEvent);
      
      // Wait for upload to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/storage/upload",
          expect.objectContaining({
            method: "POST",
          })
        );
      });
    });

    it("should not upload non-image files on drop", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const editorSection = screen.getByText("标题").closest("section");
      
      // Create drop event with non-image file
      const file = new File(["text"], "test.txt", { type: "text/plain" });
      const dataTransfer = {
        files: [file],
      };
      
      const dropEvent = new DragEvent("drop", {
        dataTransfer: dataTransfer as any,
      });
      
      fireEvent(editorSection!, dropEvent);
      
      // Should not call upload API
      await waitFor(() => {
        expect(global.fetch).not.toHaveBeenCalledWith(
          "/api/storage/upload",
          expect.anything()
        );
      });
    });
  });

  describe("Requirement 6.8: Insert markdown on upload complete", () => {
    it("should insert markdown image syntax at cursor position", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const textarea = screen.getByPlaceholderText("在这里写 Markdown...") as HTMLTextAreaElement;
      
      // Set initial content and cursor position
      fireEvent.change(textarea, { target: { value: "Hello world" } });
      textarea.setSelectionRange(5, 5); // After "Hello"
      fireEvent.focus(textarea);
      
      // Create and paste image
      const file = new File(["image"], "test.png", { type: "image/png" });
      
      (global.fetch as any).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              image: { url: "https://example.com/test.png" },
            }),
        })
      );
      
      const clipboardData = {
        items: [
          {
            type: "image/png",
            kind: "file",
            getAsFile: () => file,
          },
        ],
      };
      
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: clipboardData as any,
      });
      
      fireEvent(textarea, pasteEvent);
      
      // Wait for markdown to be inserted
      await waitFor(() => {
        expect(textarea.value).toContain("![test.png](https://example.com/test.png)");
      });
    });
  });

  describe("Requirement 12.1: Visual feedback", () => {
    it("should show uploading indicator during upload", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const textarea = screen.getByPlaceholderText("在这里写 Markdown...");
      fireEvent.focus(textarea);
      
      // Create slow upload mock
      let resolveUpload: any;
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve;
      });
      
      (global.fetch as any).mockImplementationOnce(() => uploadPromise);
      
      // Paste image
      const file = new File(["image"], "test.png", { type: "image/png" });
      const clipboardData = {
        items: [
          {
            type: "image/png",
            kind: "file",
            getAsFile: () => file,
          },
        ],
      };
      
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: clipboardData as any,
      });
      
      fireEvent(textarea, pasteEvent);
      
      // Should show uploading indicator
      await waitFor(() => {
        expect(screen.getByText("Uploading image...")).toBeDefined();
      });
      
      // Complete upload
      resolveUpload({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            image: { url: "https://example.com/test.png" },
          }),
      });
      
      // Uploading indicator should disappear
      await waitFor(() => {
        expect(screen.queryByText("Uploading image...")).toBeNull();
      });
    });

    it("should disable textarea during upload", async () => {
      render(<DocumentEditor document={mockDocument} />);
      
      const textarea = screen.getByPlaceholderText("在这里写 Markdown...") as HTMLTextAreaElement;
      fireEvent.focus(textarea);
      
      // Create slow upload mock
      let resolveUpload: any;
      const uploadPromise = new Promise((resolve) => {
        resolveUpload = resolve;
      });
      
      (global.fetch as any).mockImplementationOnce(() => uploadPromise);
      
      // Paste image
      const file = new File(["image"], "test.png", { type: "image/png" });
      const clipboardData = {
        items: [
          {
            type: "image/png",
            kind: "file",
            getAsFile: () => file,
          },
        ],
      };
      
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: clipboardData as any,
      });
      
      fireEvent(textarea, pasteEvent);
      
      // Textarea should be disabled
      await waitFor(() => {
        expect(textarea.disabled).toBe(true);
      });
      
      // Complete upload
      resolveUpload({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            image: { url: "https://example.com/test.png" },
          }),
      });
      
      // Textarea should be enabled again
      await waitFor(() => {
        expect(textarea.disabled).toBe(false);
      });
    });
  });
});
