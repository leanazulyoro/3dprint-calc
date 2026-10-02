export type CurrencyCode = "ARS" | "USD" | "EUR" | "BRL" | "CLP" | "UYU" | "MXN" | "COP";

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "ARS", label: "Peso argentino" },
  { code: "USD", label: "Dólar" },
  { code: "EUR", label: "Euro" },
  { code: "BRL", label: "Real" },
  { code: "CLP", label: "Peso chileno" },
  { code: "UYU", label: "Peso uruguayo" },
  { code: "MXN", label: "Peso mexicano" },
  { code: "COP", label: "Peso colombiano" },
];

export const isCurrency = (v: string): v is CurrencyCode =>
  CURRENCIES.some((c) => c.code === v);

const cache = new Map<string, Intl.NumberFormat>();

function formatter(currency: CurrencyCode, digits: number) {
  const key = `${currency}:${digits}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    cache.set(key, f);
  }
  return f;
}

const NO_CENTS: CurrencyCode[] = ["ARS", "CLP", "COP"];

/** Whole units for currencies where cents are meaningless, two decimals elsewhere. */
export function money(value: number, currency: CurrencyCode): string {
  const digits = NO_CENTS.includes(currency) ? 0 : 2;
  return formatter(currency, digits).format(value);
}

export function hoursLabel(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (whole === 0) return `${mins} min`;
  if (mins === 0) return `${whole} h`;
  return `${whole} h ${mins} min`;
}

const pctFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/** "13,5%" with es-AR decimals. */
export function percent(v: number): string {
  return `${pctFormatter.format(Number.isFinite(v) ? v : 0)}%`;
}
