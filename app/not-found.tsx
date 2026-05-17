import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="space-y-6 text-center">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.24em] text-stone-400">404</p>
          <h1 className="text-3xl font-semibold text-stone-800">没有找到这篇文档</h1>
          <p className="text-sm text-stone-500">它可能已被删除，或者当前账号没有访问权限。</p>
        </div>
        <Link href="/dashboard">
          <Button>返回文档列表</Button>
        </Link>
      </div>
    </main>
  );
}
