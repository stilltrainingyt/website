import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { test, expect, type TestInfo } from '@playwright/test';
import { Article, Project, Upcoming, Video } from '../../src/components/content';

// The content files' checks (step 6): each test writes a small set of content and data files,
// builds the site from them in a separate process, and sees the build pass or stop. Sample
// content that agrees with itself builds; the same content with one field missing, or one end
// of a video, transcript and article link broken, stops the build and says which file and why.
// Each build keeps its content cache in its own folder (astro.config.mjs), but writes Astro's
// generated types into .astro/, so this file's tests run one after another.

const PROJECT = process.cwd();
const DATA = (name: string) => fs.readFileSync(path.join(PROJECT, 'src/data', name), 'utf8');

const VIDEO = `---
title: Gradient descent, by hand
youtubeId: AbC123xYz_0
slate: ST-002
published: 2026-11-02
track: foundations
mode:
course:
unit:
topic: ai
duration: "13:45"
summary: How a model learns by walking downhill, worked out with a pencil.
pinned: true
hot: false
chapters:
  - { at: "00:00", title: Why a model needs a direction }
  - { at: "02:10", title: The slope }
sources:
  - { text: "Cauchy, 1847. Méthode générale", url: https://example.org }
linked: [writing/gradient-descent-worked]
---
What the episode covers, in my own words.
`;

const COURSE_VIDEO = `---
title: Reinforcement learning, unit 1
youtubeId: Xy9_8-7wVu6
published: 2026-11-09
track: course
course: reinforcement-learning
unit: 1
topic: ai
duration: "42:00"
summary: Agents, rewards and the loop that ties them together.
---
The first unit.
`;

const VTT = `WEBVTT
Kind: captions
Language: en

00:00:00.000 --> 00:00:03.500
A model learns by walking downhill.

2
00:00:03.500 --> 00:00:07.000 align:start position:0%
One step at a time.
`;

const ARTICLE = `---
title: Gradient descent, worked out
published: 2026-11-02
track: foundations
topic: ai
summary: Every step of the walk, written down.
video: episodes/gradient-descent-by-hand
---
The working, step by step.
`;

const LONE_ARTICLE = `---
title: A capable model on a Raspberry Pi
published: 2026-11-03
updated: 2026-11-05
track: e3
mode: experiment
topic: tech
summary: What fits, what does not, and how slow slow really is.
pinned: false
hot: true
---
The measurements.
`;

const PROJECT_FILE = `---
title: ContextCore
kind: Desktop app
group: Tools and apps
summary: An AI chat desktop app where every chat is its own persistent, self-contained workspace.
tags: [Local AI]
order: 1
---
`;

const UPCOMING = `# The board
ST-003:
  title: Backpropagation without the chain-rule fear
  track: foundations
  stage: recording
  runtime: "14:10"
ST-101:
  title: SliceGPT, reproduced on one laptop
  track: e3
  stage: planned
`;

type Files = Record<string, string>;
const SAMPLE: Files = {
  'data/taxonomy.json': DATA('taxonomy.json'),
  'data/site.json': DATA('site.json'),
  'data/upcoming.yaml': UPCOMING,
  'content/videos/gradient-descent-by-hand.md': VIDEO,
  'content/transcripts/gradient-descent-by-hand.vtt': VTT,
  'content/videos/reinforcement-learning-unit-1.md': COURSE_VIDEO,
  'content/transcripts/reinforcement-learning-unit-1.vtt': VTT,
  'content/articles/gradient-descent-worked.md': ARTICLE,
  'content/articles/a-capable-model-on-a-raspberry-pi.md': LONE_ARTICLE,
  'content/projects/contextcore.md': PROJECT_FILE,
};

// The sample with some files changed: new text, or null to leave the file out.
function changed(changes: Record<string, string | null>): Files {
  const files = { ...SAMPLE };
  for (const [name, text] of Object.entries(changes)) {
    if (text === null) delete files[name];
    else files[name] = text;
  }
  return files;
}

// Changes one line of a sample file, failing loudly if the line is not there.
function edit(text: string, from: string | RegExp, to: string): string {
  const next = text.replace(from, to);
  if (next === text) throw new Error(`the sample has no ${from}`);
  return next;
}

type Built = { ok: boolean; output: string };

