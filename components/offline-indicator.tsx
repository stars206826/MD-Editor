/**
 * Offline Indicator Component
 * 
 * Displays online/offline status, pending changes count, and sync controls.
 * Requirements: 9.2, 9.11, 9.12, 12.1, 12.2
 */

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNetwork } from "@/lib/network-context";
import { formatDate } from "@/lib/utils";

interface OfflineIndicatorProps {
  onSync?: () => Promise<void>;
}

export function OfflineIndicator({ onSync }: OfflineIndicatorProps) {
  const { isOnline, lastOnlineAt } = useNetwork();
  const [pendingChangesCount, setPendingChangesCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load pending changes count from IndexedDB
  useEffect(() => {
    loadPendingChangesCount();
  }, []);

  async function loadPendingChangesCount() {
    try {
      // This would query IndexedDB for unsynced documents
      // For now, we'll use a placeholder
      // TODO: Implement actual IndexedDB query
      setPendingChangesCount(0);
    } catch (err) {
      console.error("Failed to load pending changes count:", err);
    }
  }

  async function handleSync() {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      if (onSync) {
        await onSync();
      }
      
      setLastSyncAt(new Date());
      await loadPendingChangesCount();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  // Auto-sync when coming back online (Requirement 9.6)
  useEffect(() => {
    if (isOnline && pendingChangesCount > 0 && !isSyncing) {
      handleSync();
    }
  }, [isOnline]);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Status badge (Requirement 9.2) */}
      <div
        className="group relative cursor-pointer"
        onClick={() => setShowDetails(!showDetails)}
      >
        <div
          className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-lg transition-colors ${
            isOnline
              ? "bg-green-500/20 text-green-300 hover:bg-green-500/30"
              : "bg-red-500/20 text-red-300 hover:bg-red-500/30"
          }`}
        >
          {/* Status indicator */}
          <div
            className={`h-2 w-2 rounded-full ${
              isOnline ? "bg-green-400" : "bg-red-400 animate-pulse"
            }`}
          />
          
          {/* Status text */}
          <span className="text-sm font-medium">
            {isOnline ? "在线" : "离线"}
          </span>

          {/* Pending changes badge (Requirement 9.11) */}
          {pendingChangesCount > 0 && (
            <span className="rounded-full bg-sky-500 px-2 py-0.5 text-xs font-semibold text-white">
              {pendingChangesCount}
            </span>
          )}

          {/* Syncing indicator */}
          {isSyncing && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
          )}
        </div>

        {/* Details panel */}
        {showDetails && (
          <div className="absolute bottom-full right-0 mb-2 w-80 rounded-xl border border-border bg-slate-900 p-4 shadow-xl">
            <div className="space-y-3">
              {/* Connection status */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  连接状态
                </h3>
                <p className="text-xs text-slate-400">
                  {isOnline ? "已连接到服务器" : "无法连接到服务器"}
                </p>
              </div>

              {/* Pending changes (Requirement 9.11) */}
              {pendingChangesCount > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">
                    待同步更改
                  </h3>
                  <p className="text-xs text-slate-400">
                    {pendingChangesCount} 个文档有未同步的更改
                  </p>
                </div>
              )}

              {/* Last sync timestamp (Requirement 9.12) */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200">
                  最后同步
                </h3>
                <p className="text-xs text-slate-400">
                  {lastSyncAt
                    ? formatDate(lastSyncAt.toISOString())
                    : lastOnlineAt
                    ? formatDate(lastOnlineAt.toISOString())
                    : "从未同步"}
                </p>
              </div>

              {/* Sync error */}
              {syncError && (
                <div className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2">
                  <p className="text-xs text-red-200">{syncError}</p>
                </div>
              )}

              {/* Manual sync button (Requirement 9.12, 12.2) */}
              {isOnline && pendingChangesCount > 0 && (
                <Button
                  variant="primary"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="w-full"
                  size="sm"
                >
                  {isSyncing ? "同步中..." : "立即同步"}
                </Button>
              )}

              {/* Offline mode info */}
              {!isOnline && (
                <div className="rounded-lg border border-sky-400/20 bg-sky-500/10 px-3 py-2">
                  <p className="text-xs text-sky-200">
                    离线模式：您的更改将保存在本地，并在恢复连接后自动同步
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
