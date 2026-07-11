"use client";

import type { ReactNode } from "react";
import { CompanyProvider } from "./company-context";
import { ToastProvider } from "./toast";
import { TopBar } from "./top-bar";

/**
 * The console shell: a single top row (wordmark, tabs, settings) over one calm
 * scrolling column. No left rail — the app opens like a landing (see the Overview
 * page) and the chrome stays out of the way. Content caps at 1180px.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CompanyProvider>
      <ToastProvider>
        <div className="flex min-h-screen flex-col">
          <TopBar />
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-8 sm:px-8">
              {children}
            </div>
          </main>
        </div>
      </ToastProvider>
    </CompanyProvider>
  );
}
