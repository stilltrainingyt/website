// What every content and data file must hold. The build checks each video, transcript, article,
// project and planned episode against these fields (src/content.config.ts), the two data files
// as they are read here, and the links between files (checks.ts); any file that fails stops the
// build, and the live site stays on its last good version.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';

// Where the content and data live: src/ for the site. Tests point CONTENT_ROOT at a folder of
// their own, relative to the project and laid out as src/ is: content/ and data/.
const root = (process.env.CONTENT_ROOT || 'src').replaceAll('\\', '/').replace(/\/+$/, '');
if (path.isAbsolute(root) || root.split('/').includes('..')) {
  throw new Error(`CONTENT_ROOT must be a folder inside the project, written relative to it: ${root}`);
}
export const ROOT = root;

// A page address, and so every file name and id: lowercase words and numbers joined by hyphens.
export const ADDRESS = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// A slate number, as the design writes them: ST-002.
export const SLATE = /^ST-\d{3}$/;
// A time in a video: 13:45, or 1:02:03.
const TIME = /^(?:\d+:)?[0-5]?\d:[0-5]\d$/;

export const seconds = (time: string): number => time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0);

// The file name of a video, article, project or transcript is its page address.
export function addressOf(name: string, extension: string, file: string): string {
  const id = name.slice(0, -extension.length);
  if (!name.endsWith(extension) || !ADDRESS.test(id)) {
    throw new Error(`${file}: the file name is the page address, so it is lowercase words joined by hyphens, ending ${extension}`);
  }
  return id;
}

function parsed<T>(schema: z.ZodType<T>, value: unknown, file: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`${file} is not as the build expects:\n${z.prettifyError(result.error)}`);
  return result.data;
}

function readJson(name: string): unknown {
  const file = `${ROOT}/data/${name}`;
  try {
    return JSON.parse(fs.readFileSync(path.resolve(ROOT, 'data', name), 'utf8'));
  } catch (error) {
    throw new Error(`${file} could not be read: ${(error as Error).message}`);
  }
}

// A field missing, or left blank (YAML reads `title:` as nothing), is "Required".
const required = (otherwise?: string) => ({ error: (issue: { input?: unknown }) => (issue.input == null ? 'Required' : otherwise) });
const text = z.string(required()).trim().min(1, 'Required');
const unique = (ids: string[], what: string, ctx: z.RefinementCtx) => {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) ctx.addIssue({ code: 'custom', message: `${what} "${id}" is listed twice` });
    seen.add(id);
  }
};

// The shelves: the tracks (one with modes) and the topics, in the order the pages show them.
const Named = z.strictObject({ id: z.string().regex(ADDRESS), label: text });
const Taxonomy = z.strictObject({
  tracks: z.array(Named.extend({ modes: z.array(Named).min(1).optional() })).min(1),
  topics: z.array(Named).min(1),
}).superRefine((taxonomy, ctx) => {
  unique(taxonomy.tracks.map((track) => track.id), 'Track', ctx);
  unique(taxonomy.tracks.flatMap((track) => (track.modes ?? []).map((mode) => mode.id)), 'Mode', ctx);
  unique(taxonomy.topics.map((topic) => topic.id), 'Topic', ctx);
});
export const taxonomy = parsed(Taxonomy, readJson('taxonomy.json'), `${ROOT}/data/taxonomy.json`);

// The site's name, its author, its tagline, and the addresses it links to.
const web = z.url({ protocol: /^https$/ });
const Site = z.strictObject({
  name: text,
  author: text,
  tagline: text,
  links: z.strictObject({ youtube: web, linkedin: web, github: web, githubPersonal: web }),
});
export const site = parsed(Site, readJson('site.json'), `${ROOT}/data/site.json`);

// Fields every file shares. A field left blank (`mode:`) reads as not given.
const blank = <T extends z.ZodType>(schema: T) => schema.nullish().transform((value) => value ?? undefined);
const list = <T extends z.ZodType>(schema: T) => z.array(schema).nullish().transform((value) => value ?? []);
const flag = z.boolean().nullish().transform((value) => value ?? false);
// A date as YAML writes it, 2026-11-02, whether or not it is in quotes.
const day = z.union([z.date(), z.iso.date().transform((value) => new Date(value))], required('a date like 2026-11-02'));
const time = z.string(required()).regex(TIME, 'a time like "13:45" or "1:02:03", in quotes');
// One of a list: "Required" when missing, the list when wrong.
const oneOf = <const T extends readonly [string, ...string[]]>(values: T) => z.enum(values, required(`one of ${values.join(', ')}`));
const ids = (items: { id: string }[]) => items.map((item) => item.id) as [string, ...string[]];
const track = oneOf(ids(taxonomy.tracks));
const topic = oneOf(ids(taxonomy.topics));
const mode = oneOf(ids(taxonomy.tracks.flatMap((entry) => entry.modes ?? [])));

