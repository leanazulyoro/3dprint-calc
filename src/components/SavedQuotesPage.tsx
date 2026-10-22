"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_INPUT, MATERIALS } from "@/lib/calc";
import { csvFilename, csvToQuotes, quotesToCsv } from "@/lib/csv";
import { localRepo, useData } from "@/lib/data-context";
import { hasIndexedDb } from "@/lib/db";
import { hostOf, hoursLabel, isUrlLike, money, toHref } from "@/lib/format";
import { migrateQuotes } from "@/lib/migrate";
import { printerFields, type Printer } from "@/lib/printers";
import { daysSinceSaved, isStale, withPrinter, type Quote } from "@/lib/quotes";
import { readActiveId, writeActiveId, writePrinterId, writeState } from "@/lib/storage";
import { Skeleton } from "./Skeleton";

const when = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

export function SavedQuotesPage() {
  const router = useRouter();
  const { repo, mode, ready, workshop, setSavedCount } = useData();
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [localCount, setLocalCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    const [ps, qs] = await Promise.all([repo.listPrinters(), repo.listQuotes()]);
    setPrinters(ps);
    setQuotes(qs);
    setSavedCount(qs.length);
  };

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    const load = hasIndexedDb() || mode === "remote" ? Promise.all([repo.listPrinters(), repo.listQuotes()]) : Promise.reject(new Error("Este navegador no permite guardar datos locales."));
    load
      .then(([ps, qs]) => {
        if (cancelled) return;
        setPrinters(ps);
        setQuotes(qs);
        setSavedCount(qs.length);
        setError(null);
        setActiveId(readActiveId());
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "No se pudieron cargar los presupuestos");
        setQuotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repo, mode, ready, setSavedCount]);

  // Logged in: anything still in this browser can be moved to the workshop.
  useEffect(() => {
    if (mode !== "remote" || !hasIndexedDb()) return;
    let cancelled = false;
    localRepo
      .listQuotes()
      .then((qs) => {
        if (!cancelled) setLocalCount(qs.length);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Hand the quote to the calculator through the same storage it restores from.
  const load = (q: Quote) => {
    const p = q.printerId ? printers.find((x) => x.id === q.printerId) : undefined;
    const fields = p ? printerFields(p) : (q.legacyPrinter ?? DEFAULT_INPUT);
    writeState({ input: withPrinter({ ...DEFAULT_INPUT, ...q.input }, fields), currency: q.currency });
    writePrinterId(p?.id ?? null);
    writeActiveId(q.id);
    router.push("/");
  };

  const remove = async (q: Quote) => {
    if (!window.confirm(`¿Borrar "${q.name}"?`)) return;
    try {
      await repo.deleteQuote(q.id);
      const rest = (quotes ?? []).filter((x) => x.id !== q.id);
      setQuotes(rest);
      setSavedCount(rest.length);
      if (activeId === q.id) {
        setActiveId(null);
        writeActiveId(null);
      }
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "No se pudo borrar el presupuesto.");
    }
  };

  const exportCsv = () => {
    const blob = new Blob([quotesToCsv(quotes ?? [], printers)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    setNotice("Importando…");
    setBusy(true);
    try {
      const { quotes: parsed, printers: created, errors } = csvToQuotes(await file.text(), printers);
      for (const p of created) await repo.putPrinter(p);
      const existing = new Set((quotes ?? []).map((q) => q.id));
      let added = 0;
      let updated = 0;
      for (const q of parsed) {
        await repo.putQuote(q);
        if (existing.has(q.id)) updated++;
        else added++;
      }
      await reload();
      const parts = [];
      if (added) parts.push(`${added} ${added === 1 ? "nuevo" : "nuevos"}`);
      if (updated) parts.push(`${updated} ${updated === 1 ? "actualizado" : "actualizados"}`);
      if (created.length) parts.push(`${created.length} ${created.length === 1 ? "impresora nueva" : "impresoras nuevas"}`);
      if (errors.length) {
        const detail = errors
          .slice(0, 3)
          .map((e) => `línea ${e.line}: ${e.message}`)
          .join("; ");
        parts.push(`${errors.length} con error (${detail}${errors.length > 3 ? "…" : ""})`);
      }
      setNotice(parts.length ? `Importación: ${parts.join(", ")}.` : "El archivo no tenía filas.");
    } catch (e) {
      setNotice(e instanceof Error && e.message ? `No se pudo importar: ${e.message}` : "No se pudo importar.");
    } finally {
      setBusy(false);
    }
  };

  // Move what this browser holds into the workshop.
  const migrateLocal = async () => {
    if (!window.confirm(`¿Subir ${localCount} presupuestos de este navegador al taller? Se mueven: dejan de estar solo acá.`)) return;
    setBusy(true);
    setNotice("Subiendo…");
    try {
      const { moved, printersCreated } = await migrateQuotes(localRepo, repo);
      setLocalCount(0);
      await reload();
      setNotice(
        `Listo: ${moved} ${moved === 1 ? "presupuesto subido" : "presupuestos subidos"} al taller${
          printersCreated ? `, ${printersCreated} ${printersCreated === 1 ? "impresora nueva" : "impresoras nuevas"}` : ""
        }.`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? `No se pudo subir: ${e.message}` : "No se pudo subir.");
    } finally {
      setBusy(false);
    }
  };

  const list = quotes ?? [];

  const describe = (q: Quote) => {
    const r = q.result;
    return {
      r,
      material: MATERIALS.find((m) => m.id === q.input.material)?.label ?? q.input.material,
      final: r.ml ? r.ml.listTotal : r.priceWithVat,
      tag: r.ml ? "en ML" : q.input.vatEnabled ? "con IVA" : null,
      printerName: (q.printerId && printers.find((p) => p.id === q.printerId)?.name) || q.printerName,
      active: q.id === activeId,
      stale: isStale(q),
    };
  };

  const modelLine = (q: Quote, className: string) =>
    q.input.modelRef?.trim() ? (
      isUrlLike(q.input.modelRef) ? (
        <a
          href={toHref(q.input.modelRef)}
          target="_blank"
          rel="noreferrer"
          className={`block truncate text-xs font-normal text-accent-ink hover:underline ${className}`}
          title={q.input.modelRef}
        >
          modelo en {hostOf(q.input.modelRef)} ↗
        </a>
      ) : (
        <span className={`block truncate text-xs font-normal text-ink-3 ${className}`} title={q.input.modelRef}>
          {q.input.modelRef.trim()}
        </span>
      )
    ) : null;

  const staleTag = (q: Quote) => (
    <span
      className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color:var(--l-energy)]/15 px-2 py-0.5 text-xs font-medium text-ink"
      title={`Sin cambios hace ${daysSinceSaved(q)} días`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[color:var(--l-energy)]" />
      Desactualizado, verificar precios de filamentos
    </span>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-8 pb-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm">
            <Link href="/" className="text-accent-ink font-medium hover:underline">
              ← Volver a la calculadora
            </Link>
          </p>
          <h1 className="display text-3xl sm:text-4xl font-semibold leading-none mt-3">Presupuestos guardados</h1>
          <p className="mt-2 text-ink-2 text-base sm:text-lg leading-snug">
            {mode === "remote"
              ? `Compartidos en el taller${workshop ? ` "${workshop.name}"` : ""}. Los ve cualquier miembro, desde cualquier dispositivo.`
              : "Quedan en este navegador. Exportalos a CSV para abrirlos en Excel o Sheets, o iniciá sesión para compartirlos entre dispositivos."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" disabled={busy || Boolean(error)} onClick={() => fileRef.current?.click()}>
              Importar CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void importCsv(file);
              }}
            />
            <button type="button" className="btn" onClick={exportCsv} disabled={list.length === 0}>
              Exportar CSV
            </button>
          </div>
        </div>
      </header>

      {mode === "remote" && localCount > 0 ? (
        <p className="mt-4 flex flex-wrap items-center gap-3 rounded-md border border-line bg-accent-soft/40 px-3 py-2 text-sm">
          <span>
            Tenés {localCount} {localCount === 1 ? "presupuesto guardado" : "presupuestos guardados"} solo en este navegador.
          </span>
          <button type="button" className="btn py-1.5 text-xs" disabled={busy} onClick={() => void migrateLocal()}>
            Subir al taller
          </button>
        </p>
      ) : null}

      {notice ? (
        <p role="status" className="mt-4 text-sm text-ink-2">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-ink">
          {error}
        </p>
      ) : null}

      {quotes === null ? (
        <div className="mt-8 overflow-hidden rounded-lg border border-line bg-ticket" aria-busy="true" aria-label="Cargando presupuestos">
          <div className="flex gap-6 border-b border-line px-3 py-3">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="ml-auto h-3.5 w-14" />
            <Skeleton className="h-3.5 w-16" />
          </div>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-6 border-b border-line/60 px-3 py-3 last:border-b-0">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="ml-auto h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line px-4 py-8 text-sm text-ink-2 text-center">
          Todavía no guardaste ninguno.{" "}
          <Link href="/" className="text-accent-ink font-medium hover:underline">
            Calculá una pieza
          </Link>{" "}
          y tocá &ldquo;Guardar presupuesto&rdquo;.
        </p>
      ) : (
        <>
        <div className="sm:hidden mt-6 flex flex-col gap-3">
          {list.map((q) => {
            const { r, material, final, tag, printerName, active, stale } = describe(q);
            return (
              <article
                key={q.id}
                className={`rounded-lg border bg-ticket p-4 ${active ? "border-accent/50 bg-accent-soft/40" : "border-line"}`}
                aria-label={q.name}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium" title={q.input.description?.trim() || undefined}>
                      {q.name}
                    </p>
                    <p className="num mt-0.5 text-xs text-ink-3">
                      {when.format(q.createdAt)}
                      {active ? ", en el form" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num font-semibold">{money(final, q.currency)}</p>
                    <p className="text-xs text-ink-3">
                      {tag ? `${tag}, ` : ""}costo {money(r.cost, q.currency)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-sm text-ink-2">
                  {material}, {q.input.grams} g, {hoursLabel(r.printHours)}
                  {q.input.quantity > 1 ? `, ${q.input.quantity} u.` : ""}
                  {printerName ? `, ${printerName}` : ""}
                </p>
                {modelLine(q, "mt-1")}
                {stale ? staleTag(q) : null}
                <div className="mt-3 flex gap-2">
                  <button type="button" className="btn btn-primary grow py-2.5" onClick={() => load(q)}>
                    Cargar
                  </button>
                  <button type="button" className="btn py-2.5 px-4" aria-label={`Borrar ${q.name}`} onClick={() => remove(q)}>
                    Borrar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden sm:block mt-8 overflow-x-auto rounded-lg border border-line bg-ticket">
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
                const { r, material, final, tag, printerName, active, stale } = describe(q);
                return (
                  <tr
                    key={q.id}
                    className={`border-b border-line/60 last:border-b-0 ${active ? "bg-accent-soft/60" : ""}`}
                  >
                    <td className="px-3 py-2.5 num whitespace-nowrap text-ink-2">{when.format(q.createdAt)}</td>
                    <td className="px-3 py-2.5 font-medium max-w-[18rem]">
                      <span className="block truncate" title={q.input.description?.trim() || undefined}>
                        {q.name}
                        {active ? <span className="ml-1.5 text-xs font-normal text-ink-3">en el form</span> : null}
                      </span>
                      {modelLine(q, "")}
                      {stale ? staleTag(q) : null}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink-2">
                      {material}, {q.input.grams} g, {hoursLabel(r.printHours)}
                      {q.input.quantity > 1 ? `, ${q.input.quantity} u.` : ""}
                      {printerName ? <span className="block text-xs text-ink-3">{printerName}</span> : null}
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
        </>
      )}
    </div>
  );
}
