"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export async function createHousehold(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Укажите название" };

  const { error } = await supabase.rpc("create_household_for_user", { p_name: name });
  if (error) return { error: "Ошибка создания домохозяйства" };

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return { success: true };
}

export async function createAccount(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { data: profile } = await supabase
    .from("profiles").select("household_id").eq("user_id", user.id).single();
  if (!profile?.household_id) return { error: "Домохозяйство не настроено" };

  const parsed = z.object({
    name: z.string().min(1),
    type: z.enum(["personal", "shared"]),
    balance: z.coerce.number().default(0),
  }).safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    balance: formData.get("balance"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase.from("accounts").insert({
    ...parsed.data,
    household_id: profile.household_id,
    user_id: user.id,
    currency: "RUB",
  });

  if (error) return { error: "Ошибка создания счёта" };
  revalidatePath("/settings");
  return { success: true };
}

export async function inviteMember(formData: FormData) {
  // Invitation via email — in real app, would send email with magic link
  // For now, show a placeholder message
  return { success: true, message: "Приглашение отправлено (функция в разработке)" };
}
