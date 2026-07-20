import { cp, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const serverOutput = join(root, "dist", "server");
const pagesWorker = join(root, "dist", "client", "_worker.js");
const workerDeployConfig = join(root, ".wrangler", "deploy", "config.json");

await rm(pagesWorker, { recursive: true, force: true });
await mkdir(pagesWorker, { recursive: true });
await cp(serverOutput, pagesWorker, { recursive: true });
await rm(join(pagesWorker, "wrangler.json"), { force: true });
await rm(workerDeployConfig, { force: true });

console.log("Prepared Cloudflare Pages advanced-mode worker.");
