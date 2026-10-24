# StillTraining website: standing rules

## Source of truth
- design-reference/ holds the two design files. Never edit, move or delete anything in it.
- The site must look identical to them. When code and reference disagree, the reference wins.
- desktop.html and pocket.html are the same pages at two widths. Build ONE responsive site:
  pocket edition below 900 px, desktop edition from 900 px.

## Styling
- Copy CSS and scripts from the reference as written. No Tailwind, no component library,
  no restyling, no new colours, fonts, shadows, spacing or animations.
- Every colour, font, size and spacing value comes from src/styles/tokens.css.
- Only these changes to the reference code are allowed:
  1. Remove the prefers-reduced-motion CSS blocks and treat the scripts' `reduce` as false.
  2. Write the --sp scroll value on .frame instead of the document root.
  3. Relabel filters and track cards from src/data/taxonomy.json.
  Anything else that would change the reference code: stop and ask.
- New pieces are composed only from existing components, and wait for my approval.

## Content
- Content lives only in src/content/ and src/data/. Pages never hard-code content.
- Archives list only published items. Upcoming items appear only on the production board.
- No YouTube Shorts anywhere on the site.

## Working
- One step per branch, named step-NN-short-name. Never commit to main.
- Commit as the configured git user. Never change the git identity.
- When a step is done, push and open a pull request with gh. Merge only when I say,
  with a merge commit.
- A step is done only when the screenshot, behaviour and speed tests pass.
  Never say something works unless you ran it and saw it pass.
- Ask before adding any dependency, changing the folder structure, or doing anything
  outside the step.
- Ideas outside the step go in PARKING_LOT.md. Gaps you fill go in ASSUMPTIONS.md, with why.

## Speed budgets, at 4x CPU slowdown
- Largest contentful paint 2.5 s or less, interaction to next paint 200 ms or less,
  layout shift 0.1 or less.
- No long task while scrolling the home page. A page turn under 200 ms of main-thread work.
- Animate only transform and opacity.
