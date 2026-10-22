"use client";

import { useEffect, useState } from "react";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID;

/** Registers the service worker and offers a reload when a newer deploy takes over. */
export function ServiceWorker() {
  const [outdated, setOutdated] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; version?: string } | null;
      if (data?.type === "sw-activated" && data.version !== BUILD_ID) setOutdated(true);
    };
    sw.addEventListener("message", onMessage);
    sw.startMessages();
    const registration = sw.register("/sw.js", { updateViaCache: "none" });
    registration.catch(() => {});
    // An installed app can stay open for days: look for a new deploy when it comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") registration.then((r) => r.update()).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      sw.removeEventListener("message", onMessage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!outdated) return null;
  return (
    <div
      role="status"
      className="no-print fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-line bg-ticket px-4 py-3 text-sm shadow-lg"
    >
      <span className="flex-1">Hay una versión nueva de la app.</span>
      <button type="button" className="btn py-1.5" onClick={() => setOutdated(false)}>
        Después
      </button>
      <button type="button" className="btn btn-primary py-1.5" onClick={() => window.location.reload()}>
        Recargar
      </button>
    </div>
  );
}
