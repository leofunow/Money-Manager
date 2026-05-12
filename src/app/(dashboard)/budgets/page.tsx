import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getMonthBounds } from "@/lib/utils";
import { BudgetsClient } from "./budgets-client";
import type { Database } from "@/types/database";

type BudgetRow = Database["public"]["Tables"]["budgets"]["Row"] & {
  category: { name: string; color: string; icon: string | null } | null;
};

export default async function BudgetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles").select("household_id").eq("user_id", user.id).single();
  const profile = profileData as { household_id: string | null } | null;
  if (!profile?.household_id) redirect("/dashboard");

  const { data: categoriesData } = await supabase
    .from("categories").select("*").eq("household_id", profile.household_id).eq("type", "expense").order("sort_order");

  const { data: budgetsData } = await supabase
    .from("budgets")
    .select(`id, category_id, amount, period, start_date, household_id, created_at, category:categories(name, color, icon)`)
    .eq("household_id", profile.household_id);

  const { data: accountsData } = await supabase
    .from("accounts").select("id").eq("household_id", profile.household_id);

  const accountIds = ((accountsData ?? []) as { id: string }[]).map((a) => a.id);
  const { start, end } = getMonthBounds();

  const { data: spendingData } = accountIds.length
    ? await supabase
        .from("transactions")
        .select("category_id, amount")
        .in("account_id", accountIds)
        .gte("date", start.toISOString().split("T")[0])
        .lte("date", end.toISOString().split("T")[0])
        .eq("type", "expense")
    : { data: [] };

  const spendingMap = ((spendingData ?? []) as { category_id: string | null; amount: number }[])
    .reduce<Record<string, number>>((acc, t) => {
      if (t.category_id) acc[t.category_id] = (acc[t.category_id] ?? 0) + Number(t.amount);
      return acc;
    }, {});

  return (
    <BudgetsClient
      budgets={(budgetsData ?? []) as unknown as BudgetRow[]}
      categories={(categoriesData ?? []) as Database["public"]["Tables"]["categories"]["Row"][]}
      spendingMap={spendingMap}
    />
  );
}
