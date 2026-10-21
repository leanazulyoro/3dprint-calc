import { NextRequest, NextResponse } from "next/server";
import { ML_SITE, mlConfigured, mlGet } from "@/lib/ml-server";

/** Phase 0: does Mercado Libre's search answer an app token? Raw passthrough. */
export async function GET(req: NextRequest) {
  if (!mlConfigured()) return NextResponse.json({ configured: false });
  const q = req.nextUrl.searchParams.get("q")?.trim() || "filamento pla 1kg";
  const limit = req.nextUrl.searchParams.get("limit") ?? "10";
  try {
    const { status, body } = await mlGet(`/sites/${ML_SITE}/search`, { q, limit });
    const b = (body ?? {}) as { paging?: unknown; results?: unknown[] };
    const results = Array.isArray(b.results) ? b.results : [];
    return NextResponse.json({
      configured: true,
      status,
      paging: b.paging ?? null,
      sample: results.slice(0, 10).map((r) => {
        const o = r as Record<string, unknown>;
        return { id: o.id, title: o.title, price: o.price, currency: o.currency_id, condition: o.condition, category: o.category_id };
      }),
      error: results.length ? undefined : body,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 502 });
  }
}
