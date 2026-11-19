// What the episodes page shows, from the content and data files: its words
// (src/data/episodes.yaml), the stations' counts, the production board, pinned, latest and hot,
// and the full archive. Episodes.astro draws both editions from this.
import { getCollection, getEntry } from 'astro:content';
import { ROOT, STAGES, taxonomy } from './content';
import { highlights, videoCard, type Card } from './pieces';

// A count in its place in a line of copy: "Uploaded: {count}."
export { counting } from './home';

// The board's status dot for each stage, as the design colours them.
const DOT: Record<(typeof STAGES)[number], string> = { planned: 'plan', scripted: 'aired', recording: 'aired', cutting: 'cut' };

// A slate number as the design's desktop board writes it, with a hyphen that never breaks.
export const unbroken = (slate: string): string => slate.replace('-', '‑');

export async function episodesWords() {
  const entry = await getEntry('episodes', 'episodes');
  if (!entry) throw new Error(`${ROOT}/data/episodes.yaml has no episodes: key`);
  return entry.data;
}

const label = (list: { id: string; label: string }[], id: string): string => list.find((item) => item.id === id)!.label;
export const trackLabel = (id: string): string => label(taxonomy.tracks, id);

export async function episodesContent() {
  const copy = await episodesWords();
  const [videos, upcoming] = await Promise.all([getCollection('videos'), getCollection('upcoming')]);

  // The stations: how many planned episodes stand at each, then how many are published.
  const stations = [
    ...STAGES.map((stage) => ({ ...copy.stations.stages[stage], count: upcoming.filter((u) => u.data.stage === stage).length })),
    { ...copy.stations.stages.uploaded, count: videos.length },
  ];

  // The board: every planned episode, in slate order, as plain text.
  const board = [...upcoming].sort((a, b) => a.id.localeCompare(b.id)).map((u) => ({
    slate: u.id,
    title: u.data.title,
    track: trackLabel(u.data.track),
    runtime: u.data.runtime,
    status: copy.stations.stages[u.data.stage].label,
    dot: DOT[u.data.stage],
  }));

  // Pinned, latest and hot, then every video newest first, each carrying what the archive's
  // filters and sort read: its track, its mode, its topic (and the topic's place in
  // taxonomy.json) and its date.
  const card = (video: (typeof videos)[number]): Card => videoCard(video, copy.picks.watch);
  const picked = highlights(videos);
  const picks = [
    { label: copy.picks.pinned, cards: picked.pinned.map(card) },
    { label: copy.picks.latest, cards: picked.latest.map(card) },
    { label: copy.picks.hot, cards: picked.hot.map(card) },
  ];
  const archive = [...videos]
    .sort((a, b) => b.data.published.getTime() - a.data.published.getTime() || a.data.title.localeCompare(b.data.title))
    .map((video) => ({
      ...card(video),
      shelf: video.data.mode ? `${video.data.track}:${video.data.mode}` : video.data.track,
      topic: video.data.topic,
      topicAt: taxonomy.topics.findIndex((topic) => topic.id === video.data.topic),
      published: video.data.published.toISOString().slice(0, 10),
    }));

  // The stations' second button opens the newest video's page; while none is published, the board.
  const open = archive[0] ? { href: archive[0].href, route: 'episode', then: undefined } : { href: '#log', route: 'episodes', then: 'log' };

  // The archive's filters: every track, then each track's modes; and every topic.
  const shelves = taxonomy.tracks.flatMap((track) => [
    { id: track.id, label: track.label },
    ...(track.modes ?? []).map((mode) => ({ id: `${track.id}:${mode.id}`, label: mode.label })),
  ]);
  const sorts = (['az', 'topic', 'newest', 'oldest'] as const).map((id) => ({ id, label: copy.archive.sort[id] }));

  return { copy, stations, published: videos.length, board, picks, archive, open, shelves, topics: taxonomy.topics, sorts };
}

export type EpisodesContent = Awaited<ReturnType<typeof episodesContent>>;
