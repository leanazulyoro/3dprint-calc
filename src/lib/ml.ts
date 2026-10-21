export type MlFee = {
  id: string;
  name: string;
  percentage: number | null;
  fixedFee: number | null;
  saleFee: number | null;
};

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * Normalize a `sites/{site}/listing_prices` response. Tolerates missing
 * fields: each listing type keeps whatever Mercado Libre sent.
 */
export function parseListingPrices(raw: unknown): MlFee[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      const d = (o.sale_fee_details ?? {}) as Record<string, unknown>;
      return {
        id: String(o.listing_type_id ?? ""),
        name: String(o.listing_type_name ?? o.listing_type_id ?? ""),
        percentage: num(d.percentage_fee),
        fixedFee: num(d.fixed_fee),
        saleFee: num(o.sale_fee_amount),
      };
    })
    .filter((f) => f.id);
}
