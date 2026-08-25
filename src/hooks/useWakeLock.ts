import * as React from "react";

/**
 * Keep the screen awake while `active` is true, using the Screen Wake Lock API.
 *
 * The OS releases a wake lock whenever the tab is hidden, so we re-request it
 * when the page becomes visible again if we're still meant to be holding one.
 * No-ops on browsers without support (and requires a secure context — which
 * GitHub Pages provides).
 */
export function useWakeLock(active: boolean) {
  const sentinelRef = React.useRef<WakeLockSentinel | null>(null);

  React.useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let cancelled = false;

    const request = async () => {
      if (sentinelRef.current || document.visibilityState !== "visible") return;
      try {
        const sentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void sentinel.release().catch(() => {});
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener("release", () => {
          if (sentinelRef.current === sentinel) sentinelRef.current = null;
        });
      } catch {
        // Denied or interrupted — nothing we can do; playback still works.
      }
    };

    const release = () => {
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      void sentinel?.release().catch(() => {});
    };

    if (active) void request();
    else release();

    const onVisibility = () => {
      if (active && document.visibilityState === "visible") void request();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);

  // Ensure the lock is dropped when the provider unmounts.
  React.useEffect(
    () => () => {
      void sentinelRef.current?.release().catch(() => {});
      sentinelRef.current = null;
    },
    [],
  );
}
