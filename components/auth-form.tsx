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

  function translateAuthError(message: string): string {
    const map: Record<string, string> = {
      "Invalid login credentials": "邮箱或密码错误",
      "Email not confirmed": "邮箱尚未验证，请检查收件箱",
      "User already registered": "该邮箱已注册",
      "Signup requires a valid password": "请输入有效的密码",
      "Password should be at least 6 characters": "密码至少需要 6 个字符",
      "Password should be at least 6 characters.": "密码至少需要 6 个字符",
      "Unable to validate email address: invalid format": "邮箱格式不正确",
      "For security purposes, you can only request this after 60 seconds": "操作过于频繁，请 60 秒后再试",
      "Email rate limit exceeded": "请求过于频繁，请稍后再试",
      "User not found": "用户不存在",
      "Network request failed": "网络连接失败，请检查网络",
    };
    return map[message] ?? message;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (mode === "sign-in") {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (authError) {
        setError(translateAuthError(authError.message));
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
      setError(translateAuthError(authError.message));
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-stone-800">
          {mode === "sign-in" ? "登录账号" : "创建账号"}
        </h2>
        <p className="text-sm leading-6 text-stone-500">
          使用邮箱和密码进入你的私人 Markdown 空间。
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-stone-200 bg-stone-50 p-1">
        <button
          type="button"
          onClick={() => { setMode("sign-in"); setError(null); }}
          className={mode === "sign-in" ? "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white" : "rounded-lg px-4 py-2 text-sm text-stone-500"}
        >
          登录
        </button>
        <button
          type="button"
          onClick={() => { setMode("sign-up"); setError(null); }}
          className={mode === "sign-up" ? "rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white" : "rounded-lg px-4 py-2 text-sm text-stone-500"}
        >
          注册
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="text-sm text-stone-600">邮箱</label>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-stone-600">密码</label>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 6 位"
            minLength={6}
            required
          />
        </div>

        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p> : null}

        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading ? "处理中..." : mode === "sign-in" ? "登录" : "创建账号"}
        </Button>
      </form>
    </div>
  );
}
