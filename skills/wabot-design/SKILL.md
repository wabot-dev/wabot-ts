---
name: wabot-design
description: A ready-made design system for building good-looking web UIs in Wabot apps. Ships tokens (color, type, spacing, radii, motion), accessible components (buttons, badges, cards, forms, tables), and layout primitives so elements look polished by default. Use when generating UI, pages, forms, prototypes, slides, or any visual artifact for a Wabot project.
user-invocable: true
---

# wabot-design

A ready-to-use design system for Wabot apps: download it once and build against its tokens,
components, and layout primitives — tuned so your UI looks good by default, with no per-project
theming work. It is distributed at `https://design.wabot.dev/assets/`, but you copy it into the
project and render from that local file, never a runtime CDN link.

---

## 1. Set up the design system (download once, keep it local and upgradable)

Seed the project with the published stylesheet, then reference the **local** file everywhere. This
keeps the app working offline and under a strict CSP, pins it to a known version, and lets you
extend it.

```bash
mkdir -p src/design
# Seed the project's design system from the published base.
curl -fsSL https://design.wabot.dev/assets/colors_and_type.css -o src/design/wabot-design.css
```

- `src/design/wabot-design.css` is **the file the project uses** — it carries the color + type tokens and the base component/layout classes used throughout this skill.
- **Upgrade** by re-running the download (it overwrites the file). Treat it as generated: don't hand-edit it. Keep any customizations in a separate `wabot-design.overrides.css` loaded _after_ it, so an upgrade never clobbers your changes.
- If the published system ever splits into several stylesheets, download each into `src/design/` and link/inline them together.
- Its `@font-face` rules load Geist + Geist Mono from `https://design.wabot.dev/assets/fonts/`. For fully offline fonts, download those into `src/design/fonts/` and point the `@font-face` URLs at them.

### Use it in plain HTML / prototypes / slides

```html
<!doctype html>
<html lang="en">
  <head>
    <link rel="stylesheet" href="./wabot-design.css" />
    <!-- add ./wabot-design.overrides.css after it if you have one -->
  </head>
  <body data-theme="light">
    <!-- or "dark" -->
  </body>
</html>
```

### Use it in a Wabot UI app

Full-stack Wabot UIs server-render Preact (see the `wabot-ui` skill). Inject the design system once
by inlining the local file in a layout — the framework's recommended way to ship a design-system
stylesheet — and reuse the global classes alongside your CSS modules:

```tsx
import fs from 'node:fs'
import { uiController, Outlet } from '@wabot-dev/framework/ui'

const designCss = fs.readFileSync(new URL('./design/wabot-design.css', import.meta.url), 'utf8')

function AppLayout() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: designCss }} />
      <main data-theme="light">
        <Outlet />
      </main>
    </>
  )
}

@uiController({ path: '/', app: true, layout: AppLayout })
export class AppController {
  /* @view methods render inside the shell */
}
```

In JSX use `class`, not `className`. Global utility classes (`.btn`, `.card`, …) and CSS-module styles coexist freely.

---

## 2. The non-negotiables

The defaults that keep the system cohesive and elements looking right. Break them only when the user explicitly asks.

