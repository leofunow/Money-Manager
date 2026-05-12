import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await request.json() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { endpoint, keys } = sub;

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  type PushSubInsert = Database["public"]["Tables"]["push_subscriptions"]["Insert"];
  await supabase.from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth } satisfies PushSubInsert,
    { onConflict: "endpoint" }
  );

  return NextResponse.json({ success: true });
}
