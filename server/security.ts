import type { RequestHandler } from 'express';

// Check the Host as well as Origin: a hostile site can otherwise reach a local
// server through DNS rebinding, and CORS alone does not stop simple POST writes.
export function createRequestGuard(trustedOrigins: string[]): RequestHandler {
  const origins = new Set(trustedOrigins.map(origin => new URL(origin).origin));
  const hosts = new Set([...origins].map(origin => new URL(origin).host));

  return (req, res, next) => {
    const host = req.get('host')?.toLowerCase();
    if (!host || !hosts.has(host)) {
      res.status(403).json({ error: 'Untrusted host' });
      return;
    }

    const origin = req.get('origin');
    if ((origin !== undefined && !origins.has(origin)) ||
        (origin === undefined && req.get('sec-fetch-site') === 'cross-site')) {
      res.status(403).json({ error: 'Untrusted origin' });
      return;
    }

    next();
  };
}
