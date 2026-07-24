module.exports = function (eleventyConfig) {
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("posts/**/*.md")
      .filter((item) => !item.data.eleventyExcludeFromCollections)
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addFilter("isoDate", function (date) {
    return new Date(date).toISOString();
  });

  eleventyConfig.addFilter("readableDate", function (date) {
    var d = new Date(date);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return y + " \u00B7 " + m + " \u00B7 " + day;
  });

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

  eleventyConfig.addWatchTarget("posts/");
  eleventyConfig.addWatchTarget("_includes/");
  eleventyConfig.addPassthroughCopy("fonts");
  eleventyConfig.addPassthroughCopy("white-diamond.jpg");
  eleventyConfig.addPassthroughCopy("assets");
  eleventyConfig.addPassthroughCopy("CNAME");

  return {
    pathPrefix: process.env.ELEVENTY_PATH_PREFIX || "/",
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    markdownTemplateEngine: false,
  };
};
