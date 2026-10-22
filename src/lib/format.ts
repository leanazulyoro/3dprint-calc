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

const TLDS = /\.(com|net|org|ar|io|co|app|dev|me|cloud|xyz|info|uk|es|br|cl|uy|mx)$/i;

/** A reference that reads as a web address rather than a file name ("pieza.f3d"). */
export function isUrlLike(s: string): boolean {
  const t = s.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(t) || /^www\./i.test(t)) return true;
  const m = t.match(/^([\w-]+(?:\.[\w-]+)+)(\/\S*)?$/i);
  if (!m) return false;
  return Boolean(m[2]) || TLDS.test(m[1]);
}

/** "printables.com/model/1" → "https://printables.com/model/1"; leaves schemes alone. */
export function toHref(url: string): string {
  const t = url.trim();
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : `https://${t}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(toHref(url)).host.replace(/^www\./, "");
  } catch {
    return url.trim();
  }
}
