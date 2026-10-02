"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@/lib/calc";
import { CURRENCIES, hoursLabel, money, percent, type CurrencyCode } from "@/lib/format";
import { parseListingPrices } from "@/lib/ml";
import { decodeState, encodeState } from "@/lib/url";
import { Checkbox, NumberField, Section, SelectField, TextField } from "./fields";
import { Summary, buildLayers } from "./Summary";

const STORAGE_KEY = "calc3d:v1";

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

export function Calculator() {
  const [input, setInput] = useState<CalcInput>(DEFAULT_INPUT);
  const [currency, setCurrency] = useState<CurrencyCode>("ARS");
  const [loaded, setLoaded] = useState(false);
  const [presetId, setPresetId] = useState("a1");
  const [mlApi, setMlApi] = useState<{ configured: boolean } | null>(null);
  const [mlCategory, setMlCategory] = useState("");
  const [mlStatus, setMlStatus] = useState<string | null>(null);

  // Hydrate from a shared link first, then from this browser's saved values.
  useEffect(() => {
    let saved = decodeState(new URLSearchParams(window.location.search));
    if (!saved.input) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) saved = decodeState(new URLSearchParams(raw));
      } catch {
        // Storage blocked: keep defaults.
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from URL/storage
    if (saved.input) setInput(saved.input);
    if (saved.currency) setCurrency(saved.currency);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, encodeState({ input, currency }));
    } catch {
      // Storage blocked: nothing to persist.
    }
  }, [input, currency, loaded]);

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
      const data = (await r.json()) as { error?: string; fees?: unknown };
      if (!r.ok) throw new Error(data.error ?? `Error ${r.status}`);
      const fee = parseListingPrices(data.fees).find((f) => f.id === "gold_special") ?? parseListingPrices(data.fees)[0];
      if (!fee) throw new Error("Mercado Libre no devolvió comisiones para ese precio");
      const pct =
        fee.percentage ?? (fee.saleFee !== null ? ((fee.saleFee - (fee.fixedFee ?? 0)) / price) * 100 : null);
      if (pct === null) throw new Error("La respuesta no trae porcentaje");
      const rounded = Math.round(pct * 100) / 100;
      setInput((prev) => ({ ...prev, mlCommission: rounded }));
      setMlStatus(`${fee.name}: ${percent(rounded)} según Mercado Libre.`);
    } catch (e) {
      setMlStatus(e instanceof Error ? e.message : "No se pudo consultar");
    }
  };

  const set = <K extends keyof CalcInput>(key: K) => (value: CalcInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const preset = PRINTER_PRESETS.find((p) => p.id === presetId);
  const shownPreset = preset && preset.watts === input.watts ? preset.id : "";
  const isPreset = MARGIN_PRESETS.some((m) => m.value === input.multiplier);

  const reset = () => {
    setInput(DEFAULT_INPUT);
    setCurrency("ARS");
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
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
      `${input.material}, ${input.grams || 0} g, ${hoursLabel(result.printHours)}`,
      "",
      ...buildLayers(result, input.failureRate)
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
        <div className="flex items-end gap-2">
          <SelectField
            label="Moneda"
            value={currency}
            onChange={(v) => setCurrency(v as CurrencyCode)}
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.label} (${c.code})` }))}
            className="w-52"
          />
          <button type="button" className="btn" onClick={reset}>
            Reiniciar
          </button>
        </div>
      </header>

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
              <NumberField label="Tiempo" value={input.hours} onChange={set("hours")} unit="h" />
              <NumberField label=" " value={input.minutes} onChange={set("minutes")} unit="min" />
            </div>
          </Section>

          <Section title="Impresora y energía" lead="Elegí un modelo para autocompletar el consumo, o cargá el tuyo.">
            <SelectField
              label="Modelo"
              value={shownPreset}
              onChange={(id) => {
                const p = PRINTER_PRESETS.find((x) => x.id === id);
                setPresetId(id);
                if (p) set("watts")(p.watts);
              }}
              placeholder="Elegí tu impresora (opcional)"
              options={PRINTER_PRESETS.map((p) => ({ value: p.id, label: `${p.label}, ${p.watts} W` }))}
              hint="Consumo promedio imprimiendo. Valores aproximados."
            />
            <NumberField label="Consumo" value={input.watts} onChange={set("watts")} unit="W" />
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
            <NumberField label="Precio de la impresora" value={input.printerPrice} onChange={set("printerPrice")} unit={sym} />
            <NumberField
              label="Vida útil"
              value={input.printerLifeHours}
              onChange={set("printerLifeHours")}
              unit="h"
              hint={`Horas de impresión antes de reemplazarla. Desgaste: ${money(result.wearPerHour, currency)} por hora.`}
            />
          </Section>

          <Section
            title="Mano de obra y extras"
            lead="Tu tiempo de diseño, armado y post-proceso, más insumos comprados como tiras LED, tornillería o packaging. Se suman al precio tal cual, sin pasar por el margen."
          >
            <NumberField label="Valor de tu hora" value={input.laborRate} onChange={set("laborRate")} unit={`${sym}/h`} />
            <NumberField label="Horas de trabajo" value={input.laborHours} onChange={set("laborHours")} unit="h" />
            <NumberField label="Extras" value={input.extras} onChange={set("extras")} unit={sym} hint="Lo que pagaste por los insumos." />
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
                      <button type="button" className="btn" onClick={fetchMlFees}>
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
            Los valores iniciales son orientativos para Argentina. Se guardan en este navegador; el
            link compartible lleva todos los datos.
          </p>
        </form>

        <div className="lg:sticky lg:top-6">
          <Summary
            input={input}
            result={result}
            currency={currency}
            onCopyText={() => navigator.clipboard.writeText(summaryText())}
            onCopyLink={() => navigator.clipboard.writeText(shareUrl())}
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
