"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const budgetSchema = z.object({
  category_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  period: z.enum(["monthly", "yearly"]),
});

export async function upsertBudget(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("profiles").select("household_id").eq("user_id", user.id).single();
  if (!profile?.household_id) return { error: "Домохозяйство не настроено" };

  const parsed = budgetSchema.safeParse({
    category_id: formData.get("category_id"),
    amount: formData.get("amount"),
    period: formData.get("period"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("budgets").upsert(
    { ...parsed.data, household_id: profile.household_id },
    { onConflict: "household_id,category_id,period" }
  );

  if (error) return { error: "Ошибка сохранения" };
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteBudget(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { error: "Ошибка удаления" };
  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return { success: true };
}
