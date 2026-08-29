---
name: epub-annotation-types
description: This skill should be used when adding a new annotation/highlight visual type (e.g. strikethrough, double-underline, or any custom text-marking style) to the ebook reader in this project. It captures the non-obvious epub.js constraint that only highlight/underline/mark exist natively, and the required SVG post-processing + re-decoration-on-navigation pattern used by src/views/ebookReader.
agent_created: true
---

# EPUB / TXT Annotation Type Extension

## Overview

The ebook reader (`src/views/ebookReader/`) supports text annotations (划线/标注) with
visual types. The base types are `highlight` (背景高亮) and `underline` (下划线). When the
user asks for a NEW visual type (e.g. 删除线/strikethrough, 双下划线/double-underline,
or any custom marker), extend the system by adding a new `HighlightTypeName` and wiring
it through the render layers. This skill records the epub.js constraints and the exact
patterns that work.

## Key Constraint (read before coding)

epub.js (`node_modules/epubjs`, `marks-pane` package) only supports THREE annotation types:
`highlight`, `underline`, `mark`. There is **no native strikethrough or double-underline**.

- `highlight` → draws an SVG `<rect>` fill behind the text.
- `underline` → draws a `<g>` containing, **per wrapped line fragment**, one `<rect>` (positioning box) + one bottom `<line>` (y = line bottom).
- `mark` → internally maps to the highlight draw path.

Therefore any new line-style type (strikethrough, double-underline) MUST be rendered by
mapping to epub.js `underline` and then **post-processing the generated SVG `<g>`**.

## The Decoration Pattern (epub side)

Implement in `src/views/ebookReader/composables/useEpubHighlight.ts`:

1. `uiTypeToEpub(type)` → returns `'underline'` for all line-style types (incl. the new one), `'highlight'` only for background fills.
2. `getAnnotationClassName(type)` → ALWAYS return the single token `'epub-highlight'`. epub.js applies the className via `element.classList.add(className)`, which rejects space-separated strings (throws `InvalidCharacterError: ... contains HTML space characters`). So do NOT return `'epub-highlight epub-<yours>'`. The new type's visual difference is carried entirely by `decorateMark` SVG geometry, and `decorateAllMarks` identifies it via `ctx.annotations[].type` — no extra class needed (and none of the `epub-strike`/`epub-double` classes are referenced by CSS anyway).
3. `getTypeStyles(type, color)` → for line-style types return the underline-style object:
   `{ style: '--hl-stroke:<fill>;--hl-stroke-opacity:<opacity>;mix-blend-mode:multiply' }`.
   Coloring is done by the global CSS in `EpubReader.vue`: `g.epub-highlight > line { stroke: var(--hl-stroke); stroke-width:2; ... }` and `g.epub-highlight > rect { stroke:none }`.
4. `decorateMark(mark, type)` → post-process the `<g>` (`mark.element`):
   - Query `rect`s and `line`s (they are paired per line fragment: rect[i] ↔ line[i]).
   - **CRITICAL POSITIONING FIX**: epub.js's `Underline` draws each `rect` from `range.getClientRects()`, whose height is the **full line box** (includes half-leading from line-height/段间距), and the native line sits at `rect.y + rect.height - 1` (line-box bottom). With large line spacing this drifts far below the glyphs — lines look like they belong to the NEXT line. So DO NOT anchor to `rect.height`; anchor to the actual font baseline / x-height center instead:
     - Read the resolved font size: `const range = mark.range; const sc = range.startContainer; const textEl = sc.nodeType === Node.TEXT_NODE ? sc.parentElement : (sc.nodeType === Node.ELEMENT_NODE ? sc : null); const F = parseFloat(textEl.ownerDocument.defaultView.getComputedStyle(textEl).fontSize);` (fall back to `rect.height * 0.7` if unavailable).
     - `halfLeading = max(0, (rect.height - F)/2)`.
     - **Underline / Double-underline**: move the existing `<line>` to `baseline = rect.y + halfLeading + 0.8*F`.
     - **Strikethrough**: move the existing `<line>` to `strikeY = rect.y + halfLeading + 0.55*F` (≈ x-height middle).
     - **Double-underline**: append a SECOND `<line>` (using `g.ownerDocument.createElementNS('http://www.w3.org/2000/svg','line')` — must be the iframe doc) at `y = baseline + max(2, 0.18*F)`.
   - Make it **idempotent** with `g.setAttribute('data-decorated', type)` and early-return if already set (prevents double-underline from stacking on re-decoration).
   - Note: the native `underline` type ALSO needs `decorateMark` (to lift the line off the line-box bottom). So the call sites / `decorateAllMarks` filter must include `underline` too, not only `mark`/`markStrong`.
