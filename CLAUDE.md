# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Henry Weikel's personal site, built with [11ty (Eleventy)](https://www.11ty.dev/) v3.

**There is one page.** A fixed-canvas grid driven by `_data/cells.json` and `js/grid.js` is also the notes reader: a nav column of titles and a reading pane are two regions of the same canvas. `/` opens the newest entry; `/notes/<slug>/` serves the same canvas with the slug read off the URL. All of it shares `assets/css/site.css`.

Markdown posts in `notes/` are an ordinary Eleventy collection feeding the nav (`notes.json.njk`), the fetched post bodies (`note-fragments.njk`), and the Atom feed.

**Nothing is server-rendered.** `/` and `/notes/<slug>/` both return an empty `<div id="grid">`; the nav and the prose arrive by `fetch`. With JavaScript off the page is blank, not degraded. The rendered prose does exist server-side at `/notes/<slug>/content.html` and in `feed.xml`.

## Commands

```
npm run serve                 # rm -rf _site && eleventy --serve — local dev server on :8080
npm run build                 # rm -rf _site && eleventy — production build
```

No tests or linters are configured.

## Architecture

### The canvas (`index.html`, `js/grid.js`, `_data/cells.json`, `assets/css/site.css`)

A **fixed 32×20 (16:10) graph-paper canvas** — a fixed collage, not a reflowing grid. `grid.js` fetches `cells.json` at load and places every element by explicit coordinate. `index.html` is an empty shell.

