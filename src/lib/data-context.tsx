"use client";

import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { CurrencyCode } from "./format";
import { LocalRepo, RemoteRepo, type Repo } from "./repo";
import { readWorkshopId, writeWorkshopId } from "./storage";
import { getSupabase, supabaseConfigured } from "./supabase";

export type Workshop = { id: string; name: string; joinCode: string; role: string };
export type User = { id: string; email: string };

type DataContextValue = {
  /** Supabase env present: login is possible. */
  configured: boolean;
  authLoading: boolean;
  user: User | null;
  workshops: Workshop[];
  workshop: Workshop | null;
  /** "remote" once logged in with a workshop; "local" otherwise. */
  mode: "local" | "remote";
  repo: Repo;
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  selectWorkshop: (id: string) => void;
  joinWorkshop: (code: string) => Promise<void>;
  createWorkshop: (name: string) => Promise<void>;
  renameWorkshop: (name: string) => Promise<void>;
  /** Display currency, owned here so the top bar and the calculator agree. */
  currency: CurrencyCode;
  setCurrency: (c: CurrencyCode) => void;
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
  const { data, error } = await client
    .from("workshop_members")
    .select("role, workshops(id, name, join_code, created_at)")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  type Row = { role: string; workshops: { id: string; name: string; join_code: string; created_at: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  return rows
    .flatMap((r) => {
      const w = Array.isArray(r.workshops) ? r.workshops[0] : r.workshops;
      return w ? [{ id: w.id, name: w.name, joinCode: w.join_code, role: r.role, createdAt: w.created_at }] : [];
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((w) => ({ id: w.id, name: w.name, joinCode: w.joinCode, role: w.role }));
}

export function DataProvider({ children }: { children: ReactNode }) {
  const client = getSupabase();
  const [authLoading, setAuthLoading] = useState(supabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const [currency, setCurrency] = useState<CurrencyCode>("ARS");
  const [savedCount, setSavedCount] = useState<number | null>(null);

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
        const stored = readWorkshopId();
        setWorkshopId(list.some((w) => w.id === stored) ? stored : (list[0]?.id ?? null));
      })
      .catch(() => {
        if (active) setWorkshops([]);
      });
    return () => {
      active = false;
    };
  }, [client, user]);

  const workshop = useMemo(() => workshops.find((w) => w.id === workshopId) ?? null, [workshops, workshopId]);

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
      user,
      workshops,
      workshop,
      mode: client && user && workshop ? "remote" : "local",
      repo,
      currency,
      setCurrency,
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
      signOut: async () => {
        if (!client) return;
        await client.auth.signOut();
        setWorkshops([]);
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
    [authLoading, user, workshops, workshop, client, repo, currency, savedCount],
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
