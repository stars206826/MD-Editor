/**
 * Unit tests for POST /api/versions endpoint
 * Tests version creation with deduplication, auto-increment, and pruning
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.4, 11.5
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

describe("POST /api/versions", () => {
  const mockUserId = "test-user-123";
  const mockDocumentId = "doc-123";
  const mockTitle = "Test Document";
  const mockContent = "Test content";

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

    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        title: mockTitle,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if document_id is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        title: mockTitle,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Document ID is required");
  });

  it("should return 400 if title is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Title is required");
  });

  it("should return 400 if content is not a string", async () => {
    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        title: mockTitle,
        content: 123,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Content must be a string");
  });

  it("should return 404 if document does not exist", async () => {
    mockSupabase.from.mockReturnValue({
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

    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        title: mockTitle,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Document not found or access denied");
  });

  it("should return 404 if user does not own the document", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: {
                id: mockDocumentId,
                user_id: "different-user-id",
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        title: mockTitle,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Document not found or access denied");
  });

  it("should not create a new version if content hash matches latest version (deduplication)", async () => {
    const mockLatestVersion = {
      id: "version-1",
      document_id: mockDocumentId,
      title: mockTitle,
      content: mockContent,
      version_number: 1,
      content_hash: "mock-hash-123",
      created_at: "2024-01-01T00:00:00Z",
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
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
      }
      if (table === "document_versions") {
        callCount++;
        if (callCount === 1) {
          // First call: check latest version hash
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: mockLatestVersion,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        } else {
          // Second call: get existing version with same hash
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: mockLatestVersion,
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
      }
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        title: mockTitle,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.message).toBe("No changes detected, version not created");
    expect(data.version).toEqual(mockLatestVersion);
  });

  it("should create a new version with auto-incremented version number", async () => {
    const mockNewVersion = {
      id: "version-2",
      document_id: mockDocumentId,
      title: mockTitle,
      content: mockContent,
      version_number: 2,
      content_hash: "mock-hash-123",
      created_at: "2024-01-02T00:00:00Z",
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
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
      }
      if (table === "document_versions") {
        callCount++;
        if (callCount === 1) {
          // First call: check latest version hash (different hash)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { content_hash: "different-hash" },
                      error: null,
                    }),
                  }),
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
                      data: { version_number: 1 },
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
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        title: mockTitle,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.version).toEqual(mockNewVersion);
    expect(data.version.version_number).toBe(2);
  });

  it("should create version 1 when no previous versions exist", async () => {
    const mockNewVersion = {
      id: "version-1",
      document_id: mockDocumentId,
      title: mockTitle,
      content: mockContent,
      version_number: 1,
      content_hash: "mock-hash-123",
      created_at: "2024-01-01T00:00:00Z",
    };

    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
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
      }
      if (table === "document_versions") {
        callCount++;
        if (callCount === 1) {
          // First call: check latest version hash (no versions exist)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: "No rows found" },
                    }),
                  }),
                }),
              }),
            }),
          };
        } else if (callCount === 2) {
          // Second call: get max version number (no versions exist)
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { message: "No rows found" },
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
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        title: mockTitle,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.version).toEqual(mockNewVersion);
    expect(data.version.version_number).toBe(1);
  });

  it("should return 500 if version creation fails", async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "documents") {
        return {
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
      }
      if (table === "document_versions") {
        callCount++;
        if (callCount === 1) {
          // First call: check latest version hash
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: { content_hash: "different-hash" },
                      error: null,
                    }),
                  }),
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
                      data: { version_number: 1 },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        } else {
          // Third call: insert fails
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Database error" },
                }),
              }),
            }),
          };
        }
      }
      return {};
    });

    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: JSON.stringify({
        document_id: mockDocumentId,
        title: mockTitle,
        content: mockContent,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database error");
  });

  it("should return 400 for invalid JSON body", async () => {
    const request = new NextRequest("http://localhost:3000/api/versions", {
      method: "POST",
      body: "invalid json",
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Invalid request body");
  });
});
