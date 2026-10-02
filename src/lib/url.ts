import { CalcInput, DEFAULT_INPUT, MATERIALS, ML_INSTALLMENTS, MaterialId, MlInstallments } from "./calc";
import { CurrencyCode, isCurrency } from "./format";

export type AppState = { input: CalcInput; currency: CurrencyCode };

/** Short keys keep share links readable. */
const KEYS: Record<keyof CalcInput, string> = {
  name: "n",
  material: "m",
  grams: "g",
  pricePerKg: "pk",
  hours: "h",
  minutes: "mi",
  watts: "w",
  kwhPrice: "kwh",
  printerPrice: "pp",
  printerLifeHours: "vu",
  failureRate: "f",
  laborRate: "lr",
  laborHours: "lh",
  extras: "ex",
  extrasMarkup: "exm",
  multiplier: "x",
  quantity: "q",
  vatEnabled: "iva",
  vatRate: "ivap",
  mlEnabled: "ml",
  mlCommission: "mlc",
  mlInstallments: "mli",
  mlFeesVat: "mliva",
};

export function encodeState(s: AppState): string {
  const p = new URLSearchParams();
  for (const [field, key] of Object.entries(KEYS) as [keyof CalcInput, string][]) {
    const v = s.input[field];
    if (v === DEFAULT_INPUT[field]) continue;
    if (v === "" || v === undefined) continue;
    p.set(key, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  if (s.currency !== "ARS") p.set("c", s.currency);
  return p.toString();
}

export function decodeState(params: URLSearchParams): Partial<AppState> {
  if ([...params.keys()].length === 0) return {};
  const input: CalcInput = { ...DEFAULT_INPUT };
  for (const [field, key] of Object.entries(KEYS) as [keyof CalcInput, string][]) {
    const raw = params.get(key);
    if (raw === null) continue;
    if (field === "name") {
      input.name = raw.slice(0, 80);
    } else if (field === "material") {
      if (MATERIALS.some((m) => m.id === raw)) input.material = raw as MaterialId;
    } else if (field === "mlInstallments") {
      if (ML_INSTALLMENTS.some((o) => o.id === raw)) input.mlInstallments = raw as MlInstallments;
    } else if (typeof DEFAULT_INPUT[field] === "boolean") {
      if (raw === "1" || raw === "0") (input as Record<string, unknown>)[field] = raw === "1";
    } else {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) (input as Record<string, unknown>)[field] = n;
    }
  }
  const c = params.get("c");
  return { input, currency: c && isCurrency(c) ? c : "ARS" };
}
