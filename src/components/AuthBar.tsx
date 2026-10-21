"use client";

import { useState } from "react";
import { useData } from "@/lib/data-context";

/** Login state in the header: magic link in, workshop switcher, sign out. */
export function AuthBar() {
  const { configured, authLoading, user, workshops, workshop, selectWorkshop, signIn, signOut } = useData();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (!configured) return null;
  if (authLoading) return <span className="text-sm text-ink-3 self-center">…</span>;

  if (user) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {workshops.length > 1 ? (
          <select
            aria-label="Taller"
            className="field py-1.5 text-sm w-auto"
            value={workshop?.id ?? ""}
            onChange={(e) => selectWorkshop(e.target.value)}
          >
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-sm text-ink-2">{workshop?.name ?? "Sin taller"}</span>
        )}
        <span className="text-xs text-ink-3 hidden sm:inline">{user.email}</span>
        <button type="button" className="btn py-1.5 text-sm" onClick={() => void signOut()}>
          Salir
        </button>
      </div>
    );
  }

  const send = async () => {
    setSending(true);
    setStatus(null);
    try {
      await signIn(email);
      setStatus(`Te mandamos un link a ${email.trim()}. Abrilo desde este dispositivo o cualquier otro.`);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "No se pudo enviar el link");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      {open ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-ink-2 mb-1.5">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              autoComplete="email"
              className="field w-60"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@ejemplo.com"
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={sending}>
            {sending ? "Enviando…" : "Enviar link"}
          </button>
          <button type="button" className="btn" onClick={() => setOpen(false)}>
            Cancelar
          </button>
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          Iniciar sesión
        </button>
      )}
      {status ? (
        <p role="status" className="text-xs text-ink-2 max-w-xs text-right">
          {status}
        </p>
      ) : null}
    </div>
  );
}
