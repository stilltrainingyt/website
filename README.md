# Still Training

Source code for [stilltraining.in](https://stilltraining.in), the personal brand site of Pratyush P: long-form videos, articles and projects.

- YouTube: [@StillTraining_ai](https://www.youtube.com/@StillTraining_ai)
- LinkedIn: [Pratyush P](https://www.linkedin.com/in/pratyush-p-1226b532b/)
- GitHub: [stilltrainingyt](https://github.com/stilltrainingyt) · [06pratyush](https://github.com/06pratyush)

## Stack

A static [Astro](https://astro.build) site, served by Cloudflare. No server or database of its own.

## Tests

Playwright compares every page with the two design files in `design-reference/`.

```bash
npx playwright install chromium   # once per machine
npm run baselines                 # render the baselines from the design files (about 17 minutes)
npm run test:visual               # compare against them
npm run test:selfcheck            # prove small changes are caught
npm run test:speed                # scroll and page-turn timing at 1×, 4× and 6× CPU slowdown
```

Chrome on Windows sometimes draws a few screens slightly differently for a whole run, so run `npm run baselines` two or three times: each run adds the renderings it sees, and the collection starts over when `design-reference/` changes.

## Contributions

This is a personal site and isn't open to outside contributions.

## Licence

- Code, design and visual assets: all rights reserved. See [LICENSE](LICENSE).
- Articles, transcripts and video notes: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), credited to Pratyush P, Still Training. See [LICENSE-CONTENT](LICENSE-CONTENT).
