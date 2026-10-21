import { NextRequest, NextResponse } from "next/server";
import { parseListingPrices } from "@/lib/ml";

/**
 * Optional live fees from Mercado Libre. Their API is no longer public:
 * every endpoint answers 403 without a token, so this needs an app
 * (ML_CLIENT_ID / ML_CLIENT_SECRET) and uses the client_credentials grant.
 * Without credentials the page falls back to the built-in table.
 */

const SITE = process.env.ML_SITE_ID ?? "MLA";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";

let cachedToken: { value: string; expiresAt: number } | null = null;

async function appToken(clientId: string, secret: string): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: secret }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Mercado Libre rechazó las credenciales (${res.status})`);
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error("Mercado Libre no devolvió un token");
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 21600) * 1000 };
  return cachedToken.value;
}

export async function GET(req: NextRequest) {
  const clientId = process.env.ML_CLIENT_ID;
  const secret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !secret) return NextResponse.json({ configured: false });

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

  const url = new URL(`https://api.mercadolibre.com/sites/${SITE}/listing_prices`);
  url.searchParams.set("price", String(price));
  if (category) url.searchParams.set("category_id", category);

  try {
    const token = await appToken(clientId, secret);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      if (res.status === 401) cachedToken = null;
      return NextResponse.json({ error: `Mercado Libre respondió ${res.status}` }, { status: 502 });
    }
    const fees = parseListingPrices(await res.json());
    return NextResponse.json({ configured: true, price, fees });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
