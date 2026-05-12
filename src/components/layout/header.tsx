"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/actions/auth";
import { LogOut, User } from "lucide-react";
import Link from "next/link";
import { BellButton } from "./bell-button";

const supabase = createClient();

export function Header() {
  const { data: displayName = "Пользователь" } = useQuery({
    queryKey: ["headerUser"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return "Пользователь";
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .single();
      return (data as { display_name: string | null } | null)?.display_name || user.email?.split("@")[0] || "Пользователь";
    },
    staleTime: 5 * 60_000,
  });

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4 lg:px-6 shrink-0">
      <div className="lg:hidden flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary text-white font-bold text-xs">FF</div>
        <span className="font-semibold text-foreground">FinFamily</span>
      </div>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-2">
        <BellButton />

        <Link href="/settings" className="flex items-center gap-2 pl-2 border-l hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <User size={16} />
          </div>
          <span className="hidden sm:block text-sm font-medium text-foreground max-w-32 truncate">{displayName}</span>
        </Link>

        <form action={logout}>
          <button type="submit" className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-destructive transition-colors" aria-label="Выйти">
            <LogOut size={18} />
          </button>
        </form>
      </div>
    </header>
  );
}
