# warrant — Layouts

> Page-level composition. Uses the components in `components.md` and the tokens in
> `brand.md`. The app is a light, desktop-first operator console with a fixed left
> sidebar. Content column caps at `--content-max` (1200px) inside a `--container-max`
> (1440px) shell; the app breathes with generous, *varied* margins.

---

## App shell (`app/layout.tsx` + `Sidebar`, `TopBar`)

```
┌──────────────────────────────────────────────────────────────┐
│  TopBar (64px, 1px bottom border)                             │
│  warrant•            [ Overview ]        [ Company ▾ ] [op]   │
├───────────┬──────────────────────────────────────────────────┤
│ Sidebar   │  Main (scrolls; content max 1200, centered,       │
│ (240px,   │  padding 32–48)                                    │
│  1px right│                                                    │
│  border)  │   <page>                                           │
│           │                                                    │
│ Overview  │                                                    │
│ Workers   │                                                    │
│ Tasks     │                                                    │
│ Approvals │                                                    │
│ Audit     │                                                    │
│ Policies  │                                                    │
│ Analytics │                                                    │
│ Settings  │                                                    │
└───────────┴──────────────────────────────────────────────────┘
```

- **TopBar:** `warrant` wordmark + dot far left (links to Overview). Center/left of the
  right cluster: the current page name (optional, Micro `--ink-3`). Right cluster: the
  **company selector** (`GET /api/companies`, persisted in context + localStorage) and the
  **operator name** field/label (used as `approvedBy`/`confirmedBy`, default "Amit").
- **Sidebar:** nav items in `components.md` order. Fixed, full-height, 1px right border,
  `--paper`. Active item marked per nav-item spec. The section is the only chrome — no logos
  repeated, no collapsible clutter for the demo.
- **Main:** single scroll region. Page header block = H1 title + one-line `--ink-3` caption.
  Then content. Respect the space rhythm (title→content 24–32; between sections 48).
- **Responsive:** ≤ 1024px the sidebar collapses to a top row of nav links (or a slim icon
  rail); nothing is removed. The company selector stays reachable.

Priority: **Overview, Workers, Tasks, Approvals, Policies, Analytics are fully built.**
**Audit** and **Settings** are honest placeholders (a single card: "This view is outside the
demo scope.") — never faked data.

---

## Overview `/` — the live routing loop (the centrepiece)

Two columns on desktop; stacks on narrow. Left ≈ 62%, right ≈ 38%, gap 32–40.

**Left — the run trace (a `Stepper`).** One task at a time, top to bottom, prior stages
staying visible as evidence:

1. **Compose.** Card "New task": operator name (if not in TopBar), Title input, Input
   textarea. Three one-click **example** chips above the textarea that fill realistic tasks
   (invoice → autonomous; purchase order → gate; upset customer → human). Primary "Submit task".
   → `POST /api/tasks`. Result: a `--sky` "Classified" chip — `{taskType} · confidence 0.NN ·
   {reversible|irreversible}` — with `classification.reasoning` as a caption.
2. **Route.** Primary "Route to a worker" → `POST /api/tasks/{id}/route`. Renders the
   **Routing Decision**: chosen worker (H3), mode, a **trigger chip** (per status map) with a
   one-line plain-language gloss of what the trigger means, the **score breakdown** for every
   candidate (chosen row marked), and the rationale (body).
3. **Execute.** Primary "Execute" → `POST /api/assignments/{id}/execute`, then branch:
   - `completed` → **Output** (mono block, `--raised`), a `cost $0.0000 · latency Nms` meta row,
     the **verdict** chip + detail. → Confirm.
   - `gate_required` → the **Gate banner** (see components) → Approve & execute
     (`POST …/approve`) → Output + verdict → Confirm.
   - `human_work_item` → the **human work-item** block → Submit response (`POST …/output`)
     → verdict → Confirm.
4. **Confirm.** "Confirm" / "Override" (`POST /api/outcomes/{id}/confirm`) → "Reputation
   updated" caption + refresh the right column. A ghost "Run another task" resets the trace.

**Right — Reputation (live).** `GET /api/companies/{id}/reputation`. A quiet titled panel
(not a heavy card): rows of `worker · task type` with a reliability **data bar** (mean, mono
2dp) and an `α=… β=…` caption. Grouped by worker. Empty: "No outcomes yet — run a task."
This column re-fetches after every Confirm so the audience watches reliability move.

The Overview is the demo. It must read as a single, legible narrative from a free-text task to
an evidence-backed decision to a measured, learned outcome.

---

## Workers `/workers`

Page header + a **table** of `GET …/workers` (active). Columns: Name · Kind (chip: agent =
neutral, human = mint) · Backing (mono `provider · model`, "—" for humans) · Cost (mono
`$0.00`) · Latency (mono `~Ns`) · Suitability. The suitability cell shows a compact set of
axis **data bars** (human axes + AI axes) so a reader can see, at a glance, what each worker is
good at. Sort by name; allow a quick text filter.

## Tasks `/tasks`

Page header + a **table** of `GET …/tasks`, newest first. Columns: Title · Type · Status
(status chip per map) · Created (relative, e.g. "2m ago", with absolute on hover). Read-only
ledger of everything submitted.

## Approvals `/approvals`

Page header + a list of `GET …/assignments?status=awaiting_approval`. Each item is a card:
task title (resolved via tasks) + chosen worker + rationale + the Gate treatment inline
(Approved-by field prefilled, Primary "Approve & execute" → `POST …/approve`); on success the
row leaves with a mint toast. Empty: "Nothing is awaiting approval." This is the standalone
authority queue — the same gate as Overview, gathered in one place.

## Policies `/policies`

Page header + `GET …/task-types` as a set of sections (not a uniform card grid): each task
type shows Name (H3) + reversibility chip (reversible = neutral, irreversible = butter),
description (body), acceptance criteria (body, `--ink-2`), and the **required** human/AI axis
profile as data bars. This is where a tenant's routing rules are made legible — "what the
system expects of a worker for this kind of work."

## Analytics `/analytics`

Page header + the full reliability picture: the reputation data (same source as Overview's
panel) at full width, grouped by worker, each (task type, mean, α/β) as a data-bar row. One
explanatory line up top: "Reliability is a Beta posterior over confirmed outcomes; it never
resets." Keep it a reading surface, not a chart-junk dashboard — bars and numbers, quiet.

## Audit `/audit`, Settings `/settings`

Single honest placeholder card each ("This view is outside the demo scope."). Present so the
nav is complete and the shell reads as a real product; never populated with fake data.
