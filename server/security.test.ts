import express from 'express';
import type { Server } from 'node:http';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequestGuard } from './security.js';

describe('local server request protection', () => {
  let server: Server;
  let baseURL: string;
  let writes = 0;

  beforeAll(async () => {
    const app = express();
    app.use(createRequestGuard(['http://localhost:5173', 'http://127.0.0.1:3001']));
    app.post('/api/files/example.md', (_req, res) => {
      writes++;
      res.json({ ok: true });
    });
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, '127.0.0.1', error => error ? reject(error) : resolve());
    });
    baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });

  async function write(headers: Record<string, string>) {
    return new Promise<{ status: number | undefined }>((resolve, reject) => {
      const req = request(`${baseURL}/api/files/example.md`, {
        method: 'POST',
        headers: { host: '127.0.0.1:3001', 'content-type': 'text/plain', ...headers },
      }, res => {
        res.resume();
        res.on('end', () => resolve({ status: res.statusCode }));
      });
      req.on('error', reject);
      req.end('# Example');
    });
  }

  it.each<Record<string, string>>([
    { origin: 'https://attacker.example' },
    { origin: 'null' },
    { origin: 'http://localhost:5173.attacker.example' },
    { host: 'attacker.example:3001' },
    { 'sec-fetch-site': 'cross-site' },
  ])('rejects hostile browser requests before a file can be written: %j', async headers => {
    const before = writes;
    const response = await write(headers);
    expect(response.status).toBe(403);
    expect(writes).toBe(before);
  });

  it('allows the local frontend to save via the dev proxy', async () => {
    const before = writes;
    const response = await write({ host: 'localhost:5173', origin: 'http://localhost:5173' });
    expect(response.status).toBe(200);
    expect(writes).toBe(before + 1);
  });

  it('allows the built frontend on the API origin', async () => {
    expect((await write({ origin: 'http://127.0.0.1:3001' })).status).toBe(200);
  });

  it('allows local command-line clients without an Origin header', async () => {
    expect((await write({})).status).toBe(200);
  });
});
