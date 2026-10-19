import express from 'express';
import cors from 'cors';
import path from 'path';
import filesRouter from './routes/files.js';
import imagesRouter from './routes/images.js';
import { createRequestGuard } from './security.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const trustedOrigins = [
  `http://localhost:${PORT}`,
  `http://127.0.0.1:${PORT}`,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(process.env.CORS_ORIGIN ? [new URL(process.env.CORS_ORIGIN).origin] : []),
];

app.disable('x-powered-by');
app.use(createRequestGuard(trustedOrigins));
app.use(cors({ origin: trustedOrigins }));
// Content Security Policy
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

// Simple in-memory rate limiter for API routes
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 200;
app.use('/api/', (req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    entry = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests, please try again later' });
    return;
  }
  next();
});

app.use(express.json());
app.use(express.text());
app.use('/api/files', filesRouter);
app.use('/api/images', imagesRouter);

// In production, serve the built frontend
const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));
app.get('{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`NotionMind server running on http://127.0.0.1:${PORT}`);
});
