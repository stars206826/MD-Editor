import { redirect } from "next/navigation";

export default function HomePage() {
  // middleware 会处理认证：已登录 → 放行，未登录 → /auth
  // 这里直接重定向到 dashboard，middleware 会拦截未登录用户
  redirect("/dashboard");
}
