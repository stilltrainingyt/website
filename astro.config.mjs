import fs from 'node:fs';
import { defineConfig } from 'astro/config';

// Tests build the site from content folders of their own (CONTENT_ROOT, see
// src/components/content.ts). Each keeps its own content cache, inside it, so no entry from a
// test's files is ever carried into a build of the site's.
const contentRoot = process.env.CONTENT_ROOT;

// A test's content folder may hold pages of its own in pages/, such as the review pages for
// the pieces you approved in step 7 (tests/fixtures/pieces). Each is added at
// /pieces/<name>/. The site's own build has no CONTENT_ROOT, so it never has them.
const reviewPages = contentRoot && fs.existsSync(`${contentRoot}/pages`)
  ? fs.readdirSync(`${contentRoot}/pages`).filter((name) => name.endsWith('.astro'))
  : [];
const reviewPagesIntegration = {
  name: 'review-pages',
  hooks: {
    'astro:config:setup': ({ injectRoute }) => {
      for (const name of reviewPages) injectRoute({ pattern: `/pieces/${name.slice(0, -'.astro'.length)}`, entrypoint: `./${contentRoot}/pages/${name}` });
    },
  },
};

// Static files only: no adapter, nothing runs on a server.
export default defineConfig({
  site: 'https://stilltraining.in',
  output: 'static',
  ...(contentRoot ? { cacheDir: `./${contentRoot}/.astro/` } : {}),
  ...(reviewPages.length > 0 ? { integrations: [reviewPagesIntegration] } : {}),
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
