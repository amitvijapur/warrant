# warrant — Components

> The UI kit. Every component uses only the tokens in `brand.md`. Build these once in
> `app/_components/` and compose pages from them — no bespoke one-off styling in pages.
> No shadows anywhere. Motion values live in `interactions.md`.

---

## Buttons

Height 40px, `--radius-md`, padding 0 16px, Geist 500, 14px, single-line. Colour is the
only thing that separates the variants; hierarchy must be obvious at a glance.

| Variant | Rest | Hover | Use |
|---|---|---|---|
| **Primary** | `--ink` fill, `--paper` text | bg lightens to `#2A2A2A` | The one main action of a view/step |
| **Secondary** | `--paper` fill, 1px `--ink` border, `--ink` text | bg `--raised` | Alternative actions |
| **Ghost** | transparent, `--ink-2` text | bg `--raised`, text `--ink` | Tertiary / nav-like / low-emphasis |
| **Danger** | `--paper` fill, 1px `--blush-line`, `--blush-ink` text | bg `--blush` fill | Override → fail, destructive |

Rules: at most **one primary** per view/step (see `frontend_spec.md` — not every button
is primary). Disabled: `--ink-disabled` text, `--divider` border, no hover, `cursor: not-allowed`.
**In-flight:** disable + swap label to a quiet working state (e.g. "Routing…"), never a spinner
that shifts layout. Focus: `--focus` ring. Icons optional and rare; if present, 16px, inherit colour.

## Inputs, textarea, select

- Height 44px (textarea min 96px, auto-grow ok), `--radius-md`, `--paper` bg, 1px `--border`,
  14–15px Geist, `--ink` text, `--ink-3` placeholder, padding 0 14px (textarea 12px 14px).
- Hover border `--ink-3`; focus border `--sky-line` + `--focus` ring.
- Every field has a real `<label>` (13px `--ink-2`, 6px above) — no placeholder-as-label.
- Validation/error text: 13px `--blush-ink` below the field; error border `--blush-line`.
- Select: native `<select>` styled to match; custom caret (thin chevron, `--ink-3`).
- Monospace inputs (none needed now) would use `--font-plex-mono`.

## Cards

`--paper` bg, 1px `--border`, `--radius-lg`, padding 20–24px, **no shadow**. Optional header
row: H3 title left, optional caption/action right, then a `--divider` hairline, then content.
Do **not** nest cards in cards — flatten to sections divided by hairlines. Not everything
needs a card; tables and the run-trace live directly on paper.

## Badges / chips (status & meta)

Inline-flex, `--radius-full`, height 22px, padding 0 10px, Micro type (12px/500,
+0.02em). Two kinds:
- **Neutral / meta:** `--raised` fill, `--ink-2` text (e.g. `agent · gpt-4.1-nano`, counts).
- **Semantic status:** pastel `fill` + matching `ink` per the status map in `brand.md`
  (awaiting=butter, completed=mint, failed/override=blush, trigger chips per map).
A leading 6px dot inside a chip is allowed to reinforce a status; keep it the chip's ink colour.

## Data bars (axis / score / reliability)

The core "evidence" primitive. A 6px-tall `--radius-full` track (`--raised`) with a fill
representing 0..1. Label (Micro, `--ink-3`) left, mono value right, bar below. Fill is
`--ink` for neutral magnitudes; for a reliability/confidence bar use `--mint-line`. Keep
these small and quiet — they appear in rows and tables, many at once, and must not shout.
Never render them as decorative sparklines with no axis meaning.

## Score breakdown (routing evidence)

For each candidate worker: a row with worker name (Geist 500), total score (mono, 2dp,
right-aligned), and the four `parts` (axis / cost / latency / reliability) as tiny inline
data bars or a compact `label value` mono cluster. The **chosen** worker's row is marked
with a `--sky` left border (3px) and a subtle `--surface` fill — selection, not celebration.

## Tables

- Full-width, `--paper` bg. Header row: `--raised` fill, Micro uppercase `--ink-3` labels,
  sticky on scroll. Rows separated by `--divider` hairlines (no vertical rules).
- Row height comfortable (48–52px), padding 12–16px. Hover row → `--surface`.
- Numeric columns right-aligned, mono. Text columns left-aligned, Geist.
- Sorting/filtering affordances where useful (Workers, Tasks); keep controls quiet (ghost).
- Empty state replaces the body with a teaching line (see below), never a blank grid.

## Stepper (the Overview run-trace)

A vertical sequence of stages (Compose → Route → Execute → Confirm). Each completed stage
stays visible as a compact summary block; the active stage is expanded with its control.
Connector: a 1px `--divider` vertical line on the left with a `--radius-full` node per stage
(node fills `--ink` when done, `--dot` for the active decision point, `--butter-line` when the
stage is a gate awaiting the human). Progressive disclosure: a stage's control appears only
when the prior stage resolves. No accordions that hide completed evidence.

## Gate banner (the authority moment)

When execution returns `gate_required`, render a prominent but calm banner inside the
Execute stage: `--butter` fill, 1px `--butter-line`, `--radius-lg`, a leading dot motif
(the decision node) in `--dot`, heading "Approval required" (`--ink`, H3), body explaining
"An irreversible action can't run until a person approves it." Then an "Approved by" field
(prefilled operator name) + a **Primary** "Approve & execute" button. This is the flagship
interaction — it should feel weighty and deliberate, never alarming.

## Human work-item (judgment moment)

When execution returns `human_work_item`, render a `--mint`-accented block: "Routed to a
human operator" with the rationale, then a textarea for the operator's response + a Primary
"Submit response" button. Mint because this is trusted-human work, not an error.

## Verdict + confirmation

After output exists: a **PASS** (mint) / **FAIL** (blush) chip with the judge's `judgeDetail`
in body text. Then the human ratifies: Primary "Confirm" (adopts the verdict) and a Danger/
secondary "Override → fail/pass" (inverts it). On confirm, show a quiet "Reputation updated"
caption and refresh the reputation panel.

## Toast / inline feedback

Prefer inline feedback over toasts (a toast for transient confirms like "Approved" is ok:
bottom-right, `--paper`, 1px `--border`, `--radius-md`, auto-dismiss ~2.4s, no shadow — a hairline
and a mint dot suffice). Never use modals for the core flow; the stepper is the flow.

## Nav item (sidebar)

Height 36px, `--radius-md`, padding 0 12px, Geist 14px `--ink-2`. Hover → `--raised`, text
`--ink`. **Active** → `--surface` fill + a 3px `--lavender-line` (or `--sky-line`) left indicator
+ `--ink` text. One active item at a time. Icons optional; if used, 16px line icons, quiet.

## Empty / loading / error states

- **Empty:** one sentence that teaches the next action ("No outcomes yet — run a task.").
- **Loading:** a quiet inline "Loading…" caption or a shimmer on the specific region; never a
  full-page spinner. Keep layout stable (reserve space).
- **Error:** `--blush-ink` caption with the message from the API's `{ error }`; offer a retry
  where sensible. Never crash the page on a failed fetch.
