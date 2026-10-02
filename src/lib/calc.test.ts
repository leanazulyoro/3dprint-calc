import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT, calculate, mlFixedFee, mlGrossUp } from "./calc";
import { decodeState, encodeState } from "./url";

describe("calculate", () => {
  it("matches the worked example: 100 g at 20000/kg costs 2000 of material", () => {
    const r = calculate({ ...DEFAULT_INPUT, grams: 100, pricePerKg: 20000 });
    expect(r.material).toBe(2000);
  });

  it("applies material multipliers to energy and wear only", () => {
    const pla = calculate({ ...DEFAULT_INPUT, material: "PLA", failureRate: 0 });
    const abs = calculate({ ...DEFAULT_INPUT, material: "ABS", failureRate: 0 });
    expect(abs.material).toBe(pla.material);
    expect(abs.energy).toBeCloseTo(pla.energy * 1.6);
    expect(abs.wear).toBeCloseTo(pla.wear * 1.25);
  });

  it("computes energy from watts, hours and kWh price", () => {
    const r = calculate({ ...DEFAULT_INPUT, watts: 200, hours: 2, minutes: 30, kwhPrice: 100 });
    expect(r.printHours).toBe(2.5);
    expect(r.energy).toBeCloseTo(0.2 * 2.5 * 100);
  });

  it("amortizes the printer over its useful life", () => {
    const r = calculate({ ...DEFAULT_INPUT, printerPrice: 800000, printerLifeHours: 8000, hours: 1, minutes: 0 });
    expect(r.wearPerHour).toBe(100);
    expect(r.wear).toBe(100);
  });

  it("failure margin covers material, energy and wear but not labor or extras", () => {
    const r = calculate({ ...DEFAULT_INPUT, failureRate: 10, laborRate: 1000, laborHours: 1, extras: 500 });
    expect(r.failure).toBeCloseTo((r.material + r.energy + r.wear) * 0.1);
    expect(r.cost).toBeCloseTo(r.material + r.energy + r.wear + r.failure + 1000 + 500);
  });

  it("multiplier applies to the printing cost, quantity only splits per unit", () => {
    const one = calculate({ ...DEFAULT_INPUT, multiplier: 4, quantity: 1 });
    const four = calculate({ ...DEFAULT_INPUT, multiplier: 4, quantity: 4 });
    expect(one.printing).toBeCloseTo(one.material + one.energy + one.wear + one.failure);
    expect(one.price).toBeCloseTo(one.printing * 4);
    expect(four.cost).toBeCloseTo(one.cost);
    expect(four.costPerUnit).toBeCloseTo(one.cost / 4);
    expect(four.pricePerUnit).toBeCloseTo(one.price / 4);
  });

  it("passes labor and extras through without the margin", () => {
    const base = calculate({ ...DEFAULT_INPUT, multiplier: 4 });
    const r = calculate({ ...DEFAULT_INPUT, multiplier: 4, laborRate: 5000, laborHours: 2, extras: 8000 });
    expect(r.cost).toBeCloseTo(base.cost + 10000 + 8000);
    expect(r.price).toBeCloseTo(base.price + 10000 + 8000);
    expect(r.profit).toBeCloseTo(base.profit);
  });

  it("adds an optional markup on extras that counts as profit, not cost", () => {
    const r = calculate({ ...DEFAULT_INPUT, extras: 10000, extrasMarkup: 15 });
    const plain = calculate({ ...DEFAULT_INPUT, extras: 10000, extrasMarkup: 0 });
    expect(r.extrasMarkup).toBe(1500);
    expect(r.cost).toBeCloseTo(plain.cost);
    expect(r.price).toBeCloseTo(plain.price + 1500);
    expect(r.profit).toBeCloseTo(plain.profit + 1500);
  });

  it("treats invalid numbers as zero and never divides by zero", () => {
    const r = calculate({ ...DEFAULT_INPUT, grams: NaN, printerLifeHours: 0, quantity: 0 });
    expect(r.material).toBe(0);
    expect(r.wear).toBe(0);
    expect(Number.isFinite(r.costPerUnit)).toBe(true);
  });
});

describe("IVA", () => {
  it("adds VAT on top of the suggested price, per unit and total", () => {
    const r = calculate({ ...DEFAULT_INPUT, vatEnabled: true, vatRate: 21, quantity: 2 });
    expect(r.priceWithVat).toBeCloseTo(r.price * 1.21);
    expect(r.pricePerUnitWithVat).toBeCloseTo(r.pricePerUnit * 1.21);
    expect(r.vat).toBeCloseTo(r.pricePerUnit * 0.21);
  });

  it("is a no-op when disabled", () => {
    const r = calculate({ ...DEFAULT_INPUT, vatEnabled: false, vatRate: 21 });
    expect(r.priceWithVat).toBe(r.price);
    expect(r.vat).toBe(0);
  });
});

