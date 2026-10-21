import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Inlined at build time: without both values the app stays local-only. */
export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      // Implicit flow: a magic link opened in another browser still signs in.
      auth: { flowType: "implicit", persistSession: true, detectSessionInUrl: true, autoRefreshToken: true },
    });
  }
  return client;
}
