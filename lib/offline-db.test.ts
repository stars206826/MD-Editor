/**
 * Unit tests for IndexedDB schema setup
 * 
 * Tests the database creation, object stores, and indexes
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  openDatabase, 
  closeDatabase, 
  deleteDatabase, 
  STORES,
  getDatabaseVersion,
  isIndexedDBSupported
} from './offline-db';

describe('IndexedDB Schema', () => {
  let db: IDBDatabase | null = null;

  beforeEach(async () => {
    // Clean up any existing database before each test
    try {
      await deleteDatabase();
    } catch (error) {
      // Ignore errors if database doesn't exist
    }
  });

  afterEach(async () => {
    // Close and clean up database after each test
    if (db) {
      closeDatabase(db);
      db = null;
    }
    try {
      await deleteDatabase();
    } catch (error) {
      // Ignore errors
    }
  });

  it('should check if IndexedDB is supported', () => {
    const supported = isIndexedDBSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('should return the correct database version', () => {
    const version = getDatabaseVersion();
    expect(version).toBe(1);
  });

  it('should create database with correct name', async () => {
    db = await openDatabase();
    expect(db.name).toBe('markdown-editor-offline');
  });

  it('should create database with correct version', async () => {
    db = await openDatabase();
    expect(db.version).toBe(1);
  });

  it('should create documents object store', async () => {
    db = await openDatabase();
    expect(db.objectStoreNames.contains(STORES.DOCUMENTS)).toBe(true);
  });

  it('should create sync_queue object store', async () => {
    db = await openDatabase();
    expect(db.objectStoreNames.contains(STORES.SYNC_QUEUE)).toBe(true);
  });

  it('should create indexes on documents store', async () => {
    db = await openDatabase();
    
    const transaction = db.transaction(STORES.DOCUMENTS, 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    
    // Check that all required indexes exist
    expect(store.indexNames.contains('user_id')).toBe(true);
    expect(store.indexNames.contains('synced')).toBe(true);
    expect(store.indexNames.contains('updated_at')).toBe(true);
    expect(store.indexNames.contains('user_synced')).toBe(true);
    expect(store.indexNames.contains('last_sync_at')).toBe(true);
  });

  it('should create indexes on sync_queue store', async () => {
    db = await openDatabase();
    
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    
    // Check that all required indexes exist
    expect(store.indexNames.contains('user_id')).toBe(true);
    expect(store.indexNames.contains('timestamp')).toBe(true);
    expect(store.indexNames.contains('operation')).toBe(true);
    expect(store.indexNames.contains('retryCount')).toBe(true);
  });

  it('should use id as keyPath for documents store', async () => {
    db = await openDatabase();
    
    const transaction = db.transaction(STORES.DOCUMENTS, 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    
    expect(store.keyPath).toBe('id');
  });

  it('should use id as keyPath for sync_queue store', async () => {
    db = await openDatabase();
    
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    
    expect(store.keyPath).toBe('id');
  });

  it('should allow storing and retrieving a document', async () => {
    db = await openDatabase();
    
    const testDocument = {
      id: 'test-doc-1',
      user_id: 'user-123',
      title: 'Test Document',
      content: 'Test content',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
      last_sync_at: null,
      pending_changes: []
    };

    // Store document
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(STORES.DOCUMENTS, 'readwrite');
      const store = transaction.objectStore(STORES.DOCUMENTS);
      const request = store.add(testDocument);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Retrieve document
    const retrieved = await new Promise((resolve, reject) => {
      const transaction = db!.transaction(STORES.DOCUMENTS, 'readonly');
      const store = transaction.objectStore(STORES.DOCUMENTS);
      const request = store.get('test-doc-1');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(retrieved).toEqual(testDocument);
  });

  it('should allow storing and retrieving a sync queue entry', async () => {
    db = await openDatabase();
    
    const testEntry = {
      id: 'test-doc-1',
      user_id: 'user-123',
      operation: 'update' as const,
      data: {
        title: 'Updated Title',
        content: 'Updated content'
      },
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    // Store entry
    await new Promise<void>((resolve, reject) => {
      const transaction = db!.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.add(testEntry);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Retrieve entry
    const retrieved = await new Promise((resolve, reject) => {
      const transaction = db!.transaction(STORES.SYNC_QUEUE, 'readonly');
      const store = transaction.objectStore(STORES.SYNC_QUEUE);
      const request = store.get('test-doc-1');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(retrieved).toEqual(testEntry);
  });

  it('should query documents by user_id index', async () => {
    db = await openDatabase();
    
    const doc1 = {
      id: 'doc-1',
      user_id: 'user-123',
      title: 'Doc 1',
      content: 'Content 1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: true,
      last_sync_at: new Date().toISOString(),
      pending_changes: []
    };

    const doc2 = {
      id: 'doc-2',
      user_id: 'user-123',
      title: 'Doc 2',
      content: 'Content 2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
      last_sync_at: null,
      pending_changes: []
    };

    // Store documents
    const transaction = db.transaction(STORES.DOCUMENTS, 'readwrite');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    store.add(doc1);
    store.add(doc2);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    // Query by user_id
    const results = await new Promise<any[]>((resolve, reject) => {
      const transaction = db!.transaction(STORES.DOCUMENTS, 'readonly');
      const store = transaction.objectStore(STORES.DOCUMENTS);
      const index = store.index('user_id');
      const request = index.getAll('user-123');
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(results).toHaveLength(2);
    expect(results.map(r => r.id)).toContain('doc-1');
    expect(results.map(r => r.id)).toContain('doc-2');
  });

  it('should query unsynced documents using synced index', async () => {
    db = await openDatabase();
    
    const syncedDoc = {
      id: 'doc-synced',
      user_id: 'user-123',
      title: 'Synced Doc',
      content: 'Content',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: true,
      last_sync_at: new Date().toISOString(),
      pending_changes: []
    };

    const unsyncedDoc = {
      id: 'doc-unsynced',
      user_id: 'user-123',
      title: 'Unsynced Doc',
      content: 'Content',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
      last_sync_at: null,
      pending_changes: []
    };

    // Store documents
    const transaction = db.transaction(STORES.DOCUMENTS, 'readwrite');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    store.add(syncedDoc);
    store.add(unsyncedDoc);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    // Query unsynced documents
    const results = await new Promise<any[]>((resolve, reject) => {
      const transaction = db!.transaction(STORES.DOCUMENTS, 'readonly');
      const store = transaction.objectStore(STORES.DOCUMENTS);
      const index = store.index('synced');
      const request = index.getAll(false);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('doc-unsynced');
  });

  it('should delete database successfully', async () => {
    db = await openDatabase();
    closeDatabase(db);
    db = null;
    
    await deleteDatabase();
    
    // Try to open again - should create fresh database
    db = await openDatabase();
    expect(db.name).toBe('markdown-editor-offline');
  });
});
