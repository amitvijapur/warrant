# warrant — Brand Tokens (colour · typography · spacing)

> Implementation-ready values derived from `../branding/warrant_brand_kit_v3.md` and
> the board PNG. These are the single source of the CSS custom properties in
> `app/globals.css`. Names here map 1:1 to `--token` names there.

---

## 1. Colour

The system is **monochrome by default**. Pastels carry meaning only and must occupy
**< 5%** of any screen. Never use a pastel as an ambient background or brand fill.

### Neutrals (the whole interface, 95%+)

| Token | Hex | Role |
|---|---|---|
| `--paper` | `#FFFFFF` | App background, cards, primary surface, primary brand colour |
| `--surface` | `#FCFCFC` | Surface alt — subtle section separation from paper |
| `--raised` | `#F6F6F6` | Raised fills: table header, hovered rows, neutral chips, code blocks |
| `--border` | `#E8E8E8` | Card / input / table borders (1px) |
| `--divider` | `#EFEFEF` | Hairline dividers inside a surface |
| `--ink` | `#111111` | Primary text, icons, primary buttons, high-emphasis (brand black — not pure #000) |
| `--ink-2` | `#555555` | Secondary text |
| `--ink-3` | `#8B8B8B` | Muted text, captions, placeholders |
| `--ink-disabled` | `#B7B7B7` | Disabled text and controls |

No shadows anywhere. Elevation is expressed with border + surface tone, never `box-shadow`.

### Semantic pastels (meaning only)

Each has a soft **fill** (backgrounds of chips/banners), a **line** (border/bar), and
an **ink** (text on the fill — a darkened shade of the same hue, never grey on colour).

| Meaning | Token stem | Fill | Line | Ink |
|---|---|---|---|---|
| Information · focus · selection | `--sky` | `#DDE7FF` | `#9DB8FF` | `#274690` |
| Trusted-human · approval · success · PASS | `--mint` | `#DDF0E6` | `#9AD3B4` | `#1F6B45` |
| Warning · awaiting action | `--butter` | `#FFF2CC` | `#EBCF7A` | `#7A5B12` |
| Destructive · FAIL · override | `--blush` | `#FCE1EA` | `#F0AEC4` | `#9B2C50` |
| Decision node · charts/grouping | `--lavender` | `#E6E2FF` | `#C2B8FF` | `#4B3F9E` |
| Charts / secondary grouping | `--peach` | `#FFDCCB` | `#F5B79B` | `#9A4A28` |

### The accent (the dot)

| Token | Hex | Role |
|---|---|---|
| `--dot` | `#8B7FE8` | The wordmark dot and the decision/gate motif. A medium lavender — deeper than `--lavender` fill so it reads on paper. The ONLY saturated mark in the system; use with extreme restraint. |

### Focus

`--focus` = `--sky-line` (`#9DB8FF`). Focus is a 3px ring (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--focus) 55%, transparent)`), never an outline that shifts layout.

### Status → colour mapping (use everywhere, consistently)

- Task/assignment `pending`, `proposed`, `running`, `assigned` → neutral (`--raised` chip)
- `awaiting_approval` → **butter** (an action is owed)
- `completed` → **mint**
- `failed` / `rejected` → **blush**
- Trigger `none` → neutral · `capability` → **sky** · `judgment` → **lavender** · `risk` → **butter**
- Judge/confirm **PASS** → mint · **FAIL** → blush

---

## 2. Typography

Three roles. The brand fonts (Panagram, Panagram Signature Italic) are commercial and
not on Google Fonts; the substitutions below are the shipped defaults and are chosen to
preserve the editorial feel. Swap to licensed Panagram by changing only the `--font-*` vars.

| Role | Brand font | Shipped substitute (`next/font/google`) | Where |
|---|---|---|---|
| Wordmark / display serif gesture | Panagram Signature Italic | **Cormorant**, italic 600 | The `warrant` logotype only |
| UI · headings · body | Panagram (grotesque) | **Geist** (`--font-geist-sans`) | Everything else |
| Data · numerals · IDs · code | IBM Plex Mono | **IBM Plex Mono** (`--font-plex-mono`), 400/500 | Scores, money, latency, α/β, ids, model names, agent output |

Mono is used **for data, not for a "technical" vibe** — numbers align and compare, so
they get a monospace. Prose never uses mono.

### Type scale (fluid where it helps; px baseline)

| Name | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| Display | `clamp(2.25rem, 4vw, 3rem)` (36–48) | 700 | 1.05 | Page-level hero number/word (rare) |
| H1 | 32 | 600 | 1.15 | Page title |
| H2 | 24 | 600 | 1.2 | Section title |
| H3 | 20 | 500 | 1.3 | Card title, sub-section |
| Body-lg | 17 | 400 | 1.5 | Lead paragraph |
| Body | 15 | 400 | 1.55 | Default body |
| Caption | 13 | 400 | 1.45 | Secondary/meta text (`--ink-3`) |
| Micro | 12 | 500 | 1.4 | Chip labels, table column heads (uppercase, tracked +0.04em) |
| Mono | 13–14 | 400/500 | 1.5 | Data values |

Letter-spacing: `-0.01em` on H1/H2 for a tighter editorial set; `+0.04em` uppercase on
Micro labels. Body stays default.

---

## 3. Spacing, radius, sizing

### Space scale (4px base — use these, not arbitrary values)

`--space-1` 4 · `--space-2` 8 · `--space-3` 12 · `--space-4` 16 · `--space-5` 20 ·
`--space-6` 24 · `--space-8` 32 · `--space-10` 40 · `--space-12` 48 · `--space-16` 64 · `--space-20` 80.

Rhythm rule: related items sit at 8–12; groups separate at 24–32; major sections at 48–64.
Do **not** apply one uniform padding everywhere — vary it to create hierarchy.

### Radius

`--radius-sm` 8 (chips inner, small controls) · `--radius-md` 10 (buttons, inputs, selects)
· `--radius-lg` 16 (cards, banners) · `--radius-full` 999 (status chips, the dot, avatars).

### Elevation

None via shadow. Layers read as: `--paper` (base) → 1px `--border` (card) → `--surface`/`--raised`
(nested fills). A hovered interactive surface shifts background one step (`--paper`→`--raised`), not a shadow.

### Sizing constants

`--header-h` 64 · `--sidebar-w` 240 · `--container-max` 1440 · `--content-max` 1200 ·
control height 40 (buttons) / 44 (inputs, textareas min).

### Borders & lines

Default border `1px solid var(--border)`. Inner dividers `1px solid var(--divider)`.
Data bars (axis/score/reliability) are 6px tall, `--radius-full`, track `--raised`, fill `--ink` (or a
semantic line colour when the bar itself is semantic).
