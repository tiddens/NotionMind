import { Router, raw } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createStorageRoot, safeStoragePath } from '../storage.js';

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
};

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function createImagesRouter(directory: string) {
  const mapsDir = createStorageRoot(directory);
  const router = Router();
  const parseImage = raw({ type: () => true, limit: MAX_IMAGE_BYTES, inflate: false });

  function safeImagePath(name: unknown): string | null {
    if (typeof name !== 'string' || !/^[\w-]+\.(png|jpg|jpeg|gif|webp)$/i.test(name)) return null;
    return safeStoragePath(mapsDir, `_images/${name}`);
  }

  router.post('/', (req, res) => {
    const contentType = req.headers['content-type'] || '';
    const ext = ALLOWED_TYPES[contentType];
    if (!ext) { res.status(400).json({ error: 'Unsupported image type' }); return; }

    // raw-body enforces the limit while consuming the stream, including chunked uploads.
    parseImage(req, res, error => {
      if (error) {
        const tooLarge = error.type === 'entity.too.large';
        res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Image too large (max 10MB)' : 'Invalid image body' });
        return;
      }
      try {
        const buffer = req.body;
        if (!Buffer.isBuffer(buffer) || buffer.length === 0) { res.status(400).json({ error: 'Empty body' }); return; }

        const magicValid =
          (contentType === 'image/png' && buffer.length >= 8 && buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') ||
          (contentType === 'image/jpeg' && buffer.length >= 3 && buffer.subarray(0, 3).toString('hex') === 'ffd8ff') ||
          (contentType === 'image/gif' && buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0, 6).toString('ascii'))) ||
          (contentType === 'image/webp' && buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP');
        if (!magicValid) { res.status(400).json({ error: 'File content does not match declared Content-Type' }); return; }

        const filename = crypto.randomBytes(16).toString('hex') + ext;
        const filePath = safeImagePath(filename);
        if (!filePath) { res.status(400).json({ error: 'Invalid image directory' }); return; }
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, buffer, { flag: 'wx' });
        res.json({ ok: true, filename });
      } catch {
        res.status(500).json({ error: 'Failed to save image' });
      }
    });
  });

  router.get('/:name', (req, res) => {
    const filePath = safeImagePath(req.params.name);
    if (!filePath) { res.status(400).json({ error: 'Invalid filename' }); return; }
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
    res.sendFile(filePath);
  });

  router.delete('/:name', (req, res) => {
    const filePath = safeImagePath(req.params.name);
    if (!filePath) { res.status(400).json({ error: 'Invalid filename' }); return; }
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Not found' }); return; }
    try {
      fs.unlinkSync(filePath);
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: 'Failed to delete image' });
    }
  });

  return router;
}

export default createImagesRouter(process.env.NOTIONMIND_DIR || path.join(process.cwd(), 'maps'));
