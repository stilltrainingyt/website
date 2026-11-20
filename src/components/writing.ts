// What the writing page and each article's page show, from the content and data files: their
// words (src/data/writing.yaml), the shelf of published articles with its filters and order,
// and an article's text, linked video and licence line. Writing.astro and Article.astro draw
// both editions from this.
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { ROOT, site, taxonomy } from './content';
import { trackLabel } from './episodes';
import { articleCard, highlights, readingMinutes, type Card } from './pieces';

export async function writingWords() {
  const entry = await getEntry('writing', 'writing');
  if (!entry) throw new Error(`${ROOT}/data/writing.yaml has no writing: key`);
  return entry.data;
}

const topicLabel = (id: string): string => taxonomy.topics.find((topic) => topic.id === id)!.label;
const modeLabel = (track: string, mode: string): string => taxonomy.tracks.find((t) => t.id === track)!.modes!.find((m) => m.id === mode)!.label;

// A day as the page writes it: 27 October 2026.
export const day = (date: Date): string => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export async function writingContent() {
  const copy = (await writingWords()).index;
  const articles = await getCollection('articles');
  const card = (article: (typeof articles)[number]): Card => articleCard(article, copy.minutes, copy.read);

  // Pinned, latest and hot, then every article newest first, each carrying what the shelf's
  // filters and sort read: its track (and mode), its topic and the topic's place in
  // taxonomy.json, and its date.
  const picked = highlights(articles);
  const picks = [
    { label: copy.pinned, cards: picked.pinned.map(card) },
    { label: copy.latest, cards: picked.latest.map(card) },
    { label: copy.hot, cards: picked.hot.map(card) },
  ];
  const shelf = [...articles]
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.data.title.localeCompare(b.data.title))
    .map((article) => ({
      ...card(article),
      shelf: article.data.mode ? `${article.data.track}:${article.data.mode}` : article.data.track,
      topic: article.data.topic,
      topicAt: taxonomy.topics.findIndex((topic) => topic.id === article.data.topic),
      published: article.data.published.toISOString().slice(0, 10),
    }));

  // The filters: every track, then each track's modes; and every topic, as the design's
  // subject chips (relabelled from taxonomy.json, allowed change 3).
  const shelves = taxonomy.tracks.flatMap((track) => [
    { id: track.id, label: track.label },
    ...(track.modes ?? []).map((mode) => ({ id: `${track.id}:${mode.id}`, label: mode.label })),
  ]);
  const sorts = (['az', 'topic', 'newest', 'oldest'] as const).map((id) => ({ id, label: copy.sort[id] }));

  return { copy, picks, shelf, shelves, topics: taxonomy.topics, sorts };
}

export type WritingContent = Awaited<ReturnType<typeof writingContent>>;

// The article's text as HTML, its first paragraph opening with the design's drop capital.
const withDropcap = (html: string): string => html.replace(/<p>/, '<p class="dropcap">');

export async function articleContent(article: CollectionEntry<'articles'>) {
  const copy = (await writingWords()).article;
  const { title, summary, published, updated, track, mode, topic, video } = article.data;
  const html = article.rendered?.html;
  if (!html) throw new Error(`${ROOT}/content/articles/${article.id}.md has no text below its front matter`);

  // The video the article names, which names the article back (checked in checks.ts).
  let watch: string | undefined;
  if (video) {
    const entry = await getEntry('videos', video.slice('episodes/'.length));
    if (!entry) throw new Error(`${article.id} names ${video}, which is not a video`);
    watch = `/${video}/`;
  }

  const shelf = mode ? `${trackLabel(track)} · ${modeLabel(track, mode)}` : trackLabel(track);
  const fill = (template: string, values: Record<string, string>) => Object.entries(values).reduce((line, [name, value]) => line.replaceAll(`{${name}}`, value), template);
  return {
    copy,
    title,
    summary,
    html: withDropcap(html),
    eyebrow: fill(copy.eyebrow, { topic: topicLabel(topic), track: shelf, minutes: String(readingMinutes(article.body ?? '')) }),
    published: fill(copy.published, { date: day(published) }),
    updated: updated ? fill(copy.updated, { date: day(updated) }) : undefined,
    watch,
    licence: {
      line: fill(copy.licence.line, { year: String(published.getUTCFullYear()), author: site.author }),
      label: copy.licence.label,
      url: copy.licence.url,
    },
  };
}

export type ArticleContent = Awaited<ReturnType<typeof articleContent>>;
