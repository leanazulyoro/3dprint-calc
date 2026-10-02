import { describe, expect, it } from "vitest";
import { parseListingPrices } from "./ml";

describe("parseListingPrices", () => {
  it("maps the listing_prices shape", () => {
    const fees = parseListingPrices([
      {
        listing_type_id: "gold_special",
        listing_type_name: "Clásica",
        currency_id: "ARS",
        listing_fee_amount: 0,
        sale_fee_amount: 2630,
        sale_fee_details: { percentage_fee: 13, fixed_fee: 1330, gross_amount: 2630 },
      },
      { listing_type_id: "gold_pro", listing_type_name: "Premium", sale_fee_amount: 3060 },
    ]);
    expect(fees).toEqual([
      { id: "gold_special", name: "Clásica", percentage: 13, fixedFee: 1330, saleFee: 2630 },
      { id: "gold_pro", name: "Premium", percentage: null, fixedFee: null, saleFee: 3060 },
    ]);
  });

  it("drops junk", () => {
    expect(parseListingPrices({ message: "nope" })).toEqual([]);
    expect(parseListingPrices([null, {}, { listing_type_id: 5 }])).toEqual([
      { id: "5", name: "5", percentage: null, fixedFee: null, saleFee: null },
    ]);
  });
});
