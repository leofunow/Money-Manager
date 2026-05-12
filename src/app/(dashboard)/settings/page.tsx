import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SettingsClient } from "./settings-client";
import type { Database } from "@/types/database";

type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"] & {
  household?: { id: string; name: string } | null;
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase
    .from("profiles")
    .select(`*, household:households(id, name)`)
    .eq("user_id", user.id)
    .single();

  const profile = profileData as ProfileRow | null;

  const { data: accountsData } = profile?.household_id
    ? await supabase.from("accounts").select("*").eq("household_id", profile.household_id)
    : { data: [] };

  const { data: membersData } = profile?.household_id
    ? await supabase
        .from("household_members")
        .select(`role, profile:profiles(display_name)`)
        .eq("household_id", profile.household_id)
    : { data: [] };

  return (
    <SettingsClient
      profile={profile}
      accounts={(accountsData ?? []) as AccountRow[]}
      members={(membersData ?? []) as unknown as Array<{ role: string; profile?: { display_name: string | null } | null }>}
      userEmail={user.email ?? ""}
    />
  );
}
