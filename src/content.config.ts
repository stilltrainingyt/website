// The content collections. Every file is checked against its fields in
// src/components/content.ts as the build starts, and the links between files by
// src/components/checks.ts as the pages are built; a file that fails stops the build.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineCollection } from 'astro:content';
import { file, glob, type Loader, type LoaderContext } from 'astro/loaders';
import { ROOT, SLATE, Article, Home, Project, Transcript, Upcoming, Video, addressOf, parseVtt } from './components/content';

// Astro's loaders log some faults and carry on without the file: one they cannot read or
// parse, an entry with no id. While a loader loads, each fault it logs stops the build instead.
function strict(loader: Loader): Loader {
  return {
    ...loader,
    load: async (context) => {
      let loading = true;
      const logger = Object.create(context.logger);
      logger.error = (message: string) => {
        if (loading) throw new Error(message);
        context.logger.error(message);
      };
      try {
        await loader.load({ ...context, logger });
      } finally {
        loading = false;
      }
    },
  };
}

// The files of one content folder, other than hidden ones such as .gitkeep. A file the
// collection would skip, such as notes.txt beside the videos, stops the build.
function filesIn(folder: string, extension: string, root: URL): string[] {
  const dir = new URL(`./${ROOT}/content/${folder}/`, root);
  if (!fs.existsSync(dir)) return [];
  const names = fs.readdirSync(dir).filter((name) => !name.startsWith('.'));
  for (const name of names) addressOf(name, extension, `${ROOT}/content/${folder}/${name}`);
  return names;
}

// Videos, articles and projects: one Markdown file each, named by its page address.
function markdown(folder: string): Loader {
  const loader = strict(glob({
    base: `./${ROOT}/content/${folder}`,
    pattern: '*.md',
    generateId: ({ entry }) => addressOf(entry, '.md', `${ROOT}/content/${folder}/${entry}`),
  }));
  return {
    ...loader,
    load: async (context) => {
      filesIn(folder, '.md', context.config.root);
      await loader.load(context);
    },
  };
}

// Transcripts: one WebVTT caption file per video, named as the video is.
const transcripts: Loader = {
  name: 'transcript-loader',
  load: async ({ config, store, parseData, generateDigest }) => {
    store.clear();
    for (const name of filesIn('transcripts', '.vtt', config.root)) {
      const filePath = `${ROOT}/content/transcripts/${name}`;
      const source = fs.readFileSync(new URL(`./${filePath}`, config.root), 'utf8');
      const id = addressOf(name, '.vtt', filePath);
      const data = await parseData({ id, data: { cues: parseVtt(source, filePath) }, filePath });
      store.set({ id, data, digest: generateDigest(source), filePath });
    }
  },
};

// The production board: planned episodes listed under their slate numbers. Until the first one
// is planned, the file holds only comments.
const upcoming: Loader = {
  name: 'upcoming-loader',
  load: async (context) => {
    const filePath = `${ROOT}/data/upcoming.yaml`;
    const source = fs.readFileSync(fileURLToPath(new URL(`./${filePath}`, context.config.root)), 'utf8');
    if (source.split(/\r?\n/).every((line) => /^\s*(?:#.*)?$/.test(line))) {
      context.store.clear();
      return;
    }
    try {
      await strict(file(`./${filePath}`)).load(context);
    } catch (error) {
      const message = (error as Error).message;
      throw new Error(/missing an id or slug/.test(message)
        ? `${filePath} lists each planned episode under its slate number (ST-003:), not as a list`
        : `${filePath}: ${message}`);
    }
    for (const slate of context.store.keys()) {
      if (!SLATE.test(slate)) throw new Error(`${filePath}: "${slate}" is not a slate number like ST-003`);
    }
  },
};

// The home page's words: one entry, under the file's one key, home:. Any other key is refused
// before its contents are checked, so the message names the key rather than the fields it lacks.
const home: Loader = {
  name: 'home-loader',
  load: async (context) => {
    const filePath = `${ROOT}/data/home.yaml`;
    const oneKey = `${filePath} holds the home page's words under one key, home:, and nothing else`;
    const parseData: LoaderContext['parseData'] = async (entry) => {
      if (entry.id !== 'home') throw new Error(`${oneKey} (found ${entry.id})`);
      return context.parseData(entry);
    };
    try {
      await strict(file(`./${filePath}`)).load({ ...context, parseData });
    } catch (error) {
      const message = (error as Error).message;
      throw new Error(message.startsWith(oneKey) ? message : `${filePath}: ${message}`);
    }
    const keys = [...context.store.keys()];
    if (keys.length !== 1 || keys[0] !== 'home') throw new Error(`${oneKey} (found ${keys.join(', ') || 'nothing'})`);
  },
};

export const collections = {
  videos: defineCollection({ loader: markdown('videos'), schema: Video }),
  transcripts: defineCollection({ loader: transcripts, schema: Transcript }),
  articles: defineCollection({ loader: markdown('articles'), schema: Article }),
  projects: defineCollection({ loader: markdown('projects'), schema: Project }),
  upcoming: defineCollection({ loader: upcoming, schema: Upcoming }),
  home: defineCollection({ loader: home, schema: Home }),
};
