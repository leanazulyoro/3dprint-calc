export type MaterialId = "PLA" | "PETG" | "ABS" | "ASA" | "TPU";

export type Material = {
  id: MaterialId;
  label: string;
  /** Multiplier on electricity: heated bed/chamber and higher temps. */
  energy: number;
  /** Multiplier on machine wear: abrasion, temps, retraction stress. */
  wear: number;
  hint: string;
};

export const MATERIALS: Material[] = [
  { id: "PLA", label: "PLA", energy: 1, wear: 1, hint: "Material de referencia, sin recargos." },
  { id: "PETG", label: "PETG", energy: 1.15, wear: 1.3, hint: "Suma 15% de electricidad y 30% de desgaste." },
  { id: "ABS", label: "ABS", energy: 1.6, wear: 1.25, hint: "Suma 60% de electricidad y 25% de desgaste." },
  { id: "ASA", label: "ASA", energy: 1.6, wear: 1.25, hint: "Suma 60% de electricidad y 25% de desgaste." },
  { id: "TPU", label: "TPU", energy: 1.05, wear: 1.35, hint: "Suma 5% de electricidad y 35% de desgaste." },
];

export type PrinterPreset = {
  id: string;
  label: string;
  watts: number;
};

/** Average draw while printing PLA. Approximate; users can override. */
export const PRINTER_PRESETS: PrinterPreset[] = [
  { id: "ender3", label: "Creality Ender 3 / Pro", watts: 130 },
  { id: "ender3v3", label: "Creality Ender 3 V3 SE / KE", watts: 120 },
  { id: "k1max", label: "Creality K1 Max", watts: 170 },
  { id: "k2plus", label: "Creality K2 Plus", watts: 220 },
  { id: "a1mini", label: "Bambu Lab A1 mini", watts: 100 },
  { id: "a1", label: "Bambu Lab A1", watts: 120 },
  { id: "p1s", label: "Bambu Lab P1S / X1C", watts: 110 },
  { id: "kobras1", label: "Anycubic Kobra S1", watts: 130 },
  { id: "kobra3", label: "Anycubic Kobra 3", watts: 120 },
  { id: "neptune4", label: "Elegoo Neptune 4 Pro", watts: 140 },
  { id: "centauri", label: "Elegoo Centauri Carbon", watts: 250 },
  { id: "mk4", label: "Prusa MK4 / MK4S", watts: 110 },
  { id: "ad5x", label: "Flashforge AD5X", watts: 150 },
];

export type MarginPreset = { value: number; label: string };

export const MARGIN_PRESETS: MarginPreset[] = [
  { value: 2, label: "Mayorista" },
  { value: 3, label: "Ganancia media" },
  { value: 4, label: "Estándar" },
  { value: 5, label: "Minorista" },
];

export type MlInstallments = "none" | "low" | "same3" | "same6" | "same9" | "same12";

export type MlInstallmentOption = { id: MlInstallments; label: string; rate: number };

/** Official "costo por ofrecer cuotas" table, Mercado Libre Argentina. */
export const ML_INSTALLMENTS: MlInstallmentOption[] = [
  { id: "none", label: "Sin cuotas (solo las de los bancos)", rate: 0 },
  { id: "low", label: "Cuotas con interés bajo, 3 a 12", rate: 5 },
  { id: "same3", label: "3 cuotas al mismo precio", rate: 8.9 },
  { id: "same6", label: "6 cuotas al mismo precio", rate: 13.4 },
  { id: "same9", label: "9 cuotas al mismo precio", rate: 17.8 },
  { id: "same12", label: "12 cuotas al mismo precio", rate: 21.6 },
];

/**
 * "Costo por unidad vendida" for Flex, acuerdo con el comprador and retiro.
 * Applies below 33.000 ARS. Full/correo/colecta depends on size and weight.
 */
export const ML_FIXED_FEE_TIERS: { upTo: number; fee: number }[] = [
  { upTo: 14999.99, fee: 1330 },
  { upTo: 23999.99, fee: 2740 },
  { upTo: 32999.99, fee: 3320 },
];

export const ML_FEES_UPDATED = "septiembre 2026";
export const ML_COMMISSION_RANGE = { min: 11.62, max: 17.75 };
export const ML_FEES_VAT = 21;

export function mlFixedFee(listPrice: number): number {
  const tier = ML_FIXED_FEE_TIERS.find((t) => listPrice <= t.upTo);
  return tier ? tier.fee : 0;
}

export type CalcInput = {
  name: string;
  material: MaterialId;
  grams: number;
  pricePerKg: number;
  hours: number;
  minutes: number;
  watts: number;
  kwhPrice: number;
  printerPrice: number;
  printerLifeHours: number;
  failureRate: number; // percent
  laborRate: number; // per hour
  laborHours: number;
  extras: number;
  extrasMarkup: number; // percent added on top of extras, not part of the margin
  multiplier: number;
  quantity: number;
  vatEnabled: boolean;
  vatRate: number; // percent
  mlEnabled: boolean;
  mlCommission: number; // percent, "cargo por vender"
  mlInstallments: MlInstallments;
  mlFeesVat: boolean; // 21% IVA charged on ML fees
};

