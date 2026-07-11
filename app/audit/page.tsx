"use client";

import { Card } from "../_components/card";
import { PageHeader } from "../_components/page";

export default function AuditPage() {
  return (
    <>
      <PageHeader title="Audit" caption="A signed, append-only record of every decision, gate, and approval." />
      <Card>
        <p className="text-[15px] text-ink-2">
          This view is outside the demo scope. The evidence ledger behind it is real — each
          allocation, gate halt, and approval is recorded — but its console surface is not built for
          this demo.
        </p>
      </Card>
    </>
  );
}
