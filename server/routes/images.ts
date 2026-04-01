import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const MAPS_DIR = process.env.NOTIONMIND_DIR || path.join(process.cwd(), 'maps');
const IMAGES_DIR = path.join(MAPS_DIR, '_images');

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

function safeImageName(name: string): string | null {
  const base = path.basename(name);
  if (base.includes('..') || base.startsWith('.')) return null;
  if (!/^[\w-]+\.\w+$/.test(base)) return null;
  return base;
}

const router = Router();

// Upload an image (raw binary body with Content-Type header)
router.post('/', (req: Request, res: Response) => {
  const contentType = req.headers['content-type'] || '';
  const ext = ALLOWED_TYPES[contentType];
  if (!ext) {
    res.status(400).json({ error: `Unsupported image type: ${contentType}` });
    return;
  }

  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      if (buffer.length === 0) { res.status(400).json({ error: 'Empty body' }); return; }
      if (buffer.length > 10 * 1024 * 1024) { res.status(400).json({ error: 'Image too large (max 10MB)' }); return; }

      const filename = crypto.randomBytes(8).toString('hex') + ext;
      fs.writeFileSync(path.join(IMAGES_DIR, filename), buffer);
      res.json({ ok: true, filename });
    } catch {
      res.status(500).json({ error: 'Failed to save image' });
    }
  });
});

// Serve an image
router.get('/:name', (req: Request, res: Response) => {
  const name = safeImageName(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }

  const filePath = path.join(IMAGES_DIR, name);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }

  res.sendFile(filePath);
});

// Delete an image
router.delete('/:name', (req: Request, res: Response) => {
  const name = safeImageName(req.params.name);
  if (!name) { res.status(400).json({ error: 'Invalid filename' }); return; }

  const filePath = path.join(IMAGES_DIR, name);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }

  try {
    fs.unlinkSync(filePath);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

export default router;
