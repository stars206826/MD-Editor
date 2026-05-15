"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "sign-in") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (authError) {
        setError(authError.message);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    // 注册后直接登录
    const { error: authError } = await supabase.auth.signUp({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-white">
          {mode === "sign-in" ? "登录账号" : "创建账号"}
        </h2>
        <p className="text-sm leading-6 text-slate-400">
          使用邮箱和密码进入你的私人 Markdown 空间。
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-border bg-slate-950/60 p-1">
        <button
          type="button"
          onClick={() => { setMode("sign-in"); setError(null); }}
          className={mode === "sign-in" ? "rounded-lg bg-sky-400 px-4 py-2 text-sm font-medium text-slate-950" : "rounded-lg px-4 py-2 text-sm text-slate-300"}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => { setMode("sign-up"); setError(null); }}
          className={mode === "sign-up" ? "rounded-lg bg-sky-400 px-4 py-2 text-sm font-medium text-slate-950" : "rounded-lg px-4 py-2 text-sm text-slate-300"}
        >
          注册
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">邮箱</label>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300">密码</label>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 6 位"
            minLength={6}
            required
          />
        </div>

        {error ? <p className="rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p> : null}

        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "处理中..." : mode === "sign-in" ? "登录" : "创建账号"}
        </Button>
      </form>
    </div>
  );
}
