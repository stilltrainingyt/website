import { defineConfig } from 'astro/config';

// Static files only: no adapter, nothing runs on a server.
export default defineConfig({
  site: 'https://stilltraining.in',
  output: 'static',
});
