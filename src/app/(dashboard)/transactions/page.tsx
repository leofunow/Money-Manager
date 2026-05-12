import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TransactionsClient } from "./transactions-client";
import type { Database } from "@/types/database";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type TxnWithRels = Database["public"]["Tables"]["transactions"]["Row"] & {
  category: { name: string; color: string; icon: string | null } | null;
  account: { name: string } | null;
};

export default async function TransactionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles").select("household_id").eq("user_id", user.id).single();
  const profile = profileData as { household_id: string | null } | null;
  if (!profile?.household_id) redirect("/dashboard");

  const { data: accountsData } = await supabase
    .from("accounts").select("*").eq("household_id", profile.household_id);

  const { data: categoriesData } = await supabase
    .from("categories").select("*").eq("household_id", profile.household_id).order("sort_order");

  const accounts = (accountsData ?? []) as AccountRow[];
  const accountIds = accounts.map((a) => a.id);

  const { data: txnsData } = accountIds.length
    ? await supabase
        .from("transactions")
        .select(`*, category:categories(name, color, icon), account:accounts(name)`)
        .in("account_id", accountIds)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };

  return (
    <TransactionsClient
      transactions={(txnsData ?? []) as unknown as TxnWithRels[]}
      accounts={accounts}
      categories={(categoriesData ?? []) as CategoryRow[]}
    />
  );
}
