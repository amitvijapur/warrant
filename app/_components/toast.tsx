"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type Toast = { id: number; message: string };
type ToastCtx = { show: (message: string) => void };

const Ctx = createContext<ToastCtx | null>(null);

/** Transient confirmations only (e.g. "Approved"). Inline feedback is preferred
 *  for the core flow; toasts are a hairline + a mint dot, auto-dismissing. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const show = useCallback((message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2400);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex flex-col gap-2"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-toast-in flex items-center gap-2.5 rounded-md border border-border bg-paper px-3.5 py-2.5 text-[14px] text-ink"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-mint-line" />
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
