import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { PageName } from '../targets';
import type { Edition } from '../visual/materials';

// The design samples (your decision, step 5). The design files show each page filled with
// sample episodes, articles and projects. The folders here hold those samples as content and
// data files, laid out as src/ is; the site built from them must match the design's screenshots
// pixel for pixel. The site itself is built from src/ only.
//
// A sample site is a stack of these folders, each laid over the ones before it. The pocket
// edition's home page names one planned episode differently from the desktop's, so its site
// lays one file over the desktop's. Each page has samples of its own: the design's home page and
// its episodes page give the same episodes different titles.
export const FIXTURE_SITES = {
  home: ['home'],
  'home-pocket': ['home', 'home-pocket'],
} as const satisfies Record<string, readonly string[]>;
export type FixtureSite = keyof typeof FIXTURE_SITES;

// The sample site that draws each page, in each edition.
export const FIXTURE_PAGES: Partial<Record<PageName, Record<Edition, FixtureSite>>> = {
  home: { desktop: 'home', pocket: 'home-pocket' },
};

// Each site's folders laid together, and the site built from them, inside Playwright's output.
const BUILT = path.resolve('test-results', 'fixture-sites');
export const fixtureRoot = (site: FixtureSite): string => path.join(BUILT, site, 'root');
export const fixtureDist = (site: FixtureSite): string => path.join(BUILT, site, 'dist');

// Lay a site's folders together and build it, as `astro build` builds src/ but from them
// (CONTENT_ROOT, src/components/content.ts). Returns the build's output; a failed build throws.
export async function buildFixtureSite(site: FixtureSite): Promise<string> {
  fs.rmSync(path.join(BUILT, site), { recursive: true, force: true });
  for (const layer of FIXTURE_SITES[site]) fs.cpSync(path.resolve('tests', 'fixtures', layer), fixtureRoot(site), { recursive: true });
  const env = {
    ...process.env,
    CONTENT_ROOT: path.relative(process.cwd(), fixtureRoot(site)).split(path.sep).join('/'),
    ASTRO_TELEMETRY_DISABLED: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };
  try {
    const { stdout, stderr } = await promisify(execFile)(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', fixtureDist(site)], { env });
    return `${stdout}${stderr}`;
  } catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };
    throw new Error(`The ${site} design sample did not build:\n${stdout}${stderr}`);
  }
}
