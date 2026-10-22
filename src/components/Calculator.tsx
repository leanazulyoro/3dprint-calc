"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_INPUT,
  MARGIN_PRESETS,
  MATERIALS,
  ML_COMMISSION_RANGE,
  ML_FEES_UPDATED,
  ML_FEES_VAT,
  ML_FIXED_FEE_TIERS,
  ML_INSTALLMENTS,
  PRINTER_PRESETS,
  calculate,
  type CalcInput,
  type MaterialId,
  type MlInstallments,
  type PrinterFields,
} from "@/lib/calc";
import { useData } from "@/lib/data-context";
import { hoursLabel, money, percent, type CurrencyCode } from "@/lib/format";
import type { MlFee } from "@/lib/ml";
import { defaultPrinter, matchPrinter, printerFields, printerFromFields, type Printer } from "@/lib/printers";
import { daysSinceSaved, isStale, newQuoteId, stripPrinter, withPrinter, type Quote } from "@/lib/quotes";
import {
  clearState,
  readActiveId,
  readPrinterId,
  readState,
  writeActiveId,
  writePrinterId,
  writeState,
} from "@/lib/storage";
import { decodeState, encodeState } from "@/lib/url";
import { Checkbox, NumberField, Section, SelectField, TextAreaField, TextField } from "./fields";
import { ResetIcon } from "./icons";
import { Summary, buildLayers } from "./Summary";

const SYMBOL: Record<CurrencyCode, string> = {
  ARS: "$",
  USD: "US$",
  EUR: "€",
  BRL: "R$",
  CLP: "$",
  UYU: "$U",
  MXN: "$",
  COP: "$",
};

const NEW_PRINTER = "__new__";
const NEW_PRINTER_NAME = "Nueva impresora";

const touch = (p: Printer, patch: Partial<Printer>): Printer => ({ ...p, ...patch, updatedAt: Date.now() });

const PRINTER_KEY_OF: Record<keyof PrinterFields, "watts" | "price" | "lifeHours"> = {
  watts: "watts",
  printerPrice: "price",
  printerLifeHours: "lifeHours",
};

