/**
 * Offline Storage Utilities
 * 
 * This module provides utility functions for managing offline document storage
 * and synchronization using IndexedDB.
 * 
 * Requirements: 9.3, 9.4, 9.9
 */

import { openDatabase, closeDatabase, STORES, SyncQueueEntry } from './offline-db';
import { OfflineDocument, PendingChange, DocumentRecord } from './types';

/**
 * Saves a document to IndexedDB for offline access
 * 
 * Preconditions:
 * - document is a valid DocumentRecord with all required fields
 * - document.id is a valid UUID
 * - document.user_id is a valid UUID
 * 
 * Postconditions:
 * - Document is stored in IndexedDB documents store
 * - If document has changes, it's added to sync queue
 * - Document is marked as unsynced if it has pending changes
 * - Returns the saved OfflineDocument
 * 
 * @param document - The document to save offline
 * @param pendingChanges - Optional array of pending changes made offline
 * @returns Promise<OfflineDocument> The saved offline document
 * @throws Error if IndexedDB operation fails
 */
export async function saveDocumentOffline(
  document: DocumentRecord,
  pendingChanges: PendingChange[] = []
): Promise<OfflineDocument> {
  const db = await openDatabase();
  
  try {
    const offlineDoc: OfflineDocument = {
      ...document,
      synced: pendingChanges.length === 0,
      last_sync_at: pendingChanges.length === 0 ? new Date().toISOString() : null,
      pending_changes: pendingChanges,
    };

    // Start transaction for both stores
    const transaction = db.transaction([STORES.DOCUMENTS, STORES.SYNC_QUEUE], 'readwrite');
    
    // Store document
    const docStore = transaction.objectStore(STORES.DOCUMENTS);
    await new Promise<void>((resolve, reject) => {
      const request = docStore.put(offlineDoc);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save document: ${request.error?.message}`));
    });

    // If there are pending changes, add to sync queue
    if (pendingChanges.length > 0) {
      const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);
      const queueEntry: SyncQueueEntry = {
        id: document.id,
        user_id: document.user_id,
        operation: 'update',
        data: offlineDoc,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };

      await new Promise<void>((resolve, reject) => {
        const request = queueStore.put(queueEntry);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error(`Failed to add to sync queue: ${request.error?.message}`));
      });
    }

    // Wait for transaction to complete
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Transaction failed: ${transaction.error?.message}`));
    });

    return offlineDoc;
  } finally {
    closeDatabase(db);
  }
}

/**
 * Retrieves offline documents for a specific user
 * 
 * Preconditions:
 * - userId is a valid UUID
 * - IndexedDB is supported and accessible
 * 
 * Postconditions:
 * - Returns array of OfflineDocument objects for the specified user
 * - Documents are sorted by updated_at in descending order (most recent first)
 * - Returns empty array if no documents found
 * 
 * @param userId - The user ID to filter documents
 * @param unsyncedOnly - If true, only return documents with synced=false
 * @returns Promise<OfflineDocument[]> Array of offline documents
 * @throws Error if IndexedDB operation fails
 */
