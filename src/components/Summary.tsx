"use client";

import { useState } from "react";
import type { CalcInput, CalcResult } from "@/lib/calc";
import { MATERIALS, ML_FEES_VAT, ML_INSTALLMENTS } from "@/lib/calc";
import { hoursLabel, money, percent, type CurrencyCode } from "@/lib/format";
import { LayerStack, type Layer } from "./LayerStack";

type Props = {
  input: CalcInput;
  result: CalcResult;
  currency: CurrencyCode;
  onCopyText: () => Promise<void> | void;
  onCopyLink: () => Promise<void> | void;
};

export function buildLayers(r: CalcResult, failureRate: number): Layer[] {
  return [
    { key: "material", label: "Material", value: r.material, color: "var(--l-material)" },
    { key: "energy", label: "Electricidad", value: r.energy, color: "var(--l-energy)" },
    { key: "wear", label: "Desgaste de impresora", value: r.wear, color: "var(--l-wear)" },
    { key: "failure", label: `Margen de fallos ${percent(failureRate)}`, value: r.failure, color: "var(--l-failure)" },
    { key: "labor", label: "Mano de obra", value: r.labor, color: "var(--l-labor)" },
    { key: "extras", label: "Extras", value: r.extras, color: "var(--l-extras)" },
  ];
}

