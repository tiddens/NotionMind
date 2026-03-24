import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const MAPS_DIR = process.env.NOTIONMIND_DIR || path.join(process.cwd(), 'maps');

// Ensure directory exists
if (!fs.existsSync(MAPS_DIR)) {
  fs.mkdirSync(MAPS_DIR, { recursive: true });
}

function safePath(name: string): string | null {
  // Allow subdirectory paths like "folder/file.md" but prevent traversal
  const normalized = path.normalize(name).replace(/\\/g, '/');
  if (normalized.startsWith('..') || normalized.startsWith('/') || normalized.includes('/../')) {
    return null;
  }
  return normalized;
}

function safeName(name: string): string | null {
  const safe = safePath(name);
  if (!safe || !safe.endsWith('.md')) return null;
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
  try {
    items = fs.readdirSync(dir).sort();
  } catch {
    return entries;
  }

  for (const item of items) {
    if (item.startsWith('.')) continue;
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

// List all files and folders recursively
router.get('/', (_req: Request, res: Response) => {
  try {
    const tree = readDirRecursive(MAPS_DIR);
    res.json(tree);
  } catch {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// Read a file (supports subpaths like folder/file.md)
router.get('/:name', (req: Request, res: Response) => {
  const name = safeName(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }

  const filePath = path.join(MAPS_DIR, name);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    res.type('text/plain').send(content);
  } catch {
    res.status(500).json({ error: 'Failed to read file' });
  }
});

// Write/overwrite a file (auto-creates parent folders)
router.post('/:name', (req: Request, res: Response) => {
  const name = safeName(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }

  const filePath = path.join(MAPS_DIR, name);
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf-8');
      fs.writeFileSync(filePath, body, 'utf-8');
      res.json({ ok: true });
    });
  } catch {
    res.status(500).json({ error: 'Failed to write file' });
  }
});

// Delete a file
router.delete('/:name', (req: Request, res: Response) => {
  const name = safeName(req.params.name);
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
  const name = safeName(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }

  const filePath = path.join(MAPS_DIR, name);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const newName = safeName(body.newName);
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
});

// Create a folder
router.post('/', (req: Request, res: Response) => {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      const folderName = safePath(body.folder);
      if (!folderName) { res.status(400).json({ error: 'Invalid folder name' }); return; }

      const folderPath = path.join(MAPS_DIR, folderName);
      fs.mkdirSync(folderPath, { recursive: true });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to create folder' });
    }
  });
});

export default router;
