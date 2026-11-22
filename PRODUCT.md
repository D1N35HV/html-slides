# Slide Bolt — Design Context

This file guides every design decision in the project. All `/impeccable` skills, and any agent touching UI, must read this before writing code.

---

## Design Context

### Users

**Primary persona: the slide-to-SCORM migrator.**
- Corporate L&D specialists, instructional designers, training managers, compliance leads, and subject-matter experts who already have decks (often dozens to hundreds) and need to ship them as SCORM packages to an LMS.
- They are **not** designers. They are not creating from a blank canvas. They are *curators of existing material* — re-flowing content, adjusting layouts, fixing imports, and hitting publish.
- **Context of use**: desktop, in work hours, in a browser, often for long focused sessions. Rarely mobile. The deliverable is usually under deadline (training rollout, compliance quarter, new-hire cohort).
- **Success looks like**: import a PPTX → edit what's broken → export a SCORM that passes LMS validation → move to the next one. Speed-through-ten-decks matters more than wow-on-the-first-one.

### Differentiation

Every general-purpose deck tool (Canva, Gamma, Pitch, Google Slides, PowerPoint) is optimized for **creating from scratch**. Slide Bolt is optimized for the opposite job: **inheriting existing content and producing LMS-ready SCORM output.** The real competitive set is Articulate Rise, Articulate Storyline, iSpring Suite, Adobe Captivate — serious L&D tools, not creative suites. That's the flavor we're answering.

The memorable thing about Slide Bolt should be: *it's the fastest, least-painful path from "pile of PPTs" to "SCORM in an LMS."* Every UI decision should reinforce that.

### Brand Personality

Three words: **fast, dependable, easy.**

Emotional target: **familiarity.** A user opening the editor should immediately feel at home — like they've used this tool before even on day one. Conventions they know from PowerPoint and Canva (slide strip, contextual toolbars, click-to-edit text boxes, right-click menus) are *borrowed on purpose* and then refined. This is not the place for novel interaction paradigms.

### Aesthetic Direction

**"Precision instrument for learning content."**

Think: a quiet, confident, utilitarian tool that gets out of the user's way. The chrome is muted and recessive so user-imported slide content — which can be any style, any color, any layout — always visually dominates. Accents are rare and meaningful (save state, validation status, destructive confirmations). The overall feel is closer to a well-designed desktop app (Linear, Things 3, Panic's product design, a good IDE) than to a marketing-first SaaS.

**Theme**: Light mode is the default for the editor and dashboard. L&D work happens during work hours, imported PPTs assume a light canvas, and SCORM preview environments are almost always light. Respect `prefers-color-scheme` for users who want dark; do not lead with dark-mode-with-glowing-cyan (that's the SaaS default we're avoiding).

**Color** (locked): The accent is **Ink-indigo** `oklch(0.38 0.15 265)`. It's quiet enough to recede behind user-imported slide content, distinct from the Articulate/Rise/iSpring competitive palette (which is heavy on warm reds and teals), and reads as "considered, editorial, trustworthy" — the right signal for compliance/L&D buyers. Replaces Electric Orange `#ff5500` entirely.

Neutrals are **warm-tinted** (chroma ~0.005–0.01 toward amber), not cool-blue, so the chrome doesn't feel sterile. Near-black ink has a subtle cool tint (`oklch(0.2 0.025 265)`) so it harmonizes with the accent. Never pure white, never pure black.

**Typography** (locked):
- **Body / UI: Mona Sans** (GitHub, free, variable, humanist warmth). Variable width + weight axes give room for hierarchy without a second family.
- **Metadata / functional mono: Courier Prime** (refined Courier on Google Fonts). Used only for actual file-like content — SCORM version labels, package sizes, file extensions, manifest keys. Not decoration. The "document / form / learning material" association is a brand-aligned asset, not a developer-tool reflex.
- No third family. No display serif.
- Modular scale, at least 1.25 ratio between steps. Fluid `clamp()` allowed on the `/landing` marketing page; fixed `rem` in the product (editor, dashboard, auth).

