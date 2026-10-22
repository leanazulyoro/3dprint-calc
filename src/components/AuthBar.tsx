"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/data-context";
import { ChevronIcon, SettingsIcon, WrenchIcon } from "./icons";
import { SettingsDialog } from "./SettingsDialog";
import { Skeleton } from "./Skeleton";

/** Login state in the top bar: magic link (or its code) in a modal, workshop switcher, sign out. */
export function AuthBar() {
  const { configured, ready, user, workshop, signIn, verifyCode, signOut } = useData();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [email, setEmail] = useState("");
  // Where the email went; the dialog then asks for its code.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  // The dialog element owns focus trapping, Escape and the backdrop.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const settingsButton = (
    <button
      type="button"
      className="btn py-1.5 px-2.5"
      aria-label="Configuración"
      aria-haspopup="dialog"
      aria-expanded={settingsOpen}
      onClick={() => setSettingsOpen(true)}
    >
      <SettingsIcon />
    </button>
  );

  if (!configured) {
    return (
      <>
        {settingsButton}
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </>
    );
  }
  if (!ready) {
    return (
      <div className="flex items-center gap-2 sm:ml-2" aria-busy="true" aria-label="Cargando sesión">
        <Skeleton className="h-8 w-20 sm:w-28 rounded-full" />
        <Skeleton className="h-8 w-14" />
      </div>
    );
  }

  if (user) {
    // Logged in from the code, or from the link in another tab: the next login starts over.
    if (open || sentTo) {
      setOpen(false);
      setSentTo(null);
      setCode("");
      setError(null);
    }
    return (
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2 sm:ml-2">
        <button
          type="button"
          className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft/70 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-soft"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(true)}
        >
          <WrenchIcon className="shrink-0" />
          <span className="max-w-20 sm:max-w-40 truncate">{workshop?.name ?? "Sin taller"}</span>
          <ChevronIcon className="shrink-0" />
        </button>
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <button type="button" className="btn py-1.5" onClick={() => void signOut()} title={user.email}>
          Salir
        </button>
      </div>
    );
  }

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await signIn(email);
      setSentTo(email.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el link");
    } finally {
      setSending(false);
    }
  };

  const verify = async () => {
    if (!sentTo) return;
    setSending(true);
    setError(null);
    try {
      await verifyCode(sentTo, code);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo verificar el código");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {settingsButton}
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onLogin={() => {
          setSettingsOpen(false);
          setOpen(true);
        }}
      />
      <button type="button" className="btn btn-primary py-1.5 px-2.5 sm:px-3" onClick={() => setOpen(true)}>
        <span className="sm:hidden">Entrar</span>
        <span className="hidden sm:inline">Iniciar sesión</span>
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
            void (sentTo ? verify() : send());
          }}
        >
          <h2 id="login-title" className="display text-xl font-semibold leading-tight">
            Iniciar sesión
          </h2>
          <p className="mt-1.5 text-sm text-ink-2">
            Sin contraseña: te mandamos un link por email. Con sesión, los presupuestos e impresoras se comparten
            entre tus dispositivos y con tu taller.
          </p>
          {sentTo ? (
            <>
              <p role="status" className="mt-5 text-sm text-ok">
                Te mandamos un mail a {sentTo}. Abrí el link desde cualquier dispositivo, o escribí acá el código que
                trae (en la app instalada en iPhone, usá el código).
              </p>
              <label htmlFor="login-code" className="block text-sm font-medium text-ink-2 mt-4 mb-1.5">
                Código
              </label>
              <input
                id="login-code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                pattern="[0-9]{6,10}"
                maxLength={10}
                className="field num tracking-widest"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
              />
              <button
                type="button"
                className="mt-2 text-sm text-accent-ink underline underline-offset-2"
                onClick={() => {
                  setSentTo(null);
                  setCode("");
                  setError(null);
                }}
              >
                Usar otro email
              </button>
            </>
          ) : (
            <>
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
            </>
          )}
          {error ? (
            <p role="alert" className="mt-3 text-sm text-ink">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn" onClick={() => setOpen(false)}>
              {sentTo ? "Cerrar" : "Cancelar"}
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sentTo ? (sending ? "Verificando…" : "Entrar") : sending ? "Enviando…" : "Enviar link"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
