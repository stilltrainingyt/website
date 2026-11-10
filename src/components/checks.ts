// The links between content files, checked from both ends as the pages are built: a video and
// its transcript each need the other; a video's linked article names the video back, and an
// article's video lists the article back. Slate numbers stay unique, and a planned episode
// leaves the board once its video is published. Each page's layout waits for these checks, so
// any problem stops the build, with every problem listed at once.
import { getCollection } from 'astro:content';
import { ROOT } from './content';

async function check(): Promise<void> {
  const [videos, transcripts, articles, upcoming] = await Promise.all([
    getCollection('videos'), getCollection('transcripts'), getCollection('articles'), getCollection('upcoming'),
  ]);
  const videoFile = (id: string) => `${ROOT}/content/videos/${id}.md`;
  const articleFile = (id: string) => `${ROOT}/content/articles/${id}.md`;
  const transcriptFile = (id: string) => `${ROOT}/content/transcripts/${id}.vtt`;
  const video = new Map(videos.map((entry) => [entry.id, entry]));
  const article = new Map(articles.map((entry) => [entry.id, entry]));
  const transcript = new Set(transcripts.map((entry) => entry.id));
  const problems: string[] = [];

  for (const entry of videos) {
    if (!transcript.has(entry.id)) problems.push(`${videoFile(entry.id)} has no transcript: add ${transcriptFile(entry.id)}`);
    if (!entry.body?.trim()) problems.push(`${videoFile(entry.id)} has no notes below its front matter`);
    for (const link of entry.data.linked) {
      const id = link.slice('writing/'.length);
      const linked = article.get(id);
      if (!linked) problems.push(`${videoFile(entry.id)} links ${link}, but there is no ${articleFile(id)}`);
      else if (linked.data.video !== `episodes/${entry.id}`) {
        problems.push(`${videoFile(entry.id)} links ${link}, but that article names ${linked.data.video ?? 'no video'}: set its video to episodes/${entry.id}`);
      }
    }
  }
  for (const id of transcript) {
    if (!video.has(id)) problems.push(`${transcriptFile(id)} has no video: add ${videoFile(id)}`);
  }
  for (const entry of articles) {
    if (!entry.body?.trim()) problems.push(`${articleFile(entry.id)} has no text below its front matter`);
    if (!entry.data.video) continue;
    const id = entry.data.video.slice('episodes/'.length);
    const named = video.get(id);
    if (!named) problems.push(`${articleFile(entry.id)} names ${entry.data.video}, but there is no ${videoFile(id)}`);
    else if (!named.data.linked.includes(`writing/${entry.id}`)) {
      problems.push(`${articleFile(entry.id)} names ${entry.data.video}, but that video does not link it: add writing/${entry.id} to its linked list`);
    }
  }
  const slates = new Map<string, string>();
  for (const entry of videos) {
    const slate = entry.data.slate;
    if (!slate) continue;
    if (slates.has(slate)) problems.push(`${videoFile(entry.id)} and ${videoFile(slates.get(slate)!)} share the slate ${slate}`);
    else slates.set(slate, entry.id);
  }
  for (const entry of upcoming) {
    if (slates.has(entry.id)) {
      problems.push(`${ROOT}/data/upcoming.yaml still plans ${entry.id}, which ${videoFile(slates.get(entry.id)!)} published: remove its entry`);
    }
  }

  if (problems.length) throw new Error(`The content files disagree:\n  ${problems.join('\n  ')}`);
}

// Once per build; on every request while the dev server runs, as files change under it.
let checked: Promise<void> | undefined;
export const checkContent = (): Promise<void> => (import.meta.env.DEV ? check() : (checked ??= check()));
