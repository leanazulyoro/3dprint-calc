"use client";

import Link from "next/link";
import { useData } from "@/lib/data-context";
import { AuthBar } from "./AuthBar";
import { BookmarkIcon } from "./icons";
import { Skeleton } from "./Skeleton";

export function TopBar() {
  const { ready, savedCount } = useData();
  return (
    <div className="no-print sticky top-0 z-20 border-b border-line bg-ticket/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 sm:gap-3 px-4 sm:px-6 py-2">
        <Link href="/" className="display flex shrink-0 items-center gap-2 text-base font-semibold text-ink hover:text-accent-ink" aria-label="Calculadora 3D, inicio">
          {/* eslint-disable-next-line @next/next/no-img-element -- static svg, no optimizer */}
          <img src="/logo.svg" alt="" width={24} height={24} className="h-6 w-6 rounded-[6px]" />
          <span className="hidden sm:inline">Calculadora 3D</span>
        </Link>
        <nav className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2" aria-label="Principal">
          {ready ? (
            <Link href="/guardados" className="btn py-1.5 px-2.5 sm:px-3 gap-1.5" aria-label="Guardados">
              <BookmarkIcon />
              <span className="hidden sm:inline">Guardados</span>
              {savedCount !== null ? (
                <span className="num text-ink-3">{savedCount}</span>
              ) : (
                <Skeleton className="h-3.5 w-4" />
              )}
            </Link>
          ) : (
            <Skeleton className="h-8 w-14 sm:w-32" />
          )}
          <AuthBar />
        </nav>
      </div>
    </div>
  );
}
