import { ML_INSTALLMENTS } from "./calc";
import type { Quote } from "./quotes";

/**
 * CSV for Excel and Sheets in es-AR: semicolon separator, decimal comma,
 * UTF-8 BOM so accents survive a double click in Excel.
 */
const SEP = ";";

function cell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? v.toFixed(2).replace(".", ",") : "";
  if (typeof v === "boolean") return v ? "si" : "no";
  const needsQuotes = /[";\n\r]/.test(v);
  return needsQuotes ? `"${v.replace(/"/g, '""')}"` : v;
}

function stamp(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const CSV_COLUMNS = [
  "fecha",
  "nombre",
  "moneda",
  "material",
  "gramos",
  "horas_impresion",
  "precio_filamento_kg",
  "consumo_w",
  "precio_kwh",
  "precio_impresora",
  "vida_util_h",
  "margen_fallos_pct",
  "valor_hora",
  "horas_trabajo",
  "extras",
  "recargo_extras_pct",
  "margen",
  "cantidad",
  "costo_material",
  "costo_electricidad",
  "costo_desgaste",
  "costo_fallos",
  "costo_mano_obra",
  "costo_extras",
  "costo_total",
  "costo_unidad",
  "precio_sugerido",
  "precio_unidad",
  "ganancia",
  "iva",
  "iva_pct",
  "precio_con_iva",
  "mercado_libre",
  "ml_cargo_pct",
  "ml_cuotas",
  "ml_precio_publicar_unidad",
  "ml_cargos_unidad",
  "ml_total",
] as const;

export function quoteToRow(q: Quote): (string | number | boolean | null)[] {
  const i = q.input;
  const r = q.result;
  const ml = r.ml;
  return [
    stamp(q.createdAt),
    q.name,
    q.currency,
    i.material,
    i.grams,
    r.printHours,
    i.pricePerKg,
    i.watts,
    i.kwhPrice,
    i.printerPrice,
    i.printerLifeHours,
    i.failureRate,
    i.laborRate,
    i.laborHours,
    i.extras,
    i.extrasMarkup,
    i.multiplier,
    i.quantity,
    r.material,
    r.energy,
    r.wear,
    r.failure,
    r.labor,
    r.extras,
    r.cost,
    r.costPerUnit,
    r.price,
    r.pricePerUnit,
    r.profit,
    i.vatEnabled,
    i.vatEnabled ? i.vatRate : null,
    i.vatEnabled ? r.priceWithVat : null,
    ml !== null,
    ml ? i.mlCommission : null,
    ml ? (ML_INSTALLMENTS.find((o) => o.id === i.mlInstallments)?.label ?? i.mlInstallments) : null,
    ml ? ml.listPrice : null,
    ml ? ml.totalFees : null,
    ml ? ml.listTotal : null,
  ];
}

export function quotesToCsv(quotes: Quote[]): string {
  const lines = [CSV_COLUMNS.join(SEP), ...quotes.map((q) => quoteToRow(q).map(cell).join(SEP))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function csvFilename(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `presupuestos-3d-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.csv`;
}