5. Call `decorateMark((ann as any)?.mark, type)` right after every `ctx.rendition.annotations.underline(...)` in `addHighlight`, `loadAnnotations`, and `refreshAnnotations` (all three go through the `epubType === 'underline'` branch).
6. `decorateAllMarks()` → iterate `ctx.annotations.value`; for each `underline`/`mark`/`markStrong` annotation look up the live SVG via `ctx.rendition.annotations._annotations[encodeURI(ann.anchor + 'underline')]` and call `decorateMark`. Expose it as `ctx.decorateAnnotationMarks` and call it from `handleRelocated` in `useEpubRender.ts` (see below) so off-screen chapters get decorated after navigation.

**Why `decorateAllMarks` + `handleRelocated` is required:** `annotations.add()` returns the `Annotation` whose `.mark.element` is only set when the annotation is attached to the *currently rendered* view. Off-screen chapters' annotations have `mark === undefined` at add time, and epub.js only attaches them when the user navigates to that chapter. `handleRelocated` fires after navigation, so re-running decoration there catches them.

## The TXT side (parallel, simple)

In `src/views/ebookReader/composables/useTxtRender.ts`, `getTypeClass` / `getSegmentStyle`
already switch on type. Add cases using inline `text-decoration`:
- strikethrough → `'text-decoration': 'line-through <color>'`
- double-underline → `'text-decoration': 'underline <color>', 'text-decoration-style': 'double'`
`TxtReader.vue` binds both `:class="getTypeClass(seg.type)"` and `:style="getSegmentStyle(seg)"`, so inline styles win. No SVG surgery needed for txt.

## Wiring checklist (all touched when adding a type)

1. `highlightConfig.ts`: extend `HighlightTypeName` union AND append to `HIGHLIGHT_TYPES` (label + icon). The SettingsDrawer 「划线样式」radio auto-renders from `HIGHLIGHT_TYPES` — no template change needed.
2. `useEpubHighlight.ts`: steps above (uiTypeToEpub, getAnnotationClassName, getTypeStyles, decorateMark, decorateAllMarks, call sites, expose `ctx.decorateAnnotationMarks`).
3. `epubContext.ts`: add `decorateAnnotationMarks?: () => void;` to `EpubCtx`.
4. `useEpubRender.ts`: in `handleRelocated`, after `ctx.updatePrintPage?.(cfi)` add `ctx.decorateAnnotationMarks?.();`.
5. `useTxtRender.ts`: `getTypeClass` / `getSegmentStyle` new cases.
6. Update type comments in `types.ts` and `txtContext.ts` (optional but keep consistent).

## Verification

Run `node_modules/.bin/vue-tsc --noEmit` (sandbox blocks `vite build`; type-check is the gate).
Grep for `=== 'underline'` / `=== 'highlight'` to confirm no hard-coded branch excludes the
new type (all such checks should use the *mapped* epub type via `uiTypeToEpub`).

## Gotchas

- Always create appended `<line>` with `g.ownerDocument.createElementNS(...)`, never `document.createElementNS` — the SVG lives in the iframe document.
- `removeHighlight` / `removeAnnotationById` rely on `uiTypeToEpub(ann.type)` to pick the epub type for `annotations.remove`; ensure the mapping includes the new type.
- Do NOT write `stroke` directly on the `<g>` — epub.js also draws a `<rect>` that would inherit it and render a border. Use the `--hl-stroke` CSS-variable approach.
- Keep each type's logic in the existing composable (functional segmentation); do not bloat a single file.
