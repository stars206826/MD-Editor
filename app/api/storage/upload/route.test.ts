import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
};

// Mock createClient
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock crypto.randomUUID
global.crypto = {
  randomUUID: () => "test-uuid-1234",
} as any;

describe("POST /api/storage/upload", () => {
  const mockUserId = "user-123";
  const mockDocumentId = "doc-456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });

    const formData = new FormData();
    const request = new NextRequest("http://localhost/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if no file is provided", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const formData = new FormData();
    formData.append("documentId", mockDocumentId);

    const request = new NextRequest("http://localhost/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No file provided");
  });

  it("should return 400 if documentId is not provided", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);

    const request = new NextRequest("http://localhost/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Document ID is required");
  });

  it("should return 404 if document does not exist or user does not own it", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "Not found" },
            }),
          }),
        }),
      }),
    });

    mockSupabase.from = mockFrom;

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentId", mockDocumentId);

    const request = new NextRequest("http://localhost/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Document not found or access denied");
  });

  it("should return 400 if file type is not allowed", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockDocumentId, user_id: mockUserId },
              error: null,
            }),
          }),
        }),
      }),
    });

    mockSupabase.from = mockFrom;

    const file = new File(["test"], "test.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentId", mockDocumentId);

    const request = new NextRequest("http://localhost/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid file type");
  });

  it("should return 400 if file size exceeds 5MB", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockDocumentId, user_id: mockUserId },
              error: null,
            }),
          }),
        }),
      }),
    });

    mockSupabase.from = mockFrom;

    // Create a file larger than 5MB
    const largeContent = new Uint8Array(6 * 1024 * 1024); // 6MB
    const file = new File([largeContent], "large.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentId", mockDocumentId);

    const request = new NextRequest("http://localhost/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("File size exceeds 5MB limit");
  });

  it("should successfully upload an image and return public URL", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const mockDocumentQuery = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockDocumentId, user_id: mockUserId },
              error: null,
            }),
          }),
        }),
      }),
    };

    const mockImageInsert = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: "image-123",
              document_id: mockDocumentId,
              user_id: mockUserId,
              filename: "test.jpg",
              storage_path: `${mockUserId}/${mockDocumentId}/test-uuid-1234.jpg`,
              public_url: "https://example.com/image.jpg",
              size: 1024,
              mime_type: "image/jpeg",
              width: null,
              height: null,
            },
            error: null,
          }),
        }),
      }),
    };

    mockSupabase.from = vi.fn((table: string) => {
      if (table === "documents") return mockDocumentQuery;
      if (table === "document_images") return mockImageInsert;
      return {};
    });

    const mockStorageUpload = vi.fn().mockResolvedValue({
      data: { path: `${mockUserId}/${mockDocumentId}/test-uuid-1234.jpg` },
      error: null,
    });

    const mockGetPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://example.com/image.jpg" },
    });

    mockSupabase.storage.from = vi.fn(() => ({
      upload: mockStorageUpload,
      getPublicUrl: mockGetPublicUrl,
    }));

    const file = new File(["test content"], "test.jpg", {
      type: "image/jpeg",
    });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentId", mockDocumentId);

    const request = new NextRequest("http://localhost/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.image).toMatchObject({
      id: "image-123",
      url: "https://example.com/image.jpg",
      filename: "test.jpg",
      width: null,
      height: null,
    });

    // Verify storage upload was called with correct path
    expect(mockStorageUpload).toHaveBeenCalledWith(
      `${mockUserId}/${mockDocumentId}/test-uuid-1234.jpg`,
      expect.any(Uint8Array),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: false,
      })
    );

    // Verify database insert was called
    expect(mockImageInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        document_id: mockDocumentId,
        user_id: mockUserId,
        filename: "test.jpg",
        storage_path: `${mockUserId}/${mockDocumentId}/test-uuid-1234.jpg`,
        public_url: "https://example.com/image.jpg",
        mime_type: "image/jpeg",
      })
    );
  });

  it("should handle different image formats (PNG, GIF, WebP)", async () => {
    const formats = [
      { type: "image/png", ext: "png" },
      { type: "image/gif", ext: "gif" },
      { type: "image/webp", ext: "webp" },
    ];

    for (const format of formats) {
      vi.clearAllMocks();

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: mockUserId } },
        error: null,
      });

      const mockDocumentQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: mockDocumentId, user_id: mockUserId },
                error: null,
              }),
            }),
          }),
        }),
      };

      const mockImageInsert = {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: "image-123",
                public_url: `https://example.com/image.${format.ext}`,
              },
              error: null,
            }),
          }),
        }),
      };

      mockSupabase.from = vi.fn((table: string) => {
        if (table === "documents") return mockDocumentQuery;
        if (table === "document_images") return mockImageInsert;
        return {};
      });

      mockSupabase.storage.from = vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        getPublicUrl: vi
          .fn()
          .mockReturnValue({
            data: { publicUrl: `https://example.com/image.${format.ext}` },
          }),
      }));

      const file = new File([`test ${format.type}`], `test.${format.ext}`, {
        type: format.type,
      });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentId", mockDocumentId);

      const request = new NextRequest("http://localhost/api/storage/upload", {
        method: "POST",
        body: formData,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.image.url).toContain(format.ext);
    }
  });

  it("should rollback storage upload if database insert fails", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
      error: null,
    });

    const mockDocumentQuery = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: mockDocumentId, user_id: mockUserId },
              error: null,
            }),
          }),
        }),
      }),
    };

    const mockImageInsert = {
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Database error" },
          }),
        }),
      }),
    };

    mockSupabase.from = vi.fn((table: string) => {
      if (table === "documents") return mockDocumentQuery;
      if (table === "document_images") return mockImageInsert;
      return {};
    });

    const mockRemove = vi.fn().mockResolvedValue({ data: {}, error: null });

    mockSupabase.storage.from = vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
      getPublicUrl: vi
        .fn()
        .mockReturnValue({ data: { publicUrl: "https://example.com/image.jpg" } }),
      remove: mockRemove,
    }));

    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("documentId", mockDocumentId);

    const request = new NextRequest("http://localhost/api/storage/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain("Failed to save image record");

    // Verify rollback was called
    expect(mockRemove).toHaveBeenCalledWith([
      `${mockUserId}/${mockDocumentId}/test-uuid-1234.jpg`,
    ]);
  });
});
