import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

// Extensionless imports must resolve to the same module on Windows and Linux.
// E.g. Channels.tsx and channels.ts collide on a case-insensitive filesystem.
it('los módulos de src no tienen nombres ambiguos en Windows', () => {
  const root = fileURLToPath(new URL('../../src/', import.meta.url));
  const paths: string[] = [];
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) paths.push(relative(root, path));
    }
  }
  visit(root);
  const modules = new Map<string, string[]>();
  for (const path of paths) {
    const key = path.replace(/\.[cm]?[jt]sx?$/, '').toLowerCase();
    modules.set(key, [...(modules.get(key) ?? []), path]);
  }
  expect([...modules.values()].filter(files => files.length > 1)).toEqual([]);
});
