"use client";

import { MATERIALS } from "@/lib/calc";
import { hoursLabel, money } from "@/lib/format";
import type { Quote } from "@/lib/quotes";

type Props = {
  quotes: Quote[];
  activeId: string | null;
  available: boolean;
  onLoad: (q: Quote) => void;
  onDelete: (q: Quote) => void;
  onExport: () => void;
};

const when = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

export function SavedQuotes({ quotes, activeId, available, onLoad, onDelete, onExport }: Props) {
  return (
    <section className="no-print mt-14" aria-labelledby="guardados">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="guardados" className="display text-xl font-semibold leading-tight">
            Presupuestos guardados
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {available
              ? "Quedan en este navegador. Exportalos a CSV para abrirlos en Excel o Sheets."
              : "Este navegador no permite guardar datos locales."}
          </p>
        </div>
        <button type="button" className="btn" onClick={onExport} disabled={quotes.length === 0}>
          Exportar CSV
        </button>
      </div>

      {quotes.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-sm text-ink-2 text-center">
          Todavía no guardaste ninguno. Calculá una pieza y tocá &ldquo;Guardar presupuesto&rdquo;.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-ticket">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-2 border-b border-line">
                <th className="font-medium px-3 py-2.5">Fecha</th>
                <th className="font-medium px-3 py-2.5">Nombre</th>
                <th className="font-medium px-3 py-2.5">Pieza</th>
                <th className="font-medium px-3 py-2.5 text-right">Costo</th>
                <th className="font-medium px-3 py-2.5 text-right">Precio</th>
                <th className="px-3 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => {
                const r = q.result;
                const material = MATERIALS.find((m) => m.id === q.input.material)?.label ?? q.input.material;
                const final = r.ml ? r.ml.listTotal : r.priceWithVat;
                const tag = r.ml ? "en ML" : q.input.vatEnabled ? "con IVA" : null;
                const active = q.id === activeId;
                return (
                  <tr
                    key={q.id}
                    className={`border-b border-line/60 last:border-b-0 ${active ? "bg-accent-soft/60" : ""}`}
                  >
                    <td className="px-3 py-2.5 num whitespace-nowrap text-ink-2">{when.format(q.createdAt)}</td>
                    <td className="px-3 py-2.5 font-medium max-w-[16rem] truncate">{q.name}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">
                      {material}, {q.input.grams} g, {hoursLabel(r.printHours)}
                      {q.input.quantity > 1 ? `, ${q.input.quantity} u.` : ""}
                    </td>
                    <td className="px-3 py-2.5 num text-right whitespace-nowrap">{money(r.cost, q.currency)}</td>
                    <td className="px-3 py-2.5 num text-right whitespace-nowrap font-semibold">
                      {money(final, q.currency)}
                      {tag ? <span className="ml-1.5 text-xs font-normal text-ink-3">{tag}</span> : null}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <button type="button" className="btn px-2.5 py-1.5 text-xs" onClick={() => onLoad(q)}>
                        Cargar
                      </button>
                      <button
                        type="button"
                        className="btn px-2.5 py-1.5 text-xs ml-1.5"
                        aria-label={`Borrar ${q.name}`}
                        onClick={() => onDelete(q)}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
