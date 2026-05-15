import { AuthForm } from "@/components/auth-form";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AuthPage() {
  const isAuthDisabled = process.env.AUTH_DISABLED === "true";

  if (isAuthDisabled) {
    redirect("/dashboard");
  }

  // 检查用户是否已登录
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 只有在用户确实存在且没有错误时才重定向
  if (user && !error) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <div className="grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex flex-col justify-center gap-4">
          <span className="w-fit rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-2 text-sm text-sky-200">
            登录你的私人空间
          </span>
          <h1 className="text-4xl font-semibold text-white">随时打开,继续写。</h1>
          <p className="max-w-xl text-base leading-7 text-slate-300">
            首版支持邮箱注册与登录。登录后你可以在任意设备上查看、编辑并自动同步自己的 Markdown 文档。
          </p>
        </section>
        <Card className="p-6 md:p-8">
          <AuthForm />
        </Card>
      </div>
    </main>
  );
}
