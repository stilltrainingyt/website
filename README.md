# Still Training

Source code for [stilltraining.in](https://stilltraining.in), the personal brand site of Pratyush P: long-form videos, articles and projects.

- YouTube: [@StillTraining_ai](https://www.youtube.com/@StillTraining_ai)
- LinkedIn: [Pratyush P](https://www.linkedin.com/in/pratyush-p-1226b532b/)
- GitHub: [stilltrainingyt](https://github.com/stilltrainingyt) · [06pratyush](https://github.com/06pratyush)

## Stack

A static [Astro](https://astro.build) site, served by Cloudflare. No server or database of its own.

## Content

Every video, transcript, article, project and planned episode is a text file. Blank copies to start from are in `templates/`.

- `src/content/videos/<address>.md`: a video, with its notes below the front matter
- `src/content/transcripts/<address>.vtt`: its transcript, the caption file YouTube Studio gives
- `src/content/articles/<address>.md`: an article
- `src/content/projects/<address>.md`: a project
- `src/data/upcoming.yaml`: the production board, one entry per planned episode under its slate number
- `src/data/taxonomy.json`: the tracks, modes and topics, in the order the pages show them
- `src/data/site.json`: the site's name, tagline and links
- `src/data/home.yaml`: the home page's words (cover, premise, track cards, playground, cabinet), with a `desktop:` and a `pocket:` version where the two editions word a line differently

The home page's track cards list each track's latest episodes, newest first, then its planned ones as plain text, four at most. Its cabinet shows the four newest articles and the first six projects by `order`; an article or project may carry `cabinet:` tags and a summary to show there instead of its own.

The file name is the page address and never changes after publishing. The build checks every file's fields and the links between files (a video and its transcript, a video and its linked article, from both ends); any problem stops the build and says which file and why.

## Tests

Playwright compares every page with the two design files in `design-reference/`.

```bash
npx playwright install chromium   # once per machine
npm run baselines                 # render the baselines from the design files (about 17 minutes)
npm run baselines:shell           # only the shell's empty-page baselines
npm run test:visual               # compare the design files against them
npm run test:materials            # the design drawn with the project's tokens, fonts and images
npm run test:selfcheck            # prove small changes are caught
npm run test:speed                # the design files' timing at 1×, 4× and 6× CPU slowdown
npm run test:site                 # build the site and the design-sample sites, and compare their screens and the page turn with the design's
npm run test:behaviour            # build the site and the samples, press through what they do, check the code against the design, and prove the content checks stop a bad build
npm run test:site-speed           # build the site and hold it to the speed budgets
npm run test:pieces               # draw the step 7 pieces on the review site, into test-results/pieces/
```

The site's own content folders hold no episodes, articles or projects yet, so its home page has empty card lists and folders. To compare a filled page with the design, `tests/fixtures/` holds the design's own sample titles, articles and projects as content files; the `fixture-sites` project builds a site from them into `test-results/fixture-sites/`, and the `fixtures` project compares its screens with the design's baselines. The live site never reads them.

Chrome on Windows sometimes draws a few screens slightly differently for a whole run, so run `npm run baselines` two or three times: each run adds the renderings it sees, and the collection starts over when `design-reference/` changes.

Until step 13, `npm run test:site-speed` fails on two budgets, as decided in step 5: long tasks while scrolling the home page, and the desktop page turn. `ASSUMPTIONS.md` has the numbers, and step 13 settles them on Linux and on real phones.

## Contributions

This is a personal site and isn't open to outside contributions.

## Licence

- Code, design and visual assets: all rights reserved. See [LICENSE](LICENSE).
- Articles, transcripts and video notes: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), credited to Pratyush P, Still Training. See [LICENSE-CONTENT](LICENSE-CONTENT).
