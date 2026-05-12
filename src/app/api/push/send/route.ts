import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
if (vapidPublic && vapidPrivate) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@finfamily.app",
    vapidPublic,
    vapidPrivate
  );
}

type PushSubRow = Database["public"]["Tables"]["push_subscriptions"]["Row"];

export async function POST(request: NextRequest) {
  const { userId, title, body } = await request.json() as {
    userId: string;
    title: string;
    body: string;
  };

  const supabase = await createClient();
  const { data: subsData } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("user_id", userId);

  const subs = (subsData ?? []) as PushSubRow[];
  if (!subs.length) return NextResponse.json({ sent: 0 });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, icon: "/icons/icon-192.png" })
      );
      sent++;
    } catch {
      await supabase.from("push_subscriptions").delete().eq("id", sub.id);
    }
  }

  return NextResponse.json({ sent });
}