export async function getOfflineDocuments(
  userId: string,
  unsyncedOnly: boolean = false
): Promise<OfflineDocument[]> {
  const db = await openDatabase();
  
  try {
    const transaction = db.transaction(STORES.DOCUMENTS, 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    
    let documents: OfflineDocument[];

    if (unsyncedOnly) {
      // Use compound index for efficient filtering
      const index = store.index('user_synced');
      const range = IDBKeyRange.only([userId, false]);
      
      documents = await new Promise<OfflineDocument[]>((resolve, reject) => {
        const request = index.getAll(range);
        request.onsuccess = () => resolve(request.result as OfflineDocument[]);
        request.onerror = () => reject(new Error(`Failed to get unsynced documents: ${request.error?.message}`));
      });
    } else {
      // Get all documents for user
      const index = store.index('user_id');
      
      documents = await new Promise<OfflineDocument[]>((resolve, reject) => {
        const request = index.getAll(userId);
        request.onsuccess = () => resolve(request.result as OfflineDocument[]);
        request.onerror = () => reject(new Error(`Failed to get documents: ${request.error?.message}`));
      });
    }

    // Sort by updated_at descending (most recent first)
    documents.sort((a, b) => {
      const timeA = new Date(a.updated_at).getTime();
      const timeB = new Date(b.updated_at).getTime();
      return timeB - timeA;
    });

    return documents;
  } finally {
    closeDatabase(db);
  }
}

/**
 * Marks a document as successfully synced
 * 
 * Preconditions:
 * - documentId is a valid UUID
 * - Document exists in IndexedDB
 * 
 * Postconditions:
 * - Document's synced field is set to true
 * - Document's last_sync_at is set to current timestamp
 * - Document's pending_changes array is cleared
 * - Document is removed from sync queue
 * 
 * @param documentId - The ID of the document to mark as synced
 * @returns Promise<void>
 * @throws Error if document not found or IndexedDB operation fails
 */
export async function markDocumentSynced(documentId: string): Promise<void> {
  const db = await openDatabase();
  
  try {
    const transaction = db.transaction([STORES.DOCUMENTS, STORES.SYNC_QUEUE], 'readwrite');
    
    // Update document
    const docStore = transaction.objectStore(STORES.DOCUMENTS);
    
    // First, get the document
    const document = await new Promise<OfflineDocument | undefined>((resolve, reject) => {
      const request = docStore.get(documentId);
      request.onsuccess = () => resolve(request.result as OfflineDocument | undefined);
      request.onerror = () => reject(new Error(`Failed to get document: ${request.error?.message}`));
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Update sync status
    const updatedDoc: OfflineDocument = {
      ...document,
      synced: true,
      last_sync_at: new Date().toISOString(),
      pending_changes: [],
    };

    await new Promise<void>((resolve, reject) => {
      const request = docStore.put(updatedDoc);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update document: ${request.error?.message}`));
    });

    // Remove from sync queue
    const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);
    await new Promise<void>((resolve, reject) => {
      const request = queueStore.delete(documentId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to remove from sync queue: ${request.error?.message}`));
    });

    // Wait for transaction to complete
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Transaction failed: ${transaction.error?.message}`));
    });
  } finally {
    closeDatabase(db);
  }
}

/**
 * Gets all documents with pending changes that need to be synced
 * 
 * Preconditions:
 * - userId is a valid UUID
 * - IndexedDB is supported and accessible
 * 
 * Postconditions:
 * - Returns array of OfflineDocument objects with synced=false
 * - Documents are sorted by updated_at ascending (oldest first for FIFO sync)
 * - Returns empty array if no pending changes
 * 
 * @param userId - The user ID to filter documents
 * @returns Promise<OfflineDocument[]> Array of documents with pending changes
 * @throws Error if IndexedDB operation fails
 */
export async function getPendingChanges(userId: string): Promise<OfflineDocument[]> {
  const db = await openDatabase();
  
  try {
    const transaction = db.transaction(STORES.DOCUMENTS, 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const index = store.index('user_synced');
    
    // Get unsynced documents for this user
    const range = IDBKeyRange.only([userId, false]);
    
    const documents = await new Promise<OfflineDocument[]>((resolve, reject) => {
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result as OfflineDocument[]);
      request.onerror = () => reject(new Error(`Failed to get pending changes: ${request.error?.message}`));
    });

    // Sort by updated_at ascending (oldest first) for FIFO processing
    documents.sort((a, b) => {
      const timeA = new Date(a.updated_at).getTime();
      const timeB = new Date(b.updated_at).getTime();
      return timeA - timeB;
    });

    return documents;
  } finally {
    closeDatabase(db);
  }
}

/**
 * Gets a single offline document by ID
 * 
 * Preconditions:
 * - documentId is a valid UUID
 * 
 * Postconditions:
 * - Returns OfflineDocument if found
 * - Returns null if document not found
 * 
 * @param documentId - The ID of the document to retrieve
 * @returns Promise<OfflineDocument | null> The document or null if not found
 * @throws Error if IndexedDB operation fails
 */
export async function getOfflineDocument(documentId: string): Promise<OfflineDocument | null> {
  const db = await openDatabase();
  
  try {
    const transaction = db.transaction(STORES.DOCUMENTS, 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    
    const document = await new Promise<OfflineDocument | undefined>((resolve, reject) => {
      const request = store.get(documentId);
      request.onsuccess = () => resolve(request.result as OfflineDocument | undefined);
      request.onerror = () => reject(new Error(`Failed to get document: ${request.error?.message}`));
    });

    return document || null;
  } finally {
    closeDatabase(db);
  }
}

/**
 * Deletes an offline document
 * 
 * Preconditions:
 * - documentId is a valid UUID
 * 
 * Postconditions:
 * - Document is removed from IndexedDB documents store
 * - Document is removed from sync queue if present
 * 
 * @param documentId - The ID of the document to delete
 * @returns Promise<void>
 * @throws Error if IndexedDB operation fails
 */
export async function deleteOfflineDocument(documentId: string): Promise<void> {
  const db = await openDatabase();
  
  try {
    const transaction = db.transaction([STORES.DOCUMENTS, STORES.SYNC_QUEUE], 'readwrite');
    
    // Delete from documents store
    const docStore = transaction.objectStore(STORES.DOCUMENTS);
    await new Promise<void>((resolve, reject) => {
      const request = docStore.delete(documentId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete document: ${request.error?.message}`));
    });

    // Delete from sync queue
    const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);
    await new Promise<void>((resolve, reject) => {
      const request = queueStore.delete(documentId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to remove from sync queue: ${request.error?.message}`));
    });

    // Wait for transaction to complete
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Transaction failed: ${transaction.error?.message}`));
    });
  } finally {
    closeDatabase(db);
  }
}

