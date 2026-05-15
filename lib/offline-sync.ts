/**
 * Offline Sync Logic
 * 
 * Handles synchronization of offline changes with the server.
 * Requirements: 9.6, 9.7, 9.8, 9.9, 9.10
 */

import { openDatabase, closeDatabase, STORES, SyncQueueEntry } from './offline-db';
import { OfflineDocument, DocumentRecord } from './types';

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  conflictedCount: number;
  errors: Array<{ documentId: string; error: string }>;
}

export interface ConflictInfo {
  documentId: string;
  localVersion: OfflineDocument;
  serverVersion: DocumentRecord;
  localUpdatedAt: string;
  serverUpdatedAt: string;
}

/**
 * Synchronizes all pending offline changes with the server
 * 
 * Requirements: 9.6, 9.7, 9.8, 9.9, 9.10
 * 
 * @returns Promise<SyncResult> Summary of sync operation
 */
export async function syncOfflineChanges(): Promise<SyncResult> {
  const db = await openDatabase();
  
  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    conflictedCount: 0,
    errors: [],
  };

  try {
    // Get all unsynced documents (Requirement 9.9)
    const unsyncedDocs = await getUnsyncedDocuments(db);
    
    if (unsyncedDocs.length === 0) {
      return result;
    }

    // Process each unsynced document
    for (const doc of unsyncedDocs) {
      try {
        await syncDocument(db, doc, result);
      } catch (err) {
        result.failedCount++;
        result.errors.push({
          documentId: doc.id,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    result.success = result.failedCount === 0;
  } catch (err) {
    result.success = false;
    result.errors.push({
      documentId: 'general',
      error: err instanceof Error ? err.message : 'Sync failed',
    });
  } finally {
    closeDatabase(db);
  }

  return result;
}

/**
 * Get all unsynced documents from IndexedDB
 */
async function getUnsyncedDocuments(db: IDBDatabase): Promise<OfflineDocument[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.DOCUMENTS], 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const index = store.index('synced');
    const request = index.getAll(IDBKeyRange.only(0)); // Get all documents where synced = false

    request.onsuccess = () => {
      resolve(request.result as OfflineDocument[]);
    };

    request.onerror = () => {
      reject(new Error('Failed to fetch unsynced documents'));
    };
  });
}

/**
 * Sync a single document with the server
 * 
 * Requirements: 9.6, 9.7, 9.8, 9.9, 9.10
 */
async function syncDocument(
  db: IDBDatabase,
  localDoc: OfflineDocument,
  result: SyncResult
): Promise<void> {
  try {
    // Fetch current server version (Requirement 9.7)
    const serverDoc = await fetchServerDocument(localDoc.id);

    if (!serverDoc) {
      // Document doesn't exist on server - create it
      await createDocumentOnServer(localDoc);
      await markDocumentSynced(db, localDoc.id);
      result.syncedCount++;
      return;
    }

    // Compare timestamps to detect conflicts (Requirement 9.7)
    const localUpdatedAt = new Date(localDoc.updated_at);
    const serverUpdatedAt = new Date(serverDoc.updated_at);

    if (serverUpdatedAt > localUpdatedAt) {
      // Server version is newer - conflict detected (Requirement 9.8)
      await markDocumentConflicted(db, localDoc.id, {
        documentId: localDoc.id,
        localVersion: localDoc,
        serverVersion: serverDoc,
        localUpdatedAt: localDoc.updated_at,
        serverUpdatedAt: serverDoc.updated_at,
      });
      result.conflictedCount++;
      return;
    }

    // Local version is newer or same - update server
    await updateDocumentOnServer(localDoc);
    await markDocumentSynced(db, localDoc.id);
    result.syncedCount++;
  } catch (err) {
    // Sync failed - retain in queue for retry (Requirement 9.10)
    await incrementRetryCount(db, localDoc.id, err instanceof Error ? err.message : 'Unknown error');
    throw err;
  }
}

/**
 * Fetch document from server
 */