export function Summary({ input, result: r, currency, onCopyText, onCopyLink }: Props) {
  const [flash, setFlash] = useState<string | null>(null);
  const layers = buildLayers(r, input.failureRate);
  const material = MATERIALS.find((m) => m.id === input.material)?.label ?? input.material;
  const qty = Math.max(1, Math.floor(input.quantity) || 1);
  const fmt = (v: number) => money(v, currency);

  const flashThen = async (label: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      setFlash(label);
    } catch {
      setFlash("No se pudo copiar");
    }
    window.setTimeout(() => setFlash(null), 1600);
  };

  return (
    <aside
      id="resumen"
      className="ticket rounded-xl border border-line bg-ticket p-5 sm:p-6 shadow-[0_1px_0_var(--line)]"
      aria-label="Resumen del presupuesto"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="display text-lg font-semibold leading-tight">
          {input.name.trim() || "Presupuesto"}
        </h2>
        <p className="text-sm text-ink-2">
          {material}, {Number.isFinite(input.grams) ? input.grams : 0} g, {hoursLabel(r.printHours)}
        </p>
      </header>

      <div className="mt-5">
        <p className="text-sm text-ink-2">Costo real</p>
        <p className="display num text-4xl font-semibold leading-none mt-1">{fmt(r.cost)}</p>
      </div>

      <div className="mt-4">
        <LayerStack layers={layers} total={r.cost} />
      </div>

      <dl className="mt-4 text-sm">
        {layers.map((l) => {
          const optional = l.key === "labor" || l.key === "extras";
          if (optional && l.value <= 0) return null;
          return (
            <div key={l.key} className="flex items-center gap-2.5 py-1.5 border-b border-line/60 last:border-b-0">
              <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] shrink-0" style={{ background: l.color }} />
              <dt className="text-ink-2 grow">{l.label}</dt>
              <dd className="num">{fmt(l.value)}</dd>
            </div>
          );
        })}
      </dl>

      <div className="mt-5 pt-5 border-t-2 border-dashed border-line">
        <p className="text-sm text-ink-2">Precio sugerido</p>
        <p className="display num text-4xl sm:text-5xl font-semibold leading-none mt-1 text-accent-ink">
          {fmt(r.price)}
        </p>
        <p className="mt-2 text-sm text-ink-2">
          Impresión ×{Number.isFinite(input.multiplier) ? input.multiplier : 1}
          {r.labor + r.extras > 0 ? ", más mano de obra y extras" : ""}
          {r.extrasMarkup > 0 ? ` (extras +${percent(input.extrasMarkup)})` : ""}. Ganancia{" "}
          <span className="num text-ok font-medium">{fmt(r.profit)}</span>.
        </p>
        {qty > 1 ? (
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-paper px-3 py-2">
              <dt className="text-ink-2">Costo por unidad</dt>
              <dd className="num font-semibold mt-0.5">{fmt(r.costPerUnit)}</dd>
            </div>
            <div className="rounded-md bg-paper px-3 py-2">
              <dt className="text-ink-2">Precio por unidad</dt>
              <dd className="num font-semibold mt-0.5">{fmt(r.pricePerUnit)}</dd>
            </div>
          </dl>
        ) : null}
        {input.vatEnabled ? (
          <dl className="mt-3 text-sm">
            <div className="flex items-center gap-2.5 py-1.5 border-b border-line/60">
              <dt className="text-ink-2 grow">IVA {percent(input.vatRate)}{qty > 1 ? ", por unidad" : ""}</dt>
              <dd className="num">{fmt(r.vat)}</dd>
            </div>
            <div className="flex items-center gap-2.5 py-1.5">
              <dt className="text-ink-2 grow">Precio con IVA{qty > 1 ? ", por unidad" : ""}</dt>
              <dd className="num font-semibold">{fmt(r.pricePerUnitWithVat)}</dd>
            </div>
            {qty > 1 ? (
              <div className="flex items-center gap-2.5 py-1.5 border-t border-line/60">
                <dt className="text-ink-2 grow">Total con IVA, {qty} unidades</dt>
                <dd className="num font-semibold">{fmt(r.priceWithVat)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </div>

      {r.ml ? (
        <div className="mt-5 rounded-lg bg-paper p-4">
          <p className="text-sm text-ink-2">Publicalo en Mercado Libre a{qty > 1 ? ", por unidad" : ""}</p>
          <p className="display num text-3xl font-semibold leading-none mt-1">{fmt(r.ml.listPrice)}</p>
          <dl className="mt-3 text-sm">
            <div className="flex items-center gap-2.5 py-1 border-b border-line/60">
              <dt className="text-ink-2 grow">Cargo por vender {percent(input.mlCommission)}</dt>
              <dd className="num">{fmt(r.ml.commission)}</dd>
            </div>
            {r.ml.installments > 0 ? (
              <div className="flex items-center gap-2.5 py-1 border-b border-line/60">
                <dt className="text-ink-2 grow">
                  {ML_INSTALLMENTS.find((o) => o.id === input.mlInstallments)?.label ?? "Cuotas"}
                </dt>
                <dd className="num">{fmt(r.ml.installments)}</dd>
              </div>
            ) : null}
            {r.ml.fixedFee > 0 ? (
              <div className="flex items-center gap-2.5 py-1 border-b border-line/60">
                <dt className="text-ink-2 grow">Costo por unidad vendida</dt>
                <dd className="num">{fmt(r.ml.fixedFee)}</dd>
              </div>
            ) : null}
            {r.ml.feesVat > 0 ? (
              <div className="flex items-center gap-2.5 py-1 border-b border-line/60">
                <dt className="text-ink-2 grow">IVA {percent(ML_FEES_VAT)} sobre cargos</dt>
                <dd className="num">{fmt(r.ml.feesVat)}</dd>
              </div>
            ) : null}
            <div className="flex items-center gap-2.5 py-1.5">
              <dt className="text-ink-2 grow">Te queda</dt>
              <dd className="num font-semibold text-ok">{fmt(r.ml.net)}</dd>
            </div>
            {qty > 1 ? (
              <div className="flex items-center gap-2.5 py-1.5 border-t border-line/60">
                <dt className="text-ink-2 grow">Total publicado, {qty} unidades</dt>
                <dd className="num font-semibold">{fmt(r.ml.listTotal)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div className="no-print mt-6 flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={() => flashThen("Resumen copiado", onCopyText)}>
          Copiar resumen
        </button>
        <button type="button" className="btn" onClick={() => flashThen("Link copiado", onCopyLink)}>
          Copiar link
        </button>
        <button type="button" className="btn" onClick={() => window.print()}>
          Imprimir
        </button>
        <span role="status" aria-live="polite" className="self-center text-sm text-ok font-medium min-h-5">
          {flash}
        </span>
      </div>
    </aside>
  );
}
