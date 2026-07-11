# warrant — Interactions (motion & microinteractions)

> Motion is functional and subtle (principle 5). It explains state changes; it never
> performs. When in doubt, less. Everything here honours `prefers-reduced-motion`.

---

## Timing & easing

- **Durations:** `--dur-1` 120ms (hovers, colour/opacity, small state), `--dur-2` 180ms
  (element enter/exit, chip/verdict reveal), `--dur-3` 240ms (stage transitions, larger reveals).
- **Easing:** ease-out only for entrances/changes — `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`
  (ease-out-quart feel: quick start, gentle settle). Linear for opacity-only fades is fine.
- **Never** bounce, elastic, or overshoot. Real objects decelerate; they don't spring.

## What may animate

Only `opacity`, `transform`, and `color` / `background-color` / `border-color`.
**Never** animate `width`, `height`, `padding`, `margin`, `top/left`. For a container that
grows (a stage revealing), use a `grid-template-rows: 0fr → 1fr` transition, not `height`.

## Signature moment: the run-trace reveal

Each stage in the Overview stepper enters once, when it becomes relevant:
- The new stage fades + rises: `opacity 0→1`, `translateY(6px→0)`, `--dur-3 --ease-out`.
- Its stepper node fills (colour transition `--dur-2`): `--ink` when a stage completes,
  `--dot` while it is the active decision, `--butter-line` when it is a gate awaiting a person.
- Prior stages do **not** re-animate; they collapse to a static summary instantly.
Prefer this one orchestrated sequence over scattered micro-interactions — a single, calm
top-to-bottom narrative is the delight.

## Buttons & controls

- Hover/active: background/colour transition `--dur-1`. Active (press) may use
  `transform: translateY(0.5px)` — barely perceptible, no scale bounce.
- **In-flight:** disable and swap the label (Primary "Route to a worker" → "Routing…").
  No layout shift, no spinner that jumps. Re-enable on resolve. Guard against double-submit.
- Focus-visible only: the `--focus` ring appears for keyboard focus, not on mouse click.

## Reveals (chips, verdicts, banners)

- The "Classified" chip, the verdict chip, and the gate banner fade+rise (`--dur-2`).
- The gate banner is deliberate, not alarming: no shake, no pulse. Its weight comes from
  size, the butter fill, and the `--dot` motif — not from motion.

## Reputation update (the payoff)

After Confirm, the reputation panel re-fetches and the changed row's **data bar** animates its
fill width via `transform: scaleX()` (transform-based, `--dur-3 --ease-out`) from old→new mean,
and its value counts to the new number. This is the one place a number visibly *moves*, because
"reliability learned from that outcome" is the product's thesis. Keep it to that one row.

## Tables & rows

- Row hover: `background-color` to `--surface`, `--dur-1`. No row lift/scale.
- Sort/filter changes: content swaps without animating row positions (avoid distracting reflow);
  a brief `opacity` settle (`--dur-1`) on the tbody is enough.

## Toasts

Enter: fade + `translateY(8px→0)` `--dur-2`; exit: fade `--dur-1`; auto-dismiss ~2.4s. One at a time.

## Loading & optimistic behaviour

- Keep layout stable while loading: reserve the region, show a quiet "Loading…" caption or a
  low-contrast shimmer on that region only. Never a full-page spinner or layout jump.
- Use optimistic UI only where reversal is safe and cheap (e.g. removing an approved row from
  the Approvals list before the refetch confirms). The core loop's writes (route/execute/approve/
  confirm) are real backend mutations — show honest in-flight states, don't fake success.

## Accessibility of motion

Wrap all non-essential motion in:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
}
```
State changes must still be conveyed without motion (the stage still appears, the bar still
updates, the verdict still shows) — motion is an enhancement, never the only signal.