- **No borders.** Not on cards, not on inputs, not on tables, not anywhere. If separation is needed, use background-color contrast (`.bg-canvas` → `.bg-sunken` → `.bg-canvas`).
- **No shadows.** No `box-shadow` of any kind, including soft ones.
- **No hover state changes.** No darken / lift / underline on hover. Keep `:focus-visible` (a 2px accent ring) and `:active` (a small color shift confirming press) only.
- **Primary actions are near-black.** A solid dark pill with white text (`.btn`, or `<button type="submit">`). In dark mode the action inverts to a light pill on a dark background.
- **The accent (`--c-brand`, `#EE5B29` by default) is for highlights only** — focus rings, inline-link ink, and at most one call-to-action per view. It's a token: re-theme it to your own color. Never make it the primary button color.
- **Sentence case** for buttons, headings, labels, and body — no Title Case. The only caps in the system are the small, letter-spaced eyebrows and table headers it sets automatically (see §4); never type ALL CAPS yourself.
- **No emoji as iconography. No unicode characters as icons.** Status = a colored dot + a word. If a real icon is needed, use Lucide (https://unpkg.com/lucide-static/icons/) and tell the user it's a substitution.
- **Voice: terse, second-person, no marketing fluff.** Strings read like CLI prompts. "Create project", "No items yet", "Pause service". Never "Awesome! Let's get started 🎉".

---

## 3. Tokens

All tokens are CSS variables on `:root` (light) and `[data-theme='dark']`. Colors ship as RGB triplets so any color can be alpha-mixed.

### Colors — semantic aliases (use these in app code)

| Variable          | Light value     | Use                                |
| ----------------- | --------------- | ---------------------------------- |
| `--c-bg`          | warm paper      | page canvas                        |
| `--c-bg-raised`   | white           | cards, panels, form fields         |
| `--c-bg-sunken`   | hair darker     | sidebars, banded sections          |
| `--c-bg-contrast` | medium beige    | heavy bands, inputs in dark mode   |
| `--c-bg-inverse`  | near-black warm | footers, dark feature bands        |
| `--c-fg`          | near-black      | headings, primary text             |
| `--c-fg-body`     | dark grey       | body text                          |
| `--c-fg-muted`    | medium grey     | secondary text, labels             |
| `--c-fg-faint`    | light grey      | placeholders, captions             |
| `--c-brand`       | `#EE5B29`       | accent (default) — re-theme freely |
| `--c-brand-ink`   | darker accent   | inline links                       |
| `--c-action`      | near-black      | primary button background          |
| `--c-action-soft` | warm beige      | secondary button background        |
| `--c-focus`       | accent          | focus rings                        |

Compose:

```css
color: rgb(var(--c-fg)); /* opaque */
background: rgb(var(--c-brand) / 0.12); /* alpha */
```

### Colors — semantic state

| Token                               | Use                           |
| ----------------------------------- | ----------------------------- |
| `--c-success-bg` / `--c-success-fg` | "Active", "Success"           |
| `--c-warning-bg` / `--c-warning-fg` | "Paused", "Low balance"       |
| `--c-danger-bg` / `--c-danger-fg`   | "Failed", "Deleting"          |
| `--c-info-bg` / `--c-info-fg`       | "In progress", neutral notice |

### Typography

| Token       | Size | Use                               |
| ----------- | ---- | --------------------------------- |
| `--fs-xs`   | 12   | eyebrows, table headers, captions |
| `--fs-sm`   | 13   | meta, small body, table cells     |
| `--fs-base` | 15   | body (default)                    |
| `--fs-md`   | 16   | emphasized body, button labels    |
| `--fs-lg`   | 18   | h5, intro paragraphs              |
| `--fs-xl`   | 22   | h4                                |
| `--fs-2xl`  | 28   | h3                                |
| `--fs-3xl`  | 36   | h2                                |
| `--fs-4xl`  | 48   | h1, page titles                   |
| `--fs-5xl`  | 64   | hero display                      |

Fonts: `--font-sans` (Geist) and `--font-mono` (Geist Mono). Use mono for code, IDs, numerics, and inputs that accept code.

Headings are 600/700 with `letter-spacing: -0.022em`. The negative tracking is the most important type detail — without it, large Geist looks loose.

### Spacing — 4px grid

`--sp-1` (4) · `--sp-2` (8) · `--sp-3` (12) · `--sp-4` (16) · `--sp-5` (20) · `--sp-6` (24) · `--sp-8` (32) · `--sp-10` (40) · `--sp-12` (48) · `--sp-16` (64) · `--sp-20` (80) · `--sp-24` (96)

### Radii

`--r-sm` (4 — chips) · `--r-md` (8 — buttons, inputs, cells; **default**) · `--r-lg` (12 — cards, fieldsets) · `--r-xl` (18 — large panels) · `--r-pill` (999 — badges)

### Motion

`--motion-fast` (120ms ease-out, color shifts) and `--motion-base` (180ms ease-out, focus/nav). Nothing else — no springs, no choreography. The system respects `prefers-reduced-motion: reduce`.

---

## 4. Components — copy/paste patterns

### Buttons

```html
<button type="submit">Save changes</button>
<!-- dark pill (default for submit) -->
<button class="btn">Save changes</button>
<!-- same, explicit class -->
<button class="btn btn-secondary">Cancel</button>
<!-- soft beige -->
<button class="btn btn-ghost">View details</button>
<!-- text only -->
<button class="btn btn-brand">Get started</button>
<!-- accent, ONE per view max -->
<button class="btn btn-danger">Delete</button>
<!-- restrained red, destructive only -->
<button class="btn btn-sm">Retry</button>
<!-- compact -->
<button class="btn btn-lg">Continue</button>
<!-- prominent -->
<button class="btn" disabled>Saving…</button>
<!-- :disabled = 0.45 opacity -->
```

### Status dots and badges

```html
<span class="badge badge-success"><span class="dot dot-success"></span>Active</span>
<span class="badge badge-warning"><span class="dot dot-warning"></span>Paused</span>
<span class="badge badge-danger"><span class="dot dot-danger"></span>Failed</span>
<span class="badge badge-info"><span class="dot dot-info dot-pulse"></span>In progress</span>
<span class="badge badge-brand">Beta</span>
<span class="badge">meta</span>
<!-- neutral meta -->
```

`.dot-pulse` adds the live-state opacity pulse — use for in-progress states ("Building", "Uploading", "Deleting").

### Cards

```html
<div class="card">
  <!-- raised panel, --bg-raised -->
  <p class="card-label">Balance</p>
  <!-- small tracked eyebrow -->
  <div class="mono numeric">$48.21</div>
</div>

<div class="card card-sunken">…</div>
<!-- sunken band tone -->
```

### Forms

```html
<fieldset>
  <legend>Sign in</legend>
  <label for="phone">Phone number</label>
  <input id="phone" type="tel" placeholder="+1 555 0142" />
  <button type="submit">Send sign-in code</button>
</fieldset>
```

No `<div class="form-group">` wrappers; semantic HTML carries it.

### Sections — separation by contrast

```html
<section class="bg-canvas">…</section>
<section class="bg-sunken">…</section>
<!-- creates the band -->
<section class="bg-canvas">…</section>
<section class="bg-inverse">…</section>
<!-- dark feature band -->
```

Or `.bg-brand` for an accent hero, `.bg-contrast` for a heavier band.

### Tables

```html
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>api-server</td>
      <td>
        <span class="badge badge-success"><span class="dot dot-success"></span>Active</span>
      </td>
    </tr>
  </tbody>
</table>
```

Headers are uppercase tracked labels automatically. Rows zebra-stripe via background contrast, never borders.

### Key/value metadata

```html
<dl class="kv">
  <dt>Source</dt>
  <dd>github.com/acme/web</dd>
  <dt>Branch</dt>
  <dd>main</dd>
  <dt>Region</dt>
  <dd>us-east-1</dd>
</dl>
```

`<dd>` renders in mono automatically.

### Inline code / blocks

```html
<p>Set <code>LOG_LEVEL=info</code> in your env.</p>
<pre><code>npm run build
npm run start</code></pre>
```

`<pre>` is near-black on light text — the terminal block of the system. Use sparingly.

### Layout primitives

```html
<div class="stack">…</div>
<!-- vertical flex, gap 16 -->
<div class="stack-sm">…</div>
<!-- gap 8 -->
<div class="stack-lg">…</div>
<!-- gap 24 -->
<div class="row">…</div>
<!-- horizontal flex, gap 12, items center -->
<div class="cluster">…</div>
<!-- horizontal wrap, for chips -->
<div class="split">…</div>
<!-- justify-between, items center -->
```

Always prefer flex/grid with `gap` over inline siblings — it survives direct-manipulation edits cleanly.

---

## 5. Content rules

Copy defaults that keep the UI clear:

- **You-form.** "Your projects", "Your balance". Never "we" or "our team".
- **Direct verbs as button text.** "Create project", "Pause service", "Sign in". Never "Click here" / "Continue →".
- **Sentence case everywhere.**
- **Currencies show the ISO code as a small grey suffix.** `$45.00 USD`, not `$45`.
- **Dates short, locale-aware.** `Nov 14`, not `November 14th, 2026`.
- **No emoji.**
- **Empty states are flat statements.** "No items yet." Pair with one button. No illustration. No "Get started by…" paragraph.
- **Errors are blunt.** Show the raw server message inside `<p class="text-error"><strong>Error:</strong> {message}</p>`.
- **Localize cleanly.** Write copy that translates without English idioms if the app is multilingual.

---

## 6. Iconography

The system ships almost no icons. When you need one:

- Use **Lucide** (https://unpkg.com/lucide-static/icons/) inline as SVG, 24×24 grid, 2px stroke, rounded line caps. Lucide pairs cleanly with Geist.
- **Never use emoji or unicode characters as icons.** Status is conveyed with a `.dot` + a word.

When you introduce an icon the design doesn't already have, **flag the substitution** to the user.

---

## 7. Dark mode

Set `data-theme="dark"` on `<html>` or `<body>`. All tokens swap automatically; no other code changes.

The dark canvas is intentionally a warm charcoal (`#1A1918`) — not pure black. The dark "action" inverts: a light pill (`--c-fg-inverse`) on the dark canvas.

---

## 8. When this skill is invoked with no other guidance

Ask the user what they want to build. Useful follow-ups:

- What surface — an app screen, a form, a landing page, docs, a slide deck?
- Depth — a single component, a screen, a whole flow?
- Light or dark mode?

Then produce the artifact in HTML, slides, or production code — whatever the user asked for — following the non-negotiables in section 2.