export const DEFAULT_INPUT: CalcInput = {
  name: "",
  material: "PLA",
  grams: 50,
  pricePerKg: 30000,
  hours: 2,
  minutes: 30,
  watts: 120,
  kwhPrice: 150,
  printerPrice: 1400000,
  printerLifeHours: 8000,
  failureRate: 10,
  laborRate: 0,
  laborHours: 0,
  extras: 0,
  extrasMarkup: 0,
  multiplier: 4,
  quantity: 1,
  vatEnabled: false,
  vatRate: 21,
  mlEnabled: false,
  mlCommission: 14,
  mlInstallments: "none",
  mlFeesVat: true,
};

export type CalcResult = {
  printHours: number;
  material: number;
  energy: number;
  wear: number;
  wearPerHour: number;
  failure: number;
  /** Material + energy + wear + failure: the part the margin applies to. */
  printing: number;
  labor: number;
  extras: number;
  extrasMarkup: number;
  cost: number;
  costPerUnit: number;
  price: number;
  pricePerUnit: number;
  profit: number;
  /** Per unit. */
  vat: number;
  priceWithVat: number;
  pricePerUnitWithVat: number;
  ml: MlResult | null;
};

/** Everything per unit: Mercado Libre charges per unit sold. */
export type MlResult = {
  listPrice: number;
  commission: number;
  installments: number;
  fixedFee: number;
  feesVat: number;
  totalFees: number;
  net: number;
  listTotal: number;
};

/**
 * Gross-up a per-unit amount so that after Mercado Libre's cut the seller
 * keeps `net`. The fixed fee depends on the resulting list price, so climb
 * tiers until the tier used matches the price it produces.
 */
export function mlGrossUp(net: number, i: Pick<CalcInput, "mlCommission" | "mlInstallments" | "mlFeesVat">): MlResult {
  const vat = i.mlFeesVat ? 1 + ML_FEES_VAT / 100 : 1;
  const commissionRate = num(i.mlCommission) / 100;
  const installmentsRate = (ML_INSTALLMENTS.find((o) => o.id === i.mlInstallments)?.rate ?? 0) / 100;
  const pct = Math.min(0.95, (commissionRate + installmentsRate) * vat);

  let fixed = 0;
  let listPrice = 0;
  for (let step = 0; step <= ML_FIXED_FEE_TIERS.length; step++) {
    listPrice = (net + fixed * vat) / (1 - pct);
    const needed = mlFixedFee(listPrice);
    if (needed <= fixed) break;
    fixed = needed;
  }

  const commission = listPrice * commissionRate;
  const installments = listPrice * installmentsRate;
  const feesVat = i.mlFeesVat ? (commission + installments + fixed) * (ML_FEES_VAT / 100) : 0;
  const totalFees = commission + installments + fixed + feesVat;
  return {
    listPrice,
    commission,
    installments,
    fixedFee: fixed,
    feesVat,
    totalFees,
    net: listPrice - totalFees,
    listTotal: listPrice,
  };
}

const num = (v: number) => (Number.isFinite(v) && v > 0 ? v : 0);

export function calculate(i: CalcInput): CalcResult {
  const mat = MATERIALS.find((m) => m.id === i.material) ?? MATERIALS[0];
  const printHours = num(i.hours) + num(i.minutes) / 60;

  const material = (num(i.grams) / 1000) * num(i.pricePerKg);
  const energy = (num(i.watts) / 1000) * printHours * num(i.kwhPrice) * mat.energy;
  const wearPerHour = i.printerLifeHours > 0 ? num(i.printerPrice) / i.printerLifeHours : 0;
  const wear = wearPerHour * printHours * mat.wear;
  const machine = material + energy + wear;
  const failure = machine * (num(i.failureRate) / 100);
  const printing = machine + failure;
  const labor = num(i.laborRate) * num(i.laborHours);
  const extras = num(i.extras);
  const extrasMarkup = extras * (num(i.extrasMarkup) / 100);

  const cost = printing + labor + extras;
  const quantity = Math.max(1, Math.floor(num(i.quantity)) || 1);
  const multiplier = num(i.multiplier) || 1;
  // Margin only on what the printer produced. Your hour is already a sale
  // price and bought-in parts are passed through, optionally with a markup.
  const price = printing * multiplier + labor + extras + extrasMarkup;
  const pricePerUnit = price / quantity;

  const vatRate = i.vatEnabled ? num(i.vatRate) / 100 : 0;
  const pricePerUnitWithVat = pricePerUnit * (1 + vatRate);
  const priceWithVat = price * (1 + vatRate);

  const ml = i.mlEnabled ? mlGrossUp(pricePerUnitWithVat, i) : null;
  if (ml) ml.listTotal = ml.listPrice * quantity;

  return {
    printHours,
    material,
    energy,
    wear,
    wearPerHour,
    failure,
    printing,
    labor,
    extras,
    extrasMarkup,
    cost,
    costPerUnit: cost / quantity,
    price,
    pricePerUnit,
    profit: price - cost,
    vat: pricePerUnitWithVat - pricePerUnit,
    priceWithVat,
    pricePerUnitWithVat,
    ml,
  };
}
