"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const transactionSchema = z.object({
  account_id: z.string().uuid(),
  category_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive("Сумма должна быть положительной"),
  description: z.string().min(1, "Добавьте описание"),
  merchant_name: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["income", "expense", "transfer"]),
  is_shared: z.coerce.boolean().default(false),
  is_planned: z.coerce.boolean().default(false),
});

async function adjustBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  accountId: string,
  delta: number
) {
  const { data: acct } = await supabase
    .from("accounts").select("balance").eq("id", accountId).single();
  if (!acct) return;
  await supabase
    .from("accounts")
    .update({ balance: Number(acct.balance) + delta })
    .eq("id", accountId);
}

function balanceDelta(type: string, amount: number) {
  return type === "income" ? amount : -amount;
}

export async function createTransaction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const raw = {
    account_id: formData.get("account_id"),
    category_id: formData.get("category_id") || null,
    amount: formData.get("amount"),
    description: formData.get("description"),
    merchant_name: formData.get("merchant_name") || undefined,
    date: formData.get("date"),
    type: formData.get("type"),
    is_shared: formData.get("is_shared") === "true",
    is_planned: formData.get("is_planned") === "true",
  };

  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("transactions").insert({
    ...parsed.data,
    user_id: user.id,
    import_source: "manual",
  });

  if (error) return { error: "Ошибка при сохранении" };

  if (!parsed.data.is_planned) {
    await adjustBalance(supabase, parsed.data.account_id, balanceDelta(parsed.data.type, parsed.data.amount));
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateTransaction(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const raw = {
    account_id: formData.get("account_id"),
    category_id: formData.get("category_id") || null,
    amount: formData.get("amount"),
    description: formData.get("description"),
    merchant_name: formData.get("merchant_name") || undefined,
    date: formData.get("date"),
    type: formData.get("type"),
    is_shared: formData.get("is_shared") === "true",
    is_planned: formData.get("is_planned") === "true",
  };

  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { data: old } = await supabase
    .from("transactions")
    .select("amount, type, account_id, is_planned")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { account_id: _, ...updateData } = parsed.data;
  const { error } = await supabase
    .from("transactions")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Ошибка при обновлении" };

  if (old) {
    const accountId = old.account_id;
    const wasPlanned = old.is_planned;
    const nowPlanned = parsed.data.is_planned;

    if (!wasPlanned && nowPlanned) {
      // Becoming planned: reverse old effect
      await adjustBalance(supabase, accountId, -balanceDelta(old.type, Number(old.amount)));
    } else if (wasPlanned && !nowPlanned) {
      // Becoming real: apply new effect
      await adjustBalance(supabase, accountId, balanceDelta(parsed.data.type, parsed.data.amount));
    } else if (!wasPlanned && !nowPlanned) {
      // Both real: reverse old + apply new
      const delta = -balanceDelta(old.type, Number(old.amount)) + balanceDelta(parsed.data.type, parsed.data.amount);
      await adjustBalance(supabase, accountId, delta);
    }
    // Both planned: no balance change
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { data: tx } = await supabase
    .from("transactions")
    .select("amount, type, account_id, is_planned")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Ошибка при удалении" };

  if (tx && !tx.is_planned) {
    await adjustBalance(supabase, tx.account_id, -balanceDelta(tx.type, Number(tx.amount)));
  }

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function bulkImportTransactions(
  transactions: Array<{
    account_id: string;
    amount: number;
    description: string;
    merchant_name?: string;
    date: string;
    type: "income" | "expense";
    import_hash: string;
    category_id?: string | null;
  }>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован", imported: 0 };

  const rows = transactions.map((t) => ({
    ...t,
    user_id: user.id,
    import_source: "pdf" as const,
    currency: "RUB",
  }));

  const { data: existing, error: fetchError } = await supabase
    .from("transactions")
    .select("import_hash")
    .eq("user_id", user.id)
    .not("import_hash", "is", null);

  if (fetchError) {
    console.error("[bulkImport] fetch error:", fetchError.message);
    return { error: `Ошибка при импорте: ${fetchError.message}`, imported: 0 };
  }

  const existingHashes = new Set(existing?.map((r) => r.import_hash) ?? []);
  const newRows = rows.filter((r) => !existingHashes.has(r.import_hash));

  if (!newRows.length) return { success: true, imported: 0 };

  const { data, error } = await supabase
    .from("transactions")
    .insert(newRows)
    .select("id");

  if (error) {
    console.error("[bulkImport] Supabase error:", error.message, error.code);
    return { error: `Ошибка при импорте: ${error.message}`, imported: 0 };
  }

  // Update account balances
  const deltas: Record<string, number> = {};
  for (const r of newRows) {
    deltas[r.account_id] = (deltas[r.account_id] ?? 0) + balanceDelta(r.type, r.amount);
  }
  await Promise.all(
    Object.entries(deltas).map(([accountId, delta]) => adjustBalance(supabase, accountId, delta))
  );

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true, imported: data?.length ?? 0 };
}
