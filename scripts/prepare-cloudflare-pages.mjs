import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const clientOutput = join(root, "dist", "client");
const serverOutput = join(root, "dist", "server");
const pagesWorker = join(clientOutput, "_worker.js");
const workerDeployConfig = join(root, ".wrangler", "deploy", "config.json");

await rm(pagesWorker, { recursive: true, force: true });
await mkdir(pagesWorker, { recursive: true });
await cp(serverOutput, pagesWorker, { recursive: true });
await rm(join(pagesWorker, "wrangler.json"), { force: true });
await rm(workerDeployConfig, { force: true });

// The vinext-compiled worker only forwards requests to Cloudflare's ASSETS
// binding for paths its own router recognizes (the public/ folder files), not
// for Vite's hashed /assets/*.js and *.css bundles. Without this file, every
// script and stylesheet the page loads 404s, leaving the site unstyled and
// non-interactive. _routes.json tells Cloudflare Pages to serve these paths
// directly as static files without invoking the worker at all.
const RESERVED = new Set(["_worker.js", "_routes.json", "_headers", "_redirects", ".assetsignore", ".vite"]);
const entries = await readdir(clientOutput, { withFileTypes: true });
const exclude = entries
  .filter((entry) => !RESERVED.has(entry.name) && !entry.name.startsWith("."))
  .map((entry) => (entry.isDirectory() ? `/${entry.name}/*` : `/${entry.name}`));

await writeFile(
  join(clientOutput, "_routes.json"),
  JSON.stringify({ version: 1, include: ["/*"], exclude }, null, 2),
);

console.log("Prepared Cloudflare Pages advanced-mode worker.");