describe("Mercado Libre", () => {
  const base = { mlCommission: 14, mlInstallments: "none" as const, mlFeesVat: false };

  it("uses the official fixed fee tiers", () => {
    expect(mlFixedFee(14999)).toBe(1330);
    expect(mlFixedFee(15000)).toBe(2740);
    expect(mlFixedFee(23999)).toBe(2740);
    expect(mlFixedFee(24000)).toBe(3320);
    expect(mlFixedFee(32999)).toBe(3320);
    expect(mlFixedFee(33000)).toBe(0);
  });

  it("grosses up so the seller nets the target after fees", () => {
    const r = mlGrossUp(50000, base);
    expect(r.fixedFee).toBe(0);
    expect(r.listPrice).toBeCloseTo(50000 / 0.86);
    expect(r.net).toBeCloseTo(50000);
  });

  it("climbs to the fixed fee tier of the resulting list price", () => {
    // 12000 / 0.86 = 13953 → tier 1 (1330) → (12000+1330)/0.86 = 15500 → tier 2 (2740) → 17139, stays in tier 2.
    const r = mlGrossUp(12000, base);
    expect(r.fixedFee).toBe(2740);
    expect(r.listPrice).toBeCloseTo((12000 + 2740) / 0.86);
    expect(mlFixedFee(r.listPrice)).toBe(2740);
    expect(r.net).toBeCloseTo(12000);
  });

  it("adds installment charges and 21% VAT on all fees", () => {
    const r = mlGrossUp(50000, { mlCommission: 14, mlInstallments: "same3", mlFeesVat: true });
    expect(r.installments).toBeCloseTo(r.listPrice * 0.089);
    expect(r.feesVat).toBeCloseTo((r.commission + r.installments + r.fixedFee) * 0.21);
    expect(r.net).toBeCloseTo(50000);
  });

  it("is computed per unit on the VAT-inclusive price and totalled by quantity", () => {
    const r = calculate({ ...DEFAULT_INPUT, quantity: 3, vatEnabled: true, mlEnabled: true, ...base });
    expect(r.ml).not.toBeNull();
    expect(r.ml!.net).toBeCloseTo(r.pricePerUnitWithVat);
    expect(r.ml!.listTotal).toBeCloseTo(r.ml!.listPrice * 3);
  });

  it("is null when disabled", () => {
    expect(calculate({ ...DEFAULT_INPUT, mlEnabled: false }).ml).toBeNull();
  });
});

describe("url state", () => {
  it("round-trips non-default fields and omits defaults", () => {
    const qs = encodeState({ input: { ...DEFAULT_INPUT, grams: 120, name: "Llavero" }, currency: "USD" });
    expect(qs).toBe("n=Llavero&g=120&c=USD");
    const back = decodeState(new URLSearchParams(qs));
    expect(back.input?.grams).toBe(120);
    expect(back.input?.name).toBe("Llavero");
    expect(back.input?.material).toBe("PLA");
    expect(back.currency).toBe("USD");
  });

  it("round-trips booleans and installment options", () => {
    const qs = encodeState({
      input: { ...DEFAULT_INPUT, vatEnabled: true, mlEnabled: true, mlFeesVat: false, mlInstallments: "same6" },
      currency: "ARS",
    });
    expect(qs).toBe("iva=1&ml=1&mli=same6&mliva=0");
    const back = decodeState(new URLSearchParams(qs));
    expect(back.input?.vatEnabled).toBe(true);
    expect(back.input?.mlEnabled).toBe(true);
    expect(back.input?.mlFeesVat).toBe(false);
    expect(back.input?.mlInstallments).toBe("same6");
  });

  it("ignores junk values", () => {
    const back = decodeState(new URLSearchParams("m=WOOD&g=-5&c=XXX&x=abc&iva=yes&mli=same99"));
    expect(back.input?.material).toBe("PLA");
    expect(back.input?.grams).toBe(DEFAULT_INPUT.grams);
    expect(back.input?.multiplier).toBe(DEFAULT_INPUT.multiplier);
    expect(back.currency).toBe("ARS");
    expect(back.input?.vatEnabled).toBe(false);
    expect(back.input?.mlInstallments).toBe("none");
  });

  it("returns nothing for an empty query", () => {
    expect(decodeState(new URLSearchParams(""))).toEqual({});
  });
});
