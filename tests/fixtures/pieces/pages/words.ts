// The words the new pieces show on the review pages: drafts for you to change. When a piece is
// approved and used (steps 8 to 10), its words move into the data file of the page that uses it,
// so you edit them there and never in a component.
import { site } from '/src/components/content';

export const highlights = { pinned: 'Pinned', latest: 'Latest', hot: 'Hot' };
export const watchIt = 'Watch it';
export const readIt = 'Read it';
export const minutesRead = '{minutes} min read';

export const sort = {
  label: 'Sort by',
  options: [
    { id: 'az', label: 'A to Z' },
    { id: 'topic', label: 'Topic' },
    { id: 'newest', label: 'Newest' },
    { id: 'oldest', label: 'Oldest' },
  ],
  current: 'newest',
};

export const search = {
  action: '/search/',
  label: 'Search the videos and articles',
  placeholder: 'tokenizers, backprop, SliceGPT',
  button: 'Search',
};

export const transcript = { eyebrow: 'Transcript', open: 'Read it all' };

export const licence = {
  line: (year: number) => `© ${year} ${site.author} · CC BY 4.0 · Credit: ${site.author}, Still Training, with a link to this page.`,
  label: 'Licence',
  url: 'https://creativecommons.org/licenses/by/4.0/',
};

export const slip = {
  eyebrow: 'Torn · now pick a way in',
  title: 'Every new episode, wherever you follow along',
  text: 'No newsletter and no digest. Follow the channel where you already read.',
  links: [
    { label: 'Subscribe on YouTube', href: site.links.youtube, external: true },
    { label: 'Follow by RSS', href: '/rss.xml', external: false },
    { label: 'Follow on GitHub', href: site.links.github, external: true },
    { label: 'Connect on LinkedIn', href: site.links.linkedin, external: true },
  ],
  tapeBack: 'Tape it back',
};

export const player = {
  // One line on the pocket, where the box is about 180 px tall: a second line runs under the button.
  caption: 'Can\'t play it here',
  button: 'Watch on YouTube',
  tap: 'Tap the video to start. Still stuck?',
  tapLink: 'Watch on YouTube',
};
export const watchOnYouTube = (youtubeId: string) => `https://www.youtube.com/watch?v=${youtubeId}`;

export const linkedIn = { label: 'LinkedIn', href: site.links.linkedin };
