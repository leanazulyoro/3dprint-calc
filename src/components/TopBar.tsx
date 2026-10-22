"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useData } from "@/lib/data-context";
import { CURRENCIES, type CurrencyCode } from "@/lib/format";
import { AuthBar } from "./AuthBar";
import { BookmarkIcon, ChevronIcon, DollarIcon } from "./icons";
import { Skeleton } from "./Skeleton";

function CurrencyMenu() {
  const { currency, setCurrency } = useData();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (code: CurrencyCode) => {
    setCurrency(code);
    setOpen(false);
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        className="btn py-1.5 gap-1.5"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Moneda: ${currency}`}
        onClick={() => setOpen((v) => !v)}
      >
        <DollarIcon />
        <span className="num">{currency}</span>
        <ChevronIcon />
      </button>
      {open ? (
        <ul
          role="menu"
          aria-label="Moneda"
          className="absolute right-0 mt-1.5 z-30 min-w-56 rounded-md border border-line bg-ticket py-1 shadow-[0_8px_24px_rgba(15,27,45,0.12)]"
        >
          {CURRENCIES.map((c) => (
            <li key={c.code} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={c.code === currency}
                className={`flex w-full items-center justify-between gap-4 px-3 py-1.5 text-sm text-left hover:bg-paper ${
                  c.code === currency ? "font-semibold text-accent-ink" : "text-ink"
                }`}
                onClick={() => pick(c.code)}
              >
                <span>{c.label}</span>
                <span className="num text-ink-3">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function TopBar() {
  const { ready, savedCount } = useData();
  return (
    <div className="no-print sticky top-0 z-20 border-b border-line bg-ticket/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 py-2">
        <Link href="/" className="display text-base font-semibold text-ink hover:text-accent-ink">
          Calculadora 3D
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-2" aria-label="Principal">
          <CurrencyMenu />
          {ready ? (
            <Link href="/guardados" className="btn py-1.5 gap-1.5">
              <BookmarkIcon />
              <span>Guardados</span>
              {savedCount !== null ? (
                <span className="num text-ink-3">{savedCount}</span>
              ) : (
                <Skeleton className="h-3.5 w-4" />
              )}
            </Link>
          ) : (
            <Skeleton className="h-8 w-32" />
          )}
          <AuthBar />
        </nav>
      </div>
    </div>
  );
}
