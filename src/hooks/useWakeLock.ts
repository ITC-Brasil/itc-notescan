import { useCallback, useEffect, useRef } from "react";

export function useWakeLock(): void {
  const sentinel = useRef<WakeLockSentinel | null>(null);

  const release = useCallback(async () => {
    if (sentinel.current) {
      await sentinel.current.release();
      sentinel.current = null;
    }
  }, []);

  const acquire = useCallback(async () => {
    if (!("wakeLock" in navigator)) return;
    try {
      await release();
      sentinel.current = await navigator.wakeLock.request("screen");
    } catch {
      // ponytail: silent — battery saver or hidden tab can refuse
    }
  }, [release]);

  useEffect(() => {
    void acquire();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void release();
    };
  }, [acquire, release]);
}
