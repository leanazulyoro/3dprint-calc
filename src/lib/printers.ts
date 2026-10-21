import { DEFAULT_INPUT, DEFAULT_PRINTER_NAME, type PrinterFields } from "./calc";
import { newId } from "./db";

export type Printer = {
  id: string;
  name: string;
  watts: number;
  price: number;
  lifeHours: number;
  createdAt: number;
  updatedAt: number;
};

export function printerFields(p: Printer): PrinterFields {
  return { watts: p.watts, printerPrice: p.price, printerLifeHours: p.lifeHours };
}

export function printerFromFields(name: string, f: PrinterFields, now = Date.now()): Printer {
  const n = (v: number) => (Number.isFinite(v) ? v : 0);
  return {
    id: newId(),
    name: name.trim() || "Impresora",
    watts: n(f.watts),
    price: n(f.printerPrice),
    lifeHours: n(f.printerLifeHours),
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultPrinter(now = Date.now()): Printer {
  return printerFromFields(DEFAULT_PRINTER_NAME, DEFAULT_INPUT, now);
}

/** A printer whose numbers equal the given ones (shared links carry numbers, not ids). */
export function matchPrinter(printers: Printer[], f: PrinterFields): Printer | undefined {
  return printers.find((p) => p.watts === f.watts && p.price === f.printerPrice && p.lifeHours === f.printerLifeHours);
}

export function findPrinterByName(printers: Printer[], name: string): Printer | undefined {
  const needle = name.trim().toLowerCase();
  return needle ? printers.find((p) => p.name.trim().toLowerCase() === needle) : undefined;
}
