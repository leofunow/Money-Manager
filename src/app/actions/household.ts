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

export async function updateAccount(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const parsed = z.object({
    name: z.string().min(1),
    type: z.enum(["personal", "shared"]),
  }).safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("accounts")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Ошибка обновления счёта" };
  revalidatePath("/settings");
  return { success: true };
}

export async function deleteAccount(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Ошибка удаления счёта" };
  revalidatePath("/settings");
  return { success: true };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Не авторизован" };

  const paydayRaw = formData.get("payday_day");
  const display_name = formData.get("display_name");

  const dayNum = paydayRaw !== null ? parseInt(String(paydayRaw), 10) : undefined;
  const payday_day = dayNum !== undefined
    ? (isNaN(dayNum) || dayNum < 1 || dayNum > 31 ? null : dayNum)
    : undefined;

  const update = {
    ...(display_name !== null ? { display_name: String(display_name).trim() || null } : {}),
    ...(payday_day !== undefined ? { payday_day } : {}),
  };

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("user_id", user.id);

  if (error) return { error: "Ошибка обновления профиля" };
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function inviteMember(formData: FormData) {
  // Invitation via email — in real app, would send email with magic link
  // For now, show a placeholder message
  return { success: true, message: "Приглашение отправлено (функция в разработке)" };
}
