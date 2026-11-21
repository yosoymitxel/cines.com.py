import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.json':'application/json; charset=utf-8' };
const rawBasePath = String(process.env.BASE_PATH || '/cines.com.py/').replace(/^\/+|\/+$/g, '');
const basePath = rawBasePath ? `/${rawBasePath}/` : '/';
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === basePath.slice(0, -1)) pathname = '/';
    if (pathname.startsWith(basePath)) pathname = `/${pathname.slice(basePath.length)}`;
    let target = path.resolve(root, `.${pathname}`);
    if (!target.startsWith(root)) throw new Error('Invalid path');
    let stat;
    try { stat = await fs.stat(target); } catch { target = path.join(root, pathname, 'index.html'); stat = await fs.stat(target); }
    if (stat.isDirectory()) target = path.join(target, 'index.html');
    const ext = path.extname(target);
    res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(await fs.readFile(target));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Preview: http://127.0.0.1:${process.env.PORT || 4173}`));
