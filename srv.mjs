// Serveur statique minimal pour regarder les figures dans le navigateur.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = process.cwd();
const PORT = Number(process.argv[2] || 4180);
const tipos = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json; charset=utf-8",
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    let path = decodeURIComponent(url.pathname);
    if (path.endsWith("/")) path += "index.html";
    const file = join(ROOT, normalize(path).replace(/^([/\\])+/, ""));
    const info = await stat(file);
    if (info.isDirectory()) throw new Error("dir");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": tipos[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("404");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`http://127.0.0.1:${PORT}/`));
