(function () {
  function el(tag, className) {
    var e = document.createElement(tag);
    if (className) e.className = className;
    return e;
  }

  function renderImg(container, cell) {
    if (!cell.img) return;
    var img = el('img', 'cell-img');
    img.src = cell.img;
    img.alt = cell.alt || '';
    container.appendChild(img);
  }

  function renderNotes(cell) {
    var a = el('a', 'cell cell-notes');
    a.href = '/notes/' + cell.id + '/';
    a.dataset.span = cell.span || '1x1';
    renderImg(a, cell);
    if (cell.title) {
      var title = el('div', 'cell-title');
      title.textContent = cell.title;
      a.appendChild(title);
    }
    return a;
  }

  function renderShoreleave(cell) {
    var a = el('a', 'cell cell-shoreleave');
    a.href = cell.href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.dataset.span = cell.span || '1x1';
    renderImg(a, cell);
    if (cell.title) {
      var title = el('div', 'cell-title');
      title.textContent = cell.title;
      a.appendChild(title);
    }
    return a;
  }

  function renderProject(cell) {
    var wrapper = cell.href ? el('a', 'cell cell-project') : el('div', 'cell cell-project');
    if (cell.href) {
      wrapper.href = cell.href;
      wrapper.target = '_blank';
      wrapper.rel = 'noopener';
    }
    wrapper.dataset.span = cell.span || '1x1';
    renderImg(wrapper, cell);
    if (cell.title) {
      var title = el('div', 'cell-title');
      title.textContent = cell.title;
      wrapper.appendChild(title);
    }
    if (cell.text) {
      var text = el('div', 'cell-text');
      text.textContent = cell.text;
      wrapper.appendChild(text);
    }
    return wrapper;
  }

  function renderPin(cell) {
    var isBlank = !cell.title && !cell.img && !cell.text && !cell.href;
    var wrapper = cell.href ? el('a', 'cell cell-pin') : el('div', 'cell cell-pin');
    if (cell.href) {
      wrapper.href = cell.href;
      wrapper.target = '_blank';
      wrapper.rel = 'noopener';
    }
    if (isBlank) wrapper.classList.add('cell-blank');
    wrapper.dataset.span = cell.span || '1x1';
    renderImg(wrapper, cell);
    if (cell.title) {
      var title = el('div', 'cell-title');
      title.textContent = cell.title;
      wrapper.appendChild(title);
    }
    if (cell.text) {
      var text = el('div', 'cell-text');
      text.textContent = cell.text;
      wrapper.appendChild(text);
    }
    return wrapper;
  }

  function renderCell(cell) {
    if (cell.type === 'notes') return renderNotes(cell);
    if (cell.type === 'shoreleave') return renderShoreleave(cell);
    if (cell.type === 'project') return renderProject(cell);
    if (cell.type === 'pin') return renderPin(cell);
    return null;
  }

  fetch('/_data/cells.json')
    .then(function (r) { return r.json(); })
    .then(function (cells) {
      var grid = document.getElementById('grid');
      cells.forEach(function (cell) {
        var node = renderCell(cell);
        if (node) grid.appendChild(node);
      });
    });
})();