async function build(testInfo: TestInfo, files: Files): Promise<Built> {
  const root = testInfo.outputPath('root');
  fs.rmSync(root, { recursive: true, force: true });
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.writeFileSync(path.join(root, name), text);
  }
  const env = {
    ...process.env,
    CONTENT_ROOT: path.relative(PROJECT, root).split(path.sep).join('/'),
    ASTRO_TELEMETRY_DISABLED: '1',
    NO_COLOR: '1',
    FORCE_COLOR: '0',
  };
  const built = await new Promise<Built>((done) => {
    execFile(process.execPath, ['node_modules/astro/bin/astro.mjs', 'build', '--outDir', testInfo.outputPath('dist')],
      { cwd: PROJECT, env, maxBuffer: 1 << 26 },
      (error, stdout, stderr) => done({ ok: !error, output: `${stdout}\n${stderr}`.replace(/\x1b\[[0-9;]*m/g, '') }));
  });
  await testInfo.attach('build output', { body: built.output, contentType: 'text/plain' });
  return built;
}

// The build stops, and its output names the file and says what is wrong.
async function stops(testInfo: TestInfo, files: Files, ...says: (string | RegExp)[]): Promise<void> {
  const built = await build(testInfo, files);
  expect(built.ok, 'the build stops').toBe(false);
  for (const words of says) {
    if (typeof words === 'string') expect(built.output).toContain(words);
    else expect(built.output).toMatch(words);
  }
}

const root = (testInfo: TestInfo) => path.relative(PROJECT, testInfo.outputPath('root')).split(path.sep).join('/');

test.describe('content files', () => {
  test.describe.configure({ mode: 'default', timeout: 120_000 });

  test('sample content that agrees with itself builds, and the live content builds', async ({}, testInfo) => {
    const built = await build(testInfo, SAMPLE);
    expect(built.ok, built.output.slice(-3000)).toBe(true);
    expect(fs.existsSync(testInfo.outputPath('dist', 'index.html'))).toBe(true);
    // The pages read the site's name from its data file.
    expect(fs.readFileSync(testInfo.outputPath('dist', 'episodes', 'index.html'), 'utf8')).toContain('<title>Episodes · StillTraining</title>');
  });

  test.describe('a file with a missing field stops the build', () => {
    test('a video', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/videos/gradient-descent-by-hand.md': edit(VIDEO, /^youtubeId:.*\n/m, '') }),
        'videos → gradient-descent-by-hand', /youtubeId\W+Required/);
    });
    test('an article', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/articles/a-capable-model-on-a-raspberry-pi.md': edit(LONE_ARTICLE, /^summary:.*\n/m, '') }),
        'articles → a-capable-model-on-a-raspberry-pi', /summary\W+Required/);
    });
    test('a project', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/projects/contextcore.md': edit(PROJECT_FILE, /^order:.*\n/m, '') }),
        'projects → contextcore', /order\W+Required/);
    });
    test('a planned episode', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'data/upcoming.yaml': edit(UPCOMING, /^ {2}stage: planned\n/m, '') }),
        'ST-101', /stage\W+Required/);
    });
    test('a transcript with no captions', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/transcripts/gradient-descent-by-hand.vtt': 'WEBVTT\n' }),
        'transcripts → gradient-descent-by-hand', 'a transcript holds at least one caption');
    });
    test('a field left blank, or one the build does not know', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/videos/gradient-descent-by-hand.md': edit(VIDEO, /^title:.*$/m, 'title:') }),
        'videos → gradient-descent-by-hand', /title\W+Required/);
      await stops(testInfo, changed({ 'content/videos/gradient-descent-by-hand.md': edit(VIDEO, /^summary:/m, 'sumary:') }),
        'videos → gradient-descent-by-hand', 'Unrecognized key: "sumary"');
    });
    test('the site\'s data files', async ({}, testInfo) => {
      const site = JSON.parse(SAMPLE['data/site.json']);
      delete site.links.youtube;
      await stops(testInfo, changed({ 'data/site.json': JSON.stringify(site) }),
        `${root(testInfo)}/data/site.json is not as the build expects`, 'links.youtube');
      const taxonomy = JSON.parse(SAMPLE['data/taxonomy.json']);
      delete taxonomy.topics[0].label;
      await stops(testInfo, changed({ 'data/taxonomy.json': JSON.stringify(taxonomy) }),
        `${root(testInfo)}/data/taxonomy.json is not as the build expects`, 'topics[0].label');
    });
    test('an E³ item with no mode, and a course video with no unit', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/articles/a-capable-model-on-a-raspberry-pi.md': edit(LONE_ARTICLE, /^mode:.*\n/m, '') }),
        'articles → a-capable-model-on-a-raspberry-pi', 'the e3 track needs a mode: exploration, expedition, experiment');
      await stops(testInfo, changed({ 'content/videos/reinforcement-learning-unit-1.md': edit(COURSE_VIDEO, /^unit:.*\n/m, '') }),
        'videos → reinforcement-learning-unit-1', 'a course video names its unit');
    });
  });

  test.describe('a video, its transcript and its linked article are checked at both ends', () => {
    test('a video with no transcript', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/transcripts/gradient-descent-by-hand.vtt': null }),
        `${root(testInfo)}/content/videos/gradient-descent-by-hand.md has no transcript: add ${root(testInfo)}/content/transcripts/gradient-descent-by-hand.vtt`);
    });
    test('a transcript with no video', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/transcripts/backpropagation.vtt': VTT }),
        `${root(testInfo)}/content/transcripts/backpropagation.vtt has no video: add ${root(testInfo)}/content/videos/backpropagation.md`);
    });
    test('a video linking an article that does not exist', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/articles/gradient-descent-worked.md': null }),
        `${root(testInfo)}/content/videos/gradient-descent-by-hand.md links writing/gradient-descent-worked, but there is no ${root(testInfo)}/content/articles/gradient-descent-worked.md`);
    });
    test('a video linking an article that does not name it back', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/articles/gradient-descent-worked.md': edit(ARTICLE, /^video:.*\n/m, '') }),
        `${root(testInfo)}/content/videos/gradient-descent-by-hand.md links writing/gradient-descent-worked, but that article names no video: set its video to episodes/gradient-descent-by-hand`);
    });
    test('an article naming a video that does not exist', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/articles/a-capable-model-on-a-raspberry-pi.md': edit(LONE_ARTICLE, /^hot:.*$/m, 'hot: true\nvideo: episodes/a-model-on-a-pi') }),
        `${root(testInfo)}/content/articles/a-capable-model-on-a-raspberry-pi.md names episodes/a-model-on-a-pi, but there is no ${root(testInfo)}/content/videos/a-model-on-a-pi.md`);
    });
    test('an article naming a video that does not link it back', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/videos/gradient-descent-by-hand.md': edit(VIDEO, /^linked:.*$/m, 'linked: []') }),
        `${root(testInfo)}/content/articles/gradient-descent-worked.md names episodes/gradient-descent-by-hand, but that video does not link it: add writing/gradient-descent-worked to its linked list`);
    });
  });

  test.describe('the other rules the content keeps', () => {
    test('a published video leaves the board, and slates stay unique', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'data/upcoming.yaml': `${UPCOMING}ST-002:\n  title: Gradient descent, by hand\n  track: foundations\n  stage: cutting\n` }),
        `${root(testInfo)}/data/upcoming.yaml still plans ST-002, which ${root(testInfo)}/content/videos/gradient-descent-by-hand.md published: remove its entry`);
      await stops(testInfo, changed({ 'content/videos/reinforcement-learning-unit-1.md': edit(COURSE_VIDEO, /^published:/m, 'slate: ST-002\npublished:') }),
        'share the slate ST-002');
    });
    test('a file name that is not a page address', async ({}, testInfo) => {
      await stops(testInfo, changed({ 'content/projects/contextcore.md': null, 'content/projects/Context Core.md': PROJECT_FILE }),
        'Context Core.md: the file name is the page address');
    });
  });
});

