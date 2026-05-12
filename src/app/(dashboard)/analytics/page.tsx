import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./analytics-client";

interface TxnWithCategory {
  amount: number;
  type: string;
  date: string;
  category_id: string | null;
  category: { name: string; color: string; icon: string | null } | null;
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles").select("household_id").eq("user_id", user.id).single();
  const profile = profileData as { household_id: string | null } | null;
  if (!profile?.household_id) redirect("/dashboard");

  const { data: accountsData } = await supabase
    .from("accounts").select("id").eq("household_id", profile.household_id);
  const accountIds = ((accountsData ?? []) as { id: string }[]).map((a) => a.id);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const fromDate = sixMonthsAgo.toISOString().split("T")[0];

  const { data: txnsData } = accountIds.length
    ? await supabase
        .from("transactions")
        .select(`amount, type, date, category_id, category:categories(name, color, icon)`)
        .in("account_id", accountIds)
        .gte("date", fromDate)
        .order("date")
    : { data: [] };

  return <AnalyticsClient transactions={(txnsData ?? []) as unknown as TxnWithCategory[]} />;
}
