"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/data-context";
import { CURRENCIES, type CurrencyCode } from "@/lib/format";

type Props = { open: boolean; onClose: () => void; onLogin?: () => void };

/** App settings: the workshop (members, name, invite code) and preferences. */
export function SettingsDialog({ open, onClose, onLogin }: Props) {
  const { configured, user, workshops, workshop, selectWorkshop, joinWorkshop, renameWorkshop, currency, setCurrency, lastError } =
    useData();
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(workshop?.name ?? "");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  // Follow the active workshop's name while the field is not being edited.
  const [namedFor, setNamedFor] = useState<string | null>(null);
  if (workshop && namedFor !== workshop.id) {
    setNamedFor(workshop.id);
    setName(workshop.name);
  }

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(true);
    setStatus(null);
    try {
      await fn();
      setStatus(label);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "No se pudo");
    } finally {
      setBusy(false);
    }
  };

  const sectionTitle = "display text-base font-semibold leading-tight";

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="settings-title" className="display text-xl font-semibold leading-tight">
            Configuración
          </h2>
          <button type="button" className="btn py-1.5" onClick={onClose}>
            Cerrar
          </button>
        </div>

        {configured ? (
          <section className="mt-5 border-t border-line pt-5" aria-labelledby="settings-workshop">
            <h3 id="settings-workshop" className={sectionTitle}>
              Taller
            </h3>
            {user ? (
              <>
                <p className="mt-1 text-sm text-ink-2">Presupuestos e impresoras se comparten entre los miembros. {user.email}</p>

                {workshops.length > 1 ? (
                  <fieldset className="mt-4">
                    <legend className="text-sm font-medium text-ink-2 mb-1.5">Taller activo</legend>
                    <div className="flex flex-col gap-1.5">
                      {workshops.map((w) => (
                        <label
                          key={w.id}
                          className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm ${
                            w.id === workshop?.id ? "border-accent bg-accent-soft/60 font-medium" : "border-line"
                          }`}
                        >
                          <input
                            type="radio"
                            name="workshop"
                            className="accent-[var(--accent)]"
                            checked={w.id === workshop?.id}
                            onChange={() => selectWorkshop(w.id)}
                          />
                          <span className="truncate">{w.name}</span>
                          <span className="ml-auto text-xs text-ink-3">{w.role === "owner" ? "tuyo" : "miembro"}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}

                {workshop ? (
                  <>
                    <form
                      className="mt-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (name.trim() && name.trim() !== workshop.name) void run("Nombre guardado", () => renameWorkshop(name));
                      }}
                    >
                      <label htmlFor="workshop-name" className="block text-sm font-medium text-ink-2 mb-1.5">
                        Nombre
                      </label>
                      <div className="flex items-stretch gap-2">
                        <input
                          id="workshop-name"
                          type="text"
                          className="field"
                          value={name}
                          maxLength={60}
                          onChange={(e) => setName(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="btn shrink-0"
                          disabled={busy || !name.trim() || name.trim() === workshop.name}
                        >
                          Guardar
                        </button>
                      </div>
                    </form>

                    <div className="mt-4">
                      <p className="text-sm font-medium text-ink-2 mb-1.5">Código para invitar</p>
                      <div className="flex items-stretch gap-2">
                        <code className="field num flex items-center text-base tracking-wide select-all">{workshop.joinCode}</code>
                        <button
                          type="button"
                          className="btn shrink-0"
                          onClick={() => void run("Código copiado", () => navigator.clipboard.writeText(workshop.joinCode))}
                        >
                          Copiar
                        </button>
                      </div>
                      <p className="mt-1.5 text-xs text-ink-3">Quien lo cargue ve y edita los mismos presupuestos e impresoras.</p>
                    </div>
                  </>
                ) : null}

                <form
                  className="mt-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("Te uniste al taller", async () => {
                      await joinWorkshop(joinCode);
                      setJoinCode("");
                    });
                  }}
                >
                  <label htmlFor="join-code" className="block text-sm font-medium text-ink-2 mb-1.5">
                    Unirme a otro taller
                  </label>
                  <div className="flex items-stretch gap-2">
                    <input
                      id="join-code"
                      type="text"
                      className="field num"
                      placeholder="Código"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                    />
                    <button type="submit" className="btn shrink-0" disabled={busy || !joinCode.trim()}>
                      Unirme
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-3">Pedile el código a quien creó el taller.</p>
                </form>
              </>
            ) : (
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-2 max-w-xs">
                  Con sesión, los presupuestos e impresoras se comparten entre tus dispositivos y con tu taller.
                </p>
                {onLogin ? (
                  <button type="button" className="btn btn-primary" onClick={onLogin}>
                    Iniciar sesión
                  </button>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        <section className="mt-5 border-t border-line pt-5" aria-labelledby="settings-prefs">
          <h3 id="settings-prefs" className={sectionTitle}>
            Preferencias
          </h3>
          <div className="mt-3">
            <label htmlFor="settings-currency" className="block text-sm font-medium text-ink-2 mb-1.5">
              Moneda
            </label>
            <select
              id="settings-currency"
              className="field"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label} ({c.code})
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-3">
              {workshop ? "Para todos los miembros del taller." : "Para este navegador. Los links compartidos llevan la suya."}
            </p>
          </div>
        </section>

        {status ? (
          <p role="status" className="mt-4 text-sm text-ok">
            {status}
          </p>
        ) : null}
        {lastError ? (
          <p role="alert" className="mt-4 text-sm text-ink">
            {lastError}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
