import { PRINTER_FIELDS, type CalcInput, type CalcResult, type PrinterFields, type QuoteInput } from "./calc";
import { newId } from "./db";
import type { CurrencyCode } from "./format";

/** A saved calculation: inputs plus the result as it was at save time. The printer is a reference. */
export type Quote = {
  id: string;
  createdAt: number;
  updatedAt: number;
  name: string;
  currency: CurrencyCode;
  printerId: string | null;
  printerName: string;
  input: QuoteInput;
  result: CalcResult;
  /** Quotes saved before printers had their own table carried the numbers inline. */
  legacyPrinter?: PrinterFields;
};

export const newQuoteId = newId;

export function stripPrinter(input: CalcInput): QuoteInput {
  const copy: Partial<CalcInput> = { ...input };
  for (const k of PRINTER_FIELDS) delete copy[k];
  return copy as QuoteInput;
}

export function withPrinter(input: QuoteInput, p: PrinterFields): CalcInput {
  return { ...input, watts: p.watts, printerPrice: p.printerPrice, printerLifeHours: p.printerLifeHours };
}

/** Accepts rows written by any previous version of the app. */
export function normalizeQuote(raw: unknown): Quote {
  const r = (raw ?? {}) as Record<string, unknown>;
  const input = ((r.input ?? {}) as Record<string, unknown>) as CalcInput;
  const hasLegacy = PRINTER_FIELDS.every((k) => typeof input[k] === "number");
  return {
    id: String(r.id),
    createdAt: Number(r.createdAt) || 0,
    updatedAt: Number(r.updatedAt) || Number(r.createdAt) || 0,
    name: String(r.name ?? ""),
    currency: (r.currency as CurrencyCode) ?? "ARS",
    printerId: typeof r.printerId === "string" ? r.printerId : null,
    printerName: typeof r.printerName === "string" ? r.printerName : "",
    input: stripPrinter(input),
    result: r.result as CalcResult,
    legacyPrinter: hasLegacy
      ? { watts: input.watts, printerPrice: input.printerPrice, printerLifeHours: input.printerLifeHours }
      : (r.legacyPrinter as PrinterFields | undefined),
  };
}
