import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("builds the Rental Tracker mobile capture shell", async () => {
  const [layout, component] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MobileCaptureApp.tsx", import.meta.url), "utf8"),
    access(new URL("../dist/server/index.js", import.meta.url)),
  ]);
  assert.match(layout, /title: "Rental Tracker Companion"/);
  assert.match(component, /Receipt in\. Paperwork done\./);
  assert.match(component, /Send to Mobile Inbox/);
  assert.doesNotMatch(`${layout}\n${component}`, /Your site is taking shape|react-loading-skeleton/i);
});

test("declares private-storage boundaries and a mobile manifest", async () => {
  const [hosting, manifest, desktopRoute, worker] = await Promise.all([
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../public/manifest.webmanifest", import.meta.url), "utf8"),
    readFile(new URL("../app/api/desktop/submissions/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);
  const hostingConfig = JSON.parse(hosting);
  assert.equal(hostingConfig.d1, "DB");
  assert.equal(hostingConfig.r2, "UPLOADS");
  assert.match(hostingConfig.project_id, /^appgprj_/);
  assert.equal(JSON.parse(manifest).display, "standalone");
  assert.match(desktopRoute, /requireDesktopAuthorization/);
  assert.match(worker, /UPLOADS: R2Bucket/);
});
