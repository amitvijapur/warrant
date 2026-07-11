"use client";

import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

const BASE =
  "field-focus w-full rounded-md border border-border bg-paper text-[15px] text-ink placeholder:text-ink-3 hover:border-ink-3 disabled:cursor-not-allowed disabled:text-ink-disabled";

/** A labelled form row. Every control gets a real <label>. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-[13px] text-blush-ink">{error}</p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${BASE} h-11 px-3.5 ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${BASE} min-h-24 resize-y px-3.5 py-3 leading-[1.55] ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${BASE} select-caret h-11 cursor-pointer px-3.5 ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}
