import { useMutation } from "@tanstack/react-query";

export interface SendNotificationInput {
  title: string;
  body: string;
  userId?: string;
}

export interface DispatchNotificationInput {
  title: string;
  body: string;
  userIds: string[];
}

export function useSendNotification() {
  return useMutation({
    mutationFn: async (data: SendNotificationInput) => {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<{ sent: number; failed: number }>;
    },
  });
}

export function useDispatchNotification() {
  return useMutation({
    mutationFn: async (data: DispatchNotificationInput) => {
      const res = await fetch("/api/notifications/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
      return res.json() as Promise<{ sent: number; failed: number }>;
    },
  });
}

export function useSubscribePush() {
  return useMutation({
    mutationFn: async (subscription: PushSubscriptionJSON) => {
      const res = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          p256dh: subscription.keys?.p256dh,
          auth: subscription.keys?.auth,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message: string };
        throw new Error(err.message);
      }
    },
  });
}
