import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, calculate } from "./calc";
import { CSV_COLUMNS, csvToQuotes, parseCsv, quoteToRow, quotesToCsv } from "./csv";
import { newId } from "./db";
import { defaultPrinter, matchPrinter, printerFields, printerFromFields, type Printer } from "./printers";
import { STALE_AFTER_DAYS, daysSinceSaved, isStale, normalizeQuote, stripPrinter, withPrinter, type Quote } from "./quotes";
import { migrateQuotes } from "./migrate";
import { LocalRepo } from "./repo";

const printer: Printer = defaultPrinter("11111111-1111-4111-8111-111111111111", 1_700_000_000_000);

function makeQuote(over: Partial<Quote> = {}, inputOver: Partial<Quote["input"]> = {}): Quote {
  const input = stripPrinter({ ...DEFAULT_INPUT, name: "Llavero; \"test\"", grams: 120, ...inputOver });
  return {
    id: newId(),
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    name: input.name,
    currency: "ARS",
    printerId: printer.id,
    printerName: printer.name,
    input,
    result: calculate(withPrinter(input, printerFields(printer))),
    ...over,
  };
}

describe("local repo", () => {
  const repo = new LocalRepo();

  it("saves, lists newest first, updates and deletes quotes", async () => {
    const a = makeQuote({ createdAt: 1 });
    const b = makeQuote({ createdAt: 2 });
    await repo.putQuote(a);
    await repo.putQuote(b);
    expect((await repo.listQuotes()).map((q) => q.id)).toEqual([b.id, a.id]);

    await repo.putQuote({ ...a, name: "Renombrado" });
    expect((await repo.listQuotes()).find((q) => q.id === a.id)?.name).toBe("Renombrado");

    await repo.deleteQuote(a.id);
    await repo.deleteQuote(b.id);
    expect(await repo.listQuotes()).toEqual([]);
  });

  it("stores printers oldest first", async () => {
    const p1 = printerFromFields("Ender", DEFAULT_INPUT, 2);
    const p2 = printerFromFields("A1", DEFAULT_INPUT, 1);
    await repo.putPrinter(p1);
    await repo.putPrinter(p2);
    expect((await repo.listPrinters()).map((p) => p.name)).toEqual(["A1", "Ender"]);
    await repo.deletePrinter(p1.id);
    await repo.deletePrinter(p2.id);
    expect(await repo.listPrinters()).toEqual([]);
  });

  it("generates uuids", () => {
    expect(newId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(newId()).not.toBe(newId());
  });
});

describe("quotes and printers", () => {
  it("strips printer numbers from the stored input and puts them back on load", () => {
    const stored = stripPrinter(DEFAULT_INPUT);
    expect("watts" in stored).toBe(false);
    const back = withPrinter(stored, printerFields(printer));
    expect(back.watts).toBe(printer.watts);
    expect(back.printerPrice).toBe(printer.price);
  });

  it("keeps the numbers of quotes saved before printers had a table", () => {
    const old = normalizeQuote({ id: "x", createdAt: 1, name: "viejo", currency: "ARS", input: { ...DEFAULT_INPUT, watts: 99 }, result: {} });
    expect(old.printerId).toBeNull();
    expect(old.legacyPrinter?.watts).toBe(99);
    expect("watts" in old.input).toBe(false);
  });

  it("matches a printer by its numbers", () => {
    expect(matchPrinter([printer], DEFAULT_INPUT)?.id).toBe(printer.id);
    expect(matchPrinter([printer], { ...DEFAULT_INPUT, watts: 1 })).toBeUndefined();
  });
});

describe("csv export", () => {
  it("has one value per column and resolves the printer", () => {
    const row = quoteToRow(makeQuote(), [printer]);
    expect(row).toHaveLength(CSV_COLUMNS.length);
    expect(row[CSV_COLUMNS.indexOf("impresora")]).toBe(printer.name);
    expect(row[CSV_COLUMNS.indexOf("consumo_w")]).toBe(printer.watts);
  });

  it("uses semicolons, decimal commas, quoting and a BOM", () => {
    const csv = quotesToCsv([makeQuote()], [printer]);
    const [header, row] = csv.split("\r\n");
    expect(header.startsWith("\uFEFFfecha;nombre;modelo_origen;modelo_ref;descripcion;moneda")).toBe(true);
    expect(row).toContain('"Llavero; ""test"""');
    expect(row).toContain(";120,00;");
    expect(row).not.toMatch(/\d\.\d/);
  });

  it("leaves IVA and ML columns empty when disabled", () => {
    const row = quoteToRow(makeQuote(), [printer]);
    const at = (name: (typeof CSV_COLUMNS)[number]) => row[CSV_COLUMNS.indexOf(name)];
    expect(at("iva")).toBe(false);
    expect(at("precio_con_iva")).toBeNull();
    expect(at("mercado_libre")).toBe(false);
    expect(at("ml_precio_publicar_unidad")).toBeNull();
  });
});

describe("csv import", () => {
  it("parses quoted fields, escaped quotes and CRLF", () => {
    const rows = parseCsv('\uFEFFa;b;c\r\n1;"x;y";"di""jo"\r\n"multi\nline";2;3\r\n');
    expect(rows).toEqual([
      ["a", "b", "c"],
      ["1", "x;y", 'di"jo'],
      ["multi\nline", "2", "3"],
    ]);
  });

  it("round-trips an export: same inputs, same ids, same printer", () => {
    const q = makeQuote(
      { name: "Lámpara; LED" },
      {
        name: "Lámpara; LED",
        modelSource: "downloaded",
        modelRef: "https://www.printables.com/model/123",
        description: "Pantalla; base negra\nsegunda línea",
        material: "PETG",
        grams: 250,
        hours: 8,
        minutes: 30,
        laborRate: 5000,
        laborHours: 1.5,
        extras: 6000,
        extrasNote: "Tira LED",
        extrasMarkup: 15,
        multiplier: 3.5,
        quantity: 2,
        vatEnabled: true,
        mlEnabled: true,
        mlCommission: 13.5,
        mlInstallments: "same3",
        mlFeesVat: false,
      },
    );
    const { quotes, printers, errors } = csvToQuotes(quotesToCsv([q], [printer]), [printer]);
    expect(errors).toEqual([]);
    expect(printers).toEqual([]);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].id).toBe(q.id);
    expect(quotes[0].printerId).toBe(printer.id);
    expect(quotes[0].name).toBe("Lámpara; LED");
    expect(quotes[0].createdAt).toBe(q.createdAt);
    expect(quotes[0].updatedAt).toBe(q.createdAt);
    expect(quotes[0].input).toEqual(q.input);
    expect(quotes[0].result.price).toBeCloseTo(q.result.price);
  });

  it("reads the model origin and reference", () => {
    const csv = "material;gramos;horas_impresion;modelo_origen;modelo_ref\nPLA;10;1;descargado;thingiverse.com/thing/1\nPLA;10;1;;pieza-v3.f3d\n";
    const { quotes } = csvToQuotes(csv);
    expect(quotes[0].input.modelSource).toBe("downloaded");
    expect(quotes[0].input.modelRef).toBe("thingiverse.com/thing/1");
    expect(quotes[1].input.modelSource).toBe("own");
    expect(quotes[1].input.modelRef).toBe("pieza-v3.f3d");
  });

  it("creates unknown printers from the row's numbers", () => {
    const csv = "material;gramos;horas_impresion;impresora;consumo_w;precio_impresora;vida_util_h\nPLA;10;1;Ender 3;130;500000;6000\nPLA;20;2;ender 3;1;1;1\n";
    const { quotes, printers } = csvToQuotes(csv, [printer]);
    expect(printers).toHaveLength(1);
    expect(printers[0].name).toBe("Ender 3");
    expect(printers[0].watts).toBe(130);
    expect(quotes.map((q) => q.printerId)).toEqual([printers[0].id, printers[0].id]);
    expect(quotes[1].result.energy).toBeCloseTo(0.13 * 2 * DEFAULT_INPUT.kwhPrice);
  });

  it("accepts comma separator, dot decimals and dd/mm/yyyy dates", () => {
    const csv = "fecha,nombre,material,gramos,horas_impresion,margen\n13/10/2026 16:00,Maceta,pla,120.5,2.25,4\n";
    const { quotes, errors } = csvToQuotes(csv);
    expect(errors).toEqual([]);
    expect(quotes[0].input.material).toBe("PLA");
    expect(quotes[0].input.grams).toBe(120.5);
    expect(quotes[0].input.hours).toBe(2);
    expect(quotes[0].input.minutes).toBe(15);
    expect(new Date(quotes[0].createdAt).getFullYear()).toBe(2026);
    expect(quotes[0].id).toBeTruthy();
  });

  it("reports bad rows and missing columns", () => {
    const bad = csvToQuotes("material;gramos;horas_impresion\nMADERA;10;1\nPLA;abc;1\nPLA;10;1\n");
    expect(bad.quotes).toHaveLength(1);
    expect(bad.errors.map((e) => e.line)).toEqual([2, 3]);
    expect(csvToQuotes("nombre;gramos\nx;1\n").errors[0].message).toContain("horas_impresion");
    expect(csvToQuotes("").errors).toHaveLength(1);
  });
});

