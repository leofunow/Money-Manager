import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type Category = Database["public"]["Tables"]["categories"]["Row"];
type Budget = Database["public"]["Tables"]["budgets"]["Row"];
type Goal = Database["public"]["Tables"]["goals"]["Row"];
type Account = Database["public"]["Tables"]["accounts"]["Row"];

export async function getProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  return data;
}

export async function getAccounts() {
  const supabase = createClient();
  const profile = await getProfile();
  if (!profile?.household_id) return [];

  const { data } = await supabase
    .from("accounts")
    .select("*")
    .eq("household_id", profile.household_id)
    .order("created_at");

  return data ?? [];
}

export async function getCategories(type?: "income" | "expense") {
  const supabase = createClient();
  const profile = await getProfile();
  if (!profile?.household_id) return [];

  let query = supabase
    .from("categories")
    .select("*")
    .eq("household_id", profile.household_id)
    .order("sort_order");

  if (type) query = query.eq("type", type);

  const { data } = await query;
  return data ?? [];
}

export async function getTransactions(params?: {
  from?: string;
  to?: string;
  categoryId?: string;
  accountId?: string;
  limit?: number;
}) {
  const supabase = createClient();
  const accounts = await getAccounts();
  if (!accounts.length) return [];

  const accountIds = accounts.map((a) => a.id);

  let query = supabase
    .from("transactions")
    .select(`*, category:categories(name, color, icon, type), account:accounts(name)`)
    .in("account_id", accountIds)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (params?.from) query = query.gte("date", params.from);
  if (params?.to) query = query.lte("date", params.to);
  if (params?.categoryId) query = query.eq("category_id", params.categoryId);
  if (params?.accountId) query = query.eq("account_id", params.accountId);
  if (params?.limit) query = query.limit(params.limit);

  const { data } = await query;
  return data ?? [];
}

export async function getBudgets() {
  const supabase = createClient();
  const profile = await getProfile();
  if (!profile?.household_id) return [];

  const { data } = await supabase
    .from("budgets")
    .select(`*, category:categories(name, color, icon)`)
    .eq("household_id", profile.household_id);

  return data ?? [];
}

export async function getGoals() {
  const supabase = createClient();
  const profile = await getProfile();
  if (!profile?.household_id) return [];

  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("household_id", profile.household_id)
    .order("created_at", { ascending: false });

  return data ?? [];
}
