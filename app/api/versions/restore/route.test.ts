/**
 * Unit tests for POST /api/versions/restore endpoint
 * Tests restoring a document to a specific version
 * Requirements: 5.7, 10.4, 11.5
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

// Mock Supabase client
const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock crypto module
vi.mock("crypto", () => ({
  createHash: vi.fn(() => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn(() => "mock-hash-123"),
  })),
}));

describe("POST /api/versions/restore", () => {
  const mockUserId = "test-user-123";
  const mockDocumentId = "doc-123";
  const mockVersionId = "version-1";
  const mockVersion = {
    id: mockVersionId,
    document_id: mockDocumentId,
    title: "Test Document v1",
    content: "Content version 1",
    version_number: 1,
    content_hash: "hash-1",
    created_at: "2024-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: mockUserId } },
    });
  });

  it("should return 401 if user is not authenticated", async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: null },
    });

    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: JSON.stringify({
          version_id: mockVersionId,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if version_id is missing", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Version ID is required");
  });

  it("should return 400 if version_id is not a string", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: JSON.stringify({
          version_id: 123,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Version ID is required");
  });

  it("should return 404 if version does not exist", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "Not found" },
          }),
        }),
      }),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: JSON.stringify({
          version_id: mockVersionId,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Version not found");
  });

  it("should return 404 if user does not own the document", async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "document_versions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockVersion,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "documents") {
        return {
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
        };
      }
      return {};
    });

    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: JSON.stringify({
          version_id: mockVersionId,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Document not found or access denied");
  });

  it("should restore document to specified version and create new version", async () => {
    const mockDocument = {
      id: mockDocumentId,
      user_id: mockUserId,
      title: "Current Title",
      content: "Current content",
    };

    const mockUpdatedDocument = {
      id: mockDocumentId,
      user_id: mockUserId,
      title: mockVersion.title,
      content: mockVersion.content,
      updated_at: new Date().toISOString(),
    };

    const mockNewVersion = {
      id: "version-4",
      document_id: mockDocumentId,
      title: mockVersion.title,
      content: mockVersion.content,
      version_number: 4,
      content_hash: "mock-hash-123",
      created_at: new Date().toISOString(),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "document_versions") {
        callCount++;
        if (callCount === 1) {
          // First call: get version to restore
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockVersion,
                  error: null,
                }),
              }),
            }),
          };
        } else if (callCount === 2) {
          // Second call: get max version number
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { version_number: 3 },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        } else {
          // Third call: insert new version
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockNewVersion,
                  error: null,
                }),
              }),
            }),
          };
        }
      }
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockDocument,
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockUpdatedDocument,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: JSON.stringify({
          version_id: mockVersionId,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.document.title).toBe(mockVersion.title);
    expect(data.document.content).toBe(mockVersion.content);
    expect(data.version.version_number).toBe(4);
    expect(data.message).toBe(`Document restored to version ${mockVersion.version_number}`);
  });

  it("should return 500 if document update fails", async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "document_versions") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockVersion,
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "documents") {
        callCount++;
        if (callCount === 1) {
          // First call: get document (success)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: mockDocumentId,
                      user_id: mockUserId,
                      title: "Current",
                      content: "Current",
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        } else {
          // Second call: update document (failure)
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: "Update failed" },
                  }),
                }),
              }),
            }),
          };
        }
      }
      return {};
    });

    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: JSON.stringify({
          version_id: mockVersionId,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Update failed");
  });

  it("should succeed even if new version creation fails (logs error)", async () => {
    const mockDocument = {
      id: mockDocumentId,
      user_id: mockUserId,
      title: "Current Title",
      content: "Current content",
    };

    const mockUpdatedDocument = {
      id: mockDocumentId,
      user_id: mockUserId,
      title: mockVersion.title,
      content: mockVersion.content,
      updated_at: new Date().toISOString(),
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "document_versions") {
        callCount++;
        if (callCount === 1) {
          // First call: get version to restore
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockVersion,
                  error: null,
                }),
              }),
            }),
          };
        } else if (callCount === 2) {
          // Second call: get max version number
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { version_number: 3 },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        } else {
          // Third call: insert new version (fails)
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Version creation failed" },
                }),
              }),
            }),
          };
        }
      }
      if (table === "documents") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockDocument,
                  error: null,
                }),
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: mockUpdatedDocument,
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: JSON.stringify({
          version_id: mockVersionId,
        }),
      }
    );

    const response = await POST(request);
    const data = await response.json();

    // Should still succeed even if version creation fails
    expect(response.status).toBe(200);
    expect(data.document.title).toBe(mockVersion.title);
    expect(data.version).toBeNull();
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/versions/restore",
      {
        method: "POST",
        body: "invalid json",
      }
    );

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request body");
  });
});