describe("migrateQuotes", () => {
  it("moves quotes, reuses printers by name or numbers, creates the rest", async () => {
    const from = new LocalRepo("calc3d-test-from");
    const to = new LocalRepo("calc3d-test-to");
    const remoteDefault = defaultPrinter(to.defaultPrinterId);
    await to.putPrinter(remoteDefault);

    const localDefault = defaultPrinter(from.defaultPrinterId);
    const ender = printerFromFields("Ender 3", { watts: 130, printerPrice: 500000, printerLifeHours: 6000 });
    const unused = printerFromFields("Sin uso", { watts: 1, printerPrice: 1, printerLifeHours: 1 });
    for (const p of [localDefault, ender, unused]) await from.putPrinter(p);

    const byId = makeQuote({ id: "legacy-id", printerId: localDefault.id, printerName: localDefault.name });
    const byEnder = makeQuote({ printerId: ender.id, printerName: ender.name });
    const legacy = { ...makeQuote({ printerId: null, printerName: "" }), legacyPrinter: printerFields(remoteDefault) };
    for (const q of [byId, byEnder, legacy]) await from.putQuote(q);

    const r = await migrateQuotes(from, to);
    expect(r).toEqual({ moved: 3, printersCreated: 1 });

    const printers = await to.listPrinters();
    expect(printers.map((p) => p.name).sort()).toEqual(["Bambu Lab A1", "Ender 3"]);

    const quotes = await to.listQuotes();
    expect(quotes).toHaveLength(3);
    const defaultId = remoteDefault.id;
    expect(quotes.filter((q) => q.printerId === defaultId)).toHaveLength(2);
    expect(quotes.find((q) => q.printerName === "Ender 3")?.printerId).toBe(printers.find((p) => p.name === "Ender 3")?.id);
    expect(quotes.every((q) => /^[0-9a-f-]{36}$/.test(q.id))).toBe(true);
    expect(quotes.every((q) => q.legacyPrinter === undefined)).toBe(true);
    expect(await from.listQuotes()).toEqual([]);
  });

  it("is idempotent for the default printer: same id twice is one row", async () => {
    const repo = new LocalRepo("calc3d-test-default");
    await repo.putPrinter(defaultPrinter(repo.defaultPrinterId));
    await repo.putPrinter(defaultPrinter(repo.defaultPrinterId));
    expect(await repo.listPrinters()).toHaveLength(1);
  });
});

describe("stale quotes", () => {
  const day = 86_400_000;
  const now = 1_760_000_000_000;

  it("counts days since the last save, preferring updatedAt", () => {
    expect(daysSinceSaved({ createdAt: now - 10 * day, updatedAt: now - 2 * day }, now)).toBe(2);
    expect(daysSinceSaved({ createdAt: now - 10 * day, updatedAt: 0 }, now)).toBe(10);
    expect(daysSinceSaved({ createdAt: now + day, updatedAt: 0 }, now)).toBe(0);
  });

  it("is stale from the threshold on", () => {
    expect(isStale({ createdAt: now - (STALE_AFTER_DAYS - 1) * day, updatedAt: 0 }, now)).toBe(false);
    expect(isStale({ createdAt: now - STALE_AFTER_DAYS * day, updatedAt: 0 }, now)).toBe(true);
    expect(isStale({ createdAt: now - 90 * day, updatedAt: now - day }, now)).toBe(false);
  });
});
