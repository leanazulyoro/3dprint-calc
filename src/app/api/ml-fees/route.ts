import { NextRequest, NextResponse } from "next/server";
import { parseListingPrices } from "@/lib/ml";
import { ML_SITE, mlConfigured, mlGet } from "@/lib/ml-server";

/**
 * Optional live fees from Mercado Libre. Their API is no longer public:
 * every endpoint answers 403 without a token, so this needs an app
 * (ML_CLIENT_ID / ML_CLIENT_SECRET) and uses the client_credentials grant.
 * Without credentials the page falls back to the built-in table.
 */

export async function GET(req: NextRequest) {
  if (!mlConfigured()) return NextResponse.json({ configured: false });

  const params = req.nextUrl.searchParams;
  if (!params.has("price")) return NextResponse.json({ configured: true });

  const price = Number(params.get("price"));
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: "Precio inválido" }, { status: 400 });
  }
  const category = params.get("category")?.trim() ?? "";
  if (category && !/^ML[A-Z]\d{1,12}$/.test(category)) {
    return NextResponse.json({ error: "Categoría inválida, esperaba algo como MLA1234" }, { status: 400 });
  }

  try {
    const params: Record<string, string> = { price: String(price) };
    if (category) params.category_id = category;
    const { status, body } = await mlGet(`/sites/${ML_SITE}/listing_prices`, params);
    if (status < 200 || status >= 300) {
      return NextResponse.json({ error: `Mercado Libre respondió ${status}` }, { status: 502 });
    }
    const fees = parseListingPrices(body);
    return NextResponse.json({ configured: true, price, fees });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
