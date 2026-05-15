import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(() => ({
        data: { user: { id: 'test-user-id' } },
      })),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                id: 'doc-1',
                user_id: 'test-user-id',
                title: 'Test Document',
                content: '# Hello World\n\nThis is a **test** document.',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
              },
              error: null,
            })),
          })),
        })),
      })),
    })),
  })),
}));

describe('POST /api/export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 if user is not authenticated', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => ({
          data: { user: null },
        })),
      },
    } as any);

    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'markdown',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 if documentId is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        format: 'markdown',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('documentId is required');
  });

  it('should return 400 if format is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('format is required');
  });

  it('should return 400 if format is invalid', async () => {
    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'invalid',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid format');
  });

  it('should return 404 if document is not found', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => ({
          data: { user: { id: 'test-user-id' } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: { message: 'Not found' },
              })),
            })),
          })),
        })),
      })),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'non-existent',
        format: 'markdown',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Document not found');
  });

  it('should export document as markdown (Requirement 7.2)', async () => {
    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'markdown',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mimeType).toBe('text/markdown');
    expect(data.filename).toBe('Test_Document.md');
    expect(data.data).toBe('# Hello World\n\nThis is a **test** document.');
  });

  it('should export document as plain text (Requirement 7.3)', async () => {
    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'text',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mimeType).toBe('text/plain');
    expect(data.filename).toBe('Test_Document.txt');
    // Markdown syntax should be stripped
    expect(data.data).not.toContain('**');
    expect(data.data).not.toContain('#');
    expect(data.data).toContain('Hello World');
    expect(data.data).toContain('test');
  });

  it('should export document as HTML (Requirement 7.4)', async () => {
    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'html',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mimeType).toBe('text/html');
    expect(data.filename).toBe('Test_Document.html');
    expect(data.data).toContain('<!DOCTYPE html>');
    expect(data.data).toContain('<h1>Test Document</h1>');
    expect(data.data).toContain('<h1>Hello World</h1>');
    expect(data.data).toContain('<strong>test</strong>');
    expect(data.data).toContain('<style>'); // CSS styling
  });

  it('should export document as PDF (Requirement 7.5)', async () => {
    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'pdf',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.mimeType).toBe('application/pdf');
    expect(data.filename).toBe('Test_Document.pdf');
    expect(data.data).toBeTruthy(); // Base64 PDF data
    expect(typeof data.data).toBe('string');
  });

  it('should handle includeImages option', async () => {
    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'html',
        includeImages: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data).toBeTruthy();
  });

  it('should sanitize filename with special characters', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => ({
          data: { user: { id: 'test-user-id' } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  id: 'doc-1',
                  user_id: 'test-user-id',
                  title: 'Test/Document:With*Special?Chars',
                  content: '# Test',
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                },
                error: null,
              })),
            })),
          })),
        })),
      })),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'markdown',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Special characters should be removed
    expect(data.filename).not.toContain('/');
    expect(data.filename).not.toContain(':');
    expect(data.filename).not.toContain('*');
    expect(data.filename).not.toContain('?');
  });

  it('should handle Chinese characters in filename', async () => {
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockReturnValueOnce({
      auth: {
        getUser: vi.fn(() => ({
          data: { user: { id: 'test-user-id' } },
        })),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  id: 'doc-1',
                  user_id: 'test-user-id',
                  title: '测试文档',
                  content: '# 测试',
                  created_at: '2024-01-01T00:00:00Z',
                  updated_at: '2024-01-01T00:00:00Z',
                },
                error: null,
              })),
            })),
          })),
        })),
      })),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/export', {
      method: 'POST',
      body: JSON.stringify({
        documentId: 'doc-1',
        format: 'markdown',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.filename).toContain('测试文档');
  });
});
