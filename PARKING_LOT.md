# Parking lot

Ideas outside the agreed scope. Nothing here is built unless you pick it.

- A short privacy page saying what the site collects: visit counts, no cookies.
- A scheduled export of comment threads, since GitHub Discussions keeps no backup of its own.
- A page per track, such as /episodes/foundations/, which can rank on its own in search.
- A profile README for the stilltrainingyt organisation, so its GitHub page introduces the brand.
- An open-source licence for small reusable parts, such as the router, since the code is all rights reserved.
- Valty in the channel's thumbnails or wordmark: the same personal-use limit applies there.
- Checking the renewal price of stilltraining.in.
- Hindi pages, later.
- `@types/node` as a development dependency, so editors type-check the tests (Playwright runs them fine without it).
- Echo as lossless WebP: 72 KB instead of 117 KB on the home page, with every pixel the same, but Chrome draws its soft edges up to one colour step differently, so the screenshot test would have to allow that inside Echo's box.
- Preloading the Latin1 font files the home page draws first, if step 3's speed test shows fonts holding up the largest paint.
- IBM Plex Mono 2.003, from IBM's full `@ibm/plex` 6.x package (about 180 MB to download once), might match Google's Mono on the few Cyrillic letters where 2.004 differs. None of them are in the design.
- In step 13, check the font rules in Firefox and WebKit as well: they were matched to the way Chrome picks a file for each character.

## Found in the design files

- The "established · STILL TRAINING" stamp on the about page re-inks in a loop, up to 8 times a second, while the page sits still in a band near the bottom (desktop 900 px: scroll 1413 to 1513; desktop 1440 px: 1570 to 1670; phone 390 px: 2150 to 2350). Its ink animation starts it enlarged, which moves it across the 90%-visible edge its observer watches, which inks it again. A fix (for example, ink it once per visit) changes the reference code, so it waits for your decision.
- The desktop's `.leaf` reads `var(--ly,0deg)`, but nothing sets `--ly`, so it is always 0deg. Perhaps a leftover, perhaps an effect that was never wired up.
- The font link asks for Fraunces at 500 and 700, but every rule that uses the display font sets 700, so 500 is never drawn. Its rules stay as in the design; they share their files with 700, so they cost nothing.
- On Windows, Chrome draws the edges of some letters slightly differently from one load to the next (the desktop deck at 1440 px on nearly every load, a few other screens rarely), although the page is identical. The screenshot test accepts every rendering the design file itself produced; running it in WSL2 may make it exact. Step 13's runs in Firefox and WebKit will show whether it is Chrome only.
