import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, calculate } from "./calc";
import { CSV_COLUMNS, csvToQuotes, parseCsv, quoteToRow, quotesToCsv } from "./csv";
import { deleteQuote, listQuotes, newQuoteId, putQuote, type Quote } from "./quotes";

function makeQuote(over: Partial<Quote> = {}): Quote {
  const input = { ...DEFAULT_INPUT, name: "Llavero; \"test\"", grams: 120 };
  return {
    id: newQuoteId(),
    createdAt: 1_760_000_000_000,
    updatedAt: 1_760_000_000_000,
    name: input.name,
    currency: "ARS",
    input,
    result: calculate(input),
    ...over,
  };
}

describe("quotes store", () => {
  it("saves, lists newest first, updates and deletes", async () => {
    const a = makeQuote({ createdAt: 1 });
    const b = makeQuote({ createdAt: 2 });
    await putQuote(a);
    await putQuote(b);
    expect((await listQuotes()).map((q) => q.id)).toEqual([b.id, a.id]);

    await putQuote({ ...a, name: "Renombrado" });
    expect((await listQuotes()).find((q) => q.id === a.id)?.name).toBe("Renombrado");

    await deleteQuote(a.id);
    await deleteQuote(b.id);
    expect(await listQuotes()).toEqual([]);
  });

  it("generates distinct ids", () => {
    expect(newQuoteId()).not.toBe(newQuoteId());
  });
});

describe("csv", () => {
  it("has one value per column", () => {
    expect(quoteToRow(makeQuote())).toHaveLength(CSV_COLUMNS.length);
  });

  it("uses semicolons, decimal commas, quoting and a BOM", () => {
    const csv = quotesToCsv([makeQuote()]);
    const [header, row] = csv.split("\r\n");
    expect(header.startsWith("﻿fecha;nombre;moneda")).toBe(true);
    expect(row).toContain('"Llavero; ""test"""');
    expect(row).toContain(";120,00;");
    expect(row).not.toMatch(/\d\.\d/);
  });

  it("leaves IVA and ML columns empty when disabled", () => {
    const row = quoteToRow(makeQuote());
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

  it("round-trips an export: same inputs, same ids", () => {
    const q = makeQuote({
      name: "Lámpara; LED",
      input: {
        ...DEFAULT_INPUT,
        name: "Lámpara; LED",
        material: "PETG",
        grams: 250,
        hours: 8,
        minutes: 30,
        laborRate: 5000,
        laborHours: 1.5,
        extras: 6000,
        extrasMarkup: 15,
        multiplier: 3.5,
        quantity: 2,
        vatEnabled: true,
        mlEnabled: true,
        mlCommission: 13.5,
        mlInstallments: "same3",
        mlFeesVat: false,
      },
    });
    q.result = calculate(q.input);
    const { quotes, errors } = csvToQuotes(quotesToCsv([q]));
    expect(errors).toEqual([]);
    expect(quotes).toHaveLength(1);
    expect(quotes[0].id).toBe(q.id);
    expect(quotes[0].name).toBe("Lámpara; LED");
    expect(quotes[0].currency).toBe("ARS");
    expect(quotes[0].createdAt).toBe(q.createdAt);
    expect(quotes[0].input).toEqual(q.input);
    expect(quotes[0].result.price).toBeCloseTo(q.result.price);
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
