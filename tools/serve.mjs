// Tiny static server for testing: node tools/serve.mjs [port]
// The app also works from file://; this is only for browsers/tools that block file URLs.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const port = +process.argv[2] || 8080;
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json" };

http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") p = "/login.html";
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403).end(); return; }
  fs.readFile(f, (e, data) => {
    if (e) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": (types[path.extname(f)] || "application/octet-stream") + "; charset=utf-8" }).end(data);
  });
}).listen(port, () => console.log(`Vanguard Table on http://localhost:${port}`));