async function fetchServerDocument(documentId: string): Promise<DocumentRecord | null> {
  try {
    const response = await fetch(`/api/documents/${documentId}`);
    
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error('Failed to fetch document from server');
    }

    const data = await response.json();
    return data.document;
  } catch (err) {
    throw new Error(`Failed to fetch server document: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }
}

/**
 * Create document on server
 */
async function createDocumentOnServer(doc: OfflineDocument): Promise<void> {
  const response = await fetch('/api/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: doc.id,
      title: doc.title,
      content: doc.content,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to create document on server');
  }
}

/**
 * Update document on server
 */
async function updateDocumentOnServer(doc: OfflineDocument): Promise<void> {
  const response = await fetch(`/api/documents/${doc.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: doc.title,
      content: doc.content,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to update document on server');
  }
}

/**
 * Mark document as synced in IndexedDB (Requirement 9.9)
 */
async function markDocumentSynced(db: IDBDatabase, documentId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.DOCUMENTS], 'readwrite');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const request = store.get(documentId);

    request.onsuccess = () => {
      const doc = request.result as OfflineDocument;
      if (doc) {
        doc.synced = true;
        doc.last_sync_at = new Date().toISOString();
        doc.pending_changes = [];
        
        const updateRequest = store.put(doc);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(new Error('Failed to mark document as synced'));
      } else {
        reject(new Error('Document not found'));
      }
    };

    request.onerror = () => {
      reject(new Error('Failed to fetch document for sync update'));
    };
  });
}

/**
 * Mark document as conflicted (Requirement 9.8)
 */
async function markDocumentConflicted(
  db: IDBDatabase,
  documentId: string,
  conflictInfo: ConflictInfo
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.DOCUMENTS], 'readwrite');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const request = store.get(documentId);

    request.onsuccess = () => {
      const doc = request.result as OfflineDocument;
      if (doc) {
        // Store conflict information
        doc.pending_changes.push({
          type: 'conflict',
          timestamp: new Date().toISOString(),
          data: conflictInfo,
        } as any);
        
        const updateRequest = store.put(doc);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(new Error('Failed to mark document as conflicted'));
      } else {
        reject(new Error('Document not found'));
      }
    };

    request.onerror = () => {
      reject(new Error('Failed to fetch document for conflict marking'));
    };
  });
}

/**
 * Increment retry count for failed sync (Requirement 9.10)
 */
async function incrementRetryCount(
  db: IDBDatabase,
  documentId: string,
  error: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.get(documentId);

    request.onsuccess = () => {
      let entry = request.result as SyncQueueEntry | undefined;
      
      if (!entry) {
        // Create new sync queue entry
        entry = {
          id: documentId,
          user_id: '', // Will be set by the caller
          operation: 'update',
          data: {},
          timestamp: new Date().toISOString(),
          retryCount: 1,
          lastError: error,
        };
      } else {
        // Increment retry count
        entry.retryCount++;
        entry.lastError = error;
      }
      
      const updateRequest = store.put(entry);
      updateRequest.onsuccess = () => resolve();
      updateRequest.onerror = () => reject(new Error('Failed to update retry count'));
    };

    request.onerror = () => {
      reject(new Error('Failed to fetch sync queue entry'));
    };
  });
}

/**
 * Get all conflicted documents
 */
export async function getConflictedDocuments(): Promise<ConflictInfo[]> {
  const db = await openDatabase();
  const conflicts: ConflictInfo[] = [];

  try {
    const transaction = db.transaction([STORES.DOCUMENTS], 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const request = store.getAll();

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const docs = request.result as OfflineDocument[];
        
        for (const doc of docs) {
          const conflictChange = doc.pending_changes.find(
            (change) => (change as any).type === 'conflict'
          );
          
          if (conflictChange && (conflictChange as any).data) {
            conflicts.push((conflictChange as any).data as ConflictInfo);
          }
        }
        
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to fetch documents'));
      };
    });
  } finally {
    closeDatabase(db);
  }

  return conflicts;
}

/**
 * Resolve a conflict by choosing local or server version
 */
export async function resolveConflict(
  documentId: string,
  resolution: 'local' | 'server'
): Promise<void> {
  const db = await openDatabase();

  try {
    const transaction = db.transaction([STORES.DOCUMENTS], 'readwrite');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const request = store.get(documentId);

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = async () => {
        const doc = request.result as OfflineDocument;
        
        if (!doc) {
          reject(new Error('Document not found'));
          return;
        }

        // Find conflict
        const conflictIndex = doc.pending_changes.findIndex(
          (change) => (change as any).type === 'conflict'
        );
        
        if (conflictIndex === -1) {
          reject(new Error('No conflict found'));
          return;
        }

        const conflict = (doc.pending_changes[conflictIndex] as any).data as ConflictInfo;

        if (resolution === 'server') {
          // Use server version
          doc.title = conflict.serverVersion.title;
          doc.content = conflict.serverVersion.content;
          doc.updated_at = conflict.serverVersion.updated_at;
        }
        // If 'local', keep current local version

        // Remove conflict from pending changes
        doc.pending_changes.splice(conflictIndex, 1);
        doc.synced = false; // Mark for re-sync

        const updateRequest = store.put(doc);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(new Error('Failed to resolve conflict'));
      };

      request.onerror = () => {
        reject(new Error('Failed to fetch document'));
      };
    });
  } finally {
    closeDatabase(db);
  }
}
