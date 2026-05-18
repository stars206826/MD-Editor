// Base document type from database
export type DocumentRecord = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  tags?: Tag[]; // Optional tags for when documents are fetched with tags
};

// Extended document interface with optional fields for enhanced features
export interface Document extends DocumentRecord {
  tags?: Tag[];
  version_count?: number;
  image_count?: number;
  word_count?: number;
  share_link?: ShareLink | null;
}

// Tag system types (Requirement 4.1)
export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  document_count?: number;
}

export interface DocumentTag {
  document_id: string;
  tag_id: string;
  created_at: string;
}

// Version history types (Requirement 5.1)
export interface DocumentVersion {
  id: string;
  document_id: string;
  title: string;
  content: string;
  version_number: number;
  content_hash: string;
  created_at: string;
}

// Image upload types (Requirement 6.1)
export interface DocumentImage {
  id: string;
  document_id: string;
  user_id: string;
  filename: string;
  storage_path: string;
  public_url: string;
  size: number;
  mime_type: string;
  width: number | null;
  height: number | null;
  created_at: string;
}

// Share link types (Requirement 8.1)
export interface ShareLink {
  id: string;
  document_id: string;
  user_id: string;
  token: string;
  expires_at: string | null;
  password_hash: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

// Search types (Requirement 1.1)
export interface SearchResult {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  matchCount: number;
  updated_at: string;
}

// Sort and filter types (Requirement 2.1)
export type SortField = 'created_at' | 'updated_at' | 'title';
export type SortOrder = 'asc' | 'desc';

export interface FilterOptions {
  sortBy: SortField;
  order: SortOrder;
  tags?: string[];
  dateRange?: { start: Date; end: Date };
}

// Export types (Requirement 7.1)
export type ExportFormat = 'pdf' | 'html' | 'markdown' | 'text';

export interface ExportOptions {
  format: ExportFormat;
  includeMetadata?: boolean;
  includeImages?: boolean;
  styling?: 'default' | 'github' | 'minimal';
}

// Offline sync types (Requirement 9.1)
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface SyncState {
  lastSyncTime: Date | null;
  pendingDocuments: string[];
  failedDocuments: string[];
}

export interface OfflineDocument extends DocumentRecord {
  synced: boolean;
  last_sync_at: string | null;
  pending_changes: PendingChange[];
}

export interface PendingChange {
  field: 'title' | 'content';
  value: string;
  timestamp: string;
}

// Markdown toolbar types (Requirement 3.1)
export type MarkdownFormat = 
  | 'bold' 
  | 'italic' 
  | 'heading' 
  | 'link' 
  | 'code' 
  | 'codeblock'
  | 'quote' 
  | 'list' 
  | 'image';

export interface TextSelection {
  start: number;
  end: number;
  text: string;
}

// Share options
export interface ShareOptions {
  expiresIn?: number; // days
  password?: string;
  allowCopy?: boolean;
}

// Upload progress
export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

// Image metadata
export interface ImageMetadata {
  filename: string;
  size: number;
  mimeType: string;
  width: number;
  height: number;
}
