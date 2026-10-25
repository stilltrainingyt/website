# Assumptions

Every gap filled during the build, with why. Overrule any of them by saying so; the
change then goes in through a pull request.

## From the build plan

| Assumption | Why | To overrule |
| --- | --- | --- |
| Keep the browser-only features (paper colour, Echo's counter, the episode queue) and build no accounts | The queue lives only in the visitor's browser | Ask to remove the queue |
| "Naming the video" means page addresses and titles | It answered the question about addresses | Say if YouTube titles are meant too |
| Upcoming topics on the production board, only published items in the archives | Reconciles "remove anything not uploaded" with showing upcoming topics | Hide the board |
| E3 modes: Exploration a first look, Expedition a long journey, Experiment your own builds and tests | The modes were named, not defined | Redefine them |
| Topics, in order: Career and skills, AI, Research, Projects, Open source, Tech, History, World, Thoughts | Taken from the stated priorities | Edit the list |
| Course units numbered within each course | The design calls the Course track sequential | Describe another order |
| Fallback timings: 10 s to give up, 3 s before the tap hint | Long enough for slow networks, short enough not to strand anyone | Name other timings |
| Edition switch at 900 px | The desktop hides its margin tabs below 900 px | Name another width |
| Only 06pratyush commits | Commits come through 06pratyush | Say otherwise |

## Step 0, setup

| Assumption | Why | To overrule |
| --- | --- | --- |
| "Go with the plan" accepts the decision table's recommendations: repository public, code and design all rights reserved, articles CC BY 4.0, sound-first playback, AI training crawlers allowed, home and about copy drafted for you to edit, the launch definition of done as proposed, and the remaining defaults | The plan asked for these choices; the answer was to go with it | Name the row to change; LICENSE and LICENSE-CONTENT change in their own pull request |
| The optional "calm paper" switch is still open | It is a new piece, which step 7 shows for approval | Decide at step 7 |
| StillTraining_Journal.html is desktop.html and StillTraining_Pocket.html is pocket.html | The journal is the desktop edition, the pocket file the phone edition | Say if they are swapped |
| The display font is Fraunces (weights 500 and 700), chosen from four SIL Open Font License candidates shown in the journal. It replaces Space Grotesk in the Google Fonts link, in `--display` (with serif fallbacks: Georgia, Times New Roman) and in the colophon's "Display" line of both design files. Nothing else changed | Valty, the font named in the plan, is free for personal use only; Fraunces is the closest licence-safe match to its retro serif, and fits the 390 px cover | Pick another font; the design files change in their own pull request before step 1 |
| The design project the two files were exported from still shows Space Grotesk | The change was made to the exported files | Make the same change there before exporting again, or the next export brings Space Grotesk back |
| The Cloudflare application is named `stilltraining`, as in wrangler.jsonc | Cloudflare's build requires the two names to match; it also sets the workers.dev address | Rename both together |
| Cloudflare builds use the dashboard's defaults apart from the name and build command: deploy `npx wrangler deploy`, preview builds on with `npx wrangler preview`, root directory `/`, and a build token Cloudflare created for itself | These are what Cloudflare's Git integration expects for a static-assets Worker | Change them in the application's Settings, Build |
| `workers_dev` and `preview_urls` are set to true in `wrangler.jsonc` | Creating the app from the dashboard left both addresses switched off (error 1042); setting them in the file stops a later deploy from switching them off again. The account's subdomain stays `stilltraining-ai.workers.dev` | Set either to false; renaming the subdomain moves every Worker on the account |
| Previews answer an unknown address with a plain "Not found"; the live site answers it with the 404 page | Seen on the step-00-setup preview. Checked on the live site after merging step 0: `/no-such-page/` returns 404 with "This page was torn out", byte for byte the built 404.html | Nothing to do unless a preview's 404 page needs checking; check it on the live address instead |
| `wrangler.jsonc` has an empty `previews` block | `npx wrangler preview` (Cloudflare's default preview command, in open beta) refuses to run without it; empty means previews use the same settings as production | Switch the preview command to `npx wrangler versions upload` in Cloudflare and remove the block |
| The Cloudflare GitHub app is installed on stilltrainingyt with access to the website repository only | It needs nothing else; the org also holds a private demo-repository | Add repositories in the org's GitHub Apps settings |
| `compatibility_date` is 2026-10-01 | A recent date that every current Wrangler release accepts | Any later date |
| Node 24 in `.node-version` for Cloudflare's build | An LTS release that meets Astro's `>=22.23.4`; this laptop runs 25.8.1, which builds the same | Name another version |
| Astro pinned to exactly 7.4.2 | The current release; `package-lock.json` pins the rest | Upgrade in the monthly dependency pull request |
| Wrangler is not a project dependency | Cloudflare's build runs its own `npx wrangler deploy`, and dependencies need approval | Ask to add it for local deploys |
| Placeholder pages carry `noindex` | Keeps the workers.dev address out of search results before launch; step 12 sets real indexing | Remove it |
| `site` in astro.config.mjs is https://stilltraining.in | Canonical links, the sitemap and the feed need the final address | Name another address |
| The project lives in `Desktop\StillTraining\website` on Windows, not in WSL2 | That is where it was set up; `.gitattributes` keeps LF line endings, so a later WSL2 clone is identical | Clone into WSL2 and work there |
| `design-reference/` is stored without line-ending normalisation | Keeps the frozen files byte for byte as given | None needed |
| The git identity (Pratyush P, GitHub noreply address) is set for this repository only | Other projects on this laptop keep their own settings | Set it globally |

## Step 1, baselines

| Assumption | Why | To overrule |
| --- | --- | --- |
| Baselines are not committed: `npm run baselines` renders them from design-reference/ on each machine, into `tests/visual/baselines/<platform>/` (git-ignored) | They are derived from files already in the repository, so they can always be rebuilt; the 180 images come to about 58 MB; and each machine compares against its own rendering, so fonts and anti-aliasing never differ between baseline and test | Commit them instead (git LFS would suit) |
| Screens are 390 × 844 (pocket, as a touch phone), 900 × 900 and 1440 × 900 (desktop, with a mouse), at 1 device pixel per CSS pixel | 390 × 844 is a common phone; the plan names the widths, not the heights; the designs restyle some things for mouse versus touch (`hover:hover`) | Name other sizes or pixel ratios |
| Light and dark paper are set by the device's colour scheme, not by pressing the paper switch | Both designs follow `prefers-color-scheme` until the switch is pressed, so this shows each paper exactly as a first visit does | None needed |
| Each page is captured one screen at a time, from the top to exactly the bottom, rather than as one tall image | The designs' scroll effects depend on where each section sits on screen, so each screen is what a visitor actually sees there | Ask for full-page images as well |
| Comparison is exact: no colour tolerance and no differing pixels allowed | "Identical" in CLAUDE.md; the self-check proves a 1 px move, a colour 1 step off and one changed letter are each caught | Allow a tolerance with a reason |
| Before each capture the page is settled the same way: hidden from its first moment, its scroll-driven values (`--sp`, `--wire`, `--p`, `--c`, `--pd`, `--s`, `--lx`, `--lz`) cleared and rebuilt by its own scroll handler until they stop changing, then shown and left until every animation ends | The designs measure each sheet including the tilt they gave it last time, so the values depend on load timing and history (the desktop tilt can rest at 4.02deg or 4.03deg, a 32,000-pixel difference). A fixed starting point gives one answer | None needed; the site runs the same scripts |
| A baseline is every distinct rendering three loads of the design file produce, and a screen passes only when it matches one of them pixel for pixel; a page that matches none is retried once on a fresh load | On this Windows laptop Chrome draws the edges of some letters slightly differently from one load to the next (on about 1 page in 54 per run; the desktop deck at 1440 px differs on nearly every load) while every style and position on the page is identical. A tolerance large enough to absorb that would also miss one changed letter of body text, so the comparison stays exact against real renderings instead | Run the screenshot tests in WSL2 (Linux draws text through FreeType), or allow a tolerance |
| Before each screenshot the page is watched for 0.7 s; anything that starts animating by itself is masked and named in the test report | The design's stamp re-inks in a loop near the bottom of the about page (see PARKING_LOT.md), so it can never be captured the same way twice. Only that stamp is masked: the about page's last screen at 900 px and on the phone, in both papers | Mask nothing and fix the loop first |
| Screenshots and speed are measured in Chromium only for now | The plan runs the full suite in Chromium, Firefox and WebKit in step 13 | Add the other engines earlier |
| The speed test reports on the design files and enforces the CLAUDE.md budgets only on the built site | The design files are the starting point; the scroll fix that brings them within budget is one of the three allowed changes, made in step 3 | None needed |
| The two designs store the paper choice differently: desktop as `dark`, pocket as `"dark"` (JSON) under the same `st-theme` key | Read in their scripts; it matters when step 3 merges them into one site | Decide in step 3 |
