"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export type LeadsUrlUpdates = Record<string, string | null | undefined>;

// Estado da tela (busca, filtros, aba, lead aberto) vive na URL: links compartilháveis e "voltar" funciona
export function useLeadsUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefWith = useCallback(
    (updates: LeadsUrlUpdates) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );

  const push = useCallback((updates: LeadsUrlUpdates) => router.push(hrefWith(updates), { scroll: false }), [router, hrefWith]);
  const replace = useCallback(
    (updates: LeadsUrlUpdates) => router.replace(hrefWith(updates), { scroll: false }),
    [router, hrefWith],
  );

  return { searchParams, hrefWith, push, replace };
}
