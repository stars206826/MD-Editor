import type { ReactNode } from "react";

import { createClient } from "@/lib/supabase/server";
import { AppLayoutClient } from "./layout-client";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <AppLayoutClient userEmail={user?.email ?? null}>
      {children}
    </AppLayoutClient>
  );
}
