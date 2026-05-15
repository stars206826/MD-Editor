/**
 * Unit tests for GET /api/versions/[documentId] endpoint
 * Tests listing versions for a document
 * Requirements: 5.8, 10.4, 11.5
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

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

describe("GET /api/versions/[documentId]", () => {
  const mockUserId = "test-user-123";
  const mockDocumentId = "doc-123";
  const mockVersions = [
    {
      id: "version-3",
      document_id: mockDocumentId,
      title: "Test Document v3",
      content: "Content version 3",
      version_number: 3,
      content_hash: "hash-3",
      created_at: "2024-01-03T00:00:00Z",
    },
    {
      id: "version-2",
      document_id: mockDocumentId,
      title: "Test Document v2",
      content: "Content version 2",
      version_number: 2,
      content_hash: "hash-2",
      created_at: "2024-01-02T00:00:00Z",
    },
    {
      id: "version-1",
      document_id: mockDocumentId,
      title: "Test Document v1",
      content: "Content version 1",
      version_number: 1,
      content_hash: "hash-1",
      created_at: "2024-01-01T00:00:00Z",
    },
  ];

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
      `http://localhost:3000/api/versions/${mockDocumentId}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: mockDocumentId }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if documentId is missing", async () => {
    const request = new NextRequest("http://localhost:3000/api/versions/");
    const response = await GET(request, {
      params: Promise.resolve({ documentId: "" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Document ID is required");
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

    const request = new NextRequest(
      `http://localhost:3000/api/versions/${mockDocumentId}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: mockDocumentId }),
    });
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

    const request = new NextRequest(
      `http://localhost:3000/api/versions/${mockDocumentId}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: mockDocumentId }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Document not found or access denied");
  });

  it("should return all versions ordered by version number descending", async () => {
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
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockVersions,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      `http://localhost:3000/api/versions/${mockDocumentId}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: mockDocumentId }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.versions).toEqual(mockVersions);
    expect(data.versions).toHaveLength(3);
    expect(data.versions[0].version_number).toBe(3);
    expect(data.versions[1].version_number).toBe(2);
    expect(data.versions[2].version_number).toBe(1);
  });

  it("should return empty array if document has no versions", async () => {
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
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      `http://localhost:3000/api/versions/${mockDocumentId}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: mockDocumentId }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.versions).toEqual([]);
  });

  it("should return 500 if database query fails", async () => {
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
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Database connection failed" },
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      `http://localhost:3000/api/versions/${mockDocumentId}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: mockDocumentId }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database connection failed");
  });

  it("should handle null versions data gracefully", async () => {
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
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new NextRequest(
      `http://localhost:3000/api/versions/${mockDocumentId}`
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: mockDocumentId }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.versions).toEqual([]);
  });
});
