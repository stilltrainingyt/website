// What the new pieces show (step 7), worked out from the content files. Each piece is drawn by its
// own component from the design's existing classes; the words a visitor reads arrive as props,
// from the data files of the page that uses the piece. You approved every piece in step 7; pages
// use them from step 8.
import type { CollectionEntry } from 'astro:content';
import { seconds, taxonomy } from './content';
import type { Chip } from './home';

// One item on an archive: its page, title, summary, chips and the words on its way in.
export type Card = { href: string; title: string; summary: string; chips: Chip[]; go: string };

// The archives' first sections: everything pinned, then the newest of the rest, then everything
// hot, each newest first and each item once. Pinned and hot are your own marks in the files, so
// an item marked either way stays in its own section; "latest" takes only unmarked items.
export const LATEST = 3;
type Marked = { published: Date; pinned: boolean; hot: boolean };
export function highlights<T extends { data: Marked }>(entries: T[], latest = LATEST): { pinned: T[]; latest: T[]; hot: T[] } {
  const newest = [...entries].sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
  return {
    pinned: newest.filter((e) => e.data.pinned),
    latest: newest.filter((e) => !e.data.pinned && !e.data.hot).slice(0, latest),
    hot: newest.filter((e) => e.data.hot && !e.data.pinned),
  };
}

const topicLabel = (id: string): string => taxonomy.topics.find((topic) => topic.id === id)?.label ?? id;

// Minutes to read, at 230 words a minute, and never less than one.
export const readingMinutes = (text: string): number => Math.max(1, Math.round(text.split(/\s+/).filter(Boolean).length / 230));

// A video's card: its topic, its running time, and the words on its way in ("Watch it").
export const videoCard = (video: CollectionEntry<'videos'>, go: string): Card => ({
  href: `/episodes/${video.id}/`,
  title: video.data.title,
  summary: video.data.summary,
  chips: [{ text: topicLabel(video.data.topic), look: 'solid' }, { text: video.data.duration, look: 'open' }],
  go,
});

// An article's card, as the design's writing list draws a published one: its topic, then its
// reading time with the words given for it ("{minutes} min read").
export const articleCard = (article: CollectionEntry<'articles'>, minutesRead: string, go: string): Card => ({
  href: `/writing/${article.id}/`,
  title: article.data.title,
  summary: article.data.summary,
  chips: [
    { text: topicLabel(article.data.topic), look: 'solid' },
    { text: minutesRead.replaceAll('{minutes}', String(readingMinutes(article.body ?? ''))), look: 'open' },
  ],
  go,
});

// A time in the video as the design writes chapter times: 02:10, or 1:02:03 past the hour.
export function clock(at: number): string {
  const whole = Math.floor(at);
  const [h, m, s] = [Math.floor(whole / 3600), Math.floor((whole % 3600) / 60), whole % 60];
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

// The transcript in passages: one per chapter, headed by the chapter's time and title, or, for a
// video without chapters, one a minute. A caption joins the passage in which it starts.
export type Passage = { at: string; title?: string; text: string };
export function passages(cues: { start: number; text: string }[], chapters: { at: string; title: string }[]): Passage[] {
  const starts = chapters.length > 0
    ? chapters.map((chapter) => ({ from: seconds(chapter.at), at: chapter.at, title: chapter.title }))
    : [...new Set(cues.map((cue) => Math.floor(cue.start / 60) * 60))].map((from) => ({ from, at: clock(from), title: undefined }));
  return starts
    .map((start, i) => ({
      at: start.at,
      title: start.title,
      text: cues
        .filter((cue) => cue.start >= (i === 0 ? -Infinity : start.from) && (i === starts.length - 1 || cue.start < starts[i + 1].from))
        .map((cue) => cue.text.replace(/\s*\n\s*/g, ' '))
        .join(' '),
    }))
    .filter((passage) => passage.text !== '');
}

// An address as the design shows one on a link row: no https://, www. or closing slash.
export const shownAddress = (url: string): string => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
