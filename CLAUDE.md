@AGENTS.md

## Design Context

warrant is an operating system for a mixed workforce of humans and AI agents; the UI is
an **operator console**, not a marketing site. The authoritative design system lives in
`design/` — read it before touching any UI:

- `design/frontend_spec.md` — philosophy, principles, anti-references ("Apple designed the Stripe Dashboard")
- `design/brand.md` — colour/typography/spacing tokens (source of the CSS vars in `app/globals.css`)
- `design/components.md`, `design/layouts.md`, `design/interactions.md` — the UI kit, page layouts, motion
- `design/logo*.svg`, `design/ui_refs/` — brand marks and reference screenshots
- `branding/` — the source-of-truth brand board (PNG) + brand kit v3

**Aesthetic:** refined minimalism, editorial monochrome. White paper, `#111` ink, pastels
for *meaning only* (<5%), no shadows, one serif gesture (the `warrant` wordmark + lavender
dot). Voice: clear, measured, evidence-first — no hype. Apply the `frontend-design` skill's
anti-"AI-slop" rules to every screen. Light theme; WCAG AA; `prefers-reduced-motion` honoured.
