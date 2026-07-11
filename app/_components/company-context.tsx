"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Company } from "@/lib/db-types";
import { api } from "../lib/client";

const COMPANY_KEY = "warrant.companyId";
const OPERATOR_KEY = "warrant.operator";
const DEFAULT_OPERATOR = "Amit";

type CompanyCtx = {
  companies: Company[];
  company: Company | null;
  companyId: string | null;
  setCompanyId: (id: string) => void;
  operator: string;
  setOperator: (name: string) => void;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

const Ctx = createContext<CompanyCtx | null>(null);

/**
 * Every page is scoped to the company chosen in the header. The selection and
 * the operator name are persisted to localStorage and shared here so no page
 * hardcodes an id. `operator` is used as approvedBy / confirmedBy.
 */
export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyIdState] = useState<string | null>(null);
  const [operator, setOperatorState] = useState<string>(DEFAULT_OPERATOR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .companies()
      .then((list) => {
        setCompanies(list);
        const saved =
          typeof window !== "undefined" ? localStorage.getItem(COMPANY_KEY) : null;
        const next = saved && list.some((c) => c.id === saved) ? saved : list[0]?.id ?? null;
        setCompanyIdState(next);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedOp = localStorage.getItem(OPERATOR_KEY);
      // Hydrate the operator name from localStorage on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (savedOp) setOperatorState(savedOp);
    }
    load();
  }, [load]);

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(COMPANY_KEY, id);
  }, []);

  const setOperator = useCallback((name: string) => {
    setOperatorState(name);
    if (typeof window !== "undefined") localStorage.setItem(OPERATOR_KEY, name);
  }, []);

  const company = companies.find((c) => c.id === companyId) ?? null;

  return (
    <Ctx.Provider
      value={{
        companies,
        company,
        companyId,
        setCompanyId,
        operator,
        setOperator,
        loading,
        error,
        reload: load,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useCompany(): CompanyCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
}
