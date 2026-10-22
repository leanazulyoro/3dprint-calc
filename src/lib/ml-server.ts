/**
 * Server-only access to Mercado Libre's API with an app token
 * (client_credentials). Their API is closed: nothing works without it.
 */

const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
export const ML_API = "https://api.mercadolibre.com";
export const ML_SITE = process.env.ML_SITE_ID ?? "MLA";

export function mlConfigured(): boolean {
  return Boolean(process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

export async function mlAppToken(): Promise<string> {
  const clientId = process.env.ML_CLIENT_ID;
  const secret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !secret) throw new Error("Mercado Libre no está configurado");
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

export function mlForgetToken() {
  cachedToken = null;
}

/** GET on the API with a given token. Returns the parsed body and the status. */
export async function mlGetWith(
  token: string,
  path: string,
  params: Record<string, string> = {},
): Promise<{ status: number; body: unknown }> {
  const url = new URL(`${ML_API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/** GET with the app token (client_credentials). */
export async function mlGet(path: string, params: Record<string, string> = {}): Promise<{ status: number; body: unknown }> {
  const r = await mlGetWith(await mlAppToken(), path, params);
  if (r.status === 401) mlForgetToken();
  return r;
}
