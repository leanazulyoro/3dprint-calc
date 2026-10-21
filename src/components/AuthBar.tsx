"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/data-context";

/** Login state in the top bar: magic link in a modal, workshop switcher, sign out. */
export function AuthBar() {
  const { configured, authLoading, user, workshops, workshop, selectWorkshop, signIn, signOut } = useData();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [sending, setSending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  // The dialog element owns focus trapping, Escape and the backdrop.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

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
          <span className="text-sm text-ink-2 hidden sm:inline">{workshop?.name ?? "Sin taller"}</span>
        )}
        <button type="button" className="btn py-1.5" onClick={() => void signOut()} title={user.email}>
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
      setStatus({ ok: true, text: `Te mandamos un link a ${email.trim()}. Abrilo desde este dispositivo o cualquier otro; podés cerrar esta ventana.` });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "No se pudo enviar el link" });
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-primary py-1.5" onClick={() => setOpen(true)}>
        Iniciar sesión
      </button>
      <dialog
        ref={dialog}
        className="dialog"
        aria-labelledby="login-title"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialog.current) setOpen(false);
        }}
      >
        <form
          method="dialog"
          className="p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <h2 id="login-title" className="display text-xl font-semibold leading-tight">
            Iniciar sesión
          </h2>
          <p className="mt-1.5 text-sm text-ink-2">
            Sin contraseña: te mandamos un link por email. Con sesión, los presupuestos e impresoras se comparten
            entre tus dispositivos y con tu taller.
          </p>
          <label htmlFor="login-email" className="block text-sm font-medium text-ink-2 mt-5 mb-1.5">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@ejemplo.com"
          />
          {status ? (
            <p role="status" className={`mt-3 text-sm ${status.ok ? "text-ok" : "text-ink"}`}>
              {status.text}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              {status?.ok ? "Cerrar" : "Cancelar"}
            </button>
            {status?.ok ? null : (
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? "Enviando…" : "Enviar link"}
              </button>
            )}
          </div>
        </form>
      </dialog>
    </>
  );
}
