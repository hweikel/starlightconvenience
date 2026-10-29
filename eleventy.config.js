const projects = require("./_data/projects.json");

function readableDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return y + " · " + m + " · " + day;
}

module.exports = function (eleventyConfig) {
  function notePages(collectionApi) {
    return collectionApi.getFilteredByGlob("notes/**/*.md")
      .filter((item) => !item.data.eleventyExcludeFromCollections)
      .sort((a, b) => b.date - a.date);
  }

  eleventyConfig.addCollection("notes", notePages);

  /* Notes and standalone projects share one newest-first list. The column,
     the prev/next chain and the landing entry all read from it, so the merge
     happens once here rather than in every template. */
  eleventyConfig.addCollection("entries", function (collectionApi) {
    const notes = notePages(collectionApi).map((note) => ({
      id: note.fileSlug,
      title: note.data.title,
      date: note.date,
      /* Projects carry a coarser date than notes ("2026-06"), so each entry
         brings its own rendered label. */
      label: readableDate(note.date),
      url: "/notes/" + note.fileSlug + "/",
      note: note
    }));

    const works = projects.map((project) => ({
      id: project.id,
      title: project.title,
      date: new Date(project.date),
      label: String(project.date).split("-").join(" · "),
      url: "/projects/" + project.id + "/",
      project: project
    }));

    const entries = notes.concat(works).sort((a, b) => b.date - a.date);

    /* Neighbours as plain URLs: the templates only need somewhere to point,
       and storing the entries themselves would make the collection cyclic. */
    entries.forEach((entry, i) => {
      entry.olderUrl = i + 1 < entries.length ? entries[i + 1].url : null;
      entry.newerUrl = i > 0 ? entries[i - 1].url : null;
    });

    return entries;
  });

  eleventyConfig.addFilter("isoDate", function (date) {
    return new Date(date).toISOString();
  });

  eleventyConfig.addFilter("readableDate", readableDate);

  eleventyConfig.amendLibrary("md", function (md) {
    var defaultRender = md.renderer.rules.link_open ||
      function (tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
      };
    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
      var href = tokens[idx].attrGet("href") || "";
      if (/^https?:\/\//.test(href)) {
        tokens[idx].attrSet("target", "_blank");
        tokens[idx].attrSet("rel", "noopener");
      }
      return defaultRender(tokens, idx, options, env, self);
    };
  });

  const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";
  eleventyConfig.addTransform("prefix-img-src", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html") && pathPrefix !== "/") {
      return content.replace(/(<img[^>]+src=")(\/assets\/)/g, `$1${pathPrefix}assets/`);
    }
    return content;
  });

  eleventyConfig.ignores.add("README.md");

  eleventyConfig.addWatchTarget("notes/");
  eleventyConfig.addWatchTarget("_includes/");
  eleventyConfig.addPassthroughCopy("fonts");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("CNAME");

  return {
    pathPrefix: pathPrefix,
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    markdownTemplateEngine: false,
  };
};
