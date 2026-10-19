import fs from 'node:fs';
import path from 'node:path';

export function createStorageRoot(directory: string): string {
  fs.mkdirSync(directory, { recursive: true });
  // The configured root is trusted; all user-selected paths below it are checked.
  return fs.realpathSync(directory);
}

export function safeStoragePath(root: string, name: unknown): string | null {
  if (typeof name !== 'string' || !name || name.includes('\\')) return null;
  const segments = name.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..'
    || [...segment].some(character => character.charCodeAt(0) < 32)
    || /[<>:"|?*]/.test(segment) || /[. ]$/.test(segment)
    || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) return null;

  const resolved = path.resolve(root, ...segments);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;

  try {
    const rootStat = fs.lstatSync(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return null;
    let current = root;
    for (let index = 0; index < segments.length; index++) {
      current = path.join(current, segments[index]);
      let stat: fs.Stats;
      try {
        stat = fs.lstatSync(current);
      } catch (error) {
        // Once a component is absent, descendants cannot already be links.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return resolved;
        return null;
      }
      if (stat.isSymbolicLink()) return null;
      if (index < segments.length - 1 && !stat.isDirectory()) return null;
    }
    return resolved;
  } catch {
    return null;
  }
}
