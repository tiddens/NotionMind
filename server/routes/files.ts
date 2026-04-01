import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const MAPS_DIR = process.env.NOTIONMIND_DIR || path.join(process.cwd(), 'maps');

if (!fs.existsSync(MAPS_DIR)) {
  fs.mkdirSync(MAPS_DIR, { recursive: true });
}

function safePath(name: string): string | null {
  const normalized = path.normalize(name).replace(/\\/g, '/');
  if (normalized.startsWith('..') || normalized.startsWith('/') || normalized.includes('/../')) {
    return null;
  }
  return normalized;
}

function safeFile(name: string): string | null {
  const safe = safePath(name);
  if (!safe) return null;
  if (!safe.endsWith('.md') && !safe.endsWith('.meta.json')) return null;
  return safe;
}

interface DirEntry {
  name: string;
  type: 'file' | 'folder';
  children?: DirEntry[];
}

function readDirRecursive(dir: string, prefix = ''): DirEntry[] {
  const entries: DirEntry[] = [];
  let items: string[];
  try { items = fs.readdirSync(dir).sort(); } catch { return entries; }

  for (const item of items) {
    if (item.startsWith('.') || item.startsWith('_')) continue;
    const fullPath = path.join(dir, item);
    const relativePath = prefix ? `${prefix}/${item}` : item;
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      const children = readDirRecursive(fullPath, relativePath);
      entries.push({ name: relativePath, type: 'folder', children });
    } else if (item.endsWith('.md')) {
      entries.push({ name: relativePath, type: 'file' });
    }
  }
  return entries;
}

const router = Router();

// List .md files recursively
router.get('/', (_req: Request, res: Response) => {
  try {
    res.json(readDirRecursive(MAPS_DIR));
  } catch {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Read a file
router.get('/:name', (req: Request, res: Response) => {
  const name = safeFile(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }
  const filePath = path.join(MAPS_DIR, name);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
  try {
    res.type('text/plain').send(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Write/overwrite a file
router.post('/:name', (req: Request, res: Response) => {
  const name = safeFile(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }
  const filePath = path.join(MAPS_DIR, name);
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, typeof req.body === 'string' ? req.body : JSON.stringify(req.body), 'utf-8');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// Delete a file
router.delete('/:name', (req: Request, res: Response) => {
  const name = safeFile(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }
  const filePath = path.join(MAPS_DIR, name);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
  try {
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Rename a file
router.patch('/:name', (req: Request, res: Response) => {
  const name = safeFile(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }
  const filePath = path.join(MAPS_DIR, name);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const newName = safeFile(body.newName);
    if (!newName) { res.status(400).json({ error: 'Invalid new filename' }); return; }
    const newPath = path.join(MAPS_DIR, newName);
    const newDir = path.dirname(newPath);
    if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true });
    fs.renameSync(filePath, newPath);
    res.json({ ok: true, name: newName });
  } catch {
    res.status(500).json({ error: 'Failed to rename file' });
  }
});

// Create a folder
router.post('/', (req: Request, res: Response) => {
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const folderName = safePath(body.folder);
    if (!folderName) { res.status(400).json({ error: 'Invalid folder name' }); return; }
    fs.mkdirSync(path.join(MAPS_DIR, folderName), { recursive: true });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

export default router;
