import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { createFilesRouter } from './files.js';
import { createImagesRouter, MAX_IMAGE_BYTES } from './images.js';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVXsAAAAASUVORK5CYII=', 'base64');

describe('storage API security', () => {
  let fixtureDir: string;
  let mapsDir: string;
  let outsideDir: string;
  let server: http.Server;
  let baseUrl: string;

  beforeEach(async () => {
    fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notionmind-security-'));
    mapsDir = path.join(fixtureDir, 'maps');
    outsideDir = path.join(fixtureDir, 'outside');
    fs.mkdirSync(outsideDir);
    fs.writeFileSync(path.join(outsideDir, 'secret.md'), '# Private');
    fs.writeFileSync(path.join(outsideDir, 'private.png'), PNG);
    const app = express();
    app.use(express.json());
    app.use(express.text());
    app.use('/api/files', createFilesRouter(mapsDir));
    app.use('/api/images', createImagesRouter(mapsDir));
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', () => resolve()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    // mkdtemp gives this test an isolated absolute target, never the user's maps.
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  function fileUrl(name: string) {
    return `${baseUrl}/api/files/${encodeURIComponent(name)}`;
  }

  function jsonRequest(method: string, body: unknown) {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  it('supports nested folders, map files, metadata, renaming and deletion', async () => {
    expect((await fetch(`${baseUrl}/api/files`, jsonRequest('POST', { folder: 'Ideas/Work' }))).status).toBe(200);
    expect((await fetch(fileUrl('Ideas/Work/map.md'), {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '# Map',
    })).status).toBe(200);
    expect(await (await fetch(fileUrl('Ideas/Work/map.md'))).text()).toBe('# Map');
    expect((await fetch(fileUrl('Ideas/Work/map.md.meta.json'), jsonRequest('POST', { collapsed: [] }))).status).toBe(200);
    expect(await (await fetch(fileUrl('Ideas/Work/map.md.meta.json'))).json()).toEqual({ collapsed: [] });
    expect((await fetch(fileUrl('Ideas/Work/map.md'), jsonRequest('PATCH', { newName: 'Archive/renamed.md' }))).status).toBe(200);
    const listing = await (await fetch(`${baseUrl}/api/files`)).json();
    expect(JSON.stringify(listing)).toContain('Archive/renamed.md');
    expect((await fetch(fileUrl('Archive/renamed.md'), { method: 'DELETE' })).status).toBe(200);
    expect(fs.existsSync(path.join(mapsDir, 'Archive', 'renamed.md'))).toBe(false);
  });

  it('rejects traversal, Windows alternate streams/devices and malformed body paths', async () => {
    for (const name of ['../outside/secret.md', '..\\outside\\secret.md', '/outside/secret.md', 'map.md:hidden.md', 'NUL.md', 'folder./map.md', 'bad\0.md']) {
      expect((await fetch(fileUrl(name), {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '# Intrusion',
      })).status, name).toBe(400);
    }
    expect((await fetch(`${baseUrl}/api/files`, jsonRequest('POST', { folder: 42 }))).status).toBe(400);
    expect(fs.readFileSync(path.join(outsideDir, 'secret.md'), 'utf8')).toBe('# Private');
  });

  it('blocks reads and mutations through directory links and omits link cycles from listings', async () => {
    fs.symlinkSync(outsideDir, path.join(mapsDir, 'linked'), 'junction');
    fs.symlinkSync(mapsDir, path.join(mapsDir, 'cycle'), 'junction');
    fs.writeFileSync(path.join(mapsDir, 'source.md'), '# Source');

    for (const method of ['GET', 'DELETE']) {
      expect((await fetch(fileUrl('linked/secret.md'), { method })).status).toBe(400);
    }
    expect((await fetch(fileUrl('linked/secret.md'), {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '# Intrusion',
    })).status).toBe(400);
    expect((await fetch(fileUrl('source.md'), jsonRequest('PATCH', { newName: 'linked/moved.md' }))).status).toBe(400);
    expect((await fetch(fileUrl('linked/secret.md'), jsonRequest('PATCH', { newName: 'stolen.md' }))).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/files`, jsonRequest('POST', { folder: 'linked/new-folder' }))).status).toBe(400);
    expect(await (await fetch(`${baseUrl}/api/files`)).json()).toEqual([{ name: 'source.md', type: 'file' }]);
    expect(fs.readFileSync(path.join(outsideDir, 'secret.md'), 'utf8')).toBe('# Private');
    expect(fs.existsSync(path.join(outsideDir, 'moved.md'))).toBe(false);
    expect(fs.existsSync(path.join(outsideDir, 'new-folder'))).toBe(false);
  });

  it('blocks image uploads, reads and deletion through an image directory link', async () => {
    fs.symlinkSync(outsideDir, path.join(mapsDir, '_images'), 'junction');
    for (const method of ['GET', 'DELETE']) {
      expect((await fetch(`${baseUrl}/api/images/private.png`, { method })).status).toBe(400);
    }
    expect((await fetch(`${baseUrl}/api/images`, {
      method: 'POST', headers: { 'Content-Type': 'image/png' }, body: PNG,
    })).status).toBe(400);
    expect(fs.readdirSync(outsideDir).sort()).toEqual(['private.png', 'secret.md']);
    expect(fs.readFileSync(path.join(outsideDir, 'private.png'))).toEqual(PNG);
  });

  it('round-trips a valid image and rejects unsupported or mismatched image types', async () => {
    const uploaded = await fetch(`${baseUrl}/api/images`, {
      method: 'POST', headers: { 'Content-Type': 'image/png' }, body: PNG,
    });
    expect(uploaded.status).toBe(200);
    const { filename } = await uploaded.json() as { filename: string };
    const image = await fetch(`${baseUrl}/api/images/${filename}`);
    expect(Buffer.from(await image.arrayBuffer())).toEqual(PNG);
    expect((await fetch(`${baseUrl}/api/images/${filename}`, { method: 'DELETE' })).status).toBe(200);
    for (const [type, body] of [['image/svg+xml', '<svg/>'], ['image/png', 'GIF89a'], ['image/gif', 'GIFinvalid']]) {
      expect((await fetch(`${baseUrl}/api/images`, {
        method: 'POST', headers: { 'Content-Type': type }, body,
      })).status).toBe(400);
    }
    expect((await fetch(`${baseUrl}/api/images/file.svg`)).status).toBe(400);
  });

  it('rejects oversized fixed-length and chunked images without saving them', async () => {
    const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    PNG.copy(oversized);
    const response = await fetch(`${baseUrl}/api/images`, {
      method: 'POST', headers: { 'Content-Type': 'image/png' }, body: oversized,
    });
    expect(response.status).toBe(413);

    const chunkedStatus = await new Promise<number | undefined>((resolve, reject) => {
      const request = http.request(`${baseUrl}/api/images`, {
        method: 'POST', headers: { 'Content-Type': 'image/png', 'Transfer-Encoding': 'chunked' },
      }, response => {
        response.resume();
        response.on('end', () => resolve(response.statusCode));
      });
      request.on('error', reject);
      request.write(oversized.subarray(0, 1024));
      request.end(oversized.subarray(1024));
    });
    expect(chunkedStatus).toBe(413);
    expect(fs.existsSync(path.join(mapsDir, '_images'))).toBe(false);
  });
});
