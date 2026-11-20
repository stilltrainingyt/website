// What a video's own page shows, from its file, its transcript and the episodes pages' words
// (src/data/episodes.yaml, video:). Episode.astro draws both editions from this.
import { getEntry, render, type CollectionEntry } from 'astro:content';
import { episodesWords, trackLabel, unbroken } from './episodes';
import { passages } from './pieces';

// A line of copy with the video's slate number in it; a video without one leaves out
// "{slate} · " and starts the rest with a capital.
function withSlate(template: string, slate: string | undefined): string {
  if (slate) return template.replaceAll('{slate}', unbroken(slate));
  const rest = template.replace(/\{slate\}\s*·\s*/g, '');
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

export const watchOnYouTube = (youtubeId: string): string => `https://www.youtube.com/watch?v=${youtubeId}`;
// YouTube's own still for the video, as large as every video has it (480 by 360, the video
// letterboxed inside, which the cover's 16:9 box crops away).
export const thumbnail = (youtubeId: string): string => `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;

export async function episodeContent(video: CollectionEntry<'videos'>) {
  const copy = (await episodesWords()).video;
  const captions = await getEntry('transcripts', video.id);
  if (!captions) throw new Error(`src/content/transcripts/${video.id}.vtt is missing`);
  const { Content } = await render(video);
  const linked = await Promise.all(video.data.linked.map(async (ref) => {
    const article = await getEntry('articles', ref.slice('writing/'.length));
    if (!article) throw new Error(`${video.id} links ${ref}, which is not an article`);
    return { title: article.data.title, href: `/${ref}/` };
  }));
  const { slate, track, duration } = video.data;
  return {
    copy,
    video: video.data,
    Content,
    eyebrow: withSlate(copy.eyebrow, slate).replaceAll('{track}', trackLabel(track)).replaceAll('{duration}', duration),
    notesEyebrow: withSlate(copy.notes.eyebrow, slate),
    youtube: watchOnYouTube(video.data.youtubeId),
    thumbnail: thumbnail(video.data.youtubeId),
    passages: passages(captions.data.cues, video.data.chapters),
    linked,
  };
}

export type EpisodeContent = Awaited<ReturnType<typeof episodeContent>>;
