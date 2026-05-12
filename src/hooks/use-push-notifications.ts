"use client";

import { useState, useEffect } from "react";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  async function subscribe() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { error: "Пуш-уведомления не поддерживаются в этом браузере" };
    }

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return { error: "Разрешение отклонено" };

    try {
      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return { error: "VAPID ключ не настроен" };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      setSubscribed(true);
      return { success: true };
    } catch (err) {
      return { error: "Не удалось подписаться на уведомления" };
    }
  }

  return { permission, subscribed, subscribe };
}