export function Calculator() {
  const { repo, mode, ready, workshop, currency, setCurrency, setSavedCount } = useData();
  const [input, setInput] = useState<CalcInput>(DEFAULT_INPUT);
  const [loaded, setLoaded] = useState(false);
  const fromUrl = useRef(false);
  const inputRef = useRef(input);
  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  const [printers, setPrinters] = useState<Printer[]>([]);
  const [printerId, setPrinterId] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [mlApi, setMlApi] = useState<{ configured: boolean } | null>(null);
  const [mlCategory, setMlCategory] = useState("");
  const [mlStatus, setMlStatus] = useState<string | null>(null);

  // Hydrate from a shared link first, then from this browser's saved values.
  useEffect(() => {
    let saved = decodeState(new URLSearchParams(window.location.search));
    fromUrl.current = Boolean(saved.input);
    if (!saved.input) saved = readState();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from URL/storage
    if (saved.input) setInput(saved.input);
    if (saved.currency) setCurrency(saved.currency);
    setLoaded(true);
  }, [setCurrency]);

  useEffect(() => {
    if (!loaded) return;
    writeState({ input, currency });
  }, [input, currency, loaded]);

  // Printers and quotes from whichever store is active (browser or workshop).
  useEffect(() => {
    if (!loaded || !ready) return;
    let cancelled = false;
    (async () => {
      let ps = await repo.listPrinters();
      if (ps.length === 0) {
        const p = defaultPrinter(repo.defaultPrinterId);
        await repo.putPrinter(p);
        ps = [p];
      }
      const qs = await repo.listQuotes();
      if (cancelled) return;
      setPrinters(ps);
      setQuotes(qs);
      setSavedCount(qs.length);
      setDataError(null);
      setDataLoaded(true);

      const active = readActiveId();
      setActiveQuoteId(active && qs.some((q) => q.id === active) ? active : null);

      // Shared link: keep its numbers unless one of my printers matches them.
      // Otherwise the remembered printer, then one matching the form, then the first.
      const current = inputRef.current;
      const stored = readPrinterId();
      const chosen = fromUrl.current
        ? matchPrinter(ps, current)
        : (ps.find((p) => p.id === stored) ?? matchPrinter(ps, current) ?? ps[0]);
      setPrinterId(chosen?.id ?? null);
      writePrinterId(chosen?.id ?? null);
      if (chosen) setInput((prev) => withPrinter(prev, printerFields(chosen)));
    })().catch((e: unknown) => {
      if (!cancelled) {
        setDataError(e instanceof Error ? e.message : "No se pudieron cargar los datos");
        setDataLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [repo, loaded, ready, setSavedCount]);

  // Printer edits persist a moment after the last keystroke.
  const pending = useRef<{ timer: number; printer: Printer } | null>(null);
  const flushPrinter = useCallback(async () => {
    const p = pending.current;
    if (!p) return;
    window.clearTimeout(p.timer);
    pending.current = null;
    await repo.putPrinter(p.printer);
  }, [repo]);
  const schedulePersist = useCallback(
    (printer: Printer) => {
      if (pending.current) window.clearTimeout(pending.current.timer);
      const timer = window.setTimeout(() => {
        pending.current = null;
        repo.putPrinter(printer).catch((e: unknown) => {
          setDataError(e instanceof Error ? e.message : "No se pudo guardar la impresora");
        });
      }, 500);
      pending.current = { timer, printer };
    },
    [repo],
  );
  useEffect(() => () => void flushPrinter(), [flushPrinter]);

  // Mercado Libre's fixed fees are in pesos: only offer it with ARS.
  const mlAvailable = currency === "ARS";
  const result = useMemo(
    () => calculate(mlAvailable ? input : { ...input, mlEnabled: false }),
    [input, mlAvailable],
  );
  const sym = SYMBOL[currency];

  // Only ask whether live fees are configured once someone turns ML on.
  useEffect(() => {
    if (!input.mlEnabled || mlApi !== null) return;
    let cancelled = false;
    fetch("/api/ml-fees")
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => {
        if (!cancelled) setMlApi({ configured: d.configured === true });
      })
      .catch(() => {
        if (!cancelled) setMlApi({ configured: false });
      });
    return () => {
      cancelled = true;
    };
  }, [input.mlEnabled, mlApi]);

  const fetchMlFees = async () => {
    const price = result.ml?.listPrice ?? result.pricePerUnitWithVat;
    setMlStatus("Consultando…");
    try {
      const qs = new URLSearchParams({ price: String(Math.max(1, Math.round(price))) });
      if (mlCategory.trim()) qs.set("category", mlCategory.trim().toUpperCase());
      const r = await fetch(`/api/ml-fees?${qs}`);
      const data = (await r.json()) as { error?: string; fees?: MlFee[] };
      if (!r.ok) throw new Error(data.error ?? `Error ${r.status}`);
      // The route already normalized Mercado Libre's response.
      const fees = Array.isArray(data.fees) ? data.fees.filter((f) => f.saleFee !== null && f.saleFee > 0) : [];
      const fee = fees.find((f) => f.id === "gold_special") ?? fees[0];
      if (!fee) throw new Error("Mercado Libre no devolvió comisiones para ese precio");
      const pct =
        fee.percentage ?? (fee.saleFee !== null ? ((fee.saleFee - (fee.fixedFee ?? 0)) / price) * 100 : null);
      if (pct === null) throw new Error("La respuesta no trae porcentaje");
      const rounded = Math.round(pct * 100) / 100;
      setInput((prev) => ({ ...prev, mlCommission: rounded }));
      setMlStatus(`${fee.name}: ${percent(rounded)} según Mercado Libre, para un precio de ${money(price, "ARS")}.`);
    } catch (e) {
      setMlStatus(e instanceof Error ? e.message : "No se pudo consultar");
    }
  };

  const set = <K extends keyof CalcInput>(key: K) => (value: CalcInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const printer = printers.find((p) => p.id === printerId) ?? null;
  const isPreset = MARGIN_PRESETS.some((m) => m.value === input.multiplier);
  const activeQuote = activeQuoteId ? (quotes.find((q) => q.id === activeQuoteId) ?? null) : null;
  const staleDays = activeQuote && isStale(activeQuote) ? daysSinceSaved(activeQuote) : null;

  const updatePrinter = (patch: Partial<Printer>) => {
    if (!printer) return;
    const next = touch(printer, patch);
    setPrinters((prev) => prev.map((p) => (p.id === next.id ? next : p)));
    schedulePersist(next);
  };

  const setPrinterField = (key: keyof PrinterFields, value: number) => {
    set(key)(value);
    if (printer) updatePrinter({ [PRINTER_KEY_OF[key]]: Number.isFinite(value) ? value : 0 });
  };

  const selectPrinter = async (id: string) => {
    await flushPrinter();
    if (id === NEW_PRINTER) {
      const p = printerFromFields(NEW_PRINTER_NAME, DEFAULT_INPUT);
      await repo.putPrinter(p);
      setPrinters((prev) => [...prev, p]);
      id = p.id;
    }
    const chosen = id === NEW_PRINTER ? null : (printers.find((p) => p.id === id) ?? null);
    const target = chosen ?? (await repo.listPrinters()).find((p) => p.id === id) ?? null;
    if (!target) return;
    setPrinterId(target.id);
    writePrinterId(target.id);
    setInput((prev) => withPrinter(prev, printerFields(target)));
  };

  const deletePrinter = async () => {
    if (!printer || printers.length <= 1) return;
    if (!window.confirm(`¿Borrar la impresora "${printer.name}"? Los presupuestos guardados con ella quedan.`)) return;
    await flushPrinter();
    await repo.deletePrinter(printer.id);
    const rest = printers.filter((p) => p.id !== printer.id);
    setPrinters(rest);
    const next = rest[0];
    setPrinterId(next.id);
    writePrinterId(next.id);
    setInput((prev) => withPrinter(prev, printerFields(next)));
  };

  const applyPreset = (presetId: string) => {
    const p = PRINTER_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    set("watts")(p.watts);
    if (printer) {
      const generic =
        !printer.name.trim() ||
        printer.name === NEW_PRINTER_NAME ||
        PRINTER_PRESETS.some((x) => x.label === printer.name);
      updatePrinter({ watts: p.watts, ...(generic ? { name: p.label } : {}) });
    }
  };
  const shownPreset = PRINTER_PRESETS.find((p) => p.label === printer?.name && p.watts === input.watts)?.id ?? "";

  const saveQuote = async (asNew: boolean) => {
    if (!dataLoaded || dataError) throw new Error(dataError ?? "Todavía cargando");
    if (!input.modelRef.trim()) {
      throw new Error(
        input.modelSource === "downloaded"
          ? "Cargá de dónde descargaste el modelo"
          : "Cargá una referencia del modelo: link del CAD o nombre del archivo",
      );
    }
    await flushPrinter();
    let pid = printerId;
    let pname = printer?.name ?? "";
    if (!pid) {
      // Numbers came from a shared link and match none of my printers: keep them as one.
      const p = printerFromFields("Impresora del link", input);
      await repo.putPrinter(p);
      setPrinters((prev) => [...prev, p]);
      setPrinterId(p.id);
      writePrinterId(p.id);
      pid = p.id;
      pname = p.name;
    }
    const existing = asNew ? undefined : quotes.find((q) => q.id === activeQuoteId);
    const now = Date.now();
    const quote: Quote = {
      id: existing?.id ?? newQuoteId(),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      name:
        input.name.trim() ||
        `Presupuesto ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(now)}`,
      currency,
      printerId: pid,
      printerName: pname,
      input: stripPrinter(input),
      result,
    };
    await repo.putQuote(quote);
    const next = [quote, ...quotes.filter((q) => q.id !== quote.id)].sort((a, b) => b.createdAt - a.createdAt);
    setQuotes(next);
    setSavedCount(next.length);
    setActiveQuoteId(quote.id);
    writeActiveId(quote.id);
  };

  const reset = () => {
    setInput(printer ? withPrinter(DEFAULT_INPUT, printerFields(printer)) : DEFAULT_INPUT);
    setCurrency("ARS");
    setActiveQuoteId(null);
    writeActiveId(null);
    clearState();
  };

  const shareUrl = () => {
    const url = new URL(window.location.href);
    url.search = encodeState({ input, currency });
    return url.toString();
  };

  const summaryText = () => {
    const fmt = (v: number) => money(v, currency);
    const lines = [
      `Presupuesto impresión 3D${input.name.trim() ? `: ${input.name.trim()}` : ""}`,
      `${input.material}, ${input.grams || 0} g, ${hoursLabel(result.printHours)}${printer ? `, ${printer.name}` : ""}`,
      ...(input.description.trim() ? [input.description.trim()] : []),
      ...(input.modelRef.trim() ? [`Modelo ${input.modelSource === "downloaded" ? "descargado" : "propio"}: ${input.modelRef.trim()}`] : []),
      "",
      ...buildLayers(result, input.failureRate, input.extrasNote)
        .filter((l) => l.value > 0 || (l.key !== "labor" && l.key !== "extras"))
        .map((l) => `${l.label}: ${fmt(l.value)}`),
      `Costo real: ${fmt(result.cost)}`,
      "",
      `Precio sugerido (impresión ×${input.multiplier}${result.labor + result.extras > 0 ? ", más mano de obra y extras" : ""}): ${fmt(result.price)}`,
    ];
    const qty = Math.max(1, Math.floor(input.quantity) || 1);
    if (qty > 1) lines.push(`${qty} unidades, ${fmt(result.pricePerUnit)} c/u`);
    if (input.vatEnabled) {
      lines.push(`Con IVA ${percent(input.vatRate)}: ${fmt(result.priceWithVat)}${qty > 1 ? ` (${fmt(result.pricePerUnitWithVat)} c/u)` : ""}`);
    }
    if (result.ml) {
      const ml = result.ml;
      lines.push("", `Publicar en Mercado Libre a ${fmt(ml.listPrice)}${qty > 1 ? " c/u" : ""}`);
      lines.push(`Cargos de ML: ${fmt(ml.totalFees)}${qty > 1 ? " c/u" : ""}, te quedan ${fmt(ml.net)}${qty > 1 ? " c/u" : ""}`);
    }
    return lines.join("\n");
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-8 pb-28 lg:pb-16">
      <header className="no-print flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="display text-3xl sm:text-4xl font-semibold leading-none">
            Calculadora de impresión 3D
          </h1>
          <p className="mt-2 text-ink-2 text-base sm:text-lg leading-snug">
            Cargá lo que dice tu laminador y los datos de tu taller. Te muestra el costo real de la
            pieza y cuánto cobrarla.
          </p>
        </div>
        <button type="button" className="btn gap-1.5" onClick={reset}>
          <ResetIcon />
          Reiniciar
        </button>
      </header>

      {dataError ? (
        <p role="alert" className="no-print mt-4 rounded-md border border-line bg-ticket px-3 py-2 text-sm text-ink">
          {dataError}
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-10 lg:gap-12 items-start">
        <form className="no-print min-w-0" onSubmit={(e) => e.preventDefault()}>
          <Section title="Pieza" lead="Peso y tiempo salen del laminador. Si imprimís varias piezas juntas, cargá el total de la placa.">
            <TextField
              label="Nombre"
              value={input.name}
              onChange={set("name")}
              placeholder="Llavero para Cliente X"
              className="sm:col-span-2"
            />
            {input.modelSource === "downloaded" ? (
              <TextField
                label="De dónde lo descargaste"
                value={input.modelRef}
                onChange={set("modelRef")}
                placeholder="https://makerworld.com/es/models/…"
                maxLength={500}
                hint="Hace falta para guardar, así después sabés de dónde salió."
              />
            ) : (
              <TextField
                label="Dónde está el archivo"
                value={input.modelRef}
                onChange={set("modelRef")}
                placeholder="Link de Onshape, o nombre del archivo en Fusion, Blender…"
                maxLength={500}
                hint="Hace falta para guardar, así después lo encontrás."
              />
            )}
            <Checkbox
              label="Modelo propio"
              checked={input.modelSource === "own"}
              onChange={(own) => set("modelSource")(own ? "own" : "downloaded")}
              hint="Lo diseñaste vos: en vez del link de descarga, dónde está el archivo."
              className="sm:pt-7"
            />
            {descriptionOpen || input.description.trim() ? (
              <TextAreaField
                label="Descripción"
                value={input.description}
                onChange={set("description")}
                placeholder="Detalles del pedido, color, terminación, para quién es…"
                className="sm:col-span-2"
                autoFocus={descriptionOpen && !input.description}
              />
            ) : (
              <button
                type="button"
                className="sm:col-span-2 text-left text-sm font-medium text-accent-ink hover:underline"
                onClick={() => setDescriptionOpen(true)}
              >
                + Agregar descripción
              </button>
            )}
            <SelectField
              label="Material"
              value={input.material}
              onChange={(v) => set("material")(v as MaterialId)}
              options={MATERIALS.map((m) => ({ value: m.id, label: m.label }))}
              hint={MATERIALS.find((m) => m.id === input.material)?.hint}
            />
            <NumberField label="Precio del filamento" value={input.pricePerKg} onChange={set("pricePerKg")} unit={`${sym}/kg`} />
            <NumberField label="Peso" value={input.grams} onChange={set("grams")} unit="g" />
            <div className="grid grid-cols-2 gap-3">
              <NumberField label="Horas" value={input.hours} onChange={set("hours")} unit="h" />
              <NumberField label="Minutos" value={input.minutes} onChange={set("minutes")} unit="min" />
            </div>
          </Section>

          <Section
            title="Impresora y energía"
            lead={
              mode === "remote"
                ? `Las impresoras se comparten en el taller${workshop ? ` "${workshop.name}"` : ""}. Lo que edites acá queda guardado en la impresora.`
                : "Tus impresoras quedan guardadas en este navegador. Lo que edites acá queda guardado en la impresora."
            }
          >
            <SelectField
              label="Impresora"
              value={printerId ?? ""}
              onChange={(v) => void selectPrinter(v)}
              placeholder={printerId ? undefined : "Del link compartido (sin guardar)"}
              options={[
                ...printers.map((p) => ({ value: p.id, label: p.name })),
                { value: NEW_PRINTER, label: "+ Nueva impresora" },
              ]}
            />
            {printer ? (
              <div className="flex items-end gap-2">
                <TextField
                  label="Nombre de la impresora"
                  value={printer.name}
                  onChange={(name) => updatePrinter({ name })}
                  className="grow"
                />
                {printers.length > 1 ? (
                  <button type="button" className="btn" onClick={() => void deletePrinter()} aria-label={`Borrar impresora ${printer.name}`}>
                    Borrar
                  </button>
                ) : null}
              </div>
            ) : null}
            <SelectField
              label="Modelo"
              value={shownPreset}
              onChange={applyPreset}
              placeholder="Autocompletar consumo (opcional)"
              options={PRINTER_PRESETS.map((p) => ({ value: p.id, label: `${p.label}, ${p.watts} W` }))}
              hint="Consumo promedio imprimiendo. Valores aproximados."
            />
            <NumberField label="Consumo" value={input.watts} onChange={(v) => setPrinterField("watts", v)} unit="W" />
            <NumberField label="Precio de la impresora" value={input.printerPrice} onChange={(v) => setPrinterField("printerPrice", v)} unit={sym} />
            <NumberField
              label="Vida útil"
              value={input.printerLifeHours}
              onChange={(v) => setPrinterField("printerLifeHours", v)}
              unit="h"
              hint={`Horas de impresión antes de reemplazarla. Desgaste: ${money(result.wearPerHour, currency)} por hora.`}
            />
            <NumberField
              label="Precio de la electricidad"
              value={input.kwhPrice}
              onChange={set("kwhPrice")}
              unit={`${sym}/kWh`}
              hint="Está en tu factura. Usá el valor con impuestos."
            />
            <NumberField
              label="Margen de fallos"
              value={input.failureRate}
              onChange={set("failureRate")}
              unit="%"
              hint="Cubre impresiones falladas, purgas y calibraciones."
            />
          </Section>

          <Section
            title="Mano de obra y extras"
            lead="Tu tiempo de diseño, armado y post-proceso, más insumos comprados como tiras LED, tornillería o packaging. Se suman al precio tal cual, sin pasar por el margen."
          >
            <NumberField label="Valor de tu hora" value={input.laborRate} onChange={set("laborRate")} unit={`${sym}/h`} />
            <NumberField label="Horas de trabajo" value={input.laborHours} onChange={set("laborHours")} unit="h" />
            <NumberField label="Extras" value={input.extras} onChange={set("extras")} unit={sym} hint="Lo que pagaste por los insumos." />
            <TextField
              label="Qué incluyen los extras"
              value={input.extrasNote}
              onChange={set("extrasNote")}
              placeholder="Aro y cadena"
            />
            <NumberField
              label="Recargo sobre extras"
              value={input.extrasMarkup}
              onChange={set("extrasMarkup")}
              unit="%"
              hint="Opcional, por conseguir y gestionar la compra."
            />
          </Section>

          <Section title="Venta" lead="El precio sugerido es el costo de impresión por el margen, más mano de obra y extras.">
            <div className="sm:col-span-2">
              <p className="block text-sm font-medium text-ink-2 mb-1.5">Margen</p>
              <div className="flex flex-wrap items-stretch gap-3">
                <div className="flex" role="group" aria-label="Margen predefinido">
                  {MARGIN_PRESETS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      className="seg px-3 sm:px-4"
                      aria-label={`×${m.value}, ${m.label}`}
                      aria-pressed={input.multiplier === m.value}
                      onClick={() => set("multiplier")(m.value)}
                    >
                      <span className="num">×{m.value}</span>
                      <span className="hidden sm:inline text-xs font-normal ml-1.5 opacity-80">{m.label}</span>
                    </button>
                  ))}
                </div>
                <div className="relative w-28">
                  <input
                    type="text"
                    inputMode="decimal"
                    aria-label="Margen personalizado"
                    className="field num"
                    placeholder="Otro"
                    value={isPreset ? "" : Number.isFinite(input.multiplier) ? String(input.multiplier) : ""}
                    onChange={(e) => {
                      const n = Number(e.target.value.replace(",", "."));
                      set("multiplier")(e.target.value === "" ? NaN : n);
                    }}
                  />
                  <span className="field-unit">×</span>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-ink-3">×2 mayorista, ×3 o ×4 lo habitual, ×5 minorista o piezas chicas.</p>
            </div>
            <NumberField
              label="Cantidad de piezas"
              value={input.quantity}
              onChange={set("quantity")}
              unit="u."
              hint="Solo divide el costo y el precio por unidad."
            />
          </Section>

          <Section title="IVA y Mercado Libre" lead="Opcionales. Se aplican sobre el precio sugerido, por unidad.">
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3">
              <Checkbox
                label="Agregar IVA al precio"
                checked={input.vatEnabled}
                onChange={set("vatEnabled")}
                hint="Si facturás con IVA discriminado. Monotributo: dejalo apagado."
              />
              {input.vatEnabled ? (
                <NumberField label="Alícuota" value={input.vatRate} onChange={set("vatRate")} unit="%" />
              ) : null}
            </div>

            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4 pt-2">
              <Checkbox
                label="Vender por Mercado Libre"
                checked={input.mlEnabled && mlAvailable}
                onChange={set("mlEnabled")}
                disabled={!mlAvailable}
                hint={
                  mlAvailable
                    ? "Calcula a cuánto publicar para que, después de los cargos, te quede el precio sugerido."
                    : "Disponible con moneda en pesos argentinos."
                }
                className="sm:col-span-2"
              />
              {input.mlEnabled && mlAvailable ? (
                <>
                  <NumberField
                    label="Cargo por vender"
                    value={input.mlCommission}
                    onChange={set("mlCommission")}
                    unit="%"
                    hint={`Entre ${percent(ML_COMMISSION_RANGE.min)} y ${percent(ML_COMMISSION_RANGE.max)} según categoría y provincia. Lo ves al publicar.`}
                  />
                  <SelectField
                    label="Cuotas"
                    value={input.mlInstallments}
                    onChange={(v) => set("mlInstallments")(v as MlInstallments)}
                    options={ML_INSTALLMENTS.map((o) => ({
                      value: o.id,
                      label: o.rate ? `${o.label} (+${percent(o.rate)})` : o.label,
                    }))}
                  />
                  {mlApi?.configured ? (
                    <div className="sm:col-span-2 flex flex-wrap items-end gap-3">
                      <TextField
                        label="Categoría de ML"
                        value={mlCategory}
                        onChange={setMlCategory}
                        placeholder="MLA1234 (opcional)"
                        className="w-48"
                      />
                      <button type="button" className="btn" onClick={() => void fetchMlFees()}>
                        Consultar comisión en Mercado Libre
                      </button>
                      {mlStatus ? (
                        <span role="status" className="text-sm text-ink-2 basis-full">
                          {mlStatus}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <Checkbox
                    label={`Sumar ${percent(ML_FEES_VAT)} de IVA sobre los cargos`}
                    checked={input.mlFeesVat}
                    onChange={set("mlFeesVat")}
                    hint="Responsable inscripto: lo tomás como crédito fiscal y podés apagarlo."
                    className="sm:col-span-2"
                  />
                  <p className="sm:col-span-2 text-xs text-ink-3 leading-snug">
                    Costo por unidad vendida (Flex, acuerdo o retiro):{" "}
                    {ML_FIXED_FEE_TIERS.map((t, idx) => (
                      <span key={t.upTo}>
                        {idx > 0 ? ", " : ""}
                        {money(t.fee, "ARS")} hasta {money(Math.floor(t.upTo), "ARS")}
                      </span>
                    ))}
                    ; sin costo desde {money(ML_FIXED_FEE_TIERS[ML_FIXED_FEE_TIERS.length - 1].upTo + 0.01, "ARS")}.
                    Envíos Full y correo varían por peso y medidas. Tabla de Mercado Libre, {ML_FEES_UPDATED}.
                  </p>
                </>
              ) : null}
            </div>
          </Section>

          <p className="mt-10 text-xs text-ink-3 max-w-prose">
            Los valores iniciales son orientativos para Argentina. El formulario recuerda lo último que
            calculaste; el link compartible lleva todos los datos.
          </p>
        </form>

        <div className="lg:sticky lg:top-[4.25rem]">
          <Summary
            input={input}
            result={result}
            currency={currency}
            onCopyText={() => navigator.clipboard.writeText(summaryText())}
            onCopyLink={() => navigator.clipboard.writeText(shareUrl())}
            onSave={() => saveQuote(false)}
            onSaveAsNew={activeQuoteId ? () => saveQuote(true) : null}
            canSave={dataLoaded && !dataError}
            staleDays={staleDays}
          />
        </div>
      </div>

      <a
        href="#resumen"
        className="no-print lg:hidden fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 border-t border-line bg-ticket px-4 py-3 shadow-[0_-4px_16px_rgba(15,27,45,0.08)]"
      >
        <span className="text-sm text-ink-2">
          Costo <span className="num text-ink font-medium">{money(result.cost, currency)}</span>
        </span>
        <span className="text-sm text-ink-2">
          {result.ml ? "En Mercado Libre" : "Precio sugerido"}{" "}
          <span className="display num text-lg font-semibold text-accent-ink">
            {money(result.ml ? result.ml.listTotal : result.priceWithVat, currency)}
          </span>
        </span>
      </a>
    </div>
  );
}