// A track with modes needs one of its own modes; the others take none.
function shelfRules(item: { track: string; mode?: string }, ctx: z.RefinementCtx): void {
  const modes = taxonomy.tracks.find((entry) => entry.id === item.track)?.modes;
  if (modes && !item.mode) {
    ctx.addIssue({ code: 'custom', path: ['mode'], message: `the ${item.track} track needs a mode: ${modes.map((entry) => entry.id).join(', ')}` });
  } else if (modes && item.mode && !modes.some((entry) => entry.id === item.mode)) {
    ctx.addIssue({ code: 'custom', path: ['mode'], message: `the ${item.track} track's modes are ${modes.map((entry) => entry.id).join(', ')}` });
  } else if (!modes && item.mode) {
    ctx.addIssue({ code: 'custom', path: ['mode'], message: `only a track with modes takes one; leave it blank for ${item.track}` });
  }
}

// A chip, as the design draws them: plain, or with the look `open` (an outline) or `solid`
// (filled). Written as its words alone for a plain chip.
export const LOOKS = ['plain', 'open', 'solid'] as const;
const look = oneOf(LOOKS);
const chip = z.union([text, z.strictObject({ text, look })], required()).transform((value) => (typeof value === 'string' ? { text: value, look: 'plain' as const } : value));

// What the home page's cabinet shows of a file in place of its own summary and chips, each only
// when given (your decision, step 5).
const cabinet = blank(z.strictObject({ summary: blank(text), tags: blank(z.array(chip).min(1, 'Required')) }));

// A video, src/content/videos/<address>.md, with its notes below the front matter.
export const Video = z.strictObject({
  title: text,
  youtubeId: z.string(required()).regex(/^[A-Za-z0-9_-]{11}$/, 'the 11 characters after watch?v= in the YouTube link'),
  slate: blank(z.string().regex(SLATE, 'a slate number like ST-002')),
  published: day,
  track,
  mode: blank(mode),
  course: blank(z.string().regex(ADDRESS, 'lowercase words joined by hyphens, like reinforcement-learning')),
  unit: blank(z.number().int().positive()),
  topic,
  duration: time,
  summary: text,
  pinned: flag,
  hot: flag,
  chapters: list(z.strictObject({ at: time, title: text })),
  sources: list(z.strictObject({ text, url: z.url({ protocol: /^https?$/ }) })),
  linked: list(z.string().regex(/^writing\/[a-z0-9]+(?:-[a-z0-9]+)*$/, 'writing/<the article\'s address>')),
}).superRefine((video, ctx) => {
  shelfRules(video, ctx);
  if (video.track === 'course') {
    if (!video.course) ctx.addIssue({ code: 'custom', path: ['course'], message: 'a course video names its course' });
    if (!video.unit) ctx.addIssue({ code: 'custom', path: ['unit'], message: 'a course video names its unit' });
  } else {
    if (video.course) ctx.addIssue({ code: 'custom', path: ['course'], message: 'only a course video names a course' });
    if (video.unit) ctx.addIssue({ code: 'custom', path: ['unit'], message: 'only a course video names a unit' });
  }
  // Chapters in the order they play, each starting before the video ends.
  let last = -1;
  video.chapters.forEach((chapter, index) => {
    const at = seconds(chapter.at);
    if (at <= last) ctx.addIssue({ code: 'custom', path: ['chapters', index, 'at'], message: 'chapters run in order, each after the one before' });
    if (at >= seconds(video.duration)) ctx.addIssue({ code: 'custom', path: ['chapters', index, 'at'], message: `starts after the video ends at ${video.duration}` });
    last = at;
  });
  unique(video.linked, 'Linked article', ctx);
});

// An article, src/content/articles/<address>.md, with its text below the front matter.
export const Article = z.strictObject({
  title: text,
  published: day,
  updated: blank(day),
  track,
  mode: blank(mode),
  topic,
  summary: text,
  pinned: flag,
  hot: flag,
  video: blank(z.string().regex(/^episodes\/[a-z0-9]+(?:-[a-z0-9]+)*$/, 'episodes/<the video\'s address>')),
  cabinet,
}).superRefine((article, ctx) => {
  shelfRules(article, ctx);
  if (article.updated && article.updated < article.published) {
    ctx.addIssue({ code: 'custom', path: ['updated'], message: 'an article is updated after it is published' });
  }
});

// A project, src/content/projects/<address>.md, as the design's project files show one.
export const Project = z.strictObject({
  title: text,
  kind: text,
  group: text,
  summary: text,
  tags: list(text),
  inProgress: flag,
  order: z.number(required()).int(),
  cabinet,
});

