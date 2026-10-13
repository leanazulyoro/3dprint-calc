import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, calculate } from "./calc";
import { CSV_COLUMNS, quoteToRow, quotesToCsv } from "./csv";
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
