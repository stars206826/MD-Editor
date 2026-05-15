import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImageUploader } from "./image-uploader";

describe("ImageUploader", () => {
  const mockOnUploadComplete = vi.fn();
  const mockOnUploadError = vi.fn();
  const documentId = "test-doc-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders drag-and-drop zone", () => {
    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByText(/Drag and drop an image/i)).toBeInTheDocument();
    expect(screen.getByText(/or paste \(Ctrl\+V\) or click the button below/i)).toBeInTheDocument();
  });

  it("renders file input button", () => {
    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByRole("button", { name: /Choose Image File/i })).toBeInTheDocument();
  });

  it("displays file size and format restrictions", () => {
    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    expect(screen.getByText(/Supports JPEG, PNG, GIF, WebP • Max 5MB/i)).toBeInTheDocument();
  });

  it("validates file type and shows error for invalid type", async () => {
    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    // Create invalid file (PDF)
    const invalidFile = new File(["test"], "test.pdf", { type: "application/pdf" });

    // Simulate file selection
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [invalidFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
      expect(mockOnUploadError).toHaveBeenCalled();
    });
  });

  it("validates file size and shows error for oversized file", async () => {
    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    // Create oversized file (6MB)
    const oversizedFile = new File(
      [new ArrayBuffer(6 * 1024 * 1024)],
      "large.jpg",
      { type: "image/jpeg" }
    );

    // Simulate file selection
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [oversizedFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/File size exceeds 5MB limit/i)).toBeInTheDocument();
      expect(mockOnUploadError).toHaveBeenCalled();
    });
  });

  it("disables upload when disabled prop is true", () => {
    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
        disabled={true}
      />
    );

    const button = screen.getByRole("button", { name: /Choose Image File/i });
    expect(button).toBeDisabled();
  });

  it("shows uploading state during upload", async () => {
    // Mock XMLHttpRequest
    const mockXHR = {
      open: vi.fn(),
      send: vi.fn(),
      upload: {
        addEventListener: vi.fn(),
      },
      addEventListener: vi.fn(),
      status: 200,
      responseText: JSON.stringify({ success: true, image: { url: "https://example.com/image.jpg" } }),
    };

    global.XMLHttpRequest = vi.fn(() => mockXHR) as any;

    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    // Create valid file
    const validFile = new File(["test"], "test.jpg", { type: "image/jpeg" });

    // Simulate file selection
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [validFile],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(screen.getByText(/Uploading.../i)).toBeInTheDocument();
    });
  });

  it("handles drag enter and shows visual feedback", () => {
    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const dropZone = screen.getByText(/Drag and drop an image/i).closest("div");
    expect(dropZone).toBeInTheDocument();

    // Simulate drag enter
    fireEvent.dragEnter(dropZone!, {
      dataTransfer: {
        items: [{ kind: "file", type: "image/jpeg" }],
      },
    });

    expect(screen.getByText(/Drop image here/i)).toBeInTheDocument();
  });

  it("handles drag leave and removes visual feedback", () => {
    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
      />
    );

    const dropZone = screen.getByText(/Drag and drop an image/i).closest("div");
    expect(dropZone).toBeInTheDocument();

    // Simulate drag enter
    fireEvent.dragEnter(dropZone!, {
      dataTransfer: {
        items: [{ kind: "file", type: "image/jpeg" }],
      },
    });

    expect(screen.getByText(/Drop image here/i)).toBeInTheDocument();

    // Simulate drag leave
    fireEvent.dragLeave(dropZone!, {
      dataTransfer: {
        items: [],
      },
    });

    await waitFor(() => {
      expect(screen.getByText(/Drag and drop an image/i)).toBeInTheDocument();
    });
  });

  it("accepts custom maxSize prop", () => {
    const customMaxSize = 10 * 1024 * 1024; // 10MB

    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
        maxSize={customMaxSize}
      />
    );

    expect(screen.getByText(/Max 10MB/i)).toBeInTheDocument();
  });

  it("accepts custom acceptedFormats prop", () => {
    const customFormats = ["image/jpeg", "image/png"];

    render(
      <ImageUploader
        documentId={documentId}
        onUploadComplete={mockOnUploadComplete}
        onUploadError={mockOnUploadError}
        acceptedFormats={customFormats}
      />
    );

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe("image/jpeg,image/png");
  });
});
