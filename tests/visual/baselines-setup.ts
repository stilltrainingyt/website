import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { FullConfig } from '@playwright/test';

// Baselines collect every rendering the design files produce, across baseline
// runs, because Chrome on Windows sometimes draws a screen another way for a
// whole run. They are tied to the exact design files: when design-reference/
// changes, the next baseline run starts the collection over.
export default function baselinesSetup(config: FullConfig): void {
  if (config.updateSnapshots !== 'all') return;
  const dir = path.join('tests', 'visual', 'baselines', process.platform);
  const hash = crypto.createHash('sha256');
  for (const file of ['desktop.html', 'pocket.html']) hash.update(fs.readFileSync(path.join('design-reference', file)));
  const fingerprint = hash.digest('hex');
  const stamp = path.join(dir, 'design-reference.sha256');
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === fingerprint) return;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(stamp, `${fingerprint}\n`);
}
