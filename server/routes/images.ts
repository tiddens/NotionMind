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
};

function safeImageName(name: string): string | null {
  const base = path.basename(name);
  if (base !== name) return null; // reject if path separators were stripped
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

      // Validate magic bytes match declared Content-Type
      const magicValid =
        (contentType === 'image/png' && buffer.length >= 4 && buffer.subarray(0, 4).toString('hex') === '89504e47') ||
        (contentType === 'image/jpeg' && buffer.length >= 3 && buffer.subarray(0, 3).toString('hex') === 'ffd8ff') ||
        (contentType === 'image/gif' && buffer.length >= 3 && buffer.subarray(0, 3).toString('ascii') === 'GIF') ||
        (contentType === 'image/webp' && buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP');
      if (!magicValid) { res.status(400).json({ error: 'File content does not match declared Content-Type' }); return; }

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
