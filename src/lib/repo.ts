import type { SupabaseClient } from "@supabase/supabase-js";
import { STORES, isUuid, run } from "./db";
import type { Printer } from "./printers";
import { normalizeQuote, type Quote } from "./quotes";

/** Same operations whether data lives in this browser or in a shared workshop. */
export interface Repo {
  readonly key: string;
  listQuotes(): Promise<Quote[]>;
  putQuote(q: Quote): Promise<void>;
  deleteQuote(id: string): Promise<void>;
  listPrinters(): Promise<Printer[]>;
  putPrinter(p: Printer): Promise<void>;
  deletePrinter(id: string): Promise<void>;
}

const byCreatedDesc = (a: { createdAt: number }, b: { createdAt: number }) => b.createdAt - a.createdAt;
const byCreatedAsc = (a: { createdAt: number }, b: { createdAt: number }) => a.createdAt - b.createdAt;

export class LocalRepo implements Repo {
  readonly key = "local";

  async listQuotes(): Promise<Quote[]> {
    const all = await run<unknown[]>(STORES.quotes, "readonly", (s) => s.getAll());
    return all.map(normalizeQuote).sort(byCreatedDesc);
  }
  async putQuote(q: Quote) {
    await run(STORES.quotes, "readwrite", (s) => s.put(q));
  }
  async deleteQuote(id: string) {
    await run(STORES.quotes, "readwrite", (s) => s.delete(id));
  }
  async listPrinters(): Promise<Printer[]> {
    const all = await run<Printer[]>(STORES.printers, "readonly", (s) => s.getAll());
    return all.sort(byCreatedAsc);
  }
  async putPrinter(p: Printer) {
    await run(STORES.printers, "readwrite", (s) => s.put(p));
  }
  async deletePrinter(id: string) {
    await run(STORES.printers, "readwrite", (s) => s.delete(id));
  }
}

type PrinterRow = {
  id: string;
  workshop_id: string;
  name: string;
  watts: number;
  price: number;
  life_hours: number;
  created_at: string;
  updated_at: string;
};

type QuoteRow = {
  id: string;
  workshop_id: string;
  printer_id: string | null;
  name: string;
  currency: string;
  input: Quote["input"];
  result: Quote["result"];
  created_at: string;
  updated_at: string;
};

const ms = (iso: string) => new Date(iso).getTime();
const iso = (t: number) => new Date(t).toISOString();

function fail(ctx: string, error: { message: string } | null): never {
  throw new Error(`${ctx}: ${error?.message ?? "error desconocido"}`);
}

export class RemoteRepo implements Repo {
  readonly key: string;

  constructor(
    private client: SupabaseClient,
    private workshopId: string,
    private printerNames: () => Map<string, string> = () => new Map(),
  ) {
    this.key = `remote:${workshopId}`;
  }

  async listQuotes(): Promise<Quote[]> {
    const { data, error } = await this.client
      .from("quotes")
      .select("*")
      .eq("workshop_id", this.workshopId)
      .order("created_at", { ascending: false });
    if (error) fail("No se pudieron leer los presupuestos", error);
    const names = this.printerNames();
    return (data as QuoteRow[]).map((r) =>
      normalizeQuote({
        id: r.id,
        createdAt: ms(r.created_at),
        updatedAt: ms(r.updated_at),
        name: r.name,
        currency: r.currency,
        printerId: r.printer_id,
        printerName: r.printer_id ? (names.get(r.printer_id) ?? "") : "",
        input: r.input,
        result: r.result,
      }),
    );
  }

  async putQuote(q: Quote) {
    if (!isUuid(q.id)) throw new Error("Id de presupuesto inválido para el taller");
    const row: QuoteRow = {
      id: q.id,
      workshop_id: this.workshopId,
      printer_id: q.printerId && isUuid(q.printerId) ? q.printerId : null,
      name: q.name,
      currency: q.currency,
      input: q.input,
      result: q.result,
      created_at: iso(q.createdAt),
      updated_at: iso(q.updatedAt),
    };
    const { error } = await this.client.from("quotes").upsert(row, { onConflict: "id" });
    if (error) fail("No se pudo guardar el presupuesto", error);
  }

  async deleteQuote(id: string) {
    const { error } = await this.client.from("quotes").delete().eq("id", id).eq("workshop_id", this.workshopId);
    if (error) fail("No se pudo borrar el presupuesto", error);
  }

  async listPrinters(): Promise<Printer[]> {
    const { data, error } = await this.client
      .from("printers")
      .select("*")
      .eq("workshop_id", this.workshopId)
      .order("created_at", { ascending: true });
    if (error) fail("No se pudieron leer las impresoras", error);
    return (data as PrinterRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      watts: Number(r.watts),
      price: Number(r.price),
      lifeHours: Number(r.life_hours),
      createdAt: ms(r.created_at),
      updatedAt: ms(r.updated_at),
    }));
  }

  async putPrinter(p: Printer) {
    if (!isUuid(p.id)) throw new Error("Id de impresora inválido para el taller");
    const row: PrinterRow = {
      id: p.id,
      workshop_id: this.workshopId,
      name: p.name,
      watts: p.watts,
      price: p.price,
      life_hours: p.lifeHours,
      created_at: iso(p.createdAt),
      updated_at: iso(p.updatedAt),
    };
    const { error } = await this.client.from("printers").upsert(row, { onConflict: "id" });
    if (error) fail("No se pudo guardar la impresora", error);
  }

  async deletePrinter(id: string) {
    const { error } = await this.client.from("printers").delete().eq("id", id).eq("workshop_id", this.workshopId);
    if (error) fail("No se pudo borrar la impresora", error);
  }
}
