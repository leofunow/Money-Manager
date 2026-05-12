import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
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

  const members = (membersData ?? []) as unknown as Array<{ role: string; profile?: { display_name: string | null } | null }>;
  const isAdmin = members.some((m) => m.role === "admin");

  let inviteUrl: string | undefined;
  if (isAdmin && process.env.INVITE_SECRET) {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    inviteUrl = `${proto}://${host}/register?invite=${process.env.INVITE_SECRET}`;
  }

  return (
    <SettingsClient
      profile={profile}
      accounts={(accountsData ?? []) as AccountRow[]}
      members={members}
      userEmail={user.email ?? ""}
      inviteUrl={inviteUrl}
    />
  );
}
