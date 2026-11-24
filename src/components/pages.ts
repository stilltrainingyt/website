// What the projects, about, subscribe and torn-out pages show (step 10), from their words files
// in src/data/ and, for the projects page, the project files. Projects.astro, About.astro,
// Subscribe.astro and Missing.astro draw both editions from this.
import { getCollection, getEntry } from 'astro:content';
import { ROOT, site } from './content';

async function wordsFor<T>(found: Promise<{ data: T } | undefined>, file: string, key: string): Promise<T> {
  const entry = await found;
  if (!entry) throw new Error(`${ROOT}/data/${file} has no ${key}: key`);
  return entry.data;
}

export const aboutWords = () => wordsFor(getEntry('about', 'about'), 'about.yaml', 'about');
export const subscribeWords = () => wordsFor(getEntry('subscribe', 'subscribe'), 'subscribe.yaml', 'subscribe');
export const missingWords = () => wordsFor(getEntry('missing', 'missing'), 'missing.yaml', 'missing');

// A count as the design writes it in a sentence: "Eleven". Past twenty, in figures.
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
export const inWords = (count: number): string => WORDS[count] ?? String(count);

// The projects page: every project file in its group, the groups in the order of their first
// project (by order:), each group's projects by order:. Every second group draws its files in
// the design's alternate colour.
export async function projectsContent() {
  const copy = await wordsFor(getEntry('projectsWords', 'projects'), 'projects.yaml', 'projects');
  const projects = (await getCollection('projects')).sort((a, b) => a.data.order - b.data.order || a.data.title.localeCompare(b.data.title));
  const groups: { name: string; files: (typeof projects)[number]['data'][] }[] = [];
  for (const project of projects) {
    const group = groups.find((g) => g.name === project.data.group);
    if (group) group.files.push(project.data);
    else groups.push({ name: project.data.group, files: [project.data] });
  }
  const count = projects.length;
  const lede = count === 0 ? copy.lede.none : count === 1 ? copy.lede.one : copy.lede.some.replaceAll('{count}', inWords(count));
  return {
    copy,
    lede,
    github: site.links.githubPersonal,
    groups: groups.map((group, i) => ({
      eyebrow: copy.group.replaceAll('{group}', group.name).replaceAll('{count}', String(group.files.length)),
      alt: i % 2 === 1,
      files: group.files.map((file) => ({
        kind: file.kind,
        title: file.title,
        summary: file.summary,
        chips: [...file.tags.map((tag) => ({ text: tag, open: false })), ...(file.inProgress ? [{ text: copy.inProgress, open: true }] : [])],
      })),
    })),
  };
}

export type ProjectsContent = Awaited<ReturnType<typeof projectsContent>>;

// The subscribe slip's four links, in the order you approved in step 7.
export async function subscribeContent() {
  const copy = await subscribeWords();
  const { slip } = copy;
  return {
    copy,
    links: [
      { label: slip.youtube, href: site.links.youtube, external: true },
      { label: slip.rss, href: '/rss.xml', external: false },
      { label: slip.github, href: site.links.github, external: true },
      { label: slip.linkedin, href: site.links.linkedin, external: true },
    ],
    elsewhere: [
      { label: copy.elsewhere.youtube, href: site.links.youtube },
      { label: copy.elsewhere.github, href: site.links.github },
      { label: copy.elsewhere.linkedin, href: site.links.linkedin },
    ],
  };
}

export type SubscribeContent = Awaited<ReturnType<typeof subscribeContent>>;
