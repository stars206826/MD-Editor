/**
 * IndexedDB Schema for Offline Support
 * 
 * This module sets up the IndexedDB database for offline document storage and sync queue.
 * Requirements: 9.3, 9.4
 */

import { OfflineDocument, PendingChange } from './types';

const DB_NAME = 'markdown-editor-offline';
const DB_VERSION = 1;

// Object store names
export const STORES = {
  DOCUMENTS: 'documents',
  SYNC_QUEUE: 'sync_queue',
} as const;

/**
 * Interface for sync queue entries
 */
export interface SyncQueueEntry {
  id: string; // document_id
  user_id: string;
  operation: 'create' | 'update' | 'delete';
  data: Partial<OfflineDocument>;
  timestamp: string;
  retryCount: number;
  lastError?: string;
}

/**
 * Opens the IndexedDB database and ensures schema is up to date
 * 
 * @returns Promise<IDBDatabase> The opened database connection
 */
export function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create documents object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
        const documentsStore = db.createObjectStore(STORES.DOCUMENTS, { 
          keyPath: 'id' 
        });
        
        // Create indexes for efficient querying
        // Index by user_id for filtering user's documents
        documentsStore.createIndex('user_id', 'user_id', { unique: false });
        
        // Index by synced status for finding unsynced documents
        documentsStore.createIndex('synced', 'synced', { unique: false });
        
        // Index by updated_at for sorting by modification time
        documentsStore.createIndex('updated_at', 'updated_at', { unique: false });
        
        // Compound index for user_id + synced for efficient filtering
        documentsStore.createIndex('user_synced', ['user_id', 'synced'], { unique: false });
        
        // Index by last_sync_at for tracking sync history
        documentsStore.createIndex('last_sync_at', 'last_sync_at', { unique: false });
      }

      // Create sync_queue object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncQueueStore = db.createObjectStore(STORES.SYNC_QUEUE, { 
          keyPath: 'id' 
        });
        
        // Index by user_id for filtering user's sync queue
        syncQueueStore.createIndex('user_id', 'user_id', { unique: false });
        
        // Index by timestamp for processing in order
        syncQueueStore.createIndex('timestamp', 'timestamp', { unique: false });
        
        // Index by operation type for filtering by operation
        syncQueueStore.createIndex('operation', 'operation', { unique: false });
        
        // Index by retryCount for identifying failed syncs
        syncQueueStore.createIndex('retryCount', 'retryCount', { unique: false });
      }
    };
  });
}

/**
 * Closes the database connection
 * 
 * @param db The database connection to close
 */
export function closeDatabase(db: IDBDatabase): void {
  db.close();
}

/**
 * Deletes the entire offline database (useful for testing or reset)
 * 
 * @returns Promise<void>
 */
export function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    
    request.onerror = () => {
      reject(new Error(`Failed to delete IndexedDB: ${request.error?.message}`));
    };
    
    request.onsuccess = () => {
      resolve();
    };
  });
}

/**
 * Gets the current database version
 * 
 * @returns The current database version number
 */
export function getDatabaseVersion(): number {
  return DB_VERSION;
}

/**
 * Checks if IndexedDB is supported in the current browser
 * 
 * @returns true if IndexedDB is supported, false otherwise
 */
export function isIndexedDBSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}