// A planned episode in src/data/upcoming.yaml, listed under its slate number.
export const STAGES = ['planned', 'scripted', 'recording', 'cutting'] as const;
export const Upcoming = z.strictObject({
  title: text,
  track,
  stage: oneOf(STAGES),
  runtime: blank(time),
});

// The home page's words, src/data/home.yaml, all under its one key, home:. A value written once
// is the same in both editions; one written as desktop: and pocket: differs between them. A list
// of lines is set with a line break between each. The words on controls, and the words the
// design's scripts write themselves (Episode 001, Page 1 of 4, Open), stay in the page's markup.
const both = <T extends z.ZodType>(schema: T) => z.union([
  z.strictObject({ desktop: schema, pocket: schema }),
  schema.transform((value) => ({ desktop: value, pocket: value })),
], required('one value, or a desktop: and a pocket: value'));
const lines = z.array(text, required()).min(1, 'Required');
const counted = text.refine((value) => value.includes('{count}'), 'says {count} where the number goes');
const heading = { eyebrow: both(text), title: text };

// One track card: its front, then its back. The card's title is the track's label in
// src/data/taxonomy.json, and the look of its chip is also the look of the track's chip on
// the cover.
const Card = z.strictObject({
  number: text,
  about: text,
  chip: text,
  look,
  backNumber: both(text),
  outcomes: lines,
  needs: text,
});

export const Home = z.strictObject({
  cover: z.strictObject({
    eyebrow: both(text),
    title: lines,
    lede: both(text),
    syllabus: text,
    episodes: text,
    byHand: text,
    echo: text,
  }),
  premise: z.strictObject({
    ...heading,
    intro: both(text),
    pad: z.strictObject({ intro: text, pages: z.array(z.strictObject({ title: text, text: both(text) }), required()).min(1, 'Required') }),
    spec: z.array(z.strictObject({ label: text, text }), required()).min(1, 'Required'),
    note: lines,
    scrap: z.strictObject({ title: text, lines: z.array(z.strictObject({ label: text, value: text }), required()).min(1, 'Required') }),
    aside: lines,
    noteHint: text,
  }),
  tracks: z.strictObject({
    ...heading,
    lede: both(text),
    back: text,
    cards: z.record(z.enum(ids(taxonomy.tracks)), Card, required()),
  }),
  byHand: z.strictObject({ ...heading, lede: both(text), hint: both(text) }),
  cabinet: z.strictObject({
    ...heading,
    lede: both(text),
    inside: counted,
    articles: z.strictObject({ tab: text, label: text, all: text }),
    projects: z.strictObject({ tab: text, label: text, all: both(counted), inProgress: text }),
  }),
});

// A transcript, src/content/transcripts/<address>.vtt: the caption file YouTube Studio gives.
const Cue = z.strictObject({ start: z.number().min(0), end: z.number().min(0), text: z.string() });
export const Transcript = z.strictObject({ cues: z.array(Cue).min(1, 'a transcript holds at least one caption') });

// WebVTT, as far as a transcript needs it: the cues' times and words, in order. Comments, styles
// and regions are skipped; cue settings after the times are ignored.
const STAMP = String.raw`(?:(\d+):)?([0-5]\d):([0-5]\d)\.(\d{3})`;
const TIMING = new RegExp(String.raw`^${STAMP}\s+-->\s+${STAMP}(?:\s.*)?$`);
const stamp = (h: string | undefined, m: string, s: string, ms: string) => Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;

export function parseVtt(source: string, file: string): z.input<typeof Transcript>['cues'] {
  const lines = source.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  if (!/^WEBVTT(?:[ \t].*)?$/.test(lines[0] ?? '')) throw new Error(`${file}: a caption file starts with the line WEBVTT`);
  const cues: z.input<typeof Transcript>['cues'] = [];
  let i = 1;
  // The header runs to the first blank line.
  while (i < lines.length && lines[i].trim() !== '') i++;
  while (i < lines.length) {
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;
    const start = i;
    const block: string[] = [];
    while (i < lines.length && lines[i].trim() !== '') block.push(lines[i++]);
    if (/^(NOTE|STYLE|REGION)(?:\s|$)/.test(block[0])) continue;
    // An optional cue name, then the times.
    const at = TIMING.test(block[0]) ? 0 : 1;
    const timing = TIMING.exec(block[at] ?? '');
    if (!timing) throw new Error(`${file}, line ${start + 1}: expected the cue's times, like 00:01.000 --> 00:04.000`);
    const from = stamp(timing[1], timing[2], timing[3], timing[4]);
    const to = stamp(timing[5], timing[6], timing[7], timing[8]);
    if (to < from) throw new Error(`${file}, line ${start + at + 1}: the cue ends before it starts`);
    cues.push({ start: from, end: to, text: block.slice(at + 1).join('\n') });
  }
  return cues;
}
