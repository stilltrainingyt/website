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
- Steadier screenshots. A few text lines draw in one of two ways depending on when the fonts arrive, because Chrome fixes a layer's sub-pixel offset when it first builds it. The design files (fonts from Google) and the materials target (fonts from disk) land on each way in different proportions. Building the page only once its fonts are in might make every load draw the same, and let each screen's baseline shrink to one rendering.
- Skip links that skip to each page's own first entry. The design's two skip links point at home-page entries (`#premise`, `#why`) on every page, so on other pages they lead nowhere.
- A long cache lifetime for the hashed files under `/_astro/` in `public/_headers`. Their names change whenever their contents do, so browsers could keep them for a year.
- Each edition's script and CSS downloaded only at its own widths (the other edition's 4 to 9 KB of script and 30 to 40 KB of CSS, before compression), if the speed tests ever ask for it.
- Fetching the next page's file when the pointer rests on an entry or a key focuses it, so the turn starts sooner.
- Back and Forward returning to where the visitor was on each page, instead of its top.
- Ctrl-click, ⌘-click and Shift-click on page-strip links opening a new tab or window, as plain links do.
- Turning in place between two episodes or two articles, instead of loading the page (the design's `show()` treats the same page name as already shown).
- A list of courses in `taxonomy.json` with their names, so a course shows as "Reinforcement learning" rather than from its address, and its units can be checked as numbered in order.
- Scheduled publishing: a video or article left out of the build until its published date.
- A build-time check that a video is not a YouTube Short. It needs a call to YouTube during the build.
- Type checking with `astro check` (adds `@astrojs/check` and `typescript`).

## Found in the design files

- The "established · STILL TRAINING" stamp on the about page re-inks in a loop, up to 8 times a second, while the page sits still in a band near the bottom (desktop 900 px: scroll 1413 to 1513; desktop 1440 px: 1570 to 1670; phone 390 px: 2150 to 2350). Its ink animation starts it enlarged, which moves it across the 90%-visible edge its observer watches, which inks it again. A fix (for example, ink it once per visit) changes the reference code, so it waits for your decision.
- The desktop's `.leaf` reads `var(--ly,0deg)`, but nothing sets `--ly`, so it is always 0deg. Perhaps a leftover, perhaps an effect that was never wired up.
- The font link asks for Fraunces at 500 and 700, but every rule that uses the display font sets 700, so 500 is never drawn. Its rules stay as in the design; they share their files with 700, so they cost nothing.
- On Windows, Chrome draws the edges of some letters slightly differently from one load to the next (the desktop deck at 1440 px on nearly every load, a few other screens rarely), although the page is identical. The screenshot test accepts every rendering the design file itself produced; running it in WSL2 may make it exact. Step 13's runs in Firefox and WebKit will show whether it is Chrome only.
- Pocket's scroll handler works out which dock entry is current from `data-go` attributes the dock's buttons do not have, and never uses the result. The desktop's leaf handler likewise works out the nearest leaf and never uses it. Both are kept as written.
- The scroll effects lift the document's first leaf fully on arrival (`i===0 ? 1 : …`, "the first leaf is already on the desk"). In the design file that is always the home page's first leaf. On the site it is the first leaf of whichever page loaded first: a page opened at its own address lifts its first leaf fully, and after turning back home, home's first leaf is no longer first. It draws the same while that leaf starts within the top 38% of the screen (desktop) or 50% (pocket). Measured on the design's pages: home is unaffected at every width; opened at their own addresses, projects at 1440 px and an article at 900 and 1440 px would draw their first leaf differently. Changing it changes the reference code, so it waits for your decision, at the latest when those pages arrive in steps 9 and 10.
- The home cabinet's project sheets show different tags from the projects page for four projects (ContextCore, The Engine, SIH25028, SliceGPT, reproduced), and SIH25028's summary there ends "for the desktop". A project file holds one set, so step 5 settles which the cabinet shows.
- The home cabinet's article sheets carry "Draft" chips. The plan takes draft content off the site, so real articles there will have none.
