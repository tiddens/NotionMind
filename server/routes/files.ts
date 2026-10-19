import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createStorageRoot, safeStoragePath } from '../storage.js';

interface DirEntry {
  name: string;
  type: 'file' | 'folder';
  children?: DirEntry[];
}

export function createFilesRouter(directory: string) {
  const mapsDir = createStorageRoot(directory);
  const router = Router();

  function safeFile(name: unknown): string | null {
    if (typeof name !== 'string' || (!name.endsWith('.md') && !name.endsWith('.meta.json'))) return null;
    return safeStoragePath(mapsDir, name);
  }

  function readDirRecursive(prefix = ''): DirEntry[] {
    const dir = prefix ? safeStoragePath(mapsDir, prefix) : mapsDir;
    if (!dir) return [];
    const entries: DirEntry[] = [];
    for (const item of fs.readdirSync(dir).sort()) {
      if (item.startsWith('.') || item.startsWith('_')) continue;
      const relativePath = prefix ? `${prefix}/${item}` : item;
      const fullPath = safeStoragePath(mapsDir, relativePath);
      if (!fullPath) continue;
      const stat = fs.lstatSync(fullPath);
      if (stat.isDirectory()) {
        entries.push({ name: relativePath, type: 'folder', children: readDirRecursive(relativePath) });
      } else if (stat.isFile() && item.endsWith('.md')) {
        entries.push({ name: relativePath, type: 'file' });
      }
    }
    return entries;
  }

  router.get('/', (_req, res) => {
    try {
      res.json(readDirRecursive());
    } catch {
      res.status(500).json({ error: 'Failed to list files' });
    }
  });

  router.get('/:name', (req, res) => {
    const filePath = safeFile(req.params.name);
    if (!filePath) { res.status(400).json({ error: 'Invalid filename' }); return; }
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
    try {
      res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  router.post('/:name', (req, res) => {
    const filePath = safeFile(req.params.name);
    if (!filePath) { res.status(400).json({ error: 'Invalid filename' }); return; }
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, typeof req.body === 'string' ? req.body : JSON.stringify(req.body), 'utf-8');
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to write file' });
    }
  });

  router.delete('/:name', (req, res) => {
    const filePath = safeFile(req.params.name);
    if (!filePath) { res.status(400).json({ error: 'Invalid filename' }); return; }
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
    try {
      fs.unlinkSync(filePath);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete file' });
    }
  });

  router.patch('/:name', (req, res) => {
    const filePath = safeFile(req.params.name);
    if (!filePath) { res.status(400).json({ error: 'Invalid filename' }); return; }
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const newPath = safeFile(body?.newName);
      if (!newPath) { res.status(400).json({ error: 'Invalid new filename' }); return; }
      fs.mkdirSync(path.dirname(newPath), { recursive: true });
      fs.renameSync(filePath, newPath);
      res.json({ ok: true, name: path.relative(mapsDir, newPath).split(path.sep).join('/') });
    } catch {
      res.status(500).json({ error: 'Failed to rename file' });
    }
  });

  router.post('/', (req, res) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      const folderPath = safeStoragePath(mapsDir, body?.folder);
      if (!folderPath) { res.status(400).json({ error: 'Invalid folder name' }); return; }
      fs.mkdirSync(folderPath, { recursive: true });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to create folder' });
    }
  });

  return router;
}

export default createFilesRouter(process.env.NOTIONMIND_DIR || path.join(process.cwd(), 'maps'));