- **Canvas** (`.grid`): 32 columns × 20 rows, sized `min(100vw, 100vh * 32/20)` so it scales as one image; outside margins absorb the slack.
- **Anchored top-left, not centred**, inset by `--margin` top and left; letterboxing falls right and bottom. `--margin` comes off both axes twice in the `.grid` sizing, so growing it shrinks the canvas and the row unit with it. The pane bleeds past the top inset; the column starts at row `1.75`, and that gap plus the margin is the stem the shard hangs on.
- `cells.json` is a flat array; every entry has a `kind`. **Coordinates are grid-line based, 0-indexed from the top-left**, not cell indices — `x,y` is a top-left corner, `w,h` how far it extends.
  - `point`: an image centred on an intersection, not confined to a cell. `size` (columns, default 3), optional `href`; `pointer-events: none` unless linked. **`on` replaces `y`** with a named band and `pos` is the fraction along it — the shard uses `above-nav`/`0.5`. That band is part fixed margin and part scaling rows, so a plain `y` there drifts off the page top as the canvas grows.
  - `line`: a structural rule (`orientation`, `at`). Positioned at its canvas coordinate but drawn across the whole document, so it keeps running past the fold. Lines sit at a **lower z-index than points and regions**, so anything with a fill breaks the line behind it. Two optional fields on a vertical:
    - `span` clips it to a named band: `nav` (the column's measured run), `above-nav`, `below-nav`. `navBand()` resolves these at layout time, since the column's end is measured, not a coordinate. Points name the same bands with `on`.
    - `reach` (grid rows) keeps the page running that far past the column's bottom. Without it a line below the column has nowhere to go — the column is usually the tallest region, so it *is* the page's end.
  - `notes-nav` and `notes-reader` carry the reader, written with the same `x/y/w/h`: the column at `0,1.75 → 8,20` and the pane at `8,0 → 32,20`. Apart from the nav's `head` they hold no content; `grid.js` fills them.
- **The composition holds exactly one `line`**: a vertical at `x: 4` down the column's centre. Every other rule is a nav item's own border, including the column's sides — which is what lets them break wherever an unboxed image entry interrupts the column. Nothing privileges the canvas edges; an outer frame would just be more `line` entries.
- **Line weight is uniform by construction:** `--line-weight` must stay a whole pixel and `layout()` snaps every offset to a device pixel via `snap()`. Fractional values antialias across two rows and read as uneven.
- **Regions are bounded by lines, not the canvas box.** `edgeX()`/`edgeY()` run any edge that reaches the canvas boundary with no line on it out to the page edge — that is how the pane reaches the viewport's right rather than stopping at the letterbox. An edge that *does* start on a line is offset by `--line-weight`. Only left, right and top are set; the bottom is wherever content ends.
- **`bleed: false` opts a region out**, holding it to the canvas coordinate. The column needs it: its sides are item borders rather than `line`s, so nothing else stops its left edge running into the margin.
- **The page scrolls as one piece.** Both regions are `position: absolute` with no height of their own; the document carries them. Offsets are canvas-relative (`canvasBox()`, keeping `docTop`/`docLeft` for edges running past it). `layoutExtent()` takes the furthest region (or a `reach` past the column, whichever is further) as the page height.
- **The extent is remeasured, not computed once** — a body is fetched after first paint, its images later. Two catches: a capture-phase `load` listener on `.notes-reader` (the event doesn't bubble) and a `ResizeObserver` on both regions. The observer must call `layoutExtent()`, not `layout()`: a full layout rewrites nav row heights, resizing an element it watches, and Chrome drops that notification.
- **`html` is `overflow-y: scroll` deliberately** — not `auto`, not `scrollbar-gutter`. `layoutRegions()` measures `clientWidth`, so the scrollbar must exist from the first layout or a late one narrows the viewport under an already-sized pane.

### The nav column

- **The site title is the column's first cell**, the only entry in the nav's `head` array. Head items are ordinary `.notes-nav-item`s but never active and never in the prev/next chain. Optional `square` (height from the column's width), `img` and `size` (`--head-img-fill`) are supported but currently unused.
- **Nav rows are a fixed height, never stretched or clipped.** `rowHeight` (grid units, `1.85`) sizes every row; the column runs down the page rather than filling the viewport or scrolling. Titles are pinned type while rows scale, so `layoutNav()` measures first and takes `max(rowHeight, natural)` — a wrapped title breaks the rhythm rather than being cut off. Heights accumulate through `snap()` so every border lands on a device pixel.
- **Titles stack into runs, and each run closes itself.** The rules between them are `border-top`s, so a run's last row needs a `border-bottom` — at the column's end, and above every floating image entry. `closeNavRuns()` tags those `.notes-nav-close`; done in JS rather than `:has(+ .notes-nav-preview)` so head and entry items fall under one pass.
- **A title row's fill is required, not cosmetic.** Regions paint above lines, so that fill is the only thing breaking the centre line where a run crosses it.
- **Project entries are not boxed.** They keep the square cell (`notes-nav-square notes-nav-preview`, fill `0.8`) but `.notes-nav-preview` clears borders *and* background, so the centre line shows behind the preview and it rides the line as the shard does. Square keeps the break it opens scaling with the canvas. They carry no text, so `.active` is invisible on them.
- **Nav and post titles share one pinned size.** `--title-size`/`--title-tracking` are `22px`/`2px`, used by both `.notes-nav-item` and `.post-title` so a title reads identically in the column and over the post.

### Narrow mode

Below the breakpoint the canvas is abandoned, not scaled: 32 columns across a phone is a 12px unit, too small for pinned type. The media query at the foot of `site.css` rebuilds the composition in flow — one spine down the middle with everything hung off it.

- **Three conditions: `(max-width: 1120px), (max-height: 790px), (pointer: coarse)`.** Room for the canvas is not a question of width alone, since it is sized off both axes: too narrow and the column drops under ~220px; too short and a 1366×768 laptop or a landscape phone is equally cramped. The pointer condition is the only thing catching an iPad Pro in landscape, which has the room (a 281px column) but wants this layout anyway.
- **The breakpoint has one source of truth.** `--narrow` is `0` on `:root` and `1` in the media query; `isNarrow()` reads it back. Don't hard-code a width in the JS.
- **Two tiers.** The main block carries tablet values (`22px`, `48rem` cap); a `@media (max-width: 600px)` block at the foot walks them to `19px`/`36rem`. **The phone block must stay last** — both match at 390px and collide at equal specificity, so source order resolves them.
- **Capped and centred, not full-bleed.** Unconstrained, the post box runs to a ~95-character measure.
- **Size narrow-mode widths in `em`, not percentages.** Rows are a fixed `14em`, so anything proportional drifts against them as the page widens to the cap.
- **`layout()` bails to `clearLayout()`, which must strip every inline style this file writes** — region `left/top/width`, line `left/top/width/height`, point `left/top/width`, nav row `height`, `body.minHeight`. Inline beats the stylesheet. `layoutExtent()` guards separately: the observer and the `load` listener keep firing here.
- **`display: contents` on `.notes-nav`** dissolves the column's box so its rows become siblings of the pane and `order` can split them: title above the post, entries as an index below it. The index goes last so a deep link lands on the prose.
- **Narrow mode re-stacks by hand.** Losing the column's positioned box loses the stacking context that put its rows above the lines, so `.notes-nav-item`, `.notes-reader` and `.point` each take `position: relative` + `z-index`, or the spine paints over the fills meant to break it.
- **The post is an opened cell.** `.notes-reader` is ruled like a title row with vertical margins so the spine shows above and below it, and runs full width while rows are inset to `14em` — the width difference is what reads as opened.
- **Rows are a fixed `3.6em`, not `min-height`** — `layoutNav()` isn't running, so a two-line title would stand taller. `3.6em` holds two lines, which is what the longest titles take at `14em`; widening rows risks a third line overflowing. Previews are excluded (`:not(.notes-nav-preview)`) and size from `aspect-ratio`.
- The head row closes itself here: `closeNavRuns()` works on DOM order, where the head is still followed by an entry, but on the page it stands alone.

### Notes (`notes/*.md`, `notes.json.njk`, `note-fragments.njk`, `_includes/note.njk`)

- Each note is markdown in `notes/` with frontmatter: `title`, `date`, `tags`, `previewImage`, `layout: note.njk`.
- The `notes` collection globs `notes/**/*.md`, excludes `eleventyExcludeFromCollections`, and sorts newest-first. **Newest-first is load-bearing:** `grid.js` treats index 0 as the newest and walks *up* for forward, *down* for back.
- `notes.json.njk` emits `/notes.json` — `[{slug, title, date}]` with an **ISO** date, which `mergeEntries()` sorts on. Nothing needs bumping by hand when a note is added.
- **The column is not just notes.** `_data/projects.json` holds standalone entries: `{id, title, date, href, img, alt, mark?}`. `mergeEntries()` sorts them in with the notes by date, so projects take their place in the column and in the prev/next chain. A project renders as one linked image centred in the pane; `align-self: center` on `.project` both centres and shrink-wraps it so the hitbox isn't the pane's width.
- Projects use the same `.post-title`/`.post-date` header. `date` displays at whatever precision it carries (`"2026-06"` → `2026 · 06`).
- A project's optional `mark` (+ `markAlt`) is part of its **title**, not its image — `renderTitle()` puts it ahead of the label wherever the title is drawn. Colourways: `dsp1-cream.svg` (`#ffef91`), `dsp1-red.svg` (`#360816`), `dsp1.svg` (blue).
- Projects have **no URL of their own**, so opening one pushes `/`. The entry is kept in `history.state` so Back/Forward restore it; a cold load of `/` opens whatever is newest. Only notes get real deep links.
- `note-fragments.njk` generates `/notes/{slug}/content.html`, one body-only fragment per post. `grid.js` fetches these into the pane and caches them. The fragment supplies `.post-title`/`.post-date`/`.post-body` — keep those class names.
- `_includes/note.njk` is the canvas shell only, so deep links land in the grid; `grid.js` reads the slug from `location.pathname`.
- Markdown links get `target="_blank" rel="noopener"` for external URLs only, via a `link_open` override in `eleventy.config.js`.
- `readableDate` formats `YYYY · MM · DD`; `isoDate` feeds the Atom feed.
- **Inside `.notes-reader`, size in `em`, never `rem`.** The pane's base is 22px while `rem` is 16px. The measure lives in one place, `--measure: 715px`; everything else is `em` off the base.

### Eleventy config

- `pathPrefix` comes from `ELEVENTY_PATH_PREFIX` (non-root deploys); when set, the `prefix-img-src` transform rewrites `<img src="/assets/...">` in output HTML. **`grid.js`'s fetch URLs and `NOTES_BASE` are hardcoded to `/`**, so a prefixed deploy breaks the client.
- Input dir is the repo root; output is `_site`. Passthrough: `fonts/`, `white-diamond.jpg`, `assets/`, `CNAME`, `_data/`, `js/`, `index.html`.
- `README.md` is ignored from processing.
- `shelf-experiment.html` at the repo root is an unlinked prototype of the same fixed-aspect-ratio scaling trick; not in the build.
