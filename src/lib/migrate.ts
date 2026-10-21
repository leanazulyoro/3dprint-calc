import { isUuid, newId } from "./db";
import { findPrinterByName, matchPrinter, printerFromFields, type Printer } from "./printers";
import type { Repo } from "./repo";

/**
 * Move every quote from one store to another. Printers travel only when a
 * quote uses them, and are matched in the target by name, then by numbers,
 * before a new one is created.
 */
export async function migrateQuotes(from: Repo, to: Repo): Promise<{ moved: number; printersCreated: number }> {
  const [fromPrinters, fromQuotes, toPrinters] = await Promise.all([from.listPrinters(), from.listQuotes(), to.listPrinters()]);
  const resolved = new Map<string, Printer>();
  let printersCreated = 0;

  const resolve = async (source: Printer): Promise<Printer> => {
    const cached = resolved.get(source.id);
    if (cached) return cached;
    let target = findPrinterByName(toPrinters, source.name) ?? matchPrinter(toPrinters, { watts: source.watts, printerPrice: source.price, printerLifeHours: source.lifeHours });
    if (!target) {
      target = { ...source, id: newId() };
      await to.putPrinter(target);
      toPrinters.push(target);
      printersCreated++;
    }
    resolved.set(source.id, target);
    return target;
  };

  let moved = 0;
  for (const q of fromQuotes) {
    let printer: Printer | undefined;
    const own = q.printerId ? fromPrinters.find((p) => p.id === q.printerId) : undefined;
    if (own) {
      printer = await resolve(own);
    } else if (q.legacyPrinter) {
      // Saved before printers had a table: find one with the same numbers, else create it.
      printer = matchPrinter(toPrinters, q.legacyPrinter) ?? findPrinterByName(toPrinters, q.printerName);
      if (!printer) {
        printer = printerFromFields(q.printerName || "Impresora", q.legacyPrinter);
        await to.putPrinter(printer);
        toPrinters.push(printer);
        printersCreated++;
      }
    }
    await to.putQuote({
      ...q,
      id: isUuid(q.id) ? q.id : newId(),
      printerId: printer?.id ?? null,
      printerName: printer?.name ?? q.printerName,
      legacyPrinter: undefined,
    });
    await from.deleteQuote(q.id);
    moved++;
  }
  return { moved, printersCreated };
}
