import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { GoalsClient } from "./goals-client";
import type { Database } from "@/types/database";

type GoalRow = Database["public"]["Tables"]["goals"]["Row"];

export default async function GoalsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles").select("household_id").eq("user_id", user.id).single();
  const profile = profileData as { household_id: string | null } | null;
  if (!profile?.household_id) redirect("/dashboard");

  const { data: goalsData } = await supabase
    .from("goals").select("*").eq("household_id", profile.household_id).order("created_at", { ascending: false });

  return <GoalsClient goals={(goalsData ?? []) as GoalRow[]} />;
}
