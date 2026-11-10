import { test } from '@playwright/test';
import { FIXTURE_SITES, buildFixtureSite, type FixtureSite } from './sites';

// Builds each design-sample site (sites.ts) before the tests that use them: the fixtures
// project's screenshots and the behaviour project's clicks. One at a time, as content.spec.ts
// builds: every build writes the project's own .astro folder, so two at once can collide.
test.describe.configure({ mode: 'default' });

for (const site of Object.keys(FIXTURE_SITES) as FixtureSite[]) {
  test(`build the ${site} design sample`, async ({}, testInfo) => {
    test.setTimeout(180_000);
    await testInfo.attach('build output', { body: await buildFixtureSite(site), contentType: 'text/plain' });
  });
}
