"use client";

import { PageHeader } from "../_components/page";
import { Card } from "../_components/card";
import { Field, Select, TextInput } from "../_components/field";
import { useCompany } from "../_components/company-context";

export default function SettingsPage() {
  const { companies, companyId, setCompanyId, operator, setOperator, loading } = useCompany();

  return (
    <>
      <PageHeader
        title="Settings"
        caption="The workspace this console is scoped to, and who is acting in it."
      />
      <div className="max-w-xl">
        <Card title="Workspace">
          <div className="space-y-5">
            <Field
              label="Company"
              htmlFor="settings-company"
              hint="Every page is scoped to this company."
            >
              <Select
                id="settings-company"
                value={companyId ?? ""}
                disabled={loading || companies.length === 0}
                onChange={(e) => setCompanyId(e.target.value)}
              >
                {loading && <option value="">Loading…</option>}
                {!loading && companies.length === 0 && <option value="">No companies</option>}
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Operator"
              htmlFor="settings-operator"
              hint="Signs approvals at the gate and confirms outcomes."
            >
              <TextInput
                id="settings-operator"
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                placeholder="Your name"
              />
            </Field>
          </div>
        </Card>
      </div>
    </>
  );
}
