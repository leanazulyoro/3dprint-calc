"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MATERIALS } from "@/lib/calc";
import { csvFilename, quotesToCsv } from "@/lib/csv";
import { hoursLabel, money } from "@/lib/format";
import { deleteQuote, hasIndexedDb, listQuotes, type Quote } from "@/lib/quotes";
import { readActiveId, writeActiveId, writeState } from "@/lib/storage";

const when = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

export function SavedQuotesPage() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = hasIndexedDb() ? listQuotes() : Promise.reject(new Error("Sin IndexedDB"));
    load
      .then((list) => {
        if (cancelled) return;
        setQuotes(list);
        setActiveId(readActiveId());
      })
      .catch(() => {
        if (!cancelled) {
          setAvailable(false);
          setQuotes([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Hand the quote to the calculator through the same storage it restores from.
  const load = (q: Quote) => {
    writeState({ input: q.input, currency: q.currency });
    writeActiveId(q.id);
    router.push("/");
  };

  const remove = async (q: Quote) => {
    if (!window.confirm(`¿Borrar "${q.name}"?`)) return;
    try {
      await deleteQuote(q.id);
      setQuotes((prev) => (prev ?? []).filter((x) => x.id !== q.id));
      if (activeId === q.id) {
        setActiveId(null);
        writeActiveId(null);
      }
    } catch {
      window.alert("No se pudo borrar el presupuesto.");
    }
  };

  const exportCsv = () => {
    const blob = new Blob([quotesToCsv(quotes ?? [])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const list = quotes ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-8 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm">
            <Link href="/" className="text-accent-ink font-medium hover:underline">
              ← Volver a la calculadora
            </Link>
          </p>
          <h1 className="display text-3xl sm:text-4xl font-semibold leading-none mt-3">Presupuestos guardados</h1>
          <p className="mt-2 text-ink-2 text-base sm:text-lg leading-snug">
            {available
              ? "Quedan en este navegador. Exportalos a CSV para abrirlos en Excel o Sheets."
              : "Este navegador no permite guardar datos locales."}
          </p>
        </div>
        <button type="button" className="btn" onClick={exportCsv} disabled={list.length === 0}>
          Exportar CSV
        </button>
      </header>

      {quotes === null ? (
        <p className="mt-8 text-sm text-ink-3">Cargando…</p>
      ) : list.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line px-4 py-8 text-sm text-ink-2 text-center">
          Todavía no guardaste ninguno.{" "}
          <Link href="/" className="text-accent-ink font-medium hover:underline">
            Calculá una pieza
          </Link>{" "}
          y tocá &ldquo;Guardar presupuesto&rdquo;.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-line bg-ticket">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-2 border-b border-line">
                <th className="font-medium px-3 py-2.5">Fecha</th>
                <th className="font-medium px-3 py-2.5">Nombre</th>
                <th className="font-medium px-3 py-2.5">Pieza</th>
                <th className="font-medium px-3 py-2.5 text-right">Costo</th>
                <th className="font-medium px-3 py-2.5 text-right">Precio</th>
                <th className="px-3 py-2.5">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((q) => {
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
                    <td className="px-3 py-2.5 font-medium max-w-[16rem] truncate">
                      {q.name}
                      {active ? <span className="ml-1.5 text-xs font-normal text-ink-3">en el form</span> : null}
                    </td>
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
                      <button type="button" className="btn btn-primary px-2.5 py-1.5 text-xs" onClick={() => load(q)}>
                        Cargar
                      </button>
                      <button
                        type="button"
                        className="btn px-2.5 py-1.5 text-xs ml-1.5"
                        aria-label={`Borrar ${q.name}`}
                        onClick={() => remove(q)}
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
    </div>
  );
}
