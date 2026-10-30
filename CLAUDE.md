# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Henry Weikel's personal site: an [11ty (Eleventy)](https://www.11ty.dev/) v3 blog on GitHub Pages.

**It ships no JavaScript.** Every page is server-rendered and the layout is pure CSS, so navigation is ordinary full page loads. There is no client-side router, no fetch, no hydration.

## Commands

```
npm run serve                 # rm -rf _site && eleventy --serve — local dev on :8080
npm run build                 # rm -rf _site && eleventy — production build
```

No tests or linters are configured.

## Architecture

```
notes/*.md            posts
_data/projects.json   standalone entries (a site, a book) that aren't posts
eleventy.config.js    the `notes` and `entries` collections, filters
_includes/base.njk    the whole page: column + reading pane
_includes/note.njk    layout for a note
index.njk             the newest entry
projects.njk          one page per project, via pagination
assets/css/site.css   the only stylesheet
feed.xml.njk          Atom feed
```

- **`entries` is the merged list** — notes plus projects, newest first, built once in `eleventy.config.js`. The column, the prev/next chain and the landing page all read from it. Each entry carries `id`, `title`, `date`, `label` (pre-rendered, since projects date to the month: `"2026-06"` → `2026 · 06`), `url`, and `olderUrl`/`newerUrl`. Neighbours are stored as URLs rather than entries so the collection doesn't become cyclic.
- **`base.njk` renders the whole page**, including the nav and the prev/next row. Templates supply only the article. `activeId` marks the current row; it falls back to `page.fileSlug`, which covers notes, while `index.njk` and `projects.njk` set it via `eleventyComputed`.
- Markdown links get `target="_blank" rel="noopener"` for external URLs only, via a `link_open` override in the config.
- `pathPrefix` comes from `ELEVENTY_PATH_PREFIX`; when set, the `prefix-img-src` transform rewrites `<img src="/assets/...">` in output HTML.

## The layout

One unit drives the composition. The column is `--col-w`, and `--cell` is an eighth of it — the proportions come from a 32×20 grid over a 16:10 box, where a column and a row were the same length and the nav was 8 of them.

- **`.page` is a two-column grid** (`var(--col-w) 1fr`) with `min-height: 100vh`, inset from the left by `--margin`. The pane is the `1fr`, so it reaches the viewport's right edge.
- **The spine is `.page::before`** — `top: 0; bottom: 0`, so it runs the document's full height without being measured: the grid row is as tall as the taller of the two sides. Drawn on the page rather than the column so it survives the column dissolving at narrow widths.
- **Rows and the pane paint over the spine, and that is what breaks it.** `.row`'s background is required, not cosmetic. Image entries (`.row-image`) clear their borders *and* background, so the spine shows behind them and the preview rides it the way the shard does. Such a row is the preview plus its padding, never a fixed box the preview fits inside — both axes are capped at the same length, so a landscape preview breaks the spine by exactly as much as a portrait one.
- **Rows carry their own rules** rather than sitting between shared ones, so a run can end wherever an image entry interrupts the column. `:has(+ .row-image)` and `:last-child` close a run. `min-height`, not `height`, so a wrapped title grows its row.
- **`--title-size` is one pinned size** for the nav rows, the post headings and the prose, so a title reads identically in the column and over the post. `.reader`'s `font-size` is `var(--title-size)` rather than a literal to keep that structural.
- **Inside `.reader`, size in `em`, never `rem`** — the pane's base is 22px while `rem` is 16px. The measure lives in one place, `--measure`.

### Narrow

Two tiers below `1180px`, which is where the pane stops holding its measure beside the column.

- **`display: contents` on `.column`** dissolves its box so the rows become grid items of `.page`, which is the only way `order` can put the title above the post and the index below it. The index goes last so a visitor lands on the prose.
- **That also dissolves the stacking context** holding rows above the spine, so `.row`, `.reader` and `.shard` each take `position: relative` + `z-index` there. Without it the spine paints over the fills meant to break it.
- **Use compound selectors for per-row overrides** (`.row.row-head`, not `.row-head`). `.row-head` also matches `.row`, so an equal-specificity `.row` rule later in the block wins.
- **The post is an opened cell** — ruled like a row but full width where rows are inset to `14em`, with margins so the spine shows above and below it. The width difference is what reads as opened.
- Rows take a fixed `3.6em` here, since a two-line title would otherwise stand taller than its neighbours. `3.6em` holds two lines, which is what the longest titles take at `14em`.
- **A row is `14em` at any type size, so the measure is the padding.** `--title-tracking` is a fixed px, so shrinking `--title-size` shrinks the box but not the tracking: dropping the type can wrap a title the larger size held. The site title needs just over `12.4em`, which is why the inset here is `0.4em` a side rather than the wide tier's `0.8em`.
- **Size narrow widths off `--title-size`, not `--cell`.** `--cell` derives from the clamped `--col-w`, so it stops shrinking well before a phone does.
- The `max-width: 600px` block walks the type and the page cap down together; the composition is unchanged, only its scale.
