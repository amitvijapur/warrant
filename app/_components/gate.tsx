"use client";

import { useState } from "react";
import { Button } from "./button";
import { Field, TextInput } from "./field";

/**
 * The authority moment. Calm, not alarming: its weight comes from size, the
 * butter fill, and the dot motif (the decision node) — never from motion. The
 * operator name is prefilled and locally editable; approving calls onApprove.
 */
export function GateBanner({
  defaultApprovedBy,
  onApprove,
  pending,
  idPrefix = "gate",
}: {
  defaultApprovedBy: string;
  onApprove: (approvedBy: string) => void;
  pending: boolean;
  idPrefix?: string;
}) {
  const [approvedBy, setApprovedBy] = useState(defaultApprovedBy);
  const id = `${idPrefix}-approved-by`;

  return (
    <div className="rounded-lg border border-butter-line bg-butter p-5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="mt-1 size-2.5 shrink-0 rounded-full bg-dot" />
        <div className="space-y-1">
          <h3 className="text-[19px] font-medium tracking-[-0.01em] text-ink">Approval required</h3>
          <p className="text-[14px] text-butter-ink">
            An irreversible action can’t run until a person approves it.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <Field label="Approved by" htmlFor={id}>
            <TextInput
              id={id}
              value={approvedBy}
              onChange={(e) => setApprovedBy(e.target.value)}
              className="bg-paper"
            />
          </Field>
        </div>
        <Button
          variant="primary"
          pending={pending}
          pendingLabel="Approving…"
          disabled={!approvedBy.trim()}
          onClick={() => onApprove(approvedBy.trim())}
        >
          Approve &amp; execute
        </Button>
      </div>
    </div>
  );
}
