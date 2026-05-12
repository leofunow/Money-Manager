"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const goalSchema = z.object({
  name: z.string().min(1),
  target_amount: z.coerce.number().positive(),
  deadline: z.string().optional().nullable(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export async function createGoal(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("profiles").select("household_id").eq("user_id", user.id).single();
  if (!profile?.household_id) return { error: "Домохозяйство не настроено" };

  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    target_amount: formData.get("target_amount"),
    deadline: formData.get("deadline") || null,
    icon: formData.get("icon") || "🎯",
    color: formData.get("color") || "#3b82f6",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("goals").insert({
    ...parsed.data,
    household_id: profile.household_id,
  });
  if (error) return { error: "Ошибка сохранения" };
  revalidatePath("/goals");
  return { success: true };
}

export async function addToGoal(goalId: string, amount: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { data: goal } = await supabase.from("goals").select("current_amount, target_amount").eq("id", goalId).single();
  if (!goal) return { error: "Цель не найдена" };

  const newAmount = Number(goal.current_amount) + amount;
  const isCompleted = newAmount >= Number(goal.target_amount);

  const { error } = await supabase
    .from("goals")
    .update({ current_amount: newAmount, is_completed: isCompleted })
    .eq("id", goalId);

  if (error) return { error: "Ошибка обновления" };
  revalidatePath("/goals");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function addToGoalWithTransaction(
  goalId: string,
  amount: number,
  accountId: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { data: goal } = await supabase
    .from("goals")
    .select("current_amount, target_amount, name")
    .eq("id", goalId)
    .single();
  if (!goal) return { error: "Цель не найдена" };

  const { data: account } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", accountId)
    .single();
  if (!account) return { error: "Счёт не найден" };

  const today = new Date().toISOString().split("T")[0];

  // Create expense transaction
  const { error: txError } = await supabase.from("transactions").insert({
    account_id: accountId,
    user_id: user.id,
    amount,
    description: `→ Цель: ${goal.name}`,
    date: today,
    type: "expense",
    import_source: "manual",
    currency: "RUB",
  });
  if (txError) return { error: "Ошибка создания транзакции" };

  // Deduct from account balance
  await supabase
    .from("accounts")
    .update({ balance: Number(account.balance) - amount })
    .eq("id", accountId);

  // Update goal amount
  const newAmount = Number(goal.current_amount) + amount;
  const isCompleted = newAmount >= Number(goal.target_amount);
  const { error: goalError } = await supabase
    .from("goals")
    .update({ current_amount: newAmount, is_completed: isCompleted })
    .eq("id", goalId);

  if (goalError) return { error: "Ошибка обновления цели" };

  revalidatePath("/goals");
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { success: true, completed: isCompleted };
}

export async function deleteGoal(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { error: "Ошибка удаления" };
  revalidatePath("/goals");
  return { success: true };
}
