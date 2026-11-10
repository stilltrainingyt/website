import { defineConfig } from 'astro/config';

// Tests build the site from content folders of their own (CONTENT_ROOT, see
// src/components/content.ts). Each keeps its own content cache, inside it, so no entry from a
// test's files is ever carried into a build of the site's.
const contentRoot = process.env.CONTENT_ROOT;

// Static files only: no adapter, nothing runs on a server.
export default defineConfig({
  site: 'https://stilltraining.in',
  output: 'static',
  ...(contentRoot ? { cacheDir: `./${contentRoot}/.astro/` } : {}),
  // The design's markup, CSS and scripts go out as written: whitespace between tags kept (it
  // spaces inline elements), stylesheets not minified, and every file served as its own file
  // rather than folded into the page as a data: address.
  compressHTML: false,
  vite: {
    build: {
      cssMinify: false,
      assetsInlineLimit: 0,
    },
  },
});
