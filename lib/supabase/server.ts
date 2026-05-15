import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options as any);
            });
          } catch {}
        },
      },
    },
  );
}

export async function getUserIdOrDev(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<{ userId: string | null; isAuthDisabled: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthDisabled = process.env.AUTH_DISABLED === "true";
  const devUserId = process.env.DEV_USER_ID ?? null;
  const userId = user?.id ?? (isAuthDisabled ? devUserId : null);

  return { userId, isAuthDisabled };
}
