(function () {
  var GRID_COLS = 32;
  var GRID_ROWS = 20;

  var canvas = document.getElementById('grid');
  if (!canvas) return;

  function el(tag, className) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function renderImg(container, src, alt, className) {
    var img = el('img', className);
    img.src = src;
    img.alt = alt || '';
    container.appendChild(img);
    return img;
  }

  function link(node, href) {
    node.href = href;
    if (/^https?:\/\//.test(href)) {
      node.target = '_blank';
      node.rel = 'noopener';
    }
    return node;
  }

  function renderPoint(cell) {
    var wrapper = el(cell.href ? 'a' : 'div', 'point');
    if (cell.href) link(wrapper, cell.href);
    points.push({ node: wrapper, cell: cell });
    renderImg(wrapper, cell.img, cell.alt, 'point-img');
    return wrapper;
  }

  var lines = [];
  var points = [];
  var regions = [];

  function renderLine(cell) {
    var line = el('div', 'grid-line grid-line-' + cell.orientation);
    lines.push({
      node: line,
      orientation: cell.orientation,
      at: cell.at,
      span: cell.span,
      reach: cell.reach
    });
    return line;
  }

  /* Whole device pixels only: a fractional offset antialiases across two
     pixel rows, which renders as uneven line weights. */
  function snap(v) {
    var dpr = window.devicePixelRatio || 1;
    return Math.round(v * dpr) / dpr;
  }

  /* Offsets zeroed: lines and regions are absolute inside .grid, so they are
     measured from the canvas, not the window -- the page scrolls. doc* is the
     canvas's offset into the document, for edges that run past it. */
  function canvasBox() {
    var rect = canvas.getBoundingClientRect();
    return {
      top: 0,
      left: 0,
      width: rect.width,
      height: rect.height,
      docTop: rect.top + window.scrollY,
      docLeft: rect.left + window.scrollX
    };
  }

  /* Excludes the scrollbar, unlike innerWidth. Constant across layouts: the
     CSS keeps the scrollbar present whether or not the page scrolls. */
  function pageWidth() {
    return document.documentElement.clientWidth;
  }

  /* Narrow mode is laid out by CSS, so every inline style written here must
     come back off: inline beats the stylesheet. */
  function layout() {
    if (isNarrow()) { clearLayout(); return; }
    var box = canvasBox();
    layoutRegions(box);
    layoutNav(box);
    layoutExtent(box);
  }

  /* The breakpoint is declared once, as --narrow in the stylesheet. */
  function isNarrow() {
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--narrow').trim() === '1';
  }

  function clearLayout() {
    document.body.style.minHeight = '';
    regions.forEach(function (region) { clear(region.node, 'left top width'); });
    lines.forEach(function (line) { clear(line.node, 'left top width height'); });
    points.forEach(function (point) { clear(point.node, 'left top width'); });
    if (!navEl) return;
    var items = navEl.querySelectorAll('.notes-nav-item');
    for (var i = 0; i < items.length; i++) clear(items[i], 'height');
  }

  function clear(node, props) {
    props.split(' ').forEach(function (prop) { node.style[prop] = ''; });
  }

  /* Page height and the lines drawn to it. The ResizeObserver must call this
     and not layout(): a full layout rewrites nav row heights, resizing an
     element it watches, and Chrome drops that notification. */
  function layoutExtent(box) {
    if (isNarrow()) return;
    var extent = pageExtent(box);
    document.body.style.minHeight = extent + 'px';
    layoutLines(box, extent);
    layoutPoints(box, extent);
  }

  /* At least a windowful, so the lines always cross the viewport. */
  function pageExtent(box) {
    var extent = window.innerHeight;
    regions.forEach(function (region) {
      extent = Math.max(extent, box.docTop + region.top + region.node.offsetHeight);
    });
    return Math.max(extent, stemExtent(box));
  }

  /* The column usually sets the page height, which would leave a line no
     room below the last entry. `reach` (grid rows) is the page growing. */
  function stemExtent(box) {
    if (!navEl) return 0;
    var reach = 0;
    lines.forEach(function (line) {
      if (line.reach) reach = Math.max(reach, line.reach * (box.height / GRID_ROWS));
    });
    if (!reach) return 0;
    return box.docTop + (regionTop(navEl) || 0) + navEl.offsetHeight + reach;
  }

  /* Region heights land after first paint: fetched body, then its images. */
  function watchRegions() {
    if (typeof ResizeObserver !== 'function') return;
    var observer = new ResizeObserver(function () { layoutExtent(canvasBox()); });
    regions.forEach(function (region) { observer.observe(region.node); });
  }

  /* Both ends, not just the coordinate: a line spans the document, so it
     keeps running past the fold. */
  function layoutLines(box, extent) {
    lines.forEach(function (line) {
      var node = line.node;
      if (line.orientation === 'horizontal') {
        node.style.top = snap(line.at / GRID_ROWS * box.height) + 'px';
        node.style.left = -box.docLeft + 'px';
        node.style.width = pageWidth() + 'px';
      } else {
        var band = navBand(box, extent, line.span);
        node.style.left = snap(line.at / GRID_COLS * box.width) + 'px';
        node.style.top = snap(band.top) + 'px';
        node.style.height = Math.max(0, band.height) + 'px';
      }
    });
  }

  /* A named vertical run, canvas-relative. Unnamed is the whole document.
     The column's end is measured, not a coordinate, so these resolve at
     layout time. Lines name one with `span`, points with `on`. */
  function navBand(box, extent, name) {
    var page = { top: -box.docTop, height: extent };
    if (!name || !navEl) return page;
    var top = regionTop(navEl) || 0;
    var bottom = top + navEl.offsetHeight;
    if (name === 'nav') return { top: top, height: bottom - top };
    if (name === 'above-nav') return { top: page.top, height: top - page.top };
    if (name === 'below-nav') {
      return { top: bottom, height: page.top + page.height - bottom };
    }
    return page;
  }

  /* `on` rides a named band, `pos` is the fraction along it the art centres
     on. The band above the column is part fixed margin and part scaling
     rows, so a plain `y` there drifts off the page top as the canvas grows. */
  function layoutPoints(box, extent) {
    points.forEach(function (point) {
      var cell = point.cell;
      var style = point.node.style;
      style.left = (cell.x / GRID_COLS * 100) + '%';
      style.width = ((cell.size || 3) / GRID_COLS * 100) + '%';
      if (cell.on) {
        var band = navBand(box, extent, cell.on);
        var pos = cell.pos == null ? 0.5 : cell.pos;
        style.top = snap(band.top + pos * band.height) + 'px';
      } else {
        style.top = (cell.y / GRID_ROWS * 100) + '%';
      }
    });
  }

  /* The canvas-relative top layoutRegions() gave a region. */
  function regionTop(node) {
    for (var i = 0; i < regions.length; i++) {
      if (regions[i].node === node) return regions[i].top;
    }
    return 0;
  }

  function hasLine(orientation, at) {
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].orientation === orientation && lines[i].at === at) return true;
    }
    return false;
  }

  /* Regions are bounded by lines, not the canvas box: an edge hitting the
     canvas boundary with no line on it runs to the page edge. */
  function edgeX(box, at) {
    if (at <= 0 && !hasLine('vertical', 0)) return -box.docLeft;
    if (at >= GRID_COLS && !hasLine('vertical', GRID_COLS)) return pageWidth() - box.docLeft;
    return colX(box, at);
  }

  /* A column's position with no bleed rule applied. */
  function colX(box, at) {
    return snap(box.left + at / GRID_COLS * box.width);
  }

  function edgeY(box, at) {
    if (at <= 0 && !hasLine('horizontal', 0)) return -box.docTop;
    return rowY(box, at);
  }

  /* A row's position with no bleed rule applied. */
  function rowY(box, at) {
    return snap(box.top + at / GRID_ROWS * box.height);
  }

  function lineWeight() {
    var declared = getComputedStyle(document.documentElement).getPropertyValue('--line-weight');
    return parseFloat(declared) || 1;
  }

  /* Left, right and top only: a region's height is its content. */
  function layoutRegions(box) {
    /* Lines draw inward from their coordinate, so start after one rather
       than on top of it -- else a region's background hides it. */
    var weight = lineWeight();
    regions.forEach(function (region) {
      var cell = region.cell;
      /* `bleed: false` holds a region to the canvas where it draws its own
         rules; the column's are item borders, not `line`s. */
      var bleed = cell.bleed !== false;
      var left = (bleed ? edgeX(box, cell.x) : colX(box, cell.x)) +
                 (hasLine('vertical', cell.x) ? weight : 0);
      var top = (bleed ? edgeY(box, cell.y) : rowY(box, cell.y)) +
                (hasLine('horizontal', cell.y) ? weight : 0);
      var right = bleed ? edgeX(box, cell.x + cell.w) : colX(box, cell.x + cell.w);
      region.top = top;
      region.node.style.left = left + 'px';
      region.node.style.top = top + 'px';
      region.node.style.width = (right - left) + 'px';
    });
  }

  /* Rows are a fixed height in grid units; the column runs down the page
     rather than stretching or scrolling. Heights accumulate through snap() so
     each border lands on a whole device pixel. Titles are pinned type while
     rows scale, so a wrapped title takes whichever is taller. */
  function layoutNav(box) {
    if (!navEl) return;
    var items = navEl.querySelectorAll('.notes-nav-item');
    if (!items.length) return;

    var i;
    for (i = 0; i < items.length; i++) items[i].style.height = '';

    var natural = [];
    for (i = 0; i < items.length; i++) natural.push(items[i].getBoundingClientRect().height);

    var rowPx = box.height / GRID_ROWS;
    var width = navEl.getBoundingClientRect().width;
    /* Document offset, not viewport: borders must snap the same at any
       scroll position. */
    var top = box.docTop + (regionTop(navEl) || 0);
    var offset = 0;
    var acc = 0;

    for (i = 0; i < items.length; i++) {
      /* Height from the column's width, so it stays square at any scale. */
      acc += items[i].classList.contains('notes-nav-square')
        ? width
        : Math.max(navRowHeight * rowPx, natural[i]);
      var edge = snap(top + acc) - top;
      items[i].style.height = (edge - offset) + 'px';
      offset = edge;
    }
  }

  /* ---- reader -------------------------------------------------------
     Nav column and reading pane are regions of this same canvas. "/" opens
     the newest entry; /notes/<slug>/ serves the same shell and reads the
     slug off the URL. Post bodies come from note-fragments.njk. */

  var NOTES_BASE = '/notes/';
  var entries = [];
  var navEl = null;
  var navHead = [];
  var navRowHeight = 1.5;
  var readerEl = null;
  var fragmentCache = {};
  var activeId = null;

  function renderRegion(cell, className) {
    var node = el(className === 'notes-nav' ? 'nav' : 'div', className);
    regions.push({ node: node, cell: cell });
    return node;
  }

  function renderNotesNav(cell) {
    navEl = renderRegion(cell, 'notes-nav');
    navHead = cell.head || [];
    navRowHeight = cell.rowHeight || 1.5;
    return navEl;
  }

  function renderNotesReader(cell) {
    readerEl = renderRegion(cell, 'notes-reader');
    /* Images change the pane's height. Capture phase because `load` doesn't
       bubble; the ResizeObserver alone misses some of these. */
    readerEl.addEventListener('load', function () { layoutExtent(canvasBox()); }, true);
    return readerEl;
  }

  /* Notes and projects share one newest-first list; the nav, the prev/next
     chain and the landing entry all read from it. */
  function mergeEntries(notes, projects) {
    var merged = notes.map(function (note) {
      return { id: note.slug, title: note.title, date: note.date, note: note };
    }).concat(projects.map(function (project) {
      return { id: project.id, title: project.title, date: project.date, project: project };
    }));
    merged.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return merged;
  }

  function entryIndex(id) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].id === id) return i;
    }
    return -1;
  }

  function entryHref(entry) {
    return entry.note ? NOTES_BASE + entry.note.slug + '/' : '/';
  }

  /* Fixed cells at the top of the column: ordinary nav items, but never
     active and never in the prev/next chain. */
  function buildNavHead() {
    navHead.forEach(function (item) {
      /* Narrow mode splits the column on this class. */
      var node = el(item.href ? 'a' : 'div', 'notes-nav-item notes-nav-head');
      if (item.href) link(node, item.href);
      if (item.square) node.classList.add('notes-nav-square');
      if (item.img) {
        if (item.size) node.style.setProperty('--head-img-fill', item.size);
        renderImg(node, item.img, item.alt, 'notes-nav-img');
      }
      if (item.title) {
        var text = el('span', 'title-text');
        text.textContent = item.title;
        node.appendChild(text);
      }
      navEl.appendChild(node);
    });
  }

  function buildNav() {
    if (!navEl) return;
    buildNavHead();
    entries.forEach(function (entry) {
      var item = el('a', 'notes-nav-item');
      item.href = entryHref(entry);
      item.setAttribute('data-id', entry.id);
      /* A project stands on its artwork: a square cell holding a preview
         instead of a title row. */
      if (entry.project) {
        item.className += ' notes-nav-square notes-nav-preview';
        renderImg(item, entry.project.img, entry.project.alt, 'notes-nav-img');
      } else {
        renderTitle(item, entry);
      }
      item.addEventListener('click', function (e) {
        e.preventDefault();
        openEntry(entry.id, true);
      });
      navEl.appendChild(item);
    });
    closeNavRuns();
    layout();
  }

  /* Rules between titles are `border-top`s, so each run needs its last row
     to close it: the column's end, or the row above a floating image. */
  function closeNavRuns() {
    var items = navEl.querySelectorAll('.notes-nav-item');
    for (var i = 0; i < items.length; i++) {
      var next = items[i + 1];
      items[i].classList.toggle(
        'notes-nav-close',
        !items[i].classList.contains('notes-nav-preview') &&
          (!next || next.classList.contains('notes-nav-preview'))
      );
    }
  }

  function markActive(id) {
    if (!navEl) return;
    var items = navEl.querySelectorAll('.notes-nav-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-id') === id);
    }
  }

  /* Older entries are further down the list, so "back" walks toward the end
     of the array and "forward" toward 0. */
  function appendPostNav(article, id) {
    var idx = entryIndex(id);
    if (idx < 0) return;
    var nav = el('div', 'post-nav');

    function button(target, glyph, className) {
      var a = el('a', className);
      a.href = entryHref(target);
      a.textContent = glyph;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        openEntry(target.id, true);
      });
      return a;
    }

    if (idx < entries.length - 1) {
      nav.appendChild(button(entries[idx + 1], '⇜︎', 'post-nav-prev'));
    }
    if (idx > 0) {
      nav.appendChild(button(entries[idx - 1], '⇝︎', 'post-nav-next'));
    }
    article.appendChild(nav);
  }

  function show(id, build) {
    var article = el('article', 'post');
    build(article);
    appendPostNav(article, id);
    readerEl.innerHTML = '';
    readerEl.appendChild(article);
    /* Also from the observer, but this gets the lines right on the same
       frame the post appears. */
    layout();
    window.scrollTo(0, 0);
  }

  function showNote(id, html) {
    show(id, function (article) { article.innerHTML = html; });
  }

  /* Matches readableDate's separator at whatever precision the entry
     carries, so "2026-06" reads "2026 · 06". */
  function formatDate(date) {
    return String(date).split('-').join(' · ');
  }

  /* A project's `mark` (the DSP logo) stands in for words in its title, so
     it leads the label wherever that title is drawn -- nav and header alike. */
  function renderTitle(node, entry) {
    var project = entry.project;
    if (project && project.mark) {
      /* Drawn as a mask filled with currentColor rather than an <img>, so
         the mark picks up hover and active states with the label. The
         artwork is a single flat shape, so nothing is lost. */
      var mark = el('span', 'title-mark');
      mark.style.setProperty('--mark', 'url("' + project.mark + '")');
      if (project.markAlt) {
        mark.setAttribute('role', 'img');
        mark.setAttribute('aria-label', project.markAlt);
      }
      node.appendChild(mark);
    }
    var text = el('span', 'title-text');
    text.textContent = entry.title;
    node.appendChild(text);
    return node;
  }

  /* Same title/date header as a post, over a single linked image. */
  function showProject(entry) {
    var project = entry.project;
    show(entry.id, function (article) {
      article.classList.add('project-post');
      article.appendChild(renderTitle(el('h1', 'post-title'), entry));

      var date = el('div', 'post-date');
      date.textContent = formatDate(project.date);
      article.appendChild(date);

      var anchor = link(el('a', 'project'), project.href);
      renderImg(anchor, project.img, project.alt, 'project-img');
      article.appendChild(anchor);
    });
  }

  function openEntry(id, push) {
    var idx = entryIndex(id);
    if (!readerEl || idx < 0) return;
    var entry = entries[idx];
    activeId = id;
    if (push) history.pushState({ id: id }, '', entryHref(entry));
    markActive(id);

    if (entry.project) { showProject(entry); return; }

    var slug = entry.note.slug;
    if (fragmentCache[slug]) { showNote(id, fragmentCache[slug]); return; }
    fetch(NOTES_BASE + slug + '/content.html')
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      })
      .then(function (html) {
        fragmentCache[slug] = html;
        /* A slower earlier request must not overwrite a later click. */
        if (activeId === id) showNote(id, html);
      })
      .catch(function () {
        if (activeId === id) showNote(id, fragmentFallback(slug));
      });
  }

  /* Reuses .post-body's styling, and offers the one URL that serves this
     note's prose without JavaScript. */
  function fragmentFallback(slug) {
    return '<div class="post-body"><p>This note could not be loaded. ' +
      '<a href="' + NOTES_BASE + slug + '/content.html">Open it directly.</a>' +
      '</p></div>';
  }

  function idFromPath() {
    var match = location.pathname.match(/\/notes\/([^\/]+)\/?$/);
    return match ? match[1] : null;
  }

  function startReader() {
    buildNav();
    var initial = idFromPath();
    /* Deep link wins; otherwise the homepage opens the newest entry without
       rewriting the URL, so "/" stays "/". */
    if (!initial || entryIndex(initial) < 0) initial = entries.length ? entries[0].id : null;
    if (!initial) return;
    history.replaceState({ id: initial }, '', location.href);
    openEntry(initial, false);
  }

  window.addEventListener('popstate', function (e) {
    var id = (e.state && e.state.id) || idFromPath();
    if (!id || entryIndex(id) < 0) id = entries.length ? entries[0].id : null;
    if (id) openEntry(id, false);
  });

  /* ---- boot ---------------------------------------------------------- */

  var renderers = {
    line: renderLine,
    point: renderPoint,
    'notes-nav': renderNotesNav,
    'notes-reader': renderNotesReader
  };

  /* Every boot fetch falls back rather than rejecting: an unhandled rejection
     here leaves the page blank, since nothing is server-rendered. */
  function fetchJson(url) {
    return fetch(url)
      .then(function (r) { return r.json(); })
      .catch(function () { return []; });
  }

  Promise.all([
    fetchJson('/_data/cells.json'),
    fetchJson('/notes.json'),
    fetchJson('/_data/projects.json')
  ]).then(function (results) {
    entries = mergeEntries(results[1], results[2]);

    results[0].forEach(function (cell) {
      var render = renderers[cell.kind];
      if (render) canvas.appendChild(render(cell));
    });

    layout();
    watchRegions();
    window.addEventListener('resize', layout);
    window.addEventListener('load', layout);

    startReader();
  });
})();
