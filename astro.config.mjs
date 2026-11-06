import { defineConfig } from 'astro/config';

// Static files only: no adapter, nothing runs on a server.
export default defineConfig({
  site: 'https://stilltraining.in',
  output: 'static',
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
