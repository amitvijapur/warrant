# warrant — Frontend Specification

> The overall philosophy. Read this first, then `brand.md`, `components.md`,
> `layouts.md`, `interactions.md`. The board in `../branding/` (PNG + brand kit v3)
> is the visual source of truth; these files are its implementation contract.

---

## What warrant is

**warrant is an operating system for a mixed workforce of humans and AI agents.**
A company describes its workers (AI agents and human employees) and its kinds of
work. When a task arrives, warrant decides **who should do it** — a specific agent,
a human, or an agent proposing work a human must approve — measures the outcome, and
learns, so the next decision is better. Irreversible actions are always gated behind
a signed human approval.

The interface is an **operator console**: the surface where a person watches the
system reason, intervenes where judgment or authority is required, and reads how
reliability is accumulating. It is an instrument, not a marketing site.

## The one-line design brief

**"Build warrant as if Apple designed the Stripe Dashboard."**

Calm, editorial, evidence-first. The product's credibility *is* its aesthetic:
a routing engine that claims to be trustworthy must itself look considered,
precise, and quiet. Flashiness would undercut the thesis.

## Design principles

1. **Information first.** Every pixel serves comprehension. The routing decision,
   the scores behind it, the verdict, the reliability — these are the content.
   Decoration that competes with them is removed.
2. **Typography over decoration.** Hierarchy comes from type scale, weight, and
   space — not from borders, boxes, shadows, or colour. We have one serif gesture
   (the wordmark) and one disciplined sans; the rest is restraint.
3. **White space creates hierarchy.** Generous, *varied* spacing. Tight groupings
   for related facts, wide separations between sections. Rhythm, not uniform padding.
4. **Colour is reserved for meaning.** The interface is monochrome. Pastels appear
   only to carry a specific signal — information, approval, warning, risk — and never
   as ambient decoration. If a colour isn't saying something, it isn't used.
5. **Motion is subtle.** Short, ease-out, functional. Motion explains a state change;
   it never performs. No bounce, no parallax, no attention-seeking.
6. **Evidence, not assertion.** The UI shows *why*: the score breakdown, the trigger
   that fired, the judge's reasoning, the α/β behind a reliability number. Trust is
   earned by being legible, not by being asserted.

## Aesthetic direction (committed)

**Refined minimalism — editorial monochrome.** This is a deliberate, bold choice in
the same way maximalism is; the discipline is the point. Reference the calm of Apple's
typography, the information density and quiet confidence of the Stripe Dashboard, the
keyboard-first precision of Linear, and the softness of Arc's pastel accents. See
`ui_refs/`. Borrow the *feeling*, never the layout.

**Anti-references (what warrant must NOT look like):**
- Generic AI-dashboard slop: identical card grids, big-number "hero metric" tiles,
  glassmorphism, glowing accents on dark backgrounds, purple→blue gradients, neon.
- Enterprise-SaaS heaviness: drop shadows everywhere, dense chrome, saturated brand
  bars, clip-art icons above every heading.
- Crypto/fintech "trading terminal" darkness. warrant is light, calm, and literate.

## Brand personality

Precise · Calm · Trustworthy · Deliberate · Human · Intelligent.

**Voice:** clear, measured, evidence-first. Short declarative sentences. No hype, no
exclamation marks, no emoji in the product. Labels state what a thing *is*; empty
states teach the next action. ("No outcomes yet — run a task." not "Nothing here!")

## Users & the job to be done

A single operator (in the demo, "Amit") running a company's work through the system:
submitting tasks, watching them route, supplying human judgment when the router asks,
approving irreversible actions at the gate, and confirming or overriding the automated
judge. Their emotional need is **confidence** — to trust the machine's decisions
because they can see the reasoning, and to feel in control at the two moments that
matter (judgment and authority).

## Theme & scope

- **Light theme only.** White is the primary brand colour; the product lives on paper.
  (A dark logo variant exists for dark surfaces like the app icon, but the app is light.)
- **Desktop-first** operator console (the demo is shown on a laptop), but layouts must
  not break below tablet; nothing critical is amputated on smaller screens.
- **Accessibility:** WCAG AA contrast for text and controls, real `<label>`s and
  `<button>`s, visible focus rings, and `prefers-reduced-motion` honoured.

## The signature detail

The **dot** after the `warrant` wordmark. It is the one piece of brand iconography and
it *means something*: the decision point, the orchestration node, the human in the loop.
It reappears, sparingly, as the motif for a decision or a gate — never as generic decoration.

## The AI-slop test (apply before shipping any screen)

If someone saw this screen and said "an AI made this," would you believe them? If yes,
it fails. The tells are in the anti-references above. A warrant screen should read as
*considered software*, not as a template fill.
