import {
  DEFAULT_INPUT,
  MATERIALS,
  ML_INSTALLMENTS,
  calculate,
  type CalcInput,
  type MaterialId,
  type MlInstallments,
} from "./calc";
import { isCurrency, type CurrencyCode } from "./format";
import { newQuoteId, type Quote } from "./quotes";

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
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
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
  "ml_iva_cargos",
  "ml_precio_publicar_unidad",
  "ml_cargos_unidad",
  "ml_total",
  "id",
] as const;

type Column = (typeof CSV_COLUMNS)[number];

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
    ml ? i.mlFeesVat : null,
    ml ? ml.listPrice : null,
    ml ? ml.totalFees : null,
    ml ? ml.listTotal : null,
    q.id,
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

/* ---------- Import ---------- */

/** RFC 4180-style parser; separator is whatever the header uses. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (quoted) {
      if (c === '"') {
        if (src[k + 1] === '"') {
          field += '"';
          k++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[k + 1] === "\n") k++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/** "1.234,50" and "1234.50" both become 1234.5. */
function toNumber(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  let t = raw.trim().replace(/\s/g, "");
  if (t === "") return null;
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else if (t.includes(",")) t = t.replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function toBool(raw: string | undefined): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  return t === "si" || t === "sí" || t === "true" || t === "1" || t === "yes" || t === "x";
}

function toDate(raw: string | undefined, fallback: number): number {
  const t = (raw ?? "").trim();
  if (!t) return fallback;
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ ,T]+(\d{1,2}):(\d{2}))?/);
  if (dmy) {
    const year = dmy[3].length === 2 ? 2000 + Number(dmy[3]) : Number(dmy[3]);
    const d = new Date(year, Number(dmy[2]) - 1, Number(dmy[1]), Number(dmy[4] ?? 0), Number(dmy[5] ?? 0));
    return Number.isNaN(d.getTime()) ? fallback : d.getTime();
  }
  const iso = Date.parse(t.replace(" ", "T"));
  return Number.isNaN(iso) ? fallback : iso;
}

export type ImportResult = {
  quotes: Quote[];
  errors: { line: number; message: string }[];
};

/**
 * Rebuild quotes from a CSV exported here (or edited in a spreadsheet).
 * Results are recomputed with the current formula; rows carrying an `id`
 * keep it so re-importing updates instead of duplicating.
 */
export function csvToQuotes(text: string, now = Date.now()): ImportResult {
  const rows = parseCsv(text);
  const errors: ImportResult["errors"] = [];
  if (rows.length === 0) return { quotes: [], errors: [{ line: 1, message: "El archivo está vacío" }] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name: Column) => header.indexOf(name);
  const required: Column[] = ["material", "gramos", "horas_impresion"];
  const missing = required.filter((c) => col(c) < 0);
  if (missing.length > 0) {
    return { quotes: [], errors: [{ line: 1, message: `Faltan columnas: ${missing.join(", ")}` }] };
  }

  const quotes: Quote[] = [];
  rows.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const get = (name: Column) => {
      const i = col(name);
      return i >= 0 ? cells[i] : undefined;
    };
    const num = (name: Column, fallback: number) => toNumber(get(name)) ?? fallback;

    const materialRaw = (get("material") ?? "").trim().toUpperCase();
    if (!MATERIALS.some((m) => m.id === materialRaw)) {
      errors.push({ line, message: `Material desconocido "${get("material") ?? ""}"` });
      return;
    }
    const grams = toNumber(get("gramos"));
    const printHours = toNumber(get("horas_impresion"));
    if (grams === null || grams < 0 || printHours === null || printHours < 0) {
      errors.push({ line, message: "Gramos u horas inválidos" });
      return;
    }
    const hours = Math.floor(printHours);
    const minutes = Math.round((printHours - hours) * 60);

    const installmentsRaw = (get("ml_cuotas") ?? "").trim();
    const installments =
      ML_INSTALLMENTS.find((o) => o.id === installmentsRaw || o.label === installmentsRaw)?.id ??
      DEFAULT_INPUT.mlInstallments;

    const input: CalcInput = {
      ...DEFAULT_INPUT,
      name: (get("nombre") ?? "").trim(),
      material: materialRaw as MaterialId,
      grams,
      hours,
      minutes,
      pricePerKg: num("precio_filamento_kg", DEFAULT_INPUT.pricePerKg),
      watts: num("consumo_w", DEFAULT_INPUT.watts),
      kwhPrice: num("precio_kwh", DEFAULT_INPUT.kwhPrice),
      printerPrice: num("precio_impresora", DEFAULT_INPUT.printerPrice),
      printerLifeHours: num("vida_util_h", DEFAULT_INPUT.printerLifeHours),
      failureRate: num("margen_fallos_pct", DEFAULT_INPUT.failureRate),
      laborRate: num("valor_hora", 0),
      laborHours: num("horas_trabajo", 0),
      extras: num("extras", 0),
      extrasMarkup: num("recargo_extras_pct", 0),
      multiplier: num("margen", DEFAULT_INPUT.multiplier),
      quantity: num("cantidad", 1),
      vatEnabled: toBool(get("iva")),
      vatRate: num("iva_pct", DEFAULT_INPUT.vatRate),
      mlEnabled: toBool(get("mercado_libre")),
      mlCommission: num("ml_cargo_pct", DEFAULT_INPUT.mlCommission),
      mlInstallments: installments as MlInstallments,
      mlFeesVat: get("ml_iva_cargos") === undefined ? DEFAULT_INPUT.mlFeesVat : toBool(get("ml_iva_cargos")),
    };
    const currencyRaw = (get("moneda") ?? "ARS").trim().toUpperCase();
    const currency: CurrencyCode = isCurrency(currencyRaw) ? currencyRaw : "ARS";
    if (currency !== "ARS") input.mlEnabled = false;

    const id = (get("id") ?? "").trim() || newQuoteId();
    const createdAt = toDate(get("fecha"), now);
    quotes.push({
      id,
      createdAt,
      updatedAt: now,
      name: input.name || `Importado ${line - 1}`,
      currency,
      input,
      result: calculate(input),
    });
  });

  return { quotes, errors };
}
