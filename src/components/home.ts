// What the home page shows, from the content and data files: its words (src/data/home.yaml),
// each track card's latest episodes, and the cabinet's two folders. Both editions' markup
// (HomeDesktop.astro, HomePocket.astro) draw from this.
import { getCollection, getEntry } from 'astro:content';
import { ROOT, taxonomy, type LOOKS } from './content';

type Look = (typeof LOOKS)[number];
export type Chip = { text: string; look: Look };
export type Item = { title: string; href?: string };
export type Sheet = { title: string; summary: string; tags: Chip[] };

// As many as the design's cards and folders hold.
const CARD_ITEMS = 4;
const ARTICLE_SHEETS = 4;
const PROJECT_SHEETS = 6;

// The class a chip of each look carries in the design.
export const chipClass = (look: Look): string => (look === 'plain' ? 'chip' : `chip ${look}`);

// A count in its place in a line of copy: "{count} inside".
export const counting = (line: string, count: number): string => line.replaceAll('{count}', String(count));

const newestFirst = (a: Date, b: Date) => b.getTime() - a.getTime();

export async function homeContent() {
  const entry = await getEntry('home', 'home');
  if (!entry) throw new Error(`${ROOT}/data/home.yaml has no home: key`);
  const copy = entry.data;
  const [videos, upcoming, articles, projects] = await Promise.all([
    getCollection('videos'), getCollection('upcoming'), getCollection('articles'), getCollection('projects'),
  ]);
  const topic = new Map(taxonomy.topics.map((t) => [t.id, t.label]));

  // Each track's card: its published episodes, newest first, each linking to its page; then
  // its planned ones, in slate order, as plain text; as many as the card holds. A track with
  // none keeps its card with an empty list (your decision, step 5).
  const cards = taxonomy.tracks.map((track) => {
    const published: Item[] = videos
      .filter((v) => v.data.track === track.id)
      .sort((a, b) => newestFirst(a.data.published, b.data.published) || a.id.localeCompare(b.id))
      .map((v) => ({ title: v.data.title, href: `/episodes/${v.id}/` }));
    const planned: Item[] = upcoming
      .filter((u) => u.data.track === track.id)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((u) => ({ title: u.data.title }));
    return { id: track.id, title: track.label, ...copy.tracks.cards[track.id as keyof typeof copy.tracks.cards], items: [...published, ...planned].slice(0, CARD_ITEMS) };
  });

  // The cabinet: the newest articles, and the first projects in the projects page's order. A
  // file's cabinet: fields, when given, stand in for its summary and its chips.
  const articleSheets: Sheet[] = articles
    .sort((a, b) => newestFirst(a.data.published, b.data.published) || a.id.localeCompare(b.id))
    .slice(0, ARTICLE_SHEETS)
    .map((a) => ({
      title: a.data.title,
      summary: a.data.cabinet?.summary ?? a.data.summary,
      tags: a.data.cabinet?.tags ?? [{ text: topic.get(a.data.topic)!, look: 'plain' }],
    }));
  const projectSheets: Sheet[] = projects
    .sort((a, b) => a.data.order - b.data.order || a.id.localeCompare(b.id))
    .slice(0, PROJECT_SHEETS)
    .map((p) => ({
      title: p.data.title,
      summary: p.data.cabinet?.summary ?? p.data.summary,
      tags: p.data.cabinet?.tags ?? [
        ...p.data.tags.map((text): Chip => ({ text, look: 'plain' })),
        ...(p.data.inProgress ? [{ text: copy.cabinet.projects.inProgress, look: 'open' } as Chip] : []),
      ],
    }));

  return { copy, cards, articles: articleSheets, projects: projectSheets, projectCount: projects.length };
}

export type HomeContent = Awaited<ReturnType<typeof homeContent>>;
