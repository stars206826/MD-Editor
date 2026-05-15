"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { OfflineIndicator } from "@/components/offline-indicator";
import { NetworkProvider } from "@/lib/network-context";
import { syncOfflineChanges } from "@/lib/offline-sync";

interface AppLayoutClientProps {
  children: ReactNode;
  userEmail: string | null;
}

export function AppLayoutClient({ children, userEmail }: AppLayoutClientProps) {
  const router = useRouter();

  async function handleSync() {
    const result = await syncOfflineChanges();

    if (result.conflictedCount > 0) {
      alert(`同步完成，但有 ${result.conflictedCount} 个文档存在冲突，需要手动解决。`);
    }

    if (result.failedCount > 0) {
      alert(`同步部分失败：${result.failedCount} 个文档同步失败。`);
    }

    router.refresh();
  }

  return (
    <NetworkProvider>
      <div className="min-h-screen">
        <header className="border-b border-border bg-slate-950/60 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
            <div>
              <Link href="/dashboard" className="text-lg font-semibold text-white">
                Markdown Sync
              </Link>
              {userEmail && (
                <p className="text-sm text-slate-400">{userEmail}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white">
                文档列表
              </Link>
              <LogoutButton />
            </div>
          </div>
        </header>
        {children}

        {/* Offline Indicator */}
        <OfflineIndicator onSync={handleSync} />
      </div>
    </NetworkProvider>
  );
}
