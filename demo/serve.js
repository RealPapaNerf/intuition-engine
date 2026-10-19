// Tiny static server so the demo's ES-module imports work (browsers block
// module imports over file://). No dependencies: `npm run demo`.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.md': 'text/plain',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(
    /^(\.\.[/\\])+/,
    '',
  );
  const file = join(root, path === '/' ? '/demo/index.html' : path);
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': types[extname(file)] ?? 'application/octet-stream',
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(8123, () => {
  console.log('Frog bridge demo: http://localhost:8123/demo/index.html');
});
