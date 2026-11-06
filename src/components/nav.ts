// The design's nine pages, and what the shell needs to know about each.

export type PageName =
  | 'home' | 'episodes' | 'episode' | 'writing' | 'article'
  | 'projects' | 'about' | 'subscribe' | 'missing';

// The six entries of the margin tabs, page strip and thumb dock, in the design's order.
export type Route = 'home' | 'episodes' | 'writing' | 'projects' | 'about' | 'subscribe';

// The entry a page lights up, as the design's router decides it (its GROUP): an episode is
// under Episodes, an article under Writing, and a missing page under none.
export function routeOf(page: PageName): Route | '' {
  if (page === 'episode') return 'episodes';
  if (page === 'article') return 'writing';
  if (page === 'missing') return '';
  return page;
}

// Whether an entry is the current one, written as the design's router writes it.
export const currentAttr = (route: Route, current: Route | ''): 'true' | 'false' => (route === current ? 'true' : 'false');

// The edition switch's width: the desktop edition from here, the pocket edition below.
export const DESKTOP_FROM = '(min-width:900px)';