// Each blank template names exactly the fields the build checks, so a copy of it can be filled in
// without guessing; and a copy left blank does not build.
test.describe('templates', () => {
  const keys = (text: string, indent = '') => [...text.matchAll(new RegExp(`^${indent}([A-Za-z]+):`, 'gm'))].map((match) => match[1]).sort();
  const front = (file: string) => fs.readFileSync(path.join(PROJECT, 'templates', file), 'utf8').split('---')[1];

  test('each names the fields its collection checks', () => {
    expect(keys(front('video.md'))).toEqual(Object.keys(Video.shape).sort());
    expect(keys(front('article.md'))).toEqual(Object.keys(Article.shape).sort());
    expect(keys(front('project.md'))).toEqual(Object.keys(Project.shape).sort());
    expect(keys(fs.readFileSync(path.join(PROJECT, 'templates', 'upcoming.yaml'), 'utf8'), ' {2}')).toEqual(Object.keys(Upcoming.shape).sort());
  });

  test('a copy left blank stops the build', async ({}, testInfo) => {
    test.setTimeout(120_000);
    await stops(testInfo, changed({ 'content/videos/blank.md': fs.readFileSync(path.join(PROJECT, 'templates', 'video.md'), 'utf8') }),
      'videos → blank', /title\W+Required/);
  });
});
