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
| `compatibility_date` is 2026-10-01 | A recent date that every current Wrangler release accepts | Any later date |
| Node 24 in `.node-version` for Cloudflare's build | An LTS release that meets Astro's `>=22.23.4`; this laptop runs 25.8.1, which builds the same | Name another version |
| Astro pinned to exactly 7.4.2 | The current release; `package-lock.json` pins the rest | Upgrade in the monthly dependency pull request |
| Wrangler is not a project dependency | Cloudflare's build runs its own `npx wrangler deploy`, and dependencies need approval | Ask to add it for local deploys |
| Placeholder pages carry `noindex` | Keeps the workers.dev address out of search results before launch; step 12 sets real indexing | Remove it |
| `site` in astro.config.mjs is https://stilltraining.in | Canonical links, the sitemap and the feed need the final address | Name another address |
| The project lives in `Desktop\StillTraining\website` on Windows, not in WSL2 | That is where it was set up; `.gitattributes` keeps LF line endings, so a later WSL2 clone is identical | Clone into WSL2 and work there |
| `design-reference/` is stored without line-ending normalisation | Keeps the frozen files byte for byte as given | None needed |
| The git identity (Pratyush P, GitHub noreply address) is set for this repository only | Other projects on this laptop keep their own settings | Set it globally |
