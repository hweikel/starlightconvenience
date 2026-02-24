module.exports = function (eleventyConfig) {
  eleventyConfig.addCollection("posts", function (collectionApi) {
    return collectionApi.getFilteredByGlob("posts/**/*.md").sort((a, b) => {
      return b.date - a.date;
    });
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

  const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";
  eleventyConfig.addTransform("prefix-img-src", function (content, outputPath) {
    if (outputPath && outputPath.endsWith(".html") && pathPrefix !== "/") {
      return content.replace(/(<img[^>]+src=")(\/assets\/)/g, `$1${pathPrefix}assets/`);
    }
    return content;
  });

  eleventyConfig.addWatchTarget("posts/");
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
