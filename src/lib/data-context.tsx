"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isCurrency, type CurrencyCode } from "./format";
import { LocalRepo, RemoteRepo, type Repo } from "./repo";
import { readWorkshopId, writeWorkshopId } from "./storage";
import { getSupabase, supabaseConfigured } from "./supabase";

export type Workshop = { id: string; name: string; joinCode: string; role: string; currency: CurrencyCode };
export type User = { id: string; email: string };

type DataContextValue = {
  /** Supabase env present: login is possible. */
  configured: boolean;
  authLoading: boolean;
  /** Session and workshop list resolved (always true without Supabase). Pages wait for this. */
  ready: boolean;
  user: User | null;
  workshops: Workshop[];
  workshop: Workshop | null;
  /** "remote" once logged in with a workshop; "local" otherwise. */
  mode: "local" | "remote";
  repo: Repo;
  signIn: (email: string) => Promise<void>;
  /** The code in the login email, for an installed app the link can't open into (iOS). */
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectWorkshop: (id: string) => void;
  joinWorkshop: (code: string) => Promise<void>;
  createWorkshop: (name: string) => Promise<void>;
  renameWorkshop: (name: string) => Promise<void>;
  /** Display currency: the workshop's when logged in, else this browser's. */
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
  /** Last error from a background write (e.g. saving the workshop currency). */
  lastError: string | null;
  /** Saved quotes in the active store; null until a page has counted them. */
  savedCount: number | null;
  setSavedCount: (n: number | null) => void;
};

const DataContext = createContext<DataContextValue | null>(null);

const local = new LocalRepo();

function toUser(session: Session | null): User | null {
  return session?.user ? { id: session.user.id, email: session.user.email ?? "" } : null;
}

async function fetchWorkshops(client: SupabaseClient, userId: string): Promise<Workshop[]> {
  // `workshops(*)` tolerates columns added by later migrations (currency).
  const { data, error } = await client.from("workshop_members").select("role, workshops(*)").eq("user_id", userId);
  if (error) throw new Error(error.message);
  type Row = {
    role: string;
    workshops: { id: string; name: string; join_code: string; created_at: string; currency?: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  return rows
    .flatMap((r) => {
      const w = Array.isArray(r.workshops) ? r.workshops[0] : r.workshops;
      return w ? [{ ...w, role: r.role }] : [];
    })
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((w) => ({
      id: w.id,
      name: w.name,
      joinCode: w.join_code,
      role: w.role,
      currency: w.currency && isCurrency(w.currency) ? w.currency : "ARS",
    }));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const client = getSupabase();
  const [authLoading, setAuthLoading] = useState(supabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  // Which user the workshop list belongs to; null until fetched.
  const [workshopsFor, setWorkshopsFor] = useState<string | null>(null);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [localCurrency, setLocalCurrency] = useState<CurrencyCode>("ARS");
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(toUser(data.session));
      setAuthLoading(false);
    });
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(toUser(session));
      if (event === "SIGNED_IN" && window.location.hash.includes("access_token")) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [client]);

  useEffect(() => {
    if (!client || !user) {
      return;
    }
    let active = true;
    fetchWorkshops(client, user.id)
      .then((list) => {
        if (!active) return;
        setWorkshops(list);
        setWorkshopsFor(user.id);
        const stored = readWorkshopId();
        setWorkshopId(list.some((w) => w.id === stored) ? stored : (list[0]?.id ?? null));
      })
      .catch(() => {
        if (!active) return;
        setWorkshops([]);
        setWorkshopsFor(user.id);
      });
    return () => {
      active = false;
    };
  }, [client, user]);

  const workshop = useMemo(() => workshops.find((w) => w.id === workshopId) ?? null, [workshops, workshopId]);
  const workshopsLoading = user !== null && workshopsFor !== user.id;
  const ready = !supabaseConfigured || (!authLoading && !workshopsLoading);
  const currency = workshop ? workshop.currency : localCurrency;

  // Stable setter: consumers list it as an effect dependency.
  const workshopRef = useRef(workshop);
  useEffect(() => {
    workshopRef.current = workshop;
  }, [workshop]);
  const setCurrency = useCallback(
    (code: CurrencyCode) => {
      const w = workshopRef.current;
      if (!w || !client) {
        setLocalCurrency(code);
        return;
      }
      setWorkshops((prev) => prev.map((x) => (x.id === w.id ? { ...x, currency: code } : x)));
      client
        .from("workshops")
        .update({ currency: code })
        .eq("id", w.id)
        .then(({ error }) => {
          if (error) setLastError(`No se pudo guardar la moneda del taller: ${error.message}`);
          else setLastError(null);
        });
    },
    [client],
  );

  // Keyed on ids, so a rename or a refetch of the workshop list keeps the same repo.
  const userId = user?.id ?? null;
  const activeWorkshopId = workshop?.id ?? null;
  const repo = useMemo<Repo>(() => {
    if (client && userId && activeWorkshopId) return new RemoteRepo(client, activeWorkshopId);
    return local;
  }, [client, userId, activeWorkshopId]);

  const value = useMemo<DataContextValue>(
    () => ({
      configured: supabaseConfigured,
      authLoading,
      ready,
      user,
      workshops,
      workshop,
      mode: client && user && workshop ? "remote" : "local",
      repo,
      currency,
      setCurrency,
      lastError,
      savedCount,
      setSavedCount,
      signIn: async (email) => {
        if (!client) throw new Error("Login no configurado");
        const { error } = await client.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw new Error(error.message);
      },
      verifyCode: async (email, code) => {
        if (!client) throw new Error("Login no configurado");
        const { error } = await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
        if (error) throw new Error(/expired|invalid/i.test(error.message) ? "Código inválido o vencido" : error.message);
      },
      signOut: async () => {
        if (!client) return;
        await client.auth.signOut();
        setWorkshops([]);
        setWorkshopsFor(null);
        setWorkshopId(null);
      },
      selectWorkshop: (id) => {
        setWorkshopId(id);
        writeWorkshopId(id);
      },
      joinWorkshop: async (code) => {
        if (!client || !user) throw new Error("Iniciá sesión primero");
        const { data, error } = await client.rpc("join_workshop", { code });
        if (error) throw new Error(error.message);
        const list = await fetchWorkshops(client, user.id);
        setWorkshops(list);
        const id = String(data);
        setWorkshopId(id);
        writeWorkshopId(id);
      },
      createWorkshop: async (name) => {
        if (!client || !user) throw new Error("Iniciá sesión primero");
        const { data, error } = await client
          .from("workshops")
          .insert({ name: name.trim() || "Mi taller", created_by: user.id })
          .select("id")
          .single();
        if (error) throw new Error(error.message);
        const list = await fetchWorkshops(client, user.id);
        setWorkshops(list);
        setWorkshopId(data.id);
        writeWorkshopId(data.id);
      },
      renameWorkshop: async (name) => {
        if (!client || !workshop) return;
        const { error } = await client.from("workshops").update({ name: name.trim() || "Mi taller" }).eq("id", workshop.id);
        if (error) throw new Error(error.message);
        setWorkshops((prev) => prev.map((w) => (w.id === workshop.id ? { ...w, name: name.trim() || "Mi taller" } : w)));
      },
    }),
    [authLoading, ready, user, workshops, workshop, client, repo, currency, setCurrency, lastError, savedCount],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData fuera de DataProvider");
  return ctx;
}

/** The browser-only store, for migrating what was saved before logging in. */
export const localRepo = local;
