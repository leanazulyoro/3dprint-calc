"use client";

import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/data-context";

/** Everything about the workshop, opened from its pill in the top bar. */
export function WorkshopDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, workshops, workshop, selectWorkshop, joinWorkshop, renameWorkshop } = useData();
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

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="workshop-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="workshop-title" className="display text-xl font-semibold leading-tight">
            Tu taller
          </h2>
          <button type="button" className="btn py-1.5" onClick={onClose}>
            Cerrar
          </button>
        </div>
        <p className="mt-1.5 text-sm text-ink-2">
          Presupuestos e impresoras se comparten entre los miembros. {user?.email}
        </p>

        {workshops.length > 1 ? (
          <fieldset className="mt-5">
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
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim() && name.trim() !== workshop.name) void run("Nombre guardado", () => renameWorkshop(name));
              }}
            >
              <label htmlFor="workshop-name" className="block text-sm font-medium text-ink-2 mb-1.5">
                Nombre
              </label>
              <div className="flex items-stretch gap-2">
                <input id="workshop-name" type="text" className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
                <button type="submit" className="btn shrink-0" disabled={busy || !name.trim() || name.trim() === workshop.name}>
                  Guardar
                </button>
              </div>
            </form>

            <div className="mt-5">
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
          className="mt-5"
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

        {status ? (
          <p role="status" className="mt-4 text-sm text-ok">
            {status}
          </p>
        ) : null}
      </div>
    </dialog>
  );
}