**Surfaces & shape**: Keep the current sharp corners — they suit "precision instrument" well and differentiate from the rounded-everything SaaS norm. But the current shadow scale is too flat: introduce one soft elevation for floating UI (context menus, toolbars, popovers) and keep everything else flush. No glassmorphism. No decorative gradients. No colored side-stripe borders on cards or alerts (banned in the skill).

**Motion**: Minimal and functional. This is a tool, not a showcase.
- Editor interactions should feel instant (<100ms perceived latency, optimistic updates).
- Transitions are cheap and quick — 150–250ms, ease-out-quart.
- Save one orchestrated moment (the landing page or a delightful export-success beat) for delight; keep the working surfaces quiet.
- Respect `prefers-reduced-motion` everywhere.

### Design Principles

These five principles override any individual design instinct. When in doubt, the principle wins.

1. **The content is the hero.** Chrome recedes so user-imported slide content always visually dominates. Muted surfaces, restrained accents, no decorative flourishes that compete with the canvas.
2. **Familiar first, novel second.** Users arrive from PowerPoint and Canva. Borrow conventions they already know — slide strip, contextual toolbars, click-to-edit, right-click menus — and refine them. Do not reinvent interaction patterns.
3. **Dependable over delightful.** Precision spacing, predictable outcomes, immediate feedback, honest empty states, and obvious save/export status beat any micro-delight. A good tool stays out of the way.
4. **SCORM outcomes are first-class.** LMS-compatibility cues (accessibility status, package validity, asset size, manifest correctness) should be visible throughout the workflow, not buried in an export dialog at the end.
5. **Utilitarian chrome, humane typography.** The shell is quiet and precise. The typography carries the warmth so the tool feels made-by-humans-for-humans, not shipped-by-a-template.

### Accessibility

- **Target: WCAG 2.1 AA across the product.** Keyboard-first for the editor (L&D power users live on keyboard shortcuts), visible focus rings tuned to the final accent color, 4.5:1 body text contrast, 3:1 UI element contrast.
- Respect `prefers-reduced-motion`. All non-essential motion must have a reduced alternative.
- All form fields labeled. All icons-only buttons have `aria-label`. All modals trap focus correctly and restore on close.
- Content produced by Slide Bolt (SCORM output) should itself encourage AA — e.g. contrast-check the imported slide content and surface warnings, since the user's learners will be the ones consuming it.

---

## For future agents reading this file

- Color and typography are **locked**. Accent is `oklch(0.38 0.15 265)` ink-indigo; body font is Mona Sans; functional mono is Courier Prime. Do not drift.
- If you are about to use Inter, Space Grotesk, Geist, DM Sans, Plus Jakarta, Instrument Sans, JetBrains Mono, or any font on the impeccable reflex-reject list — stop. Re-read "Typography" above.
- If you are about to use Electric Orange `#ff5500`, stop. That's the legacy brand color; the new accent is ink-indigo.
- The landing page at `/landing`, the auth pages (`/login`, `/register`), the dashboard at `/`, and the **editor chrome** (`/editor/:id` top bar, save/share, slide strip, loading/error states) all share the ink-indigo paper design system (tokens scoped to the `.lp-root` class in `src/index.css`, plus matching `brand.*` hex values in `tailwind.config.js`). The legacy `purple.*` Tailwind scale is now remapped to ink-indigo in `tailwind.config.js`, so any file still using `bg-purple-*` / `text-purple-*` automatically inherits the new brand.
- **Still on legacy ad-hoc Tailwind classes** (not migrated to the `.lp-root` scope yet): in-canvas elements (`DraggableElement`, `EditableElement`, `ResizableDraggableElement`, `ShapeElement`, `ImageElement`, `VideoElement`, `ImageCropOverlay`), per-element floating toolbars (`ShapeToolbar`, `ImageToolbar`, `SlideToolbar`, `ContextMenu`, `SelectionBox`, `AlignmentGuides`), CKEditor custom toolbar, and the inner *sub-panels* of `ElementsSidebar` (FontColorSection, BgColorSection, ElementBgColorSection, template grid, uploads grid). They work visually because of the palette remap, but haven't been hand-tuned for the paper aesthetic.