/**
 * Gets the count of pending changes for a user
 * 
 * Preconditions:
 * - userId is a valid UUID
 * 
 * Postconditions:
 * - Returns the number of documents with synced=false
 * 
 * @param userId - The user ID to count pending changes for
 * @returns Promise<number> The count of pending changes
 * @throws Error if IndexedDB operation fails
 */
export async function getPendingChangesCount(userId: string): Promise<number> {
  const db = await openDatabase();
  
  try {
    const transaction = db.transaction(STORES.DOCUMENTS, 'readonly');
    const store = transaction.objectStore(STORES.DOCUMENTS);
    const index = store.index('user_synced');
    
    const range = IDBKeyRange.only([userId, false]);
    
    const count = await new Promise<number>((resolve, reject) => {
      const request = index.count(range);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count pending changes: ${request.error?.message}`));
    });

    return count;
  } finally {
    closeDatabase(db);
  }
}

/**
 * Updates a document's pending changes
 * 
 * Preconditions:
 * - documentId is a valid UUID
 * - Document exists in IndexedDB
 * - changes is a non-empty array of PendingChange objects
 * 
 * Postconditions:
 * - Document's pending_changes array is updated
 * - Document is marked as unsynced
 * - Document is added to sync queue if not already present
 * 
 * @param documentId - The ID of the document to update
 * @param changes - Array of pending changes to add
 * @returns Promise<void>
 * @throws Error if document not found or IndexedDB operation fails
 */
export async function addPendingChanges(
  documentId: string,
  changes: PendingChange[]
): Promise<void> {
  const db = await openDatabase();
  
  try {
    const transaction = db.transaction([STORES.DOCUMENTS, STORES.SYNC_QUEUE], 'readwrite');
    const docStore = transaction.objectStore(STORES.DOCUMENTS);
    
    // Get the document
    const document = await new Promise<OfflineDocument | undefined>((resolve, reject) => {
      const request = docStore.get(documentId);
      request.onsuccess = () => resolve(request.result as OfflineDocument | undefined);
      request.onerror = () => reject(new Error(`Failed to get document: ${request.error?.message}`));
    });

    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Merge new changes with existing ones
    const updatedDoc: OfflineDocument = {
      ...document,
      synced: false,
      pending_changes: [...document.pending_changes, ...changes],
    };

    // Update document
    await new Promise<void>((resolve, reject) => {
      const request = docStore.put(updatedDoc);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update document: ${request.error?.message}`));
    });

    // Add to sync queue
    const queueStore = transaction.objectStore(STORES.SYNC_QUEUE);
    const queueEntry: SyncQueueEntry = {
      id: documentId,
      user_id: document.user_id,
      operation: 'update',
      data: updatedDoc,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };

    await new Promise<void>((resolve, reject) => {
      const request = queueStore.put(queueEntry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to add to sync queue: ${request.error?.message}`));
    });

    // Wait for transaction to complete
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error(`Transaction failed: ${transaction.error?.message}`));
    });
  } finally {
    closeDatabase(db);
  }
}
