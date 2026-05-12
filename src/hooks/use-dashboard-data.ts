"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { getMonthBounds } from "@/lib/utils";

const supabase = createClient();

// ─── Profile ──────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("*, household:households(id, name)")
        .eq("user_id", user.id)
        .single();
      return data ? { ...data, userId: user.id, userEmail: user.email ?? "" } : null;
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export function useAccounts(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ["accounts", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data } = await supabase
        .from("accounts")
        .select("*")
        .eq("household_id", householdId!);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function useCategories(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ["categories", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("*")
        .eq("household_id", householdId!)
        .order("sort_order");
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export function useTransactions(accountIds: string[]) {
  return useQuery({
    queryKey: ["transactions", accountIds],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select(`*, category:categories(name, color, icon), account:accounts(name)`)
        .in("account_id", accountIds)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Budgets ──────────────────────────────────────────────────────────────────

export function useBudgets(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ["budgets", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data } = await supabase
        .from("budgets")
        .select(`id, category_id, amount, period, start_date, household_id, created_at, category:categories(name, color, icon)`)
        .eq("household_id", householdId!);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Month spending (calendar month, used for budgets) ────────────────────────

export function useMonthSpending(accountIds: string[]) {
  const { start, end } = getMonthBounds();
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["monthSpending", accountIds, startStr],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("category_id, amount, type")
        .in("account_id", accountIds)
        .gte("date", startStr)
        .lte("date", endStr);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Last 30 days spending (used for dashboard summary cards) ─────────────────

export function useLast30DaysSpending(accountIds: string[]) {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 29);
  const fromStr = from.toISOString().split("T")[0];
  const toStr = today.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["last30days", accountIds, fromStr],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select("category_id, amount, type")
        .in("account_id", accountIds)
        .gte("date", fromStr)
        .lte("date", toStr);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Goals ────────────────────────────────────────────────────────────────────

export function useGoals(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ["goals", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("household_id", householdId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

// ─── Analytics transactions (6 months) ───────────────────────────────────────

export function useAnalyticsTransactions(accountIds: string[]) {
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const fromDate = sixMonthsAgo.toISOString().split("T")[0];

  return useQuery({
    queryKey: ["analyticsTransactions", accountIds, fromDate],
    enabled: accountIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("transactions")
        .select(`amount, type, date, category_id, category:categories(name, color, icon)`)
        .in("account_id", accountIds)
        .gte("date", fromDate)
        .order("date");
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

// ─── Household members ────────────────────────────────────────────────────────

export function useHouseholdMembers(householdId: string | null | undefined) {
  return useQuery({
    queryKey: ["members", householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data } = await supabase
        .from("household_members")
        .select(`role, profile:profiles(display_name)`)
        .eq("household_id", householdId!);
      return (data ?? []) as unknown as Array<{ role: string; profile?: { display_name: string | null } | null }>;
    },
    staleTime: 5 * 60_000,
  });
}
