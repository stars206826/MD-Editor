/**
 * Unit tests for GET /api/documents endpoint
 * Tests sorting and filtering functionality
 * Requirements: 2.1, 2.2, 2.4, 10.2, 11.1
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

describe("GET /api/documents", () => {
  const mockUserId = "test-user-123";
  const mockDocuments = [
    {
      id: "doc-1",
      user_id: mockUserId,
      title: "Alpha Document",
      content: "Content A",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-03T00:00:00Z",
    },
    {
      id: "doc-2",
      user_id: mockUserId,
      title: "Beta Document",
      content: "Content B",
      created_at: "2024-01-02T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    },
    {
      id: "doc-3",
      user_id: mockUserId,
      title: "Gamma Document",
      content: "Content C",
      created_at: "2024-01-03T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
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

    const request = new NextRequest("http://localhost:3000/api/documents");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should sort documents by updated_at descending by default", async () => {
    const mockQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
    mockQuery.order.mockResolvedValue({ data: mockDocuments, error: null });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue(mockQuery),
    });

    const request = new NextRequest("http://localhost:3000/api/documents");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockQuery.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(data.documents).toEqual(mockDocuments);
  });

  it("should sort documents by created_at ascending", async () => {
    const mockQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
    mockQuery.order.mockResolvedValue({ data: mockDocuments, error: null });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue(mockQuery),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/documents?sortBy=created_at&order=asc"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockQuery.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("should sort documents by title descending", async () => {
    const mockQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
    mockQuery.order.mockResolvedValue({ data: mockDocuments, error: null });

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue(mockQuery),
    });

    const request = new NextRequest(
      "http://localhost:3000/api/documents?sortBy=title&order=desc"
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(mockQuery.order).toHaveBeenCalledWith("title", { ascending: false });
  });

  it("should return 400 for invalid sortBy parameter", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/documents?sortBy=invalid_field"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid sortBy parameter");
  });

  it("should return 400 for invalid order parameter", async () => {
    const request = new NextRequest(
      "http://localhost:3000/api/documents?order=invalid_order"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid order parameter");
  });

  it("should filter documents by single tag", async () => {
    const tagId = "tag-1";
    const mockDocumentTags = [
      { document_id: "doc-1" },
      { document_id: "doc-2" },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "document_tags") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockDocumentTags,
              error: null,
            }),
          }),
        };
      }
      // documents table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockDocuments[0], mockDocuments[1]],
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    const request = new NextRequest(
      `http://localhost:3000/api/documents?tags=${tagId}`
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documents).toHaveLength(2);
  });

  it("should filter documents by multiple tags with AND logic", async () => {
    const tagIds = "tag-1,tag-2";
    // doc-1 has both tags, doc-2 has only tag-1
    const mockDocumentTags = [
      { document_id: "doc-1" }, // tag-1
      { document_id: "doc-1" }, // tag-2
      { document_id: "doc-2" }, // tag-1
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "document_tags") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockDocumentTags,
              error: null,
            }),
          }),
        };
      }
      // documents table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockDocuments[0]], // Only doc-1 has both tags
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    const request = new NextRequest(
      `http://localhost:3000/api/documents?tags=${tagIds}`
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documents).toHaveLength(1);
    expect(data.documents[0].id).toBe("doc-1");
  });

  it("should return empty array when no documents match tag filter", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "document_tags") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      };
    });

    const request = new NextRequest(
      "http://localhost:3000/api/documents?tags=nonexistent-tag"
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documents).toEqual([]);
  });

  it("should combine sorting and filtering", async () => {
    const tagId = "tag-1";
    const mockDocumentTags = [
      { document_id: "doc-1" },
      { document_id: "doc-2" },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "document_tags") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: mockDocumentTags,
              error: null,
            }),
          }),
        };
      }
      // documents table
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [mockDocuments[0], mockDocuments[1]],
                error: null,
              }),
            }),
          }),
        }),
      };
    });

    const request = new NextRequest(
      `http://localhost:3000/api/documents?tags=${tagId}&sortBy=title&order=asc`
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documents).toHaveLength(2);
  });

  it("should handle database errors gracefully", async () => {
    const mockQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Database connection failed" },
      }),
    };

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue(mockQuery),
    });

    const request = new NextRequest("http://localhost:3000/api/documents");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Database connection failed");
  });
});
