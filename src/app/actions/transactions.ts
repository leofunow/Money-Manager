"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const transactionSchema = z.object({
  account_id: z.string().uuid(),
  category_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive("Сумма должна быть положительной"),
  description: z.string().min(1, "Добавьте описание"),
  merchant_name: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["income", "expense", "transfer"]),
  is_shared: z.coerce.boolean().default(false),
});

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
  };

  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("transactions").insert({
    ...parsed.data,
    user_id: user.id,
    import_source: "manual",
  });

  if (error) return { error: "Ошибка при сохранении" };
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
  };

  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { account_id: _, ...updateData } = parsed.data;
  const { error } = await supabase
    .from("transactions")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Ошибка при обновлении" };
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Ошибка при удалении" };
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
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true, imported: data?.length ?? 0 };
}
