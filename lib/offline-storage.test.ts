/**
 * Unit tests for offline storage utilities
 * 
 * Tests Requirements: 9.3, 9.4, 9.9
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  saveDocumentOffline,
  getOfflineDocuments,
  markDocumentSynced,
  getPendingChanges,
  getOfflineDocument,
  deleteOfflineDocument,
  getPendingChangesCount,
  addPendingChanges,
} from './offline-storage';
import { deleteDatabase } from './offline-db';
import { DocumentRecord, PendingChange } from './types';

describe('Offline Storage Utilities', () => {
  const testUserId = 'test-user-123';
  const testDocumentId = 'test-doc-456';

  const createTestDocument = (overrides?: Partial<DocumentRecord>): DocumentRecord => ({
    id: testDocumentId,
    user_id: testUserId,
    title: 'Test Document',
    content: '# Test Content',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  });

  // Clean up database before and after each test
  beforeEach(async () => {
    await deleteDatabase();
  });

  afterEach(async () => {
    await deleteDatabase();
  });

  describe('saveDocumentOffline', () => {
    it('should save a document without pending changes', async () => {
      const document = createTestDocument();
      const result = await saveDocumentOffline(document);

      expect(result.id).toBe(document.id);
      expect(result.synced).toBe(true);
      expect(result.last_sync_at).toBeTruthy();
      expect(result.pending_changes).toEqual([]);
    });

    it('should save a document with pending changes', async () => {
      const document = createTestDocument();
      const pendingChanges: PendingChange[] = [
        {
          field: 'title',
          value: 'Updated Title',
          timestamp: new Date().toISOString(),
        },
      ];

      const result = await saveDocumentOffline(document, pendingChanges);

      expect(result.synced).toBe(false);
      expect(result.last_sync_at).toBeNull();
      expect(result.pending_changes).toEqual(pendingChanges);
    });

    it('should update an existing document', async () => {
      const document = createTestDocument();
      await saveDocumentOffline(document);

      const updatedDocument = {
        ...document,
        title: 'Updated Title',
        updated_at: new Date().toISOString(),
      };

      const result = await saveDocumentOffline(updatedDocument);
      expect(result.title).toBe('Updated Title');
    });

    it('should handle multiple documents for the same user', async () => {
      const doc1 = createTestDocument({ id: 'doc-1' });
      const doc2 = createTestDocument({ id: 'doc-2' });

      await saveDocumentOffline(doc1);
      await saveDocumentOffline(doc2);

      const documents = await getOfflineDocuments(testUserId);
      expect(documents).toHaveLength(2);
    });
  });

  describe('getOfflineDocuments', () => {
    it('should return empty array when no documents exist', async () => {
      const documents = await getOfflineDocuments(testUserId);
      expect(documents).toEqual([]);
    });

    it('should return all documents for a user', async () => {
      const doc1 = createTestDocument({ id: 'doc-1' });
      const doc2 = createTestDocument({ id: 'doc-2' });

      await saveDocumentOffline(doc1);
      await saveDocumentOffline(doc2);

      const documents = await getOfflineDocuments(testUserId);
      expect(documents).toHaveLength(2);
      expect(documents.map(d => d.id)).toContain('doc-1');
      expect(documents.map(d => d.id)).toContain('doc-2');
    });

    it('should only return unsynced documents when unsyncedOnly is true', async () => {
      const syncedDoc = createTestDocument({ id: 'synced-doc' });
      const unsyncedDoc = createTestDocument({ id: 'unsynced-doc' });

      await saveDocumentOffline(syncedDoc);
      await saveDocumentOffline(unsyncedDoc, [
        { field: 'title', value: 'Changed', timestamp: new Date().toISOString() },
      ]);

      const documents = await getOfflineDocuments(testUserId, true);
      expect(documents).toHaveLength(1);
      expect(documents[0].id).toBe('unsynced-doc');
    });

    it('should sort documents by updated_at descending', async () => {
      const now = Date.now();
      const doc1 = createTestDocument({
        id: 'doc-1',
        updated_at: new Date(now - 2000).toISOString(),
      });
      const doc2 = createTestDocument({
        id: 'doc-2',
        updated_at: new Date(now - 1000).toISOString(),
      });
      const doc3 = createTestDocument({
        id: 'doc-3',
        updated_at: new Date(now).toISOString(),
      });

      await saveDocumentOffline(doc1);
      await saveDocumentOffline(doc2);
      await saveDocumentOffline(doc3);

      const documents = await getOfflineDocuments(testUserId);
      expect(documents[0].id).toBe('doc-3'); // Most recent first
      expect(documents[1].id).toBe('doc-2');
      expect(documents[2].id).toBe('doc-1');
    });

    it('should not return documents from other users', async () => {
      const userDoc = createTestDocument({ user_id: testUserId });
      const otherUserDoc = createTestDocument({
        id: 'other-doc',
        user_id: 'other-user',
      });

      await saveDocumentOffline(userDoc);
      await saveDocumentOffline(otherUserDoc);

      const documents = await getOfflineDocuments(testUserId);
      expect(documents).toHaveLength(1);
      expect(documents[0].user_id).toBe(testUserId);
    });
  });

  describe('markDocumentSynced', () => {
    it('should mark a document as synced', async () => {
      const document = createTestDocument();
      const pendingChanges: PendingChange[] = [
        { field: 'title', value: 'Changed', timestamp: new Date().toISOString() },
      ];

      await saveDocumentOffline(document, pendingChanges);
      await markDocumentSynced(testDocumentId);

      const result = await getOfflineDocument(testDocumentId);
      expect(result?.synced).toBe(true);
      expect(result?.last_sync_at).toBeTruthy();
      expect(result?.pending_changes).toEqual([]);
    });

    it('should throw error if document not found', async () => {
      await expect(markDocumentSynced('non-existent-id')).rejects.toThrow(
        'Document not found'
      );
    });

    it('should remove document from sync queue', async () => {
      const document = createTestDocument();
      const pendingChanges: PendingChange[] = [
        { field: 'title', value: 'Changed', timestamp: new Date().toISOString() },
      ];

      await saveDocumentOffline(document, pendingChanges);
      
      // Verify it's in pending changes
      let pending = await getPendingChanges(testUserId);
      expect(pending).toHaveLength(1);

      await markDocumentSynced(testDocumentId);

      // Verify it's no longer in pending changes
      pending = await getPendingChanges(testUserId);
      expect(pending).toHaveLength(0);
    });
  });

  describe('getPendingChanges', () => {
    it('should return empty array when no pending changes', async () => {
      const document = createTestDocument();
      await saveDocumentOffline(document);

      const pending = await getPendingChanges(testUserId);
      expect(pending).toEqual([]);
    });

    it('should return documents with pending changes', async () => {
      const doc1 = createTestDocument({ id: 'doc-1' });
      const doc2 = createTestDocument({ id: 'doc-2' });

      await saveDocumentOffline(doc1, [
        { field: 'title', value: 'Changed 1', timestamp: new Date().toISOString() },
      ]);
      await saveDocumentOffline(doc2, [
        { field: 'content', value: 'Changed 2', timestamp: new Date().toISOString() },
      ]);

      const pending = await getPendingChanges(testUserId);
      expect(pending).toHaveLength(2);
    });

    it('should sort pending changes by updated_at ascending (FIFO)', async () => {
      const now = Date.now();
      const doc1 = createTestDocument({
        id: 'doc-1',
        updated_at: new Date(now - 2000).toISOString(),
      });
      const doc2 = createTestDocument({
        id: 'doc-2',
        updated_at: new Date(now - 1000).toISOString(),
      });

      await saveDocumentOffline(doc1, [
        { field: 'title', value: 'Changed 1', timestamp: new Date().toISOString() },
      ]);
      await saveDocumentOffline(doc2, [
        { field: 'title', value: 'Changed 2', timestamp: new Date().toISOString() },
      ]);

      const pending = await getPendingChanges(testUserId);
      expect(pending[0].id).toBe('doc-1'); // Oldest first
      expect(pending[1].id).toBe('doc-2');
    });

    it('should not return synced documents', async () => {
      const doc1 = createTestDocument({ id: 'doc-1' });
      const doc2 = createTestDocument({ id: 'doc-2' });

      await saveDocumentOffline(doc1); // Synced
      await saveDocumentOffline(doc2, [
        { field: 'title', value: 'Changed', timestamp: new Date().toISOString() },
      ]); // Unsynced

      const pending = await getPendingChanges(testUserId);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe('doc-2');
    });
  });

  describe('getOfflineDocument', () => {
    it('should return a document by ID', async () => {
      const document = createTestDocument();
      await saveDocumentOffline(document);

      const result = await getOfflineDocument(testDocumentId);
      expect(result).toBeTruthy();
      expect(result?.id).toBe(testDocumentId);
    });

    it('should return null if document not found', async () => {
      const result = await getOfflineDocument('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('deleteOfflineDocument', () => {
    it('should delete a document', async () => {
      const document = createTestDocument();
      await saveDocumentOffline(document);

      await deleteOfflineDocument(testDocumentId);

      const result = await getOfflineDocument(testDocumentId);
      expect(result).toBeNull();
    });

    it('should remove document from sync queue', async () => {
      const document = createTestDocument();
      await saveDocumentOffline(document, [
        { field: 'title', value: 'Changed', timestamp: new Date().toISOString() },
      ]);

      await deleteOfflineDocument(testDocumentId);

      const pending = await getPendingChanges(testUserId);
      expect(pending).toHaveLength(0);
    });

    it('should not throw error if document does not exist', async () => {
      await expect(deleteOfflineDocument('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('getPendingChangesCount', () => {
    it('should return 0 when no pending changes', async () => {
      const document = createTestDocument();
      await saveDocumentOffline(document);

      const count = await getPendingChangesCount(testUserId);
      expect(count).toBe(0);
    });

    it('should return correct count of pending changes', async () => {
      const doc1 = createTestDocument({ id: 'doc-1' });
      const doc2 = createTestDocument({ id: 'doc-2' });
      const doc3 = createTestDocument({ id: 'doc-3' });

      await saveDocumentOffline(doc1, [
        { field: 'title', value: 'Changed', timestamp: new Date().toISOString() },
      ]);
      await saveDocumentOffline(doc2, [
        { field: 'content', value: 'Changed', timestamp: new Date().toISOString() },
      ]);
      await saveDocumentOffline(doc3); // Synced

      const count = await getPendingChangesCount(testUserId);
      expect(count).toBe(2);
    });
  });

  describe('addPendingChanges', () => {
    it('should add pending changes to a document', async () => {
      const document = createTestDocument();
      await saveDocumentOffline(document);

      const changes: PendingChange[] = [
        { field: 'title', value: 'New Title', timestamp: new Date().toISOString() },
      ];

      await addPendingChanges(testDocumentId, changes);

      const result = await getOfflineDocument(testDocumentId);
      expect(result?.synced).toBe(false);
      expect(result?.pending_changes).toHaveLength(1);
      expect(result?.pending_changes[0].value).toBe('New Title');
    });

    it('should merge new changes with existing ones', async () => {
      const document = createTestDocument();
      const initialChanges: PendingChange[] = [
        { field: 'title', value: 'First Change', timestamp: new Date().toISOString() },
      ];

      await saveDocumentOffline(document, initialChanges);

      const newChanges: PendingChange[] = [
        { field: 'content', value: 'Second Change', timestamp: new Date().toISOString() },
      ];

      await addPendingChanges(testDocumentId, newChanges);

      const result = await getOfflineDocument(testDocumentId);
      expect(result?.pending_changes).toHaveLength(2);
    });

    it('should throw error if document not found', async () => {
      const changes: PendingChange[] = [
        { field: 'title', value: 'Change', timestamp: new Date().toISOString() },
      ];

      await expect(addPendingChanges('non-existent-id', changes)).rejects.toThrow(
        'Document not found'
      );
    });

    it('should add document to sync queue', async () => {
      const document = createTestDocument();
      await saveDocumentOffline(document);

      const changes: PendingChange[] = [
        { field: 'title', value: 'Changed', timestamp: new Date().toISOString() },
      ];

      await addPendingChanges(testDocumentId, changes);

      const pending = await getPendingChanges(testUserId);
      expect(pending).toHaveLength(1);
      expect(pending[0].id).toBe(testDocumentId);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete offline workflow', async () => {
      // 1. Save document offline
      const document = createTestDocument();
      await saveDocumentOffline(document);

      // 2. Make changes offline
      const changes: PendingChange[] = [
        { field: 'title', value: 'Offline Edit', timestamp: new Date().toISOString() },
      ];
      await addPendingChanges(testDocumentId, changes);

      // 3. Verify pending changes
      let pending = await getPendingChanges(testUserId);
      expect(pending).toHaveLength(1);

      // 4. Mark as synced
      await markDocumentSynced(testDocumentId);

      // 5. Verify no pending changes
      pending = await getPendingChanges(testUserId);
      expect(pending).toHaveLength(0);

      // 6. Verify document is synced
      const result = await getOfflineDocument(testDocumentId);
      expect(result?.synced).toBe(true);
    });

    it('should handle multiple users independently', async () => {
      const user1Doc = createTestDocument({ user_id: 'user-1', id: 'doc-1' });
      const user2Doc = createTestDocument({ user_id: 'user-2', id: 'doc-2' });

      await saveDocumentOffline(user1Doc, [
        { field: 'title', value: 'User 1 Change', timestamp: new Date().toISOString() },
      ]);
      await saveDocumentOffline(user2Doc, [
        { field: 'title', value: 'User 2 Change', timestamp: new Date().toISOString() },
      ]);

      const user1Pending = await getPendingChanges('user-1');
      const user2Pending = await getPendingChanges('user-2');

      expect(user1Pending).toHaveLength(1);
      expect(user2Pending).toHaveLength(1);
      expect(user1Pending[0].id).toBe('doc-1');
      expect(user2Pending[0].id).toBe('doc-2');
    });
  });
});
