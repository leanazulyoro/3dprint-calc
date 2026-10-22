"use client";

import { useSyncExternalStore } from "react";
import { useData } from "@/lib/data-context";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const { mode } = useData();
  if (online) return null;
  return (
    <div role="status" className="no-print border-b border-line bg-accent-soft/70 px-4 py-2 text-center text-sm text-ink-2">
      {mode === "remote"
        ? "Sin conexión. La calculadora sigue andando; guardar en el taller necesita red."
        : "Sin conexión. Todo sigue andando: lo que guardes queda en este dispositivo."}
    </div>
  );
}
