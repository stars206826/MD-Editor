import { AuthForm } from "@/components/auth-form";
import { ParticleBackground } from "@/components/particle-background";
import { ParticleText } from "@/components/particle-text";
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
    <main className="relative mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
      <ParticleBackground />
      <div className="relative z-10 grid w-full gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="flex flex-col justify-center gap-4">
          <span className="w-fit rounded-full border border-amber-300/50 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            登录你的私人空间
          </span>
          <ParticleText text="随时打开，随时写" />
          <p className="max-w-xl text-base leading-7 text-stone-600">
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
