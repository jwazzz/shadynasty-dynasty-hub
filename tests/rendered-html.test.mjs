import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the league homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Shadynasty Dynasty League<\/title>/i);
  assert.match(html, /League Hub/);
  assert.match(html, /Week 1 kickoff/);
  assert.match(html, /Cut Tracker/);
  assert.match(html, /href="\/rosters"/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Building your site/i);
});

test("keeps live sheet requests cacheable", async () => {
  const [component, route, layout] = await Promise.all([
    readFile(new URL("../app/components/LeagueSite.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/sheet/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(component, /fetch\(`\/api\/sheet\?tab=\$\{encodeURIComponent\(tabKey\)\}`\)/);
  assert.doesNotMatch(component, /Date\.now\(\).*api\/sheet|cache:\s*"no-store"/);
  assert.match(route, /const sheetCache = new Map/);
  assert.match(route, /stale-while-revalidate=300/);
  assert.match(route, /getSheetCache\(requestedTab, true\)/);
  assert.doesNotMatch(layout, /from "next\/headers"|generateMetadata|headers\(/);
});
