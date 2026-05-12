"use client";

import { Bell } from "lucide-react";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export function BellButton() {
  const { permission, subscribe } = usePushNotifications();

  async function handleClick() {
    if (permission === "granted") return;
    await subscribe();
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors relative"
      aria-label="Уведомления"
      title={permission === "granted" ? "Уведомления включены" : "Включить уведомления"}
    >
      <Bell size={18} />
      {permission === "default" && (
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </button>
  );
}
