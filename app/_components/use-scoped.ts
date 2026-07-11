"use client";

import { useCallback, useEffect, useState } from "react";
import { useCompany } from "./company-context";

/**
 * Fetch a company-scoped resource, re-running whenever the selected company
 * changes. `fetcher` must be a stable reference (an `api.*` method or a module-
 * scope function) so the effect doesn't loop.
 */
export function useScoped<T>(fetcher: (companyId: string) => Promise<T>) {
  const { companyId } = useCompany();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    if (!companyId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetcher(companyId)
      .then(setData)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [companyId, fetcher]);

  useEffect(() => {
    // Fetch when the scope (companyId) or fetcher changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  return { data, loading, error, reload, companyId };
}
